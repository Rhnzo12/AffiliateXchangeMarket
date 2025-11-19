import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import {
  Users,
  MessageSquare,
  TrendingUp,
  ExternalLink,
  Filter,
  X,
  Download,
  PauseCircle,
  CheckCircle2,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { TopNavBar } from "../components/TopNavBar";
import { apiRequest } from "../lib/queryClient";

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "active", label: "Active (posted content)" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Completed" },
  { value: "rejected", label: "Rejected" },
];

const PERFORMANCE_OPTIONS = [
  { value: "all", label: "All Performance" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Needs Attention" },
];

const JOIN_DATE_OPTIONS = [
  { value: "all", label: "Any Join Date" },
  { value: "7d", label: "Joined in last 7 days" },
  { value: "30d", label: "Joined in last 30 days" },
  { value: "90d", label: "Joined in last 90 days" },
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

export default function CompanyCreators() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [offerFilter, setOfferFilter] = useState("all");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [performanceFilter, setPerformanceFilter] = useState("all");
  const [joinDateFilter, setJoinDateFilter] = useState("all");
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);
  const [payoutProcessingId, setPayoutProcessingId] = useState<string | null>(null);

  const startConversationMutation = useMutation({
    mutationFn: async (applicationId: string) => {
      const response = await apiRequest("POST", "/api/conversations/start", { applicationId });
      return response.json();
    },
    onSuccess: (data: any) => {
      setLocation(`/company/messages?conversation=${data.conversationId}`);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to start conversation",
        variant: "destructive",
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
      toast({
        title: "Unable to update status",
        description: error.message || "Please try again later.",
        variant: "destructive",
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
      toast({
        title: "Unable to approve payout",
        description: error.message || "Please try again later.",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setPayoutProcessingId(null);
    },
  });

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/login";
      }, 500);
    }
  }, [isAuthenticated, isLoading, toast]);

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

  const uniqueOfferOptions = useMemo(() => {
    const map = new Map<string, string>();
    normalizedApplications.forEach((app) => {
      if (app.offer?.id && app.offer?.title) {
        map.set(app.offer.id, app.offer.title);
      }
    });
    return Array.from(map.entries());
  }, [normalizedApplications]);

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

      const matchesOffer =
        offerFilter === "all" || (application.offer?.id && application.offer.id === offerFilter);

      const matchesPlatform = (() => {
        if (platformFilter === "all") return true;
        if (platformFilter === "youtube") return Boolean(application.creator?.youtubeUrl);
        if (platformFilter === "tiktok") return Boolean(application.creator?.tiktokUrl);
        if (platformFilter === "instagram") return Boolean(application.creator?.instagramUrl);
        return true;
      })();

      const matchesStatus = statusFilter === "all" || application.status === statusFilter;

      const matchesPerformance =
        performanceFilter === "all" || application.performanceTier === performanceFilter;

      const matchesJoinDate = (() => {
        if (joinDateFilter === "all" || !application.joinDate) return true;
        const diffDays = (Date.now() - application.joinDate.getTime()) / (1000 * 60 * 60 * 24);
        if (joinDateFilter === "7d") return diffDays <= 7;
        if (joinDateFilter === "30d") return diffDays <= 30;
        if (joinDateFilter === "90d") return diffDays <= 90;
        return true;
      })();

      return (
        matchesSearch &&
        matchesOffer &&
        matchesPlatform &&
        matchesStatus &&
        matchesPerformance &&
        matchesJoinDate
      );
    });
  }, [normalizedApplications, searchTerm, offerFilter, platformFilter, statusFilter, performanceFilter, joinDateFilter]);

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

  const totalVisibleCreators = filteredApplications.length;
  const totalCreators = normalizedApplications.length;

  const hasActiveFilters =
    searchTerm.trim().length > 0 ||
    offerFilter !== "all" ||
    platformFilter !== "all" ||
    statusFilter !== "all" ||
    performanceFilter !== "all" ||
    joinDateFilter !== "all";

  const clearFilters = () => {
    setSearchTerm("");
    setOfferFilter("all");
    setPlatformFilter("all");
    setStatusFilter("all");
    setPerformanceFilter("all");
    setJoinDateFilter("all");
  };

  const exportCreatorCsv = () => {
    if (filteredApplications.length === 0) {
      toast({
        title: "Nothing to export",
        description: "Adjust filters to show some creators first.",
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <TopNavBar />
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Creators by Offer</h1>
          <p className="text-muted-foreground mt-1">
            Track every creator working on your offers and take action in one place.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCreatorCsv} className="gap-2">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      <Card className="border-card-border">
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Filter className="h-4 w-4" />
              <span className="text-sm font-semibold uppercase tracking-wider">Search &amp; Filter</span>
            </div>
            <div className="sm:ml-auto text-sm text-muted-foreground">
              Showing <span className="font-semibold text-foreground">{totalVisibleCreators}</span> of {totalCreators}
              {` creator${totalCreators === 1 ? "" : "s"}`}
            </div>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" className="text-xs sm:ml-4" onClick={clearFilters}>
                <X className="h-3 w-3 mr-1" />
                Clear Filters
              </Button>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Search</label>
              <Input
                placeholder="Search by creator, bio, or offer"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Offer</label>
              <Select value={offerFilter} onValueChange={setOfferFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All offers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Offers</SelectItem>
                  {uniqueOfferOptions.map(([id, title]) => (
                    <SelectItem key={id} value={id}>
                      {title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Platform</label>
              <Select value={platformFilter} onValueChange={setPlatformFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All platforms" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Platforms</SelectItem>
                  <SelectItem value="youtube">YouTube</SelectItem>
                  <SelectItem value="tiktok">TikTok</SelectItem>
                  <SelectItem value="instagram">Instagram</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {STATUS_OPTIONS.filter((option) => option.value !== "rejected").map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Performance</label>
              <Select value={performanceFilter} onValueChange={setPerformanceFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERFORMANCE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Join Date</label>
              <Select value={joinDateFilter} onValueChange={setJoinDateFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {JOIN_DATE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

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
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="text-xs uppercase text-muted-foreground border-b">
                    <tr>
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

                      return (
                        <tr key={application.id} className="align-top">
                          <td className="py-4 pr-4">
                            <div className="flex items-start gap-3">
                              <Avatar className="h-10 w-10">
                                <AvatarImage src={application.creator?.profileImageUrl || undefined} />
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
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
