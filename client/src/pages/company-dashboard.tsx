import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Users, FileText, TrendingUp, DollarSign, Plus, CheckCircle, MousePointer, AlertTriangle, Clock } from "lucide-react";
import { Link } from "wouter";
import { apiRequest, queryClient } from "../lib/queryClient";
import { formatDistanceToNow } from "date-fns";
import { TopNavBar } from "../components/TopNavBar";
import { StatsGridSkeleton, ListItemSkeleton } from "../components/skeletons";
import { GenericErrorDialog } from "../components/GenericErrorDialog";
import { FirstTimeTutorial } from "../components/FirstTimeTutorial";
import { useTutorial } from "../hooks/useTutorial";
import { TUTORIAL_IDS, companyDashboardTutorialConfig } from "../lib/tutorialConfig";
import { usePageTour } from "../components/CompanyTour";
import { COMPANY_TOUR_IDS, dashboardTourSteps } from "../lib/companyTourConfig";

export default function CompanyDashboard() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading, user } = useAuth();
  const [errorDialog, setErrorDialog] = useState<{ title: string; message: string } | null>(null);
  const { showTutorial, completeTutorial } = useTutorial(TUTORIAL_IDS.COMPANY_DASHBOARD);

  // Quick tour for new company accounts - only start after tutorial is dismissed
  usePageTour(COMPANY_TOUR_IDS.DASHBOARD, dashboardTourSteps, !showTutorial);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setErrorDialog({
        title: "Unauthorized",
        message: "You are logged out. Logging in again...",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [isAuthenticated, isLoading]);

  const { data: stats, isLoading: statsLoading } = useQuery<any>({
    queryKey: ["/api/company/stats"],
    enabled: isAuthenticated,
  });

  const { data: applications = [], isLoading: loadingApplications } = useQuery<any[]>({
    queryKey: ["/api/company/applications"],
    enabled: isAuthenticated,
  });

  const completeApplicationMutation = useMutation({
    mutationFn: async (applicationId: string) => {
      return await apiRequest('POST', `/api/applications/${applicationId}/complete`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company/applications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/company/stats"] });
      toast({
        title: "Work Approved",
        description: "Creator work has been marked as complete.",
      });
    },
    onError: (error: any) => {
      setErrorDialog({
        title: "Error",
        message: error.message || "Failed to mark work as complete",
      });
    },
  });

  const handleMarkComplete = (applicationId: string, creatorName: string) => {
    if (confirm(`Mark work as complete for ${creatorName}? This action cannot be undone.`)) {
      completeApplicationMutation.mutate(applicationId);
    }
  };

  // Calculate top performing creators (by total clicks)
  const topCreators = applications
    .filter((app: any) => app.status === 'approved' || app.status === 'active')
    .reduce((acc: any[], app: any) => {
      // Group by creator
      const existing = acc.find((c: any) => c.creatorId === app.creatorId);
      if (existing) {
        existing.totalClicks += Number(app.clickCount || 0);
        existing.totalConversions += Number(app.conversionCount || 0);
        existing.totalEarnings += Number(app.totalEarnings || 0);
        existing.applicationsCount += 1;
      } else {
        acc.push({
          creatorId: app.creatorId,
          creatorName: app.creatorName || `${app.creator?.firstName} ${app.creator?.lastName}`.trim() || 'Unknown',
          creatorEmail: app.creatorEmail || app.creator?.email,
          creatorProfileImageUrl: app.creator?.profileImageUrl,
          totalClicks: Number(app.clickCount || 0),
          totalConversions: Number(app.conversionCount || 0),
          totalEarnings: Number(app.totalEarnings || 0),
          applicationsCount: 1,
        });
      }
      return acc;
    }, [])
    .sort((a: any, b: any) => b.totalClicks - a.totalClicks)
    .slice(0, 5); // Top 5 creators

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="animate-pulse text-lg">Loading...</div>
    </div>;
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <TopNavBar />

      {/* Company Approval Pending - Slim notification banner */}
      {stats?.companyProfile?.status === 'pending' && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-800">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-500 shrink-0" />
          <p className="flex-1 text-sm text-amber-800 dark:text-amber-200">
            <span className="font-medium">Company Approval Pending:</span> Your company registration is under review. You'll be able to create offers once approved.
          </p>
          <Badge variant="outline" className="border-amber-400 text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/50">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Company Dashboard</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">Manage your offers and track creator performance</p>
        </div>
        {stats?.companyProfile?.status === 'pending' ? (
          <Button
            className="gap-2 w-full h-11 sm:w-auto sm:h-10"
            data-testid="button-create-offer"
            disabled
            title="Your company must be approved before creating offers"
          >
            <Plus className="h-5 w-5 sm:h-4 sm:w-4" />
            <span className="text-base sm:text-sm">Create New Offer</span>
          </Button>
        ) : (
          <Link href="/company/offers/create" className="w-full sm:w-auto">
            <Button className="gap-2 w-full h-11 sm:w-auto sm:h-10" data-testid="button-create-offer">
              <Plus className="h-5 w-5 sm:h-4 sm:w-4" />
              <span className="text-base sm:text-sm">Create New Offer</span>
            </Button>
          </Link>
        )}
      </div>

      {/* Stats Grid - Improved mobile spacing */}
      {statsLoading ? (
        <StatsGridSkeleton />
      ) : (
        <div className="grid gap-4 sm:gap-6 grid-cols-2 lg:grid-cols-4">
          {/* 1. Live Offers */}
          <Card className="border-card-border">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2 p-4 sm:p-6">
              <CardTitle className="text-xs sm:text-sm font-medium">Live Offers</CardTitle>
              <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground shrink-0" />
            </CardHeader>
            <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
              <div className="text-xl sm:text-2xl font-bold">{stats?.liveOffers || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats?.draftOffers || 0} drafts
              </p>
            </CardContent>
          </Card>

          {/* 2. Pending Applications */}
          <Card className="border-card-border">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2 p-4 sm:p-6">
              <CardTitle className="text-xs sm:text-sm font-medium">Pending Applications</CardTitle>
              <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground shrink-0" />
            </CardHeader>
            <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
              <div className="text-xl sm:text-2xl font-bold">{stats?.pendingApplications || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats?.totalApplications || 0} all time
              </p>
            </CardContent>
          </Card>

          {/* 3. Active Creators */}
          <Card className="border-card-border">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2 p-4 sm:p-6">
              <CardTitle className="text-xs sm:text-sm font-medium">Active Creators</CardTitle>
              <Users className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground shrink-0" />
            </CardHeader>
            <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
              <div className="text-xl sm:text-2xl font-bold">{stats?.activeCreators || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Working on offers
              </p>
            </CardContent>
          </Card>

          {/* 4. Total Clicks */}
          <Card className="border-card-border">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2 p-4 sm:p-6">
              <CardTitle className="text-xs sm:text-sm font-medium">Total Clicks</CardTitle>
              <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground shrink-0" />
            </CardHeader>
            <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
              <div className="text-xl sm:text-2xl font-bold">{stats?.totalClicks || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats?.conversions || 0} conversions
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="border-card-border">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
            <CardTitle>Recent Applications</CardTitle>
            <Badge variant="secondary" data-testid="badge-applications-count">{applications.length}</Badge>
          </CardHeader>
          <CardContent>
            {loadingApplications ? (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="p-3 rounded-md border border-border">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="h-4 w-32 bg-muted rounded animate-pulse" />
                          <div className="h-5 w-16 bg-muted rounded animate-pulse" />
                        </div>
                        <div className="h-3 w-48 bg-muted rounded animate-pulse" />
                        <div className="h-3 w-24 bg-muted rounded animate-pulse" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : applications.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No applications yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {applications.slice(0, 5).map((app: any) => (
                  <div key={app.id} className="flex items-start justify-between gap-4 p-3 rounded-md border border-border hover-elevate" data-testid={`application-${app.id}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h4 className="font-medium text-sm truncate" data-testid={`text-creator-${app.id}`}>{app.creatorName}</h4>
                        <Badge 
                          variant={
                            app.status === 'completed' ? 'default' : 
                            app.status === 'approved' || app.status === 'active' ? 'secondary' : 
                            'outline'
                          }
                          data-testid={`badge-status-${app.id}`}
                        >
                          {app.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate" data-testid={`text-offer-${app.id}`}>{app.offerTitle}</p>
                      <p className="text-xs text-tertiary-foreground mt-1">
                        {formatDistanceToNow(new Date(app.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                    {(app.status === 'approved' || app.status === 'active') && (
                      <Button 
                        size="sm" 
                        onClick={() => handleMarkComplete(app.id, app.creatorName)}
                        disabled={completeApplicationMutation.isPending}
                        className="gap-1"
                        data-testid={`button-complete-${app.id}`}
                      >
                        <CheckCircle className="h-3 w-3" />
                        Complete
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-card-border">
          <CardHeader>
            <CardTitle>Top Performing Creators</CardTitle>
          </CardHeader>
          <CardContent>
            {topCreators.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No active creators yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {topCreators.map((creator: any, index: number) => (
                  <div key={creator.creatorId} className="flex items-center justify-between p-4 rounded-lg border border-border hover:border-primary/50 transition-colors">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm">
                        {index + 1}
                      </div>
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={creator.creatorProfileImageUrl} alt={creator.creatorName} />
                        <AvatarFallback>
                          {creator.creatorName?.charAt(0)?.toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{creator.creatorName}</p>
                        <p className="text-xs text-muted-foreground truncate">{creator.creatorEmail}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <MousePointer className="h-3 w-3" />
                          <span className="font-medium">{creator.totalClicks}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">clicks</p>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-green-600">
                          <DollarSign className="h-3 w-3" />
                          <span className="font-medium">{Number(creator.totalEarnings).toFixed(2)}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">earned</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <GenericErrorDialog
        open={!!errorDialog}
        onOpenChange={(open) => !open && setErrorDialog(null)}
        title={errorDialog?.title || "Error"}
        description={errorDialog?.message || "An error occurred"}
      />

      <FirstTimeTutorial
        open={showTutorial}
        onComplete={completeTutorial}
        config={companyDashboardTutorialConfig}
      />
    </div>
  );
}
