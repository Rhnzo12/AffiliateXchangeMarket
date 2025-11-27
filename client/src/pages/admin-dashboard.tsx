import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Users, Building2, TrendingUp, AlertCircle, CheckCircle2, Bell, AlertTriangle, ShieldAlert, ShieldCheck } from "lucide-react";
import { Link } from "wouter";
import { TopNavBar } from "../components/TopNavBar";
import { StatsGridSkeleton } from "../components/skeletons";
import { apiRequest } from "../lib/queryClient";
import { GenericErrorDialog } from "../components/GenericErrorDialog";

export default function AdminDashboard() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [errorDialog, setErrorDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
  }>({
    open: false,
    title: "",
    description: "",
  });

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setErrorDialog({
        open: true,
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [isAuthenticated, isLoading]);

  const { data: stats, isLoading: statsLoading } = useQuery<any>({
    queryKey: ["/api/admin/stats"],
    queryFn: async () => {
      const response = await fetch("/api/admin/stats", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch admin stats");
      return response.json();
    },
    enabled: isAuthenticated,
  });

  // Fetch companies with risk assessments
  const { data: riskData, isLoading: riskLoading } = useQuery<{
    companies: Array<{
      id: string;
      legalName: string;
      tradeName?: string;
      riskScore: number;
      riskLevel: 'high' | 'medium' | 'low';
      riskIndicators: string[];
    }>;
    summary: {
      total: number;
      highRisk: number;
      mediumRisk: number;
      lowRisk: number;
    };
  }>({
    queryKey: ["/api/admin/companies/risk-assessments"],
    queryFn: async () => {
      const response = await fetch("/api/admin/companies/risk-assessments", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch risk assessments");
      return response.json();
    },
    enabled: isAuthenticated,
  });

  const notifyPendingItemsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/notify-pending-items");
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: `Sent ${data.notificationsSent} notifications for ${data.pendingOffers} pending offers and ${data.pendingPayments} pending payments.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread/count"] });
    },
    onError: (error: Error) => {
      setErrorDialog({
        open: true,
        title: "Error",
        description: error.message || "Failed to send notifications",
      });
    },
  });

  const checkHighRiskMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/check-high-risk-companies");
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Risk Check Complete",
        description: `Found ${data.highRiskCount} high-risk companies. ${data.notificationsSent} new notifications sent.`,
        variant: data.highRiskCount > 0 ? "destructive" : "default",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread/count"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/companies/risk-assessments"] });
    },
    onError: (error: Error) => {
      setErrorDialog({
        open: true,
        title: "Error",
        description: error.message || "Failed to check high-risk companies",
      });
    },
  });

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="animate-pulse text-lg">Loading...</div>
    </div>;
  }

  return (
    <div className="space-y-8">
      <TopNavBar />
      <div>
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground mt-1">Platform oversight and moderation</p>
      </div>

      {statsLoading ? (
        <StatsGridSkeleton />
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <Card className="border-card-border">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Creators</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalCreators || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats?.newCreatorsThisWeek || 0} this week
              </p>
            </CardContent>
          </Card>

          <Card className="border-card-border">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Companies</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalCompanies || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats?.newCompaniesThisWeek || 0} this week
              </p>
            </CardContent>
          </Card>

          <Card className="border-card-border">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Companies</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{stats?.pendingCompanies || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Require review</p>
            </CardContent>
          </Card>

          <Card className="border-card-border">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Offers</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{stats?.pendingOffers || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Awaiting approval</p>
            </CardContent>
          </Card>

          <Card className="border-card-border">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Offers</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.activeOffers || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Live on platform</p>
            </CardContent>
          </Card>

          <Card className="border-card-border">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Company Risk</CardTitle>
              <ShieldAlert className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1" title="High Risk">
                  <ShieldAlert className="h-4 w-4 text-red-500" />
                  <span className="text-lg font-bold text-red-600">{riskData?.summary?.highRisk || 0}</span>
                </div>
                <div className="flex items-center gap-1" title="Medium Risk">
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  <span className="text-lg font-bold text-yellow-600">{riskData?.summary?.mediumRisk || 0}</span>
                </div>
                <div className="flex items-center gap-1" title="Low Risk">
                  <ShieldCheck className="h-4 w-4 text-green-500" />
                  <span className="text-lg font-bold text-green-600">{riskData?.summary?.lowRisk || 0}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">High / Medium / Low</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Quick Access Section */}
      <Card className="border-card-border">
        <CardHeader>
          <CardTitle>Quick Access</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4 mb-4">
            <Link to="/admin/reviews">
              <Button variant="outline" className="w-full h-auto py-6 flex flex-col gap-2" data-testid="button-manage-reviews">
                <AlertCircle className="h-6 w-6" />
                <span>Manage Reviews</span>
                <span className="text-xs text-muted-foreground">View, edit, approve reviews</span>
              </Button>
            </Link>
            <Link to="/admin/companies">
              <Button variant="outline" className="w-full h-auto py-6 flex flex-col gap-2" data-testid="button-manage-companies">
                <Building2 className="h-6 w-6" />
                <span>Manage Companies</span>
                <span className="text-xs text-muted-foreground">Approve or reject companies</span>
              </Button>
            </Link>
            <Link to="/admin/offers">
              <Button variant="outline" className="w-full h-auto py-6 flex flex-col gap-2" data-testid="button-manage-offers">
                <TrendingUp className="h-6 w-6" />
                <span>Manage Offers</span>
                <span className="text-xs text-muted-foreground">Review and approve offers</span>
              </Button>
            </Link>
          </div>
          <div className="border-t pt-4">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => notifyPendingItemsMutation.mutate()}
              disabled={notifyPendingItemsMutation.isPending}
            >
              <Bell className="h-4 w-4 mr-2" />
              {notifyPendingItemsMutation.isPending ? "Sending Notifications..." : "Refresh Pending Notifications"}
            </Button>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Manually trigger notifications for existing pending offers and payments
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="border-card-border">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Pending Company Approvals</CardTitle>
            <Badge variant="secondary">{stats?.pendingCompanies || 0}</Badge>
          </CardHeader>
          <CardContent>
            {stats?.pendingCompanies > 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground mb-4">
                  Companies waiting for verification
                </p>
                <Link to="/admin/companies">
                  <Button variant="outline" className="w-full" data-testid="button-review-companies">
                    Review Companies
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="text-center py-8">
                <CheckCircle2 className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">All caught up!</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-card-border">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Pending Offers</CardTitle>
            <Badge variant="secondary">{stats?.pendingOffers || 0}</Badge>
          </CardHeader>
          <CardContent>
            {stats?.pendingOffers > 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground mb-4">
                  Offers waiting for review
                </p>
                <Link to="/admin/offers">
                  <Button variant="outline" className="w-full" data-testid="button-review-offers">
                    Review Offers
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="text-center py-8">
                <CheckCircle2 className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">All caught up!</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Company Risk Overview Section */}
      <Card className="border-card-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Company Risk Overview</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="destructive">{riskData?.summary?.highRisk || 0}</Badge>
            <Badge className="bg-yellow-500 hover:bg-yellow-600">{riskData?.summary?.mediumRisk || 0}</Badge>
            <Badge className="bg-green-500 hover:bg-green-600">{riskData?.summary?.lowRisk || 0}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {riskLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-pulse text-sm text-muted-foreground">Loading risk assessments...</div>
            </div>
          ) : (riskData?.companies?.length || 0) > 0 ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                All companies sorted by risk score. High-risk companies may require platform fee adjustments.
              </p>
              <div className="space-y-3">
                {riskData?.companies?.slice(0, 8).map((company) => {
                  const isHigh = company.riskLevel === 'high';
                  const isMedium = company.riskLevel === 'medium';
                  const borderClass = isHigh
                    ? 'border-red-100 dark:border-red-900 bg-red-50/50 dark:bg-red-950/20'
                    : isMedium
                    ? 'border-yellow-100 dark:border-yellow-900 bg-yellow-50/50 dark:bg-yellow-950/20'
                    : 'border-green-100 dark:border-green-900 bg-green-50/50 dark:bg-green-950/20';
                  const iconBgClass = isHigh
                    ? 'bg-red-100 dark:bg-red-900/50'
                    : isMedium
                    ? 'bg-yellow-100 dark:bg-yellow-900/50'
                    : 'bg-green-100 dark:bg-green-900/50';
                  const textColorClass = isHigh
                    ? 'text-red-600 dark:text-red-400'
                    : isMedium
                    ? 'text-yellow-600 dark:text-yellow-400'
                    : 'text-green-600 dark:text-green-400';
                  const buttonClass = isHigh
                    ? 'border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-950'
                    : isMedium
                    ? 'border-yellow-200 text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-950'
                    : 'border-green-200 text-green-600 hover:bg-green-50 dark:hover:bg-green-950';

                  return (
                    <div
                      key={company.id}
                      className={`flex items-center justify-between p-3 rounded-lg border ${borderClass}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${iconBgClass} shrink-0`}>
                          {isHigh ? (
                            <ShieldAlert className={`h-5 w-5 ${textColorClass}`} />
                          ) : isMedium ? (
                            <AlertTriangle className={`h-5 w-5 ${textColorClass}`} />
                          ) : (
                            <ShieldCheck className={`h-5 w-5 ${textColorClass}`} />
                          )}
                        </div>
                        <div>
                          <div className="font-medium">{company.legalName}</div>
                          {company.riskIndicators.length > 0 ? (
                            <div className={`text-xs ${textColorClass} mt-1`}>
                              {company.riskIndicators[0]}
                              {company.riskIndicators.length > 1 && ` +${company.riskIndicators.length - 1} more`}
                            </div>
                          ) : (
                            <div className={`text-xs ${textColorClass} mt-1`}>
                              {isHigh ? 'High risk' : isMedium ? 'Medium risk' : 'Low risk'}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className={`text-lg font-bold ${textColorClass}`}>{company.riskScore}</div>
                          <div className="text-xs text-muted-foreground">Risk Score</div>
                        </div>
                        <Link to={`/admin/companies/${company.id}`}>
                          <Button variant="outline" size="sm" className={buttonClass}>
                            Review
                          </Button>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
              {(riskData?.companies?.length || 0) > 8 && (
                <Link to="/admin/companies">
                  <Button variant="outline" className="w-full mt-4">
                    View All {riskData?.companies?.length} Companies
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <CheckCircle2 className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No companies to assess</p>
              <p className="text-xs text-muted-foreground mt-1">Approved companies will appear here with risk assessments</p>
            </div>
          )}
          <div className="border-t pt-4 mt-4">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => checkHighRiskMutation.mutate()}
              disabled={checkHighRiskMutation.isPending}
            >
              <ShieldAlert className="h-4 w-4 mr-2" />
              {checkHighRiskMutation.isPending ? "Checking Risk Levels..." : "Check & Notify High Risk Companies"}
            </Button>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Scan all companies for high-risk indicators and send admin notifications
            </p>
          </div>
        </CardContent>
      </Card>

      <GenericErrorDialog
        open={errorDialog.open}
        onOpenChange={(open) => setErrorDialog({ ...errorDialog, open })}
        title={errorDialog.title}
        description={errorDialog.description}
        variant="error"
      />
    </div>
  );
}
