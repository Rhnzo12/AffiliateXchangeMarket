import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import {
  Building2,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Ban,
  PlayCircle,
  ExternalLink,
  FileText,
  DollarSign,
  Users,
  TrendingUp,
  Calendar,
  Mail,
  Phone,
  MapPin,
  Globe,
  Briefcase,
} from "lucide-react";
import { apiRequest, queryClient } from "../lib/queryClient";
import { TopNavBar } from "../components/TopNavBar";
import { useLocation, useRoute } from "wouter";
import { GenericErrorDialog } from "../components/GenericErrorDialog";

type CompanyDetail = {
  id: string;
  legalName: string;
  tradeName?: string;
  industry?: string;
  websiteUrl?: string;
  companySize?: string;
  yearFounded?: number;
  logoUrl?: string;
  description?: string;
  contactName?: string;
  contactJobTitle?: string;
  phoneNumber?: string;
  businessAddress?: string;
  verificationDocumentUrl?: string;
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  approvedAt?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    email: string;
    username: string;
    firstName?: string;
    lastName?: string;
  };
};

export default function AdminCompanyDetail() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [, navigate] = useLocation();
  const [, params] = useRoute("/admin/companies/:id");
  const companyId = params?.id;

  console.log('[AdminCompanyDetail] Component loaded with companyId:', companyId);

  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [activeTab, setActiveTab] = useState("details");
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
        window.location.href = "/login";
      }, 500);
    }
  }, [isAuthenticated, isLoading]);

  // Fetch company details
  const { data: company, isLoading: loadingCompany, error } = useQuery<CompanyDetail>({
    queryKey: [`/api/admin/companies/${companyId}`],
    enabled: isAuthenticated && !!companyId,
  });

  useEffect(() => {
    if (company) {
      console.log('[AdminCompanyDetail] Company data loaded:', {
        id: company.id,
        legalName: company.legalName,
        status: company.status
      });
    } else if (error) {
      console.error('[AdminCompanyDetail] Error loading company:', error);
    } else if (!loadingCompany && !company) {
      console.warn('[AdminCompanyDetail] No company found for ID:', companyId);
    }
  }, [company, error, loadingCompany, companyId]);

  // Fetch company offers
  const { data: offers = [], isLoading: loadingOffers } = useQuery<any[]>({
    queryKey: [`/api/admin/companies/${companyId}/offers`],
    enabled: isAuthenticated && !!companyId && activeTab === "offers",
  });

  // Fetch company payments
  const { data: payments = [], isLoading: loadingPayments } = useQuery<any[]>({
    queryKey: [`/api/admin/companies/${companyId}/payments`],
    enabled: isAuthenticated && !!companyId && activeTab === "payments",
  });

  // Fetch creator relationships
  const { data: relationships = [], isLoading: loadingRelationships } = useQuery<any[]>({
    queryKey: [`/api/admin/companies/${companyId}/creators`],
    enabled: isAuthenticated && !!companyId && activeTab === "creators",
  });

  // Mutations
  const approveMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/admin/companies/${companyId}/approve`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/companies/${companyId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/companies/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({
        title: "Success",
        description: "Company approved successfully",
      });
    },
    onError: (error: any) => {
      setErrorDialog({
        open: true,
        title: "Error",
        description: error.message || "Failed to approve company",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (reason: string) => {
      const response = await apiRequest("POST", `/api/admin/companies/${companyId}/reject`, { reason });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/companies/${companyId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/companies/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({
        title: "Success",
        description: "Company rejected",
      });
      setIsRejectDialogOpen(false);
      setRejectionReason("");
    },
    onError: (error: any) => {
      setErrorDialog({
        open: true,
        title: "Error",
        description: error.message || "Failed to reject company",
      });
    },
  });

  const suspendMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/admin/companies/${companyId}/suspend`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/companies/${companyId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/companies/all"] });
      toast({
        title: "Success",
        description: "Company suspended",
      });
    },
    onError: (error: any) => {
      setErrorDialog({
        open: true,
        title: "Error",
        description: error.message || "Failed to suspend company",
      });
    },
  });

  const unsuspendMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/admin/companies/${companyId}/unsuspend`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/companies/${companyId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/companies/all"] });
      toast({
        title: "Success",
        description: "Company unsuspended",
      });
    },
    onError: (error: any) => {
      setErrorDialog({
        open: true,
        title: "Error",
        description: error.message || "Failed to unsuspend company",
      });
    },
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; className?: string }> = {
      pending: { variant: "secondary" },
      approved: { variant: "default", className: "bg-green-600 hover:bg-green-700" },
      rejected: { variant: "destructive" },
      suspended: { variant: "outline", className: "border-orange-500 text-orange-700 dark:text-orange-400" },
    };
    return variants[status] || { variant: "secondary" };
  };

  if (isLoading || loadingCompany) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-lg">Loading...</div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="space-y-8">
        <TopNavBar />
        <Card className="border-card-border">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Company not found</h3>
            <Button variant="outline" onClick={() => navigate("/admin/companies")}>
              Back to Companies
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <TopNavBar />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/admin/companies")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{company.legalName}</h1>
            <p className="text-muted-foreground mt-1">Company Details</p>
          </div>
        </div>
        <Badge {...getStatusBadge(company.status)}>
          {company.status}
        </Badge>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        {company.status === 'pending' && (
          <>
            <Button
              onClick={() => approveMutation.mutate()}
              disabled={approveMutation.isPending}
              className="gap-2"
            >
              <CheckCircle2 className="h-4 w-4" />
              Approve Company
            </Button>
            <Button
              variant="destructive"
              onClick={() => setIsRejectDialogOpen(true)}
              disabled={rejectMutation.isPending}
              className="gap-2"
            >
              <XCircle className="h-4 w-4" />
              Reject Company
            </Button>
          </>
        )}
        {company.status === 'approved' && (
          <Button
            variant="outline"
            onClick={() => suspendMutation.mutate()}
            disabled={suspendMutation.isPending}
            className="gap-2"
          >
            <Ban className="h-4 w-4" />
            Suspend Company
          </Button>
        )}
        {company.status === 'suspended' && (
          <Button
            variant="outline"
            onClick={() => unsuspendMutation.mutate()}
            disabled={unsuspendMutation.isPending}
            className="gap-2"
          >
            <PlayCircle className="h-4 w-4" />
            Unsuspend Company
          </Button>
        )}
      </div>

      {/* Rejection Reason Alert */}
      {company.status === 'rejected' && company.rejectionReason && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <XCircle className="h-5 w-5" />
              Rejection Reason
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{company.rejectionReason}</p>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="offers">Offers</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="creators">Creator Relationships</TabsTrigger>
        </TabsList>

        {/* Details Tab */}
        <TabsContent value="details" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Company Information */}
            <Card className="border-card-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Company Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Legal Name</div>
                  <div className="font-medium">{company.legalName}</div>
                </div>
                {company.tradeName && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Trade Name</div>
                    <div className="font-medium">{company.tradeName}</div>
                  </div>
                )}
                {company.industry && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Industry</div>
                    <div className="font-medium flex items-center gap-2">
                      <Briefcase className="h-4 w-4" />
                      {company.industry}
                    </div>
                  </div>
                )}
                {company.websiteUrl && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Website</div>
                    <a
                      href={company.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-2"
                    >
                      <Globe className="h-4 w-4" />
                      {company.websiteUrl}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
                {company.companySize && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Company Size</div>
                    <div className="font-medium">{company.companySize}</div>
                  </div>
                )}
                {company.yearFounded && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Year Founded</div>
                    <div className="font-medium">{company.yearFounded}</div>
                  </div>
                )}
                {company.description && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Description</div>
                    <div className="text-sm">{company.description}</div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Contact Information */}
            <Card className="border-card-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Contact Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {company.user?.email && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Email</div>
                    <div className="font-medium flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      {company.user.email}
                    </div>
                  </div>
                )}
                {company.contactName && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Contact Person</div>
                    <div className="font-medium">{company.contactName}</div>
                  </div>
                )}
                {company.contactJobTitle && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Job Title</div>
                    <div className="font-medium">{company.contactJobTitle}</div>
                  </div>
                )}
                {company.phoneNumber && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Phone Number</div>
                    <div className="font-medium flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      {company.phoneNumber}
                    </div>
                  </div>
                )}
                {company.businessAddress && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Business Address</div>
                    <div className="text-sm flex items-start gap-2">
                      <MapPin className="h-4 w-4 mt-0.5" />
                      {company.businessAddress}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Account Information */}
            <Card className="border-card-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Account Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Username</div>
                  <div className="font-medium">@{company.user?.username}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Joined</div>
                  <div className="font-medium">
                    {new Date(company.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </div>
                </div>
                {company.approvedAt && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Approved</div>
                    <div className="font-medium">
                      {new Date(company.approvedAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </div>
                  </div>
                )}
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Last Updated</div>
                  <div className="font-medium">
                    {new Date(company.updatedAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Verification Documents */}
            {company.verificationDocumentUrl && (
              <Card className="border-card-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Verification Documents
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <a
                    href={company.verificationDocumentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-primary hover:underline"
                  >
                    <FileText className="h-4 w-4" />
                    View Document
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Offers Tab */}
        <TabsContent value="offers">
          <Card className="border-card-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Offers ({offers.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingOffers ? (
                <div className="text-center py-8 text-muted-foreground">Loading offers...</div>
              ) : offers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No offers created yet</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Commission</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {offers.map((offer) => (
                      <TableRow key={offer.id}>
                        <TableCell className="font-medium">{offer.title}</TableCell>
                        <TableCell>
                          {offer.commissionType === 'per_sale' && `$${offer.commissionAmount} per sale`}
                          {offer.commissionType === 'per_lead' && `$${offer.commissionAmount} per lead`}
                          {offer.commissionType === 'per_click' && `$${offer.commissionAmount} per click`}
                          {offer.commissionType === 'monthly_retainer' && `$${offer.commissionAmount}/month`}
                        </TableCell>
                        <TableCell>
                          <Badge variant={offer.status === 'approved' ? 'default' : 'secondary'}>
                            {offer.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(offer.createdAt).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payments Tab */}
        <TabsContent value="payments">
          <Card className="border-card-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Payment History ({payments.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingPayments ? (
                <div className="text-center py-8 text-muted-foreground">Loading payments...</div>
              ) : payments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No payments yet</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Creator</TableHead>
                      <TableHead>Offer</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell>
                          @{payment.creator?.username || 'Unknown'}
                        </TableCell>
                        <TableCell>{payment.offer?.title || 'Unknown Offer'}</TableCell>
                        <TableCell className="font-medium">
                          ${(Number(payment.netAmount || payment.amount || 0) / 100).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={payment.status === 'completed' ? 'default' : 'secondary'}>
                            {payment.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(payment.createdAt).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Creator Relationships Tab */}
        <TabsContent value="creators">
          <Card className="border-card-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Creator Relationships ({relationships.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingRelationships ? (
                <div className="text-center py-8 text-muted-foreground">Loading relationships...</div>
              ) : relationships.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No creator relationships yet</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Creator</TableHead>
                      <TableHead>Offer</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Applied</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {relationships.map((relationship) => (
                      <TableRow key={relationship.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              @{relationship.creator?.username || 'Unknown'}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {relationship.creator?.email}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{relationship.offer?.title || 'Unknown Offer'}</TableCell>
                        <TableCell>
                          <Badge variant={relationship.status === 'approved' ? 'default' : 'secondary'}>
                            {relationship.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(relationship.createdAt).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Rejection Dialog */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Company</DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting this company registration
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Rejection Reason</Label>
              <Textarea
                id="reason"
                placeholder="Enter reason for rejection..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsRejectDialogOpen(false);
                setRejectionReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (rejectionReason.trim()) {
                  rejectMutation.mutate(rejectionReason);
                }
              }}
              disabled={!rejectionReason.trim() || rejectMutation.isPending}
            >
              {rejectMutation.isPending ? "Rejecting..." : "Reject Company"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
