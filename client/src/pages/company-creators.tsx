import { useEffect, useMemo, useState, useCallback } from "react";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Checkbox } from "../components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import {
  Users,
  MessageSquare,
  TrendingUp,
  ExternalLink,
  X,
  Download,
  PauseCircle,
  CheckCircle2,
  FileText,
  CheckSquare,
  XCircle,
  PlayCircle,
  DollarSign,
  Loader2,
  Filter,
  ChevronDown,
} from "lucide-react";
import { exportCreatorListPDF, type CreatorExportData } from "../lib/export-utils";
import { Link, useLocation } from "wouter";
import { TopNavBar } from "../components/TopNavBar";
import { apiRequest } from "../lib/queryClient";
import { GenericErrorDialog } from "../components/GenericErrorDialog";
import { proxiedSrc } from "../lib/image";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../components/ui/accordion";

type CompanyCreatorsProps = {
  hideTopNav?: boolean;
};

type BulkActionType = "approve" | "pause" | "activate" | "complete" | "reject" | "approve_payouts" | null;

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "active", label: "Active (posted content)" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Completed" },
  { value: "rejected", label: "Rejected" },
];

const PLATFORM_OPTIONS = [
  { value: "youtube", label: "YouTube" },
  { value: "tiktok", label: "TikTok" },
  { value: "instagram", label: "Instagram" },
];

type PerformanceTier = "high" | "medium" | "low";

type CompanyApplication = {
  id: string;
  status: string;
  createdAt?: string;
  clickCount?: number | null;
  conversionCount?: number | null;
  totalEarnings?: string | number | null;
  offer?: { id: string; title: string };
  creator?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    profileImageUrl?: string | null;
    bio?: string | null;
    youtubeUrl?: string | null;
    tiktokUrl?: string | null;
    instagramUrl?: string | null;
  };
  pendingPayment?: { id: string; netAmount: string } | null;
};

type NormalizedApplication = CompanyApplication & {
  clicks: number;
  conversions: number;
  earnings: number;
  conversionRate: number;
  performanceTier: PerformanceTier;
  joinDate: Date | null;
};

function computePerformanceTier(clicks: number, conversions: number, earnings: number): PerformanceTier {
  const conversionRate = clicks > 0 ? conversions / clicks : 0;

  if (earnings >= 500 || conversionRate >= 0.05 || conversions >= 10) {
    return "high";
  }

  if (earnings >= 100 || conversionRate >= 0.02 || conversions >= 3) {
    return "medium";
  }

  return "low";
}

function formatStatusLabel(status: string): string {
  const match = STATUS_OPTIONS.find((option) => option.value === status);
  return match ? match.label : status;
}

function formatPerformanceLabel(tier: PerformanceTier): string {
  switch (tier) {
    case "high":
      return "High";
    case "medium":
      return "Medium";
    default:
      return "Needs Attention";
  }
}

function formatDate(value: Date | null): string {
  if (!value) return "-";
  return value.toLocaleDateString();
}

export default function CompanyCreators({ hideTopNav = false }: CompanyCreatorsProps) {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [platformFilters, setPlatformFilters] = useState<string[]>([]);
  const [pendingStatusFilters, setPendingStatusFilters] = useState<string[]>([]);
  const [pendingPlatformFilters, setPendingPlatformFilters] = useState<string[]>([]);
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);
  const [payoutProcessingId, setPayoutProcessingId] = useState<string | null>(null);
  const [errorDialog, setErrorDialog] = useState<{ title: string; message: string } | null>(null);

  // Bulk selection state
  const [selectedApplications, setSelectedApplications] = useState<Set<string>>(new Set());
  const [bulkActionDialog, setBulkActionDialog] = useState<BulkActionType>(null);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  const startConversationMutation = useMutation({
    mutationFn: async (applicationId: string) => {
      const response = await apiRequest("POST", "/api/conversations/start", { applicationId });
      return response.json();
    },
    onSuccess: (data: any) => {
      setLocation(`/company/messages?conversation=${data.conversationId}`);
    },
    onError: (error: any) => {
      setErrorDialog({
        title: "Error",
        message: error.message || "Failed to start conversation",
      });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ applicationId, status }: { applicationId: string; status: string }) => {
      const response = await apiRequest("PATCH", `/api/company/applications/${applicationId}/status`, { status });
      return response.json();
    },
    onMutate: ({ applicationId }) => {
      setStatusUpdatingId(applicationId);
    },
    onSuccess: (_data, { status }) => {
      toast({
        title: "Status updated",
        description: `Application marked as ${formatStatusLabel(status)}.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/company/applications"] });
    },
    onError: (error: any) => {
      setErrorDialog({
        title: "Unable to update status",
        message: error.message || "Please try again later.",
      });
    },
    onSettled: () => {
      setStatusUpdatingId(null);
    },
  });

  const approvePayoutMutation = useMutation({
    mutationFn: async ({ paymentId }: { paymentId: string }) => {
      const response = await apiRequest("POST", `/api/company/payments/${paymentId}/approve`);
      return response.json();
    },
    onMutate: ({ paymentId }) => {
      setPayoutProcessingId(paymentId);
    },
    onSuccess: () => {
      toast({
        title: "Payout approved",
        description: "The payout has been moved into processing.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/company/applications"] });
    },
    onError: (error: any) => {
      setErrorDialog({
        title: "Unable to approve payout",
        message: error.message || "Please try again later.",
      });
    },
    onSettled: () => {
      setPayoutProcessingId(null);
    },
  });

  // Bulk status update mutation
  const bulkUpdateStatusMutation = useMutation({
    mutationFn: async ({ applicationIds, status }: { applicationIds: string[]; status: string }) => {
      const results = await Promise.all(
        applicationIds.map(async (applicationId) => {
          const response = await apiRequest("PATCH", `/api/company/applications/${applicationId}/status`, { status });
          return response.json();
        })
      );
      return results;
    },
    onMutate: () => {
      setIsBulkProcessing(true);
    },
    onSuccess: (results, { status }) => {
      toast({
        title: "Bulk update complete",
        description: `${results.length} application(s) marked as ${formatStatusLabel(status)}.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/company/applications"] });
      setSelectedApplications(new Set());
    },
    onError: (error: any) => {
      setErrorDialog({
        title: "Bulk update failed",
        message: error.message || "Some applications could not be updated. Please try again.",
      });
    },
    onSettled: () => {
      setIsBulkProcessing(false);
      setBulkActionDialog(null);
    },
  });

  // Bulk payout approval mutation
  const bulkApprovePayoutsMutation = useMutation({
    mutationFn: async (paymentIds: string[]) => {
      const results = await Promise.all(
        paymentIds.map(async (paymentId) => {
          const response = await apiRequest("POST", `/api/company/payments/${paymentId}/approve`);
          return response.json();
        })
      );
      return results;
    },
    onMutate: () => {
      setIsBulkProcessing(true);
    },
    onSuccess: (results) => {
      toast({
        title: "Payouts approved",
        description: `${results.length} payout(s) moved to processing.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/company/applications"] });
      setSelectedApplications(new Set());
    },
    onError: (error: any) => {
      setErrorDialog({
        title: "Payout approval failed",
        message: error.message || "Some payouts could not be approved. Please try again.",
      });
    },
    onSettled: () => {
      setIsBulkProcessing(false);
      setBulkActionDialog(null);
    },
  });

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setErrorDialog({
        title: "Unauthorized",
        message: "You are logged out. Logging in again...",
      });
      setTimeout(() => {
        window.location.href = "/login";
      }, 500);
    }
  }, [isAuthenticated, isLoading]);

  const { data: applications = [], isLoading: loadingCreators } = useQuery<CompanyApplication[]>({
    queryKey: ["/api/company/applications"],
    enabled: isAuthenticated,
  });

  const normalizedApplications: NormalizedApplication[] = useMemo(() => {
    return applications.map((application) => {
      const clicks = Number(application.clickCount || 0);
      const conversions = Number(application.conversionCount || 0);
      const earnings = Number(application.totalEarnings || 0);
      const joinDate = application.createdAt ? new Date(application.createdAt) : null;

      return {
        ...application,
        clicks,
        conversions,
        earnings,
        conversionRate: clicks > 0 ? conversions / clicks : 0,
        performanceTier: computePerformanceTier(clicks, conversions, earnings),
        joinDate,
      };
    });
  }, [applications]);

  const filteredApplications = useMemo(() => {
    const searchValue = searchTerm.trim().toLowerCase();

    return normalizedApplications.filter((application) => {
      const haystack = [
        `${application.creator?.firstName || ""} ${application.creator?.lastName || ""}`.trim(),
        application.creator?.email || "",
        application.creator?.bio || "",
        application.offer?.title || "",
      ].filter((value): value is string => Boolean(value));

      const matchesSearch = searchValue
        ? haystack.some((value) => value.toLowerCase().includes(searchValue))
        : true;

      const matchesStatus =
        statusFilters.length === 0
          ? true
          : statusFilters.some((status) => application.status.toLowerCase() === status.toLowerCase());

      const creatorPlatforms = [
        application.creator?.youtubeUrl ? "youtube" : null,
        application.creator?.tiktokUrl ? "tiktok" : null,
        application.creator?.instagramUrl ? "instagram" : null,
      ].filter((value): value is string => Boolean(value));

      const matchesPlatform =
        platformFilters.length === 0
          ? true
          : creatorPlatforms.some((platform) => platformFilters.includes(platform));

      return matchesSearch && matchesStatus && matchesPlatform;
    });
  }, [normalizedApplications, platformFilters, searchTerm, statusFilters]);

  const groupedOffers = useMemo(() => {
    const map = new Map<string, { offerTitle: string; items: NormalizedApplication[] }>();

    filteredApplications.forEach((application) => {
      if (!application.offer?.id || !application.offer?.title) return;
      if (!map.has(application.offer.id)) {
        map.set(application.offer.id, { offerTitle: application.offer.title, items: [] });
      }
      map.get(application.offer.id)!.items.push(application);
    });

    return Array.from(map.entries())
      .map(([offerId, value]) => ({ offerId, ...value }))
      .sort((a, b) => a.offerTitle.localeCompare(b.offerTitle));
  }, [filteredApplications]);

  // Selection helper functions (must be after filteredApplications is defined)
  const toggleApplicationSelection = useCallback((applicationId: string) => {
    setSelectedApplications((prev) => {
      const next = new Set(prev);
      if (next.has(applicationId)) {
        next.delete(applicationId);
      } else {
        next.add(applicationId);
      }
      return next;
    });
  }, []);

  const toggleSelectAllForOffer = useCallback((offerApplicationIds: string[], allSelected: boolean) => {
    setSelectedApplications((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        // Deselect all in this offer
        offerApplicationIds.forEach((id) => next.delete(id));
      } else {
        // Select all in this offer
        offerApplicationIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }, []);

  const selectAllFiltered = useCallback(() => {
    const allIds = filteredApplications.map((app) => app.id);
    setSelectedApplications(new Set(allIds));
  }, [filteredApplications]);

  const clearSelection = useCallback(() => {
    setSelectedApplications(new Set());
  }, []);

  // Get selected applications data
  const selectedApplicationsData = useMemo(() => {
    return filteredApplications.filter((app) => selectedApplications.has(app.id));
  }, [filteredApplications, selectedApplications]);

  // Get pending payouts from selected applications
  const selectedPendingPayouts = useMemo(() => {
    return selectedApplicationsData
      .filter((app) => app.pendingPayment?.id)
      .map((app) => app.pendingPayment!);
  }, [selectedApplicationsData]);

  // Bulk action handlers
  const handleBulkAction = useCallback((action: BulkActionType) => {
    if (selectedApplications.size === 0) {
      toast({
        title: "No selection",
        description: "Please select at least one creator to perform bulk actions.",
        variant: "destructive",
      });
      return;
    }
    setBulkActionDialog(action);
  }, [selectedApplications.size, toast]);

  const executeBulkAction = useCallback(() => {
    const applicationIds = Array.from(selectedApplications);

    switch (bulkActionDialog) {
      case "approve":
        bulkUpdateStatusMutation.mutate({ applicationIds, status: "approved" });
        break;
      case "pause":
        bulkUpdateStatusMutation.mutate({ applicationIds, status: "paused" });
        break;
      case "activate":
        bulkUpdateStatusMutation.mutate({ applicationIds, status: "active" });
        break;
      case "complete":
        bulkUpdateStatusMutation.mutate({ applicationIds, status: "completed" });
        break;
      case "reject":
        bulkUpdateStatusMutation.mutate({ applicationIds, status: "rejected" });
        break;
      case "approve_payouts":
        const paymentIds = selectedPendingPayouts.map((p) => p.id);
        if (paymentIds.length === 0) {
          toast({
            title: "No pending payouts",
            description: "None of the selected creators have pending payouts.",
            variant: "destructive",
          });
          setBulkActionDialog(null);
          return;
        }
        bulkApprovePayoutsMutation.mutate(paymentIds);
        break;
    }
  }, [bulkActionDialog, selectedApplications, selectedPendingPayouts, bulkUpdateStatusMutation, bulkApprovePayoutsMutation, toast]);

  // Get bulk action dialog content
  const getBulkActionDialogContent = useCallback(() => {
    const count = selectedApplications.size;
    switch (bulkActionDialog) {
      case "approve":
        return {
          title: "Approve Selected Creators",
          description: `Are you sure you want to approve ${count} creator(s)? They will be able to start promoting your offer.`,
          actionText: "Approve All",
          actionClass: "bg-blue-600 hover:bg-blue-700",
        };
      case "pause":
        return {
          title: "Pause Selected Creators",
          description: `Are you sure you want to pause ${count} creator(s)? They will temporarily stop earning commissions.`,
          actionText: "Pause All",
          actionClass: "bg-amber-600 hover:bg-amber-700",
        };
      case "activate":
        return {
          title: "Activate Selected Creators",
          description: `Are you sure you want to activate ${count} creator(s)? They have posted content and are actively promoting.`,
          actionText: "Activate All",
          actionClass: "bg-emerald-600 hover:bg-emerald-700",
        };
      case "complete":
        return {
          title: "Mark as Completed",
          description: `Are you sure you want to mark ${count} creator(s) as completed? This indicates the collaboration has ended successfully.`,
          actionText: "Complete All",
          actionClass: "bg-purple-600 hover:bg-purple-700",
        };
      case "reject":
        return {
          title: "Reject Selected Creators",
          description: `Are you sure you want to reject ${count} creator(s)? This action cannot be easily undone.`,
          actionText: "Reject All",
          actionClass: "bg-red-600 hover:bg-red-700",
        };
      case "approve_payouts":
        const payoutCount = selectedPendingPayouts.length;
        const totalAmount = selectedPendingPayouts.reduce((sum, p) => sum + Number(p.netAmount || 0), 0);
        return {
          title: "Approve Pending Payouts",
          description: `Approve ${payoutCount} payout(s) totaling $${totalAmount.toFixed(2)}? Funds will be moved to processing.`,
          actionText: "Approve Payouts",
          actionClass: "bg-green-600 hover:bg-green-700",
        };
      default:
        return null;
    }
  }, [bulkActionDialog, selectedApplications.size, selectedPendingPayouts]);

  const totalVisibleCreators = filteredApplications.length;
  const totalCreators = normalizedApplications.length;

  const hasActiveFilters =
    searchTerm.trim().length > 0 || statusFilters.length > 0 || platformFilters.length > 0;

  const toggleStatusFilter = (value: string) => {
    setPendingStatusFilters((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]
    );
  };

  const togglePlatformFilter = (value: string) => {
    setPendingPlatformFilters((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]
    );
  };

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilters([]);
    setPlatformFilters([]);
    setPendingStatusFilters([]);
    setPendingPlatformFilters([]);
  };

  const applyFilters = () => {
    setStatusFilters(pendingStatusFilters);
    setPlatformFilters(pendingPlatformFilters);
    setFilterMenuOpen(false);
  };

  useEffect(() => {
    if (filterMenuOpen) {
      setPendingStatusFilters(statusFilters);
      setPendingPlatformFilters(platformFilters);
    }
  }, [filterMenuOpen, platformFilters, statusFilters]);

  const prepareCreatorExportData = (): CreatorExportData[] => {
    return filteredApplications.map((application) => ({
      id: application.id,
      name: `${application.creator?.firstName || ""} ${application.creator?.lastName || ""}`.trim() || "Unknown",
      email: application.creator?.email || "",
      offer: application.offer?.title || "",
      status: formatStatusLabel(application.status),
      performance: formatPerformanceLabel(application.performanceTier),
      clicks: application.clicks,
      conversions: application.conversions,
      earnings: application.earnings,
      joinDate: application.joinDate ? application.joinDate.toISOString().split("T")[0] : "",
    }));
  };

  const exportCreatorCsv = () => {
    if (filteredApplications.length === 0) {
      toast({
        title: "Nothing to export",
        description: "Adjust your search to show some creators first.",
      });
      return;
    }

    const headers = [
      "Offer",
      "Creator",
      "Email",
      "Status",
      "Performance",
      "Clicks",
      "Conversions",
      "Earnings",
      "Join Date",
    ];

    const rows = filteredApplications.map((application) => [
      application.offer?.title || "",
      `${application.creator?.firstName || ""} ${application.creator?.lastName || ""}`.trim(),
      application.creator?.email || "",
      formatStatusLabel(application.status),
      formatPerformanceLabel(application.performanceTier),
      application.clicks.toString(),
      application.conversions.toString(),
      `$${application.earnings.toFixed(2)}`,
      application.joinDate ? application.joinDate.toISOString().split("T")[0] : "",
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `creator-management-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    toast({
      title: "Creator list exported",
      description: "Your filtered creator roster has been downloaded as CSV.",
    });
  };

  const exportCreatorPdf = () => {
    if (filteredApplications.length === 0) {
      toast({
        title: "Nothing to export",
        description: "Adjust your search to show some creators first.",
      });
      return;
    }

    try {
      const data = prepareCreatorExportData();

      // Build filter description
      const filterParts: string[] = [];
      if (searchTerm) filterParts.push(`Search: "${searchTerm}"`);
      if (statusFilters.length > 0) {
        const selectedStatuses = statusFilters
          .map((status) => formatStatusLabel(status))
          .join(", ");
        filterParts.push(`Status: ${selectedStatuses}`);
      }
      if (platformFilters.length > 0) {
        const selectedPlatforms = platformFilters
          .map((platform) => PLATFORM_OPTIONS.find((option) => option.value === platform)?.label || platform)
          .join(", ");
        filterParts.push(`Platforms: ${selectedPlatforms}`);
      }

      const filterInfo = filterParts.length > 0
        ? `Filters: ${filterParts.join(" | ")}`
        : `Showing ${totalVisibleCreators} of ${totalCreators} creators`;

      exportCreatorListPDF(data, {
        title: "Creator Management Report",
        filterInfo,
      });

      toast({
        title: "PDF exported",
        description: "Your creator roster has been downloaded as PDF.",
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: "Unable to generate PDF report. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {!hideTopNav && <TopNavBar />}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Creators by Offer</h1>
          <p className="text-muted-foreground mt-1">
            Track every creator working on your offers and take action in one place.
          </p>
        </div>
        <div className="flex gap-2">
          <DropdownMenu open={exportMenuOpen} onOpenChange={setExportMenuOpen}>
            <div
              onMouseEnter={() => setExportMenuOpen(true)}
              onMouseLeave={() => setExportMenuOpen(false)}
              className="shrink-0"
            >
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Download className="h-4 w-4" />
                  Export
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-48"
                onMouseEnter={() => setExportMenuOpen(true)}
                onMouseLeave={() => setExportMenuOpen(false)}
              >
                <DropdownMenuLabel>Export creators</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="gap-2"
                  onClick={() => {
                    setExportMenuOpen(false);
                    exportCreatorCsv();
                  }}
                >
                  <Download className="h-4 w-4" />
                  CSV file
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="gap-2"
                  onClick={() => {
                    setExportMenuOpen(false);
                    exportCreatorPdf();
                  }}
                >
                  <FileText className="h-4 w-4" />
                  PDF report
                </DropdownMenuItem>
              </DropdownMenuContent>
            </div>
          </DropdownMenu>
        </div>
      </div>

      <Card className="border-card-border">
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:gap-4">
            <div className="flex w-full items-center gap-2 xl:max-w-md">
              <Input
                placeholder="Product name, ID, or SKU"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="w-full"
              />
              <DropdownMenu open={filterMenuOpen} onOpenChange={setFilterMenuOpen}>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="Filter" className="shrink-0">
                    <Filter className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="filter-menu-scroll w-72 space-y-2">
                  <DropdownMenuLabel>Filter creators</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <Accordion type="multiple" className="space-y-1">
                    <AccordionItem value="status" className="border-none">
                      <AccordionTrigger className="px-2 py-1 text-sm font-medium hover:no-underline">
                        Status
                      </AccordionTrigger>
                      <AccordionContent className="space-y-1">
                        {STATUS_OPTIONS.map((option) => (
                          <DropdownMenuCheckboxItem
                            key={option.value}
                            checked={pendingStatusFilters.includes(option.value)}
                            onCheckedChange={() => toggleStatusFilter(option.value)}
                            onSelect={(event) => event.preventDefault()}
                          >
                            {option.label}
                          </DropdownMenuCheckboxItem>
                        ))}
                      </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="platform" className="border-none">
                      <AccordionTrigger className="px-2 py-1 text-sm font-medium hover:no-underline">
                        Platform
                      </AccordionTrigger>
                      <AccordionContent className="space-y-1">
                        {PLATFORM_OPTIONS.map((option) => (
                          <DropdownMenuCheckboxItem
                            key={option.value}
                            checked={pendingPlatformFilters.includes(option.value)}
                            onCheckedChange={() => togglePlatformFilter(option.value)}
                            onSelect={(event) => event.preventDefault()}
                          >
                            {option.label}
                          </DropdownMenuCheckboxItem>
                        ))}
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                  <DropdownMenuSeparator />
                  <div className="flex items-center justify-between gap-2 px-2 pb-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-2 text-muted-foreground"
                      onClick={(event) => {
                        event.preventDefault();
                        clearFilters();
                      }}
                    >
                      <X className="h-4 w-4" />
                      Clear filters
                    </Button>
                    <Button
                      size="sm"
                      className="gap-2 border-0 bg-gray-200 text-black shadow-none hover:bg-gray-300"
                      onClick={applyFilters}
                    >
                      Apply
                    </Button>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground xl:ml-auto">
              Showing <span className="font-semibold text-foreground">{totalVisibleCreators}</span> of {totalCreators}
              {` creator${totalCreators === 1 ? "" : "s"}`}
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" className="text-xs" onClick={clearFilters}>
                  <X className="h-3 w-3 mr-1" />
                  Clear Filters
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions Toolbar */}
      {selectedApplications.size > 0 && (
        <Card className="border-primary bg-primary/5">
          <CardContent className="py-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <CheckSquare className="h-5 w-5 text-primary" />
                  <span className="font-semibold">
                    {selectedApplications.size} creator{selectedApplications.size === 1 ? "" : "s"} selected
                  </span>
                </div>
                <Button variant="ghost" size="sm" onClick={clearSelection} className="text-muted-foreground">
                  <X className="h-4 w-4 mr-1" />
                  Clear Selection
                </Button>
                <Button variant="ghost" size="sm" onClick={selectAllFiltered} className="text-muted-foreground">
                  Select All ({totalVisibleCreators})
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 border-blue-300 text-blue-700 hover:bg-blue-50"
                  onClick={() => handleBulkAction("approve")}
                  disabled={isBulkProcessing}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Approve
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                  onClick={() => handleBulkAction("activate")}
                  disabled={isBulkProcessing}
                >
                  <PlayCircle className="h-4 w-4" />
                  Activate
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 border-amber-300 text-amber-700 hover:bg-amber-50"
                  onClick={() => handleBulkAction("pause")}
                  disabled={isBulkProcessing}
                >
                  <PauseCircle className="h-4 w-4" />
                  Pause
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 border-purple-300 text-purple-700 hover:bg-purple-50"
                  onClick={() => handleBulkAction("complete")}
                  disabled={isBulkProcessing}
                >
                  <CheckSquare className="h-4 w-4" />
                  Complete
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 border-red-300 text-red-700 hover:bg-red-50"
                  onClick={() => handleBulkAction("reject")}
                  disabled={isBulkProcessing}
                >
                  <XCircle className="h-4 w-4" />
                  Reject
                </Button>
                <div className="w-px h-6 bg-border hidden lg:block" />
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 border-green-300 text-green-700 hover:bg-green-50"
                  onClick={() => handleBulkAction("approve_payouts")}
                  disabled={isBulkProcessing || selectedPendingPayouts.length === 0}
                >
                  <DollarSign className="h-4 w-4" />
                  Approve Payouts ({selectedPendingPayouts.length})
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {loadingCreators ? (
        <div className="text-center py-12">
          <div className="animate-pulse text-lg text-muted-foreground">Loading creators...</div>
        </div>
      ) : totalCreators === 0 ? (
        <Card className="border-card-border">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No creators yet</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              When creators apply and are accepted, they will appear here grouped by offer.
            </p>
          </CardContent>
        </Card>
      ) : filteredApplications.length === 0 ? (
        <Card className="border-card-border">
          <CardContent className="flex flex-col items-center justify-center py-12 space-y-3">
            <Users className="h-12 w-12 text-muted-foreground/40" />
            <h3 className="text-lg font-semibold">No creators match your filters</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              Try updating your search query or clearing your selected filters.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {groupedOffers.map((offer) => (
            <Card key={offer.offerId} className="border-card-border" data-testid={`card-offer-${offer.offerId}`}>
              <CardHeader className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle className="text-xl">{offer.offerTitle}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {offer.items.length} creator{offer.items.length === 1 ? "" : "s"} assigned
                  </p>
                </div>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                {(() => {
                  const offerAppIds = offer.items.map((app) => app.id);
                  const allOfferSelected = offerAppIds.length > 0 && offerAppIds.every((id) => selectedApplications.has(id));
                  const someOfferSelected = offerAppIds.some((id) => selectedApplications.has(id));

                  return (
                <table className="w-full min-w-[820px] text-sm">
                  <thead className="text-xs uppercase text-muted-foreground border-b">
                    <tr>
                      <th className="py-3 pl-2 pr-3 w-10">
                        <Checkbox
                          checked={allOfferSelected}
                          ref={(el) => {
                            if (el) {
                              (el as HTMLButtonElement).dataset.state = someOfferSelected && !allOfferSelected ? "indeterminate" : allOfferSelected ? "checked" : "unchecked";
                            }
                          }}
                          onCheckedChange={() => toggleSelectAllForOffer(offerAppIds, allOfferSelected)}
                          aria-label={`Select all creators for ${offer.offerTitle}`}
                        />
                      </th>
                      <th className="py-3 text-left font-medium">Creator</th>
                      <th className="py-3 text-left font-medium">Status</th>
                      <th className="py-3 text-left font-medium">Performance</th>
                      <th className="py-3 text-left font-medium">Metrics</th>
                      <th className="py-3 text-left font-medium">Join Date</th>
                      <th className="py-3 text-left font-medium">Quick Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {offer.items.map((application) => {
                      const creatorInitial =
                        (application.creator?.firstName?.[0] || application.creator?.email?.[0] || "C").toUpperCase();
                      const fullName = `${application.creator?.firstName || ""} ${application.creator?.lastName || ""}`.trim() ||
                        application.creator?.email ||
                        "Creator";

                      const statusBadgeClass = (() => {
                        switch (application.status) {
                          case "pending":
                            return "bg-amber-100 text-amber-800 border-amber-200";
                          case "approved":
                            return "bg-blue-100 text-blue-800 border-blue-200";
                          case "active":
                            return "bg-emerald-100 text-emerald-800 border-emerald-200";
                          case "paused":
                            return "bg-slate-200 text-slate-700 border-slate-300";
                          case "completed":
                            return "bg-purple-100 text-purple-800 border-purple-200";
                          case "rejected":
                            return "bg-red-100 text-red-700 border-red-200";
                          default:
                            return "bg-muted text-foreground border-border";
                        }
                      })();

                      const performanceBadgeClass = (() => {
                        switch (application.performanceTier) {
                          case "high":
                            return "bg-emerald-100 text-emerald-800 border-emerald-200";
                          case "medium":
                            return "bg-sky-100 text-sky-800 border-sky-200";
                          default:
                            return "bg-amber-100 text-amber-800 border-amber-200";
                        }
                      })();

                      const isSelected = selectedApplications.has(application.id);

                      return (
                        <tr
                          key={application.id}
                          className={`align-top transition-colors ${isSelected ? "bg-primary/5" : ""}`}
                        >
                          <td className="py-4 pl-2 pr-3 w-10">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleApplicationSelection(application.id)}
                              aria-label={`Select ${fullName}`}
                            />
                          </td>
                          <td className="py-4 pr-4">
                            <div className="flex items-start gap-3">
                              <Avatar className="h-10 w-10">
                                <AvatarImage src={proxiedSrc(application.creator?.profileImageUrl) || undefined} />
                                <AvatarFallback>{creatorInitial}</AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-medium leading-tight">{fullName}</div>
                                <div className="text-xs text-muted-foreground">{application.creator?.email || "No email"}</div>
                                <div className="flex flex-wrap gap-1 pt-1">
                                  {application.creator?.youtubeUrl && (
                                    <Badge variant="outline" className="gap-1">
                                      <ExternalLink className="h-3 w-3" /> YouTube
                                    </Badge>
                                  )}
                                  {application.creator?.tiktokUrl && (
                                    <Badge variant="outline" className="gap-1">
                                      <ExternalLink className="h-3 w-3" /> TikTok
                                    </Badge>
                                  )}
                                  {application.creator?.instagramUrl && (
                                    <Badge variant="outline" className="gap-1">
                                      <ExternalLink className="h-3 w-3" /> Instagram
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 pr-4">
                            <div className="flex flex-col gap-2">
                              <Badge variant="outline" className={`w-fit ${statusBadgeClass}`}>
                                {formatStatusLabel(application.status)}
                              </Badge>
                              <Select
                                value={application.status}
                                onValueChange={(nextStatus) => {
                                  if (nextStatus !== application.status) {
                                    updateStatusMutation.mutate({ applicationId: application.id, status: nextStatus });
                                  }
                                }}
                                disabled={statusUpdatingId === application.id || updateStatusMutation.isPending}
                              >
                                <SelectTrigger className="h-8 w-[180px] text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {STATUS_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </td>
                          <td className="py-4 pr-4">
                            <Badge variant="outline" className={`w-fit ${performanceBadgeClass}`}>
                              {formatPerformanceLabel(application.performanceTier)}
                            </Badge>
                            <div className="text-xs text-muted-foreground mt-2">
                              {(application.conversionRate * 100).toFixed(1)}% conversion rate
                            </div>
                          </td>
                          <td className="py-4 pr-4">
                            <div className="grid grid-cols-3 gap-3 text-center">
                              <div>
                                <div className="text-xs text-muted-foreground">Clicks</div>
                                <div className="font-semibold">{application.clicks}</div>
                              </div>
                              <div>
                                <div className="text-xs text-muted-foreground">Conversions</div>
                                <div className="font-semibold">{application.conversions}</div>
                              </div>
                              <div>
                                <div className="text-xs text-muted-foreground">Earned</div>
                                <div className="font-semibold">${application.earnings.toFixed(2)}</div>
                              </div>
                            </div>
                            {application.pendingPayment && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                                <PauseCircle className="h-3 w-3" /> Pending payout: ${Number(application.pendingPayment.netAmount || 0).toFixed(2)}
                              </div>
                            )}
                          </td>
                          <td className="py-4 pr-4">
                            <div className="text-sm font-medium">{formatDate(application.joinDate)}</div>
                          </td>
                          <td className="py-4">
                            <div className="flex flex-wrap gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-2"
                                data-testid={`button-message-${application.id}`}
                                onClick={() => startConversationMutation.mutate(application.id)}
                                disabled={startConversationMutation.isPending}
                              >
                                <MessageSquare className="h-4 w-4" />
                                Message
                              </Button>
                              <Link href={`/analytics/${application.id}`} className="flex">
                                <Button variant="outline" size="sm" className="gap-2">
                                  <TrendingUp className="h-4 w-4" />
                                  Analytics
                                </Button>
                              </Link>
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-2"
                                onClick={() => {
                                  if (application.pendingPayment?.id) {
                                    approvePayoutMutation.mutate({ paymentId: application.pendingPayment.id });
                                  }
                                }}
                                disabled={
                                  !application.pendingPayment ||
                                  approvePayoutMutation.isPending ||
                                  payoutProcessingId === application.pendingPayment?.id
                                }
                              >
                                <CheckCircle2 className="h-4 w-4" />
                                Approve Payout
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-2 text-red-600"
                                onClick={() => {
                                  if (window.confirm("Pause this creator on the offer?")) {
                                    updateStatusMutation.mutate({ applicationId: application.id, status: "paused" });
                                  }
                                }}
                                disabled={statusUpdatingId === application.id && updateStatusMutation.isPending}
                              >
                                <PauseCircle className="h-4 w-4" />
                                Remove
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                  );
                })()}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Bulk Action Confirmation Dialog */}
      <AlertDialog open={bulkActionDialog !== null} onOpenChange={(open) => !open && setBulkActionDialog(null)}>
        <AlertDialogContent>
          {(() => {
            const content = getBulkActionDialogContent();
            if (!content) return null;
            return (
              <>
                <AlertDialogHeader>
                  <AlertDialogTitle>{content.title}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {content.description}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isBulkProcessing}>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={executeBulkAction}
                    disabled={isBulkProcessing}
                    className={content.actionClass}
                  >
                    {isBulkProcessing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      content.actionText
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </>
            );
          })()}
        </AlertDialogContent>
      </AlertDialog>

      <GenericErrorDialog
        open={!!errorDialog}
        onOpenChange={(open) => !open && setErrorDialog(null)}
        title={errorDialog?.title || "Error"}
        description={errorDialog?.message || "An unexpected error occurred."}
      />
    </div>
  );
}
