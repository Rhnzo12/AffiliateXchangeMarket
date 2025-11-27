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
import { Input } from "../components/ui/input";
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
  TrendingDown,
  Calendar,
  Mail,
  Phone,
  MapPin,
  Globe,
  Briefcase,
  Eye,
  Download,
  ShieldCheck,
  RefreshCw,
  Copy,
  Code,
  Server,
  Clock,
  Percent,
  AlertTriangle,
  Info,
  Shield,
} from "lucide-react";
import { apiRequest, queryClient } from "../lib/queryClient";
import { TopNavBar } from "../components/TopNavBar";
import { useLocation, useRoute } from "wouter";
import { GenericErrorDialog } from "../components/GenericErrorDialog";

type VerificationDocument = {
  id: string;
  documentUrl: string;
  documentName: string;
  documentType: string;
  fileSize: number | null;
  uploadedAt?: string;
};

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
  // Website verification fields
  websiteVerificationToken?: string;
  websiteVerified?: boolean;
  websiteVerificationMethod?: 'meta_tag' | 'dns_txt';
  websiteVerifiedAt?: string;
  // Per-company fee override
  customPlatformFeePercentage?: string | null;
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

type CompanyFeeInfo = {
  companyId: string;
  companyName: string;
  customPlatformFeePercentage: number | null;
  customPlatformFeeDisplay: string | null;
  defaultPlatformFeePercentage: number;
  defaultPlatformFeeDisplay: string;
  processingFeePercentage: number;
  processingFeeDisplay: string;
  effectivePlatformFee: number;
  effectiveTotalFee: number;
  isUsingCustomFee: boolean;
};

type RiskIndicator = {
  type: 'warning' | 'info' | 'success';
  category: string;
  title: string;
  description: string;
  recommendation: 'increase' | 'decrease' | 'neutral';
};

type CompanyRiskInfo = {
  companyId: string;
  companyName: string;
  riskScore: number;
  riskLevel: 'high' | 'medium' | 'low';
  overallRecommendation: 'increase' | 'decrease' | 'maintain';
  recommendationText: string;
  indicators: RiskIndicator[];
  stats: {
    totalPayments: number;
    completedPayments: number;
    failedPayments: number;
    refundedPayments: number;
    disputedPayments: number;
    totalVolume: string;
    accountAgeDays: number;
  };
};

export default function AdminCompanyDetail() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [, navigate] = useLocation();
  const [, params] = useRoute("/admin/companies/:id");
  const companyId = params?.id;

  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [activeTab, setActiveTab] = useState("details");
  const [isLoadingDocument, setIsLoadingDocument] = useState(false);
  const [isFeeDialogOpen, setIsFeeDialogOpen] = useState(false);
  const [feeInputValue, setFeeInputValue] = useState("");
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
    queryFn: async () => {
      const response = await fetch(`/api/admin/companies/${companyId}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch company details");
      return response.json();
    },
    enabled: isAuthenticated && !!companyId,
  });

  useEffect(() => {
    if (error) {
      setErrorDialog({
        open: true,
        title: "Error Loading Company",
        description: "Failed to load company details. Please try again.",
      });
    } else if (!loadingCompany && !company && companyId) {
      setErrorDialog({
        open: true,
        title: "Company Not Found",
        description: "The requested company could not be found.",
      });
    }
  }, [company, error, loadingCompany, companyId]);

  // Function to view verification document with signed URL
  const handleViewDocument = async (documentUrl: string) => {
    if (!documentUrl) return;

    setIsLoadingDocument(true);
    try {
      // Extract the file path from the GCS URL
      // URL format: https://storage.googleapis.com/bucket-name/path/to/file
      const url = new URL(documentUrl);
      const pathParts = url.pathname.split('/');
      // Remove empty string and bucket name, keep the rest as file path
      const filePath = pathParts.slice(2).join('/');

      // Fetch signed URL from the API
      const response = await fetch(`/api/get-signed-url/${filePath}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to get document access');
      }

      const data = await response.json();

      // Open the signed URL in a new tab
      window.open(data.url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error('Error fetching document:', error);
      toast({
        title: "Error",
        description: "Failed to access the verification document. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingDocument(false);
    }
  };

  // Function to download verification document
  const handleDownloadDocument = async (documentUrl: string, documentName: string) => {
    if (!documentUrl) return;

    try {
      // Extract the file path from the GCS URL
      const url = new URL(documentUrl);
      const pathParts = url.pathname.split('/');
      const filePath = pathParts.slice(2).join('/');

      // Fetch signed URL with download flag from the API
      const response = await fetch(`/api/get-signed-url/${filePath}?download=true&name=${encodeURIComponent(documentName)}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to get download URL');
      }

      const data = await response.json();

      // Create a temporary link and trigger download
      const link = document.createElement('a');
      link.href = data.url;
      link.download = documentName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error downloading document:', error);
      toast({
        title: "Error",
        description: "Failed to download document. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Fetch company offers
  const { data: offers = [], isLoading: loadingOffers } = useQuery<any[]>({
    queryKey: [`/api/admin/companies/${companyId}/offers`],
    queryFn: async () => {
      const response = await fetch(`/api/admin/companies/${companyId}/offers`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch company offers");
      return response.json();
    },
    enabled: isAuthenticated && !!companyId && activeTab === "offers",
  });

  // Fetch company payments
  const { data: payments = [], isLoading: loadingPayments } = useQuery<any[]>({
    queryKey: [`/api/admin/companies/${companyId}/payments`],
    queryFn: async () => {
      const response = await fetch(`/api/admin/companies/${companyId}/payments`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch company payments");
      return response.json();
    },
    enabled: isAuthenticated && !!companyId && activeTab === "payments",
  });

  // Fetch creator relationships
  const { data: relationships = [], isLoading: loadingRelationships } = useQuery<any[]>({
    queryKey: [`/api/admin/companies/${companyId}/creators`],
    queryFn: async () => {
      const response = await fetch(`/api/admin/companies/${companyId}/creators`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch company creators");
      return response.json();
    },
    enabled: isAuthenticated && !!companyId && activeTab === "creators",
  });

  // Fetch verification documents
  const { data: verificationDocuments = [] } = useQuery<VerificationDocument[]>({
    queryKey: [`/api/admin/companies/${companyId}/verification-documents`],
    queryFn: async () => {
      const response = await fetch(`/api/admin/companies/${companyId}/verification-documents`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch verification documents");
      return response.json();
    },
    enabled: isAuthenticated && !!companyId,
  });

  // Fetch company fee info
  const { data: feeInfo, isLoading: loadingFeeInfo } = useQuery<CompanyFeeInfo>({
    queryKey: [`/api/admin/companies/${companyId}/fee`],
    queryFn: async () => {
      const response = await fetch(`/api/admin/companies/${companyId}/fee`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch company fee info");
      return response.json();
    },
    enabled: isAuthenticated && !!companyId,
  });

  // Fetch company risk indicators
  const { data: riskInfo, isLoading: loadingRiskInfo } = useQuery<CompanyRiskInfo>({
    queryKey: [`/api/admin/companies/${companyId}/risk-indicators`],
    queryFn: async () => {
      const response = await fetch(`/api/admin/companies/${companyId}/risk-indicators`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch risk indicators");
      return response.json();
    },
    enabled: isAuthenticated && !!companyId,
  });

  // Helper function to format file size
  const formatFileSize = (bytes: number | null): string => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

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

  // Update company fee mutation
  const updateFeeMutation = useMutation({
    mutationFn: async (platformFeePercentage: number) => {
      const response = await apiRequest("PUT", `/api/admin/companies/${companyId}/fee`, { platformFeePercentage });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/companies/${companyId}/fee`] });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/companies/${companyId}`] });
      toast({
        title: "Success",
        description: data.message || "Platform fee updated successfully",
      });
      setIsFeeDialogOpen(false);
      setFeeInputValue("");
    },
    onError: (error: any) => {
      setErrorDialog({
        open: true,
        title: "Error",
        description: error.message || "Failed to update platform fee",
      });
    },
  });

  // Reset company fee mutation
  const resetFeeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("DELETE", `/api/admin/companies/${companyId}/fee`);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/companies/${companyId}/fee`] });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/companies/${companyId}`] });
      toast({
        title: "Success",
        description: data.message || "Custom fee removed, using default",
      });
    },
    onError: (error: any) => {
      setErrorDialog({
        open: true,
        title: "Error",
        description: error.message || "Failed to reset platform fee",
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
            {(verificationDocuments.length > 0 || company.verificationDocumentUrl) && (
              <Card className="border-card-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Verification Documents
                    <Badge variant="outline">
                      {verificationDocuments.length > 0 ? verificationDocuments.length : 1}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {verificationDocuments.length > 0 ? (
                    <div className="space-y-3">
                      {verificationDocuments.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30"
                        >
                          <FileText className="h-5 w-5 text-primary flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{doc.documentName}</p>
                            <p className="text-xs text-muted-foreground">
                              {doc.documentType.toUpperCase()} • {formatFileSize(doc.fileSize)}
                              {doc.uploadedAt && (
                                <> • Uploaded {new Date(doc.uploadedAt).toLocaleDateString()}</>
                              )}
                            </p>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewDocument(doc.documentUrl)}
                              disabled={isLoadingDocument}
                              title="View document"
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDownloadDocument(doc.documentUrl, doc.documentName)}
                              title="Download document"
                            >
                              <Download className="h-4 w-4 mr-1" />
                              Download
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : company.verificationDocumentUrl ? (
                    <button
                      onClick={() => handleViewDocument(company.verificationDocumentUrl!)}
                      disabled={isLoadingDocument}
                      className="inline-flex items-center gap-2 text-primary hover:underline disabled:opacity-50 disabled:cursor-wait"
                    >
                      <FileText className="h-4 w-4" />
                      {isLoadingDocument ? "Loading..." : "View Document"}
                      <ExternalLink className="h-3 w-3" />
                    </button>
                  ) : null}
                </CardContent>
              </Card>
            )}

            {/* Website Verification Card */}
            {company.websiteUrl && (
              <Card className="border-card-border md:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5" />
                    Website Verification
                    {company.websiteVerified ? (
                      <Badge className="bg-green-100 text-green-800 border-green-200 ml-2">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Verified
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="ml-2">
                        <Clock className="h-3 w-3 mr-1" />
                        Not Verified
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {company.websiteVerified && company.websiteVerifiedAt && (
                    <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-900">
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                        <div>
                          <p className="font-medium text-green-800 dark:text-green-200">Website Ownership Verified</p>
                          <p className="text-sm text-green-700 dark:text-green-300">
                            Verified via {company.websiteVerificationMethod === 'meta_tag' ? 'Meta Tag' : 'DNS TXT Record'} on{' '}
                            {new Date(company.websiteVerifiedAt).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {company.websiteVerificationToken && (
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">Verification Token:</p>
                      <div className="p-3 bg-muted rounded-lg font-mono text-sm break-all">
                        {company.websiteVerificationToken}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          const response = await apiRequest("POST", `/api/admin/companies/${companyId}/generate-verification-token`);
                          const data = await response.json();
                          queryClient.invalidateQueries({ queryKey: [`/api/admin/companies/${companyId}`] });
                          toast({
                            title: "Token Generated",
                            description: "Verification token has been generated",
                          });
                        } catch (error: any) {
                          setErrorDialog({
                            open: true,
                            title: "Error",
                            description: error.message || "Failed to generate token",
                          });
                        }
                      }}
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      {company.websiteVerificationToken ? 'Regenerate Token' : 'Generate Token'}
                    </Button>

                    {company.websiteVerificationToken && !company.websiteVerified && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            try {
                              const response = await apiRequest("POST", `/api/admin/companies/${companyId}/verify-website`, { method: 'meta_tag' });
                              const data = await response.json();
                              if (data.success) {
                                queryClient.invalidateQueries({ queryKey: [`/api/admin/companies/${companyId}`] });
                                toast({
                                  title: "Verification Successful",
                                  description: "Website verified via Meta Tag",
                                });
                              } else {
                                toast({
                                  title: "Verification Failed",
                                  description: data.error || "Could not verify website",
                                  variant: "destructive",
                                });
                              }
                            } catch (error: any) {
                              toast({
                                title: "Verification Failed",
                                description: error.message || "Could not verify website",
                                variant: "destructive",
                              });
                            }
                          }}
                        >
                          <Code className="h-4 w-4 mr-2" />
                          Verify Meta Tag
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            try {
                              const response = await apiRequest("POST", `/api/admin/companies/${companyId}/verify-website`, { method: 'dns_txt' });
                              const data = await response.json();
                              if (data.success) {
                                queryClient.invalidateQueries({ queryKey: [`/api/admin/companies/${companyId}`] });
                                toast({
                                  title: "Verification Successful",
                                  description: "Website verified via DNS TXT Record",
                                });
                              } else {
                                toast({
                                  title: "Verification Failed",
                                  description: data.error || "Could not verify website",
                                  variant: "destructive",
                                });
                              }
                            } catch (error: any) {
                              toast({
                                title: "Verification Failed",
                                description: error.message || "Could not verify website",
                                variant: "destructive",
                              });
                            }
                          }}
                        >
                          <Server className="h-4 w-4 mr-2" />
                          Verify DNS TXT
                        </Button>
                      </>
                    )}

                    {company.websiteVerified && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          if (confirm('Are you sure you want to reset the website verification status?')) {
                            try {
                              await apiRequest("POST", `/api/admin/companies/${companyId}/reset-website-verification`);
                              queryClient.invalidateQueries({ queryKey: [`/api/admin/companies/${companyId}`] });
                              toast({
                                title: "Verification Reset",
                                description: "Website verification status has been reset",
                              });
                            } catch (error: any) {
                              setErrorDialog({
                                open: true,
                                title: "Error",
                                description: error.message || "Failed to reset verification",
                              });
                            }
                          }
                        }}
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Reset Verification
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Risk Indicators Card - Fee Adjustment Hints */}
            <Card className="border-card-border md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Fee Adjustment Indicators
                  {riskInfo && (
                    <Badge
                      className={`ml-2 ${
                        riskInfo.riskLevel === 'high'
                          ? 'bg-red-100 text-red-800 border-red-200'
                          : riskInfo.riskLevel === 'medium'
                          ? 'bg-yellow-100 text-yellow-800 border-yellow-200'
                          : 'bg-green-100 text-green-800 border-green-200'
                      }`}
                    >
                      {riskInfo.riskLevel === 'high' && <AlertTriangle className="h-3 w-3 mr-1" />}
                      {riskInfo.riskLevel === 'medium' && <Info className="h-3 w-3 mr-1" />}
                      {riskInfo.riskLevel === 'low' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                      {riskInfo.riskLevel.charAt(0).toUpperCase() + riskInfo.riskLevel.slice(1)} Risk
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {loadingRiskInfo ? (
                  <div className="text-center py-4 text-muted-foreground">Loading risk indicators...</div>
                ) : riskInfo ? (
                  <>
                    {/* Overall Recommendation */}
                    <div className={`p-4 rounded-lg border-2 ${
                      riskInfo.overallRecommendation === 'increase'
                        ? 'bg-red-50 border-red-200'
                        : riskInfo.overallRecommendation === 'decrease'
                        ? 'bg-green-50 border-green-200'
                        : 'bg-gray-50 border-gray-200'
                    }`}>
                      <div className="flex items-center gap-2 mb-2">
                        {riskInfo.overallRecommendation === 'increase' && (
                          <>
                            <TrendingUp className="h-5 w-5 text-red-600" />
                            <span className="font-semibold text-red-700">Consider Fee Increase</span>
                          </>
                        )}
                        {riskInfo.overallRecommendation === 'decrease' && (
                          <>
                            <TrendingDown className="h-5 w-5 text-green-600" />
                            <span className="font-semibold text-green-700">Eligible for Fee Reduction</span>
                          </>
                        )}
                        {riskInfo.overallRecommendation === 'maintain' && (
                          <>
                            <CheckCircle2 className="h-5 w-5 text-gray-600" />
                            <span className="font-semibold text-gray-700">Maintain Current Fee</span>
                          </>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{riskInfo.recommendationText}</p>
                    </div>

                    {/* Risk Score */}
                    <div className="flex items-center gap-4">
                      <div className="text-sm text-muted-foreground">Risk Score:</div>
                      <div className="flex-1 bg-gray-200 rounded-full h-3">
                        <div
                          className={`h-3 rounded-full transition-all ${
                            riskInfo.riskScore >= 70 ? 'bg-red-500' :
                            riskInfo.riskScore >= 40 ? 'bg-yellow-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${riskInfo.riskScore}%` }}
                        />
                      </div>
                      <div className="text-sm font-medium">{riskInfo.riskScore}/100</div>
                    </div>

                    {/* Indicators List */}
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-muted-foreground">Indicators:</div>
                      {riskInfo.indicators.map((indicator, idx) => (
                        <div
                          key={idx}
                          className={`p-3 rounded-lg flex items-start gap-3 ${
                            indicator.type === 'warning'
                              ? 'bg-red-50 border border-red-100'
                              : indicator.type === 'success'
                              ? 'bg-green-50 border border-green-100'
                              : 'bg-blue-50 border border-blue-100'
                          }`}
                        >
                          <div className="mt-0.5">
                            {indicator.type === 'warning' && <AlertTriangle className="h-4 w-4 text-red-500" />}
                            {indicator.type === 'success' && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                            {indicator.type === 'info' && <Info className="h-4 w-4 text-blue-500" />}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{indicator.title}</span>
                              <Badge variant="outline" className="text-xs">
                                {indicator.category}
                              </Badge>
                              {indicator.recommendation !== 'neutral' && (
                                <Badge
                                  className={`text-xs ${
                                    indicator.recommendation === 'increase'
                                      ? 'bg-red-100 text-red-700'
                                      : 'bg-green-100 text-green-700'
                                  }`}
                                >
                                  {indicator.recommendation === 'increase' ? '↑ Fee' : '↓ Fee'}
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">{indicator.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Stats Summary */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2 border-t">
                      <div className="text-center p-2">
                        <div className="text-lg font-bold">{riskInfo.stats.totalPayments}</div>
                        <div className="text-xs text-muted-foreground">Total Payments</div>
                      </div>
                      <div className="text-center p-2">
                        <div className="text-lg font-bold text-green-600">{riskInfo.stats.completedPayments}</div>
                        <div className="text-xs text-muted-foreground">Completed</div>
                      </div>
                      <div className="text-center p-2">
                        <div className="text-lg font-bold text-red-600">{riskInfo.stats.disputedPayments}</div>
                        <div className="text-xs text-muted-foreground">Disputed</div>
                      </div>
                      <div className="text-center p-2">
                        <div className="text-lg font-bold">${riskInfo.stats.totalVolume}</div>
                        <div className="text-xs text-muted-foreground">Total Volume</div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-4 text-muted-foreground">Failed to load risk indicators</div>
                )}
              </CardContent>
            </Card>

            {/* Platform Fee Override Card */}
            <Card className="border-card-border md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Percent className="h-5 w-5" />
                  Platform Fee Override
                  {feeInfo?.isUsingCustomFee ? (
                    <Badge className="bg-blue-100 text-blue-800 border-blue-200 ml-2">
                      <DollarSign className="h-3 w-3 mr-1" />
                      Custom Fee
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="ml-2">
                      Default Fee
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {loadingFeeInfo ? (
                  <div className="text-center py-4 text-muted-foreground">Loading fee information...</div>
                ) : feeInfo ? (
                  <>
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="p-4 bg-muted/50 rounded-lg">
                        <div className="text-xs text-muted-foreground mb-1">Platform Fee</div>
                        <div className="text-2xl font-bold text-primary">
                          {feeInfo.isUsingCustomFee ? feeInfo.customPlatformFeeDisplay : feeInfo.defaultPlatformFeeDisplay}
                        </div>
                        {feeInfo.isUsingCustomFee && (
                          <div className="text-xs text-muted-foreground mt-1">
                            Default: {feeInfo.defaultPlatformFeeDisplay}
                          </div>
                        )}
                      </div>
                      <div className="p-4 bg-muted/50 rounded-lg">
                        <div className="text-xs text-muted-foreground mb-1">Processing Fee (Stripe)</div>
                        <div className="text-2xl font-bold">{feeInfo.processingFeeDisplay}</div>
                        <div className="text-xs text-muted-foreground mt-1">Fixed rate</div>
                      </div>
                      <div className="p-4 bg-muted/50 rounded-lg">
                        <div className="text-xs text-muted-foreground mb-1">Total Fee</div>
                        <div className="text-2xl font-bold text-green-600">
                          {(feeInfo.effectiveTotalFee * 100).toFixed(2)}%
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">Creator receives {((1 - feeInfo.effectiveTotalFee) * 100).toFixed(0)}%</div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setFeeInputValue(feeInfo.isUsingCustomFee && feeInfo.customPlatformFeePercentage !== null
                            ? (feeInfo.customPlatformFeePercentage * 100).toString()
                            : "");
                          setIsFeeDialogOpen(true);
                        }}
                      >
                        <Percent className="h-4 w-4 mr-2" />
                        {feeInfo.isUsingCustomFee ? 'Edit Custom Fee' : 'Set Custom Fee'}
                      </Button>

                      {feeInfo.isUsingCustomFee && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (confirm('Are you sure you want to remove the custom fee and revert to the default platform fee?')) {
                              resetFeeMutation.mutate();
                            }
                          }}
                          disabled={resetFeeMutation.isPending}
                        >
                          <RefreshCw className="h-4 w-4 mr-2" />
                          {resetFeeMutation.isPending ? 'Resetting...' : 'Reset to Default'}
                        </Button>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-4 text-muted-foreground">Failed to load fee information</div>
                )}
              </CardContent>
            </Card>
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

      {/* Custom Fee Dialog */}
      <Dialog open={isFeeDialogOpen} onOpenChange={setIsFeeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Custom Platform Fee</DialogTitle>
            <DialogDescription>
              Set a custom platform fee percentage for this company. This will override the default platform fee and apply to all future payments.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="feePercentage">Platform Fee Percentage</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="feePercentage"
                  type="number"
                  step="0.01"
                  min="0"
                  max="50"
                  placeholder="e.g., 2.5"
                  value={feeInputValue}
                  onChange={(e) => setFeeInputValue(e.target.value)}
                  className="flex-1"
                />
                <span className="text-muted-foreground">%</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Enter a value between 0 and 50. The default platform fee is {feeInfo?.defaultPlatformFeeDisplay || '4%'}.
              </p>
            </div>
            {feeInputValue && !isNaN(parseFloat(feeInputValue)) && (
              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="text-sm text-muted-foreground mb-2">Preview:</div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>Platform Fee:</div>
                  <div className="font-medium">{parseFloat(feeInputValue).toFixed(2)}%</div>
                  <div>Processing Fee:</div>
                  <div className="font-medium">3% (Stripe)</div>
                  <div>Total Fee:</div>
                  <div className="font-bold text-primary">{(parseFloat(feeInputValue) + 3).toFixed(2)}%</div>
                  <div>Creator Receives:</div>
                  <div className="font-bold text-green-600">{(100 - parseFloat(feeInputValue) - 3).toFixed(2)}%</div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsFeeDialogOpen(false);
                setFeeInputValue("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                const feeValue = parseFloat(feeInputValue);
                if (!isNaN(feeValue) && feeValue >= 0 && feeValue <= 50) {
                  updateFeeMutation.mutate(feeValue / 100); // Convert from percentage to decimal
                }
              }}
              disabled={!feeInputValue || isNaN(parseFloat(feeInputValue)) || parseFloat(feeInputValue) < 0 || parseFloat(feeInputValue) > 50 || updateFeeMutation.isPending}
            >
              {updateFeeMutation.isPending ? "Saving..." : "Save Custom Fee"}
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
