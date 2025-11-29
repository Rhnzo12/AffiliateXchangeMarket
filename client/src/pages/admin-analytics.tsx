import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  DollarSign,
  Users,
  Building2,
  TrendingUp,
  TrendingDown,
  Download,
  FileText,
  BarChart3,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Activity,
  Server,
  HardDrive,
  Database,
  Clock,
  AlertCircle,
  AlertTriangle,
  Video,
  UserPlus,
  UserMinus,
  Gauge,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPie,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { TopNavBar } from "../components/TopNavBar";
import { StatsGridSkeleton, ChartSkeleton } from "../components/skeletons";
import { GenericErrorDialog } from "../components/GenericErrorDialog";
import {
  exportAdminFinancialReportPDF,
  exportAdminFinancialReportCSV,
  exportAdminUserReportPDF,
  exportAdminUserReportCSV,
  downloadCSV,
  type AdminFinancialData,
  type AdminUserStats,
} from "../lib/export-utils";

const DATE_RANGES = [
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" },
  { value: "90d", label: "Last 90 Days" },
  { value: "all", label: "All Time" },
];

const PIE_COLORS = ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

type AdminAnalytics = {
  financial: {
    totalRevenue: number;
    listingFees: number;
    platformFees: number;
    processingFees: number;
    totalPayouts: number;
    pendingPayouts: number;
    completedPayouts: number;
    disputedPayments: number;
    revenueGrowth: number;
    payoutGrowth: number;
    revenueByPeriod: Array<{
      period: string;
      listingFees: number;
      platformFees: number;
      processingFees: number;
      total: number;
    }>;
    payoutsByPeriod: Array<{
      period: string;
      amount: number;
      count: number;
    }>;
    revenueBySource: Array<{
      source: string;
      amount: number;
    }>;
  };
  users: {
    totalUsers: number;
    totalCreators: number;
    totalCompanies: number;
    totalAdmins: number;
    newUsersThisWeek: number;
    newCreatorsThisWeek: number;
    newCompaniesThisWeek: number;
    activeCreators: number;
    activeCompanies: number;
    pendingCompanies: number;
    suspendedUsers: number;
    userGrowth: Array<{
      period: string;
      creators: number;
      companies: number;
      total: number;
    }>;
    topCreators: Array<{
      id: string;
      name: string;
      email: string;
      earnings: number;
      clicks: number;
      conversions: number;
    }>;
    topCompanies: Array<{
      id: string;
      name: string;
      offers: number;
      spend: number;
      creators: number;
    }>;
  };
  platform: {
    totalOffers: number;
    activeOffers: number;
    pendingOffers: number;
    totalApplications: number;
    totalConversions: number;
    totalClicks: number;
    averageConversionRate: number;
    offersByNiche: Array<{
      niche: string;
      count: number;
    }>;
    applicationsByStatus: Array<{
      status: string;
      count: number;
    }>;
  };
};

// Platform Health Types
interface HealthSnapshot {
  overallHealthScore: number;
  apiHealthScore: number;
  storageHealthScore: number;
  databaseHealthScore: number;
  avgResponseTimeMs: number;
  errorRatePercent: number;
  memoryUsagePercent: number;
  cpuUsagePercent: number;
  uptimeSeconds: number;
  alerts: Array<{ type: string; message: string; severity: string }>;
  timestamp: string | null;
}

interface ApiMetrics {
  totalRequests: number;
  successfulRequests: number;
  errorRequests: number;
  avgResponseTime: number;
  errorRate: number;
  requestsPerMinute: number;
  topEndpoints: Array<{ endpoint: string; method: string; count: number; avgTime: number }>;
  errorsByEndpoint: Array<{ endpoint: string; method: string; errorCount: number }>;
}

interface StorageData {
  totalFiles: number;
  totalStorageBytes: number;
  videoFiles: number;
  videoStorageBytes: number;
  imageFiles: number;
  imageStorageBytes: number;
  documentFiles: number;
  documentStorageBytes: number;
}

interface VideoCosts {
  totalVideos: number;
  totalVideoStorageGb: number;
  totalBandwidthGb: number;
  storageCostUsd: number;
  bandwidthCostUsd: number;
  transcodingCostUsd: number;
  totalCostUsd: number;
  costPerVideoUsd: number;
  viewsCount: number;
}

interface ErrorLog {
  id: string;
  endpoint: string;
  method: string;
  statusCode: number;
  errorMessage: string | null;
  timestamp: string | null;
  userId: string | null;
}

interface PlatformHealthReport {
  snapshot: HealthSnapshot | null;
  apiMetrics: ApiMetrics;
  storage: StorageData;
  videoCosts: VideoCosts;
  apiTimeSeries: Array<{ date: string; totalRequests: number; errorRate: number; avgResponseTime: number }>;
  storageTimeSeries: Array<{ date: string; totalStorageGb: number; videoStorageGb: number; imageStorageGb: number; documentStorageGb: number }>;
  costTimeSeries: Array<{ date: string; totalCostUsd: number; storageCostUsd: number; bandwidthCostUsd: number; transcodingCostUsd: number }>;
  recentErrors: ErrorLog[];
}

// Churn Analytics Types
interface ChurnMetrics {
  currentCreators?: number;
  currentCompanies?: number;
  newCreatorsThisPeriod?: number;
  newCompaniesThisPeriod?: number;
  churnedCreatorsThisPeriod?: number;
  churnedCompaniesThisPeriod?: number;
  churnRate: number;
  acquisitionRate: number;
  netGrowth: number;
  timeline: Array<{
    period: string;
    newCreators?: number;
    newCompanies?: number;
    churnedCreators?: number;
    churnedCompanies?: number;
    activeCreators?: number;
    activeCompanies?: number;
    churnRate: number;
  }>;
}

interface ChurnAnalytics {
  creators: ChurnMetrics;
  companies: ChurnMetrics;
  summary: {
    totalActiveUsers: number;
    overallChurnRate: number;
    overallAcquisitionRate: number;
    healthScore: number;
  };
}

// Helper functions for Platform Health
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function getHealthColor(score: number): string {
  if (score >= 90) return "text-green-600";
  if (score >= 70) return "text-yellow-600";
  if (score >= 50) return "text-orange-600";
  return "text-red-600";
}

function getHealthBadgeVariant(score: number): "default" | "secondary" | "destructive" | "outline" {
  if (score >= 90) return "default";
  if (score >= 70) return "secondary";
  return "destructive";
}

export default function AdminAnalytics() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [dateRange, setDateRange] = useState("30d");
  const [errorDialog, setErrorDialog] = useState<{ title: string; message: string } | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      window.location.href = "/login";
    }
  }, [isAuthenticated, isLoading]);

  useEffect(() => {
    if (!isLoading && user && user.role !== "admin") {
      window.location.href = "/";
    }
  }, [user, isLoading]);

  const { data: analytics, isLoading: analyticsLoading, refetch } = useQuery<AdminAnalytics>({
    queryKey: ["/api/admin/analytics", { range: dateRange }],
    queryFn: async () => {
      const res = await fetch(`/api/admin/analytics?range=${dateRange}`, {
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          window.location.href = "/login";
          throw new Error("Unauthorized");
        }
        throw new Error("Failed to fetch admin analytics");
      }
      return res.json();
    },
    enabled: isAuthenticated && user?.role === "admin",
  });

  // Platform Health Query
  const { data: healthReport, isLoading: healthLoading, refetch: refetchHealth } = useQuery<PlatformHealthReport>({
    queryKey: ["/api/admin/platform-health"],
    queryFn: async () => {
      const res = await fetch("/api/admin/platform-health", {
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          window.location.href = "/login";
          throw new Error("Unauthorized");
        }
        throw new Error("Failed to fetch platform health data");
      }
      return res.json();
    },
    enabled: isAuthenticated && user?.role === "admin",
    refetchInterval: 60000, // Refresh every minute
  });

  // Churn Analytics Query
  const { data: churnData, isLoading: churnLoading } = useQuery<ChurnAnalytics>({
    queryKey: ["/api/admin/churn-analytics", { range: dateRange }],
    queryFn: async () => {
      const res = await fetch(`/api/admin/churn-analytics?range=${dateRange}`, {
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          window.location.href = "/login";
          throw new Error("Unauthorized");
        }
        throw new Error("Failed to fetch churn analytics");
      }
      return res.json();
    },
    enabled: isAuthenticated && user?.role === "admin",
  });

  // Mutation to create health snapshot
  const createSnapshotMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/platform-health/snapshot", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create snapshot");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Health snapshot created" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/platform-health"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create snapshot", variant: "destructive" });
    },
  });

  const exportFinancialPdf = () => {
    if (!analytics?.financial) {
      toast({
        title: "No data to export",
        description: "Financial data is not available.",
        variant: "destructive",
      });
      return;
    }

    try {
      const data: AdminFinancialData = {
        totalRevenue: analytics.financial.totalRevenue,
        listingFees: analytics.financial.listingFees,
        platformFees: analytics.financial.platformFees,
        processingFees: analytics.financial.processingFees,
        totalPayouts: analytics.financial.totalPayouts,
        pendingPayouts: analytics.financial.pendingPayouts,
        completedPayouts: analytics.financial.completedPayouts,
        disputedPayments: analytics.financial.disputedPayments,
        revenueByPeriod: analytics.financial.revenueByPeriod,
        payoutsByPeriod: analytics.financial.payoutsByPeriod,
      };

      exportAdminFinancialReportPDF(data);

      toast({
        title: "PDF exported",
        description: "Financial report has been downloaded.",
      });
    } catch (error) {
      setErrorDialog({
        title: "Export failed",
        message: "Unable to generate financial PDF report.",
      });
    }
  };

  const exportFinancialCsv = () => {
    if (!analytics?.financial) {
      toast({
        title: "No data to export",
        description: "Financial data is not available.",
        variant: "destructive",
      });
      return;
    }

    try {
      const data: AdminFinancialData = {
        totalRevenue: analytics.financial.totalRevenue,
        listingFees: analytics.financial.listingFees,
        platformFees: analytics.financial.platformFees,
        processingFees: analytics.financial.processingFees,
        totalPayouts: analytics.financial.totalPayouts,
        pendingPayouts: analytics.financial.pendingPayouts,
        completedPayouts: analytics.financial.completedPayouts,
        disputedPayments: analytics.financial.disputedPayments,
      };

      exportAdminFinancialReportCSV(data);

      toast({
        title: "CSV exported",
        description: "Financial report has been downloaded.",
      });
    } catch (error) {
      setErrorDialog({
        title: "Export failed",
        message: "Unable to generate financial CSV report.",
      });
    }
  };

  const exportUsersPdf = () => {
    if (!analytics?.users) {
      toast({
        title: "No data to export",
        description: "User data is not available.",
        variant: "destructive",
      });
      return;
    }

    try {
      const data: AdminUserStats = {
        totalUsers: analytics.users.totalUsers,
        totalCreators: analytics.users.totalCreators,
        totalCompanies: analytics.users.totalCompanies,
        totalAdmins: analytics.users.totalAdmins,
        newUsersThisWeek: analytics.users.newUsersThisWeek,
        newCreatorsThisWeek: analytics.users.newCreatorsThisWeek,
        newCompaniesThisWeek: analytics.users.newCompaniesThisWeek,
        activeCreators: analytics.users.activeCreators,
        activeCompanies: analytics.users.activeCompanies,
        pendingCompanies: analytics.users.pendingCompanies,
        suspendedUsers: analytics.users.suspendedUsers,
        userGrowth: analytics.users.userGrowth,
        topCreators: analytics.users.topCreators,
        topCompanies: analytics.users.topCompanies,
      };

      exportAdminUserReportPDF(data);

      toast({
        title: "PDF exported",
        description: "User report has been downloaded.",
      });
    } catch (error) {
      setErrorDialog({
        title: "Export failed",
        message: "Unable to generate user PDF report.",
      });
    }
  };

  const exportUsersCsv = () => {
    if (!analytics?.users) {
      toast({
        title: "No data to export",
        description: "User data is not available.",
        variant: "destructive",
      });
      return;
    }

    try {
      const data: AdminUserStats = {
        totalUsers: analytics.users.totalUsers,
        totalCreators: analytics.users.totalCreators,
        totalCompanies: analytics.users.totalCompanies,
        totalAdmins: analytics.users.totalAdmins,
        newUsersThisWeek: analytics.users.newUsersThisWeek,
        newCreatorsThisWeek: analytics.users.newCreatorsThisWeek,
        newCompaniesThisWeek: analytics.users.newCompaniesThisWeek,
        activeCreators: analytics.users.activeCreators,
        activeCompanies: analytics.users.activeCompanies,
        pendingCompanies: analytics.users.pendingCompanies,
        suspendedUsers: analytics.users.suspendedUsers,
      };

      exportAdminUserReportCSV(data);

      toast({
        title: "CSV exported",
        description: "User report has been downloaded.",
      });
    } catch (error) {
      setErrorDialog({
        title: "Export failed",
        message: "Unable to generate user CSV report.",
      });
    }
  };

  const exportPlatformCsv = () => {
    if (!analytics?.platform) {
      toast({
        title: "No data to export",
        description: "Platform data is not available.",
        variant: "destructive",
      });
      return;
    }

    try {
      const headers = ["Metric", "Value"];
      const data = [
        ["Total Offers", analytics.platform.totalOffers.toString()],
        ["Active Offers", analytics.platform.activeOffers.toString()],
        ["Pending Offers", analytics.platform.pendingOffers.toString()],
        ["Total Applications", analytics.platform.totalApplications.toString()],
        ["Total Conversions", analytics.platform.totalConversions.toString()],
        ["Total Clicks", analytics.platform.totalClicks.toString()],
        ["Average Conversion Rate", `${analytics.platform.averageConversionRate.toFixed(2)}%`],
      ];

      downloadCSV(data, "admin-platform-report", headers);

      toast({
        title: "CSV exported",
        description: "Platform report has been downloaded.",
      });
    } catch (error) {
      setErrorDialog({
        title: "Export failed",
        message: "Unable to generate platform CSV report.",
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
      <TopNavBar />

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Admin Analytics</h1>
          <p className="text-muted-foreground mt-1">
            Platform-wide financial and user analytics
          </p>
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATE_RANGES.map((range) => (
                <SelectItem key={range.value} value={range.value}>
                  {range.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => refetch()}
            disabled={analyticsLoading}
          >
            <RefreshCw className={`h-4 w-4 ${analyticsLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {analyticsLoading ? (
        <>
          <StatsGridSkeleton count={4} />
          <ChartSkeleton />
        </>
      ) : (
        <Tabs defaultValue="financial" className="space-y-6">
          <TabsList className="grid w-full max-w-lg grid-cols-4">
            <TabsTrigger value="financial" className="gap-2">
              <DollarSign className="h-4 w-4" />
              Financial
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2">
              <Users className="h-4 w-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="platform" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Platform
            </TabsTrigger>
            <TabsTrigger value="health" className="gap-2">
              <Activity className="h-4 w-4" />
              Health
            </TabsTrigger>
          </TabsList>

          {/* Financial Tab */}
          <TabsContent value="financial" className="space-y-6">
            {/* Export Actions */}
            <div className="flex justify-end gap-2">
              <Button variant="outline" className="gap-2" onClick={exportFinancialCsv}>
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
              <Button variant="outline" className="gap-2" onClick={exportFinancialPdf}>
                <FileText className="h-4 w-4" />
                PDF Report
              </Button>
            </div>

            {/* Financial Stats Grid */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <Card className="border-card-border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold font-mono text-green-600">
                    ${(analytics?.financial?.totalRevenue || 0).toFixed(2)}
                  </div>
                  <div className="flex items-center text-xs text-muted-foreground mt-1">
                    {(analytics?.financial?.revenueGrowth || 0) >= 0 ? (
                      <>
                        <ArrowUpRight className="h-3 w-3 text-green-500 mr-1" />
                        <span className="text-green-500">
                          +{(analytics?.financial?.revenueGrowth || 0).toFixed(1)}%
                        </span>
                      </>
                    ) : (
                      <>
                        <ArrowDownRight className="h-3 w-3 text-red-500 mr-1" />
                        <span className="text-red-500">
                          {(analytics?.financial?.revenueGrowth || 0).toFixed(1)}%
                        </span>
                      </>
                    )}
                    <span className="ml-1">vs last period</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-card-border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Listing Fees</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold font-mono">
                    ${(analytics?.financial?.listingFees || 0).toFixed(2)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">One-time offer fees</p>
                </CardContent>
              </Card>

              <Card className="border-card-border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Platform Fees</CardTitle>
                  <PieChart className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold font-mono">
                    ${(analytics?.financial?.platformFees || 0).toFixed(2)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">4% commission on payouts</p>
                </CardContent>
              </Card>

              <Card className="border-card-border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Processing Fees</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold font-mono">
                    ${(analytics?.financial?.processingFees || 0).toFixed(2)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">3% payment processing</p>
                </CardContent>
              </Card>
            </div>

            {/* Payout Stats */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <Card className="border-card-border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Payouts</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold font-mono">
                    ${(analytics?.financial?.totalPayouts || 0).toFixed(2)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">To creators</p>
                </CardContent>
              </Card>

              <Card className="border-card-border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pending Payouts</CardTitle>
                  <Badge variant="secondary">{(analytics?.financial?.pendingPayouts || 0) > 0 ? "Action needed" : "Up to date"}</Badge>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold font-mono text-yellow-600">
                    ${(analytics?.financial?.pendingPayouts || 0).toFixed(2)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Awaiting approval</p>
                </CardContent>
              </Card>

              <Card className="border-card-border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Completed Payouts</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold font-mono text-green-600">
                    ${(analytics?.financial?.completedPayouts || 0).toFixed(2)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Successfully processed</p>
                </CardContent>
              </Card>

              <Card className="border-card-border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Disputed Payments</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold font-mono text-red-600">
                    ${(analytics?.financial?.disputedPayments || 0).toFixed(2)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Requiring resolution</p>
                </CardContent>
              </Card>
            </div>

            {/* Revenue Over Time Chart */}
            <Card className="border-card-border">
              <CardHeader>
                <CardTitle>Revenue Over Time</CardTitle>
              </CardHeader>
              <CardContent>
                {analytics?.financial?.revenueByPeriod && analytics.financial.revenueByPeriod.length > 0 ? (
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={analytics.financial.revenueByPeriod}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="period" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                        <YAxis className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--popover))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "6px",
                          }}
                          formatter={(value: any) => [`$${Number(value).toFixed(2)}`, ""]}
                        />
                        <Area
                          type="monotone"
                          dataKey="listingFees"
                          stackId="1"
                          stroke="#2563eb"
                          fill="#2563eb"
                          fillOpacity={0.6}
                          name="Listing Fees"
                        />
                        <Area
                          type="monotone"
                          dataKey="platformFees"
                          stackId="1"
                          stroke="#10b981"
                          fill="#10b981"
                          fillOpacity={0.6}
                          name="Platform Fees"
                        />
                        <Area
                          type="monotone"
                          dataKey="processingFees"
                          stackId="1"
                          stroke="#f59e0b"
                          fill="#f59e0b"
                          fillOpacity={0.6}
                          name="Processing Fees"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    No revenue data available for this period.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Revenue by Source */}
            <Card className="border-card-border">
              <CardHeader>
                <CardTitle>Revenue by Source</CardTitle>
              </CardHeader>
              <CardContent>
                {analytics?.financial?.revenueBySource && analytics.financial.revenueBySource.length > 0 ? (
                  <div className="h-80 flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPie>
                        <Pie
                          data={analytics.financial.revenueBySource}
                          dataKey="amount"
                          nameKey="source"
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          label={({ source, percent }: any) => `${source}: ${(percent * 100).toFixed(0)}%`}
                        >
                          {analytics.financial.revenueBySource.map((entry, index) => (
                            <Cell key={entry.source} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: any) => [`$${Number(value).toFixed(2)}`, ""]} />
                      </RechartsPie>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    No revenue source data available.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-6">
            {/* Export Actions */}
            <div className="flex justify-end gap-2">
              <Button variant="outline" className="gap-2" onClick={exportUsersCsv}>
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
              <Button variant="outline" className="gap-2" onClick={exportUsersPdf}>
                <FileText className="h-4 w-4" />
                PDF Report
              </Button>
            </div>

            {/* User Stats Grid */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <Card className="border-card-border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics?.users?.totalUsers || 0}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    +{analytics?.users?.newUsersThisWeek || 0} this week
                  </p>
                </CardContent>
              </Card>

              <Card className="border-card-border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Creators</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics?.users?.totalCreators || 0}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {analytics?.users?.activeCreators || 0} active
                  </p>
                </CardContent>
              </Card>

              <Card className="border-card-border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Companies</CardTitle>
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics?.users?.totalCompanies || 0}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {analytics?.users?.pendingCompanies || 0} pending approval
                  </p>
                </CardContent>
              </Card>

              <Card className="border-card-border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Suspended</CardTitle>
                  <Badge variant={analytics?.users?.suspendedUsers ? "destructive" : "secondary"}>
                    {analytics?.users?.suspendedUsers || 0}
                  </Badge>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">
                    {analytics?.users?.suspendedUsers || 0}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Users suspended</p>
                </CardContent>
              </Card>
            </div>

            {/* Churn & Acquisition Metrics */}
            <Card className="border-card-border">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Acquisition & Churn Metrics</CardTitle>
                    <CardDescription className="mt-1">
                      User retention and growth analysis for the selected period
                    </CardDescription>
                  </div>
                  {churnData?.summary && (
                    <Badge
                      variant={churnData.summary.healthScore >= 70 ? "default" :
                               churnData.summary.healthScore >= 50 ? "secondary" : "destructive"}
                      className="gap-1"
                    >
                      <Gauge className="h-3 w-3" />
                      Health Score: {churnData.summary.healthScore}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {churnLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading churn data...</div>
                ) : churnData ? (
                  <div className="space-y-6">
                    {/* Summary Stats */}
                    <div className="grid gap-4 md:grid-cols-4">
                      <div className="p-4 rounded-lg bg-green-50 border border-green-200">
                        <div className="flex items-center gap-2 mb-2">
                          <UserPlus className="h-4 w-4 text-green-600" />
                          <span className="text-sm font-medium text-green-800">New This Period</span>
                        </div>
                        <div className="text-2xl font-bold text-green-700">
                          +{(churnData.creators.newCreatorsThisPeriod || 0) + (churnData.companies.newCompaniesThisPeriod || 0)}
                        </div>
                        <p className="text-xs text-green-600 mt-1">
                          {churnData.creators.newCreatorsThisPeriod || 0} creators, {churnData.companies.newCompaniesThisPeriod || 0} companies
                        </p>
                      </div>

                      <div className="p-4 rounded-lg bg-red-50 border border-red-200">
                        <div className="flex items-center gap-2 mb-2">
                          <UserMinus className="h-4 w-4 text-red-600" />
                          <span className="text-sm font-medium text-red-800">Churned This Period</span>
                        </div>
                        <div className="text-2xl font-bold text-red-700">
                          -{(churnData.creators.churnedCreatorsThisPeriod || 0) + (churnData.companies.churnedCompaniesThisPeriod || 0)}
                        </div>
                        <p className="text-xs text-red-600 mt-1">
                          {churnData.creators.churnedCreatorsThisPeriod || 0} creators, {churnData.companies.churnedCompaniesThisPeriod || 0} companies
                        </p>
                      </div>

                      <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
                        <div className="flex items-center gap-2 mb-2">
                          <TrendingUp className="h-4 w-4 text-blue-600" />
                          <span className="text-sm font-medium text-blue-800">Acquisition Rate</span>
                        </div>
                        <div className="text-2xl font-bold text-blue-700">
                          {churnData.summary.overallAcquisitionRate.toFixed(1)}%
                        </div>
                        <p className="text-xs text-blue-600 mt-1">New users vs existing</p>
                      </div>

                      <div className="p-4 rounded-lg bg-orange-50 border border-orange-200">
                        <div className="flex items-center gap-2 mb-2">
                          <TrendingDown className="h-4 w-4 text-orange-600" />
                          <span className="text-sm font-medium text-orange-800">Churn Rate</span>
                        </div>
                        <div className="text-2xl font-bold text-orange-700">
                          {churnData.summary.overallChurnRate.toFixed(1)}%
                        </div>
                        <p className="text-xs text-orange-600 mt-1">Lost users vs total</p>
                      </div>
                    </div>

                    {/* Detailed Breakdown */}
                    <div className="grid gap-6 lg:grid-cols-2">
                      {/* Creator Churn */}
                      <div className="p-4 border rounded-lg">
                        <h4 className="font-semibold mb-4 flex items-center gap-2">
                          <Users className="h-4 w-4 text-blue-600" />
                          Creator Metrics
                        </h4>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Active Creators</span>
                            <span className="font-semibold">{churnData.creators.currentCreators || 0}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">New This Period</span>
                            <span className="font-semibold text-green-600">+{churnData.creators.newCreatorsThisPeriod || 0}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Churned This Period</span>
                            <span className="font-semibold text-red-600">-{churnData.creators.churnedCreatorsThisPeriod || 0}</span>
                          </div>
                          <div className="flex justify-between items-center pt-2 border-t">
                            <span className="text-sm font-medium">Net Growth</span>
                            <span className={`font-bold ${churnData.creators.netGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {churnData.creators.netGrowth >= 0 ? '+' : ''}{churnData.creators.netGrowth}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Churn Rate</span>
                            <Badge variant={churnData.creators.churnRate < 5 ? "default" : churnData.creators.churnRate < 10 ? "secondary" : "destructive"}>
                              {churnData.creators.churnRate.toFixed(1)}%
                            </Badge>
                          </div>
                        </div>
                      </div>

                      {/* Company Churn */}
                      <div className="p-4 border rounded-lg">
                        <h4 className="font-semibold mb-4 flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-green-600" />
                          Company Metrics
                        </h4>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Active Companies</span>
                            <span className="font-semibold">{churnData.companies.currentCompanies || 0}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">New This Period</span>
                            <span className="font-semibold text-green-600">+{churnData.companies.newCompaniesThisPeriod || 0}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Churned This Period</span>
                            <span className="font-semibold text-red-600">-{churnData.companies.churnedCompaniesThisPeriod || 0}</span>
                          </div>
                          <div className="flex justify-between items-center pt-2 border-t">
                            <span className="text-sm font-medium">Net Growth</span>
                            <span className={`font-bold ${churnData.companies.netGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {churnData.companies.netGrowth >= 0 ? '+' : ''}{churnData.companies.netGrowth}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Churn Rate</span>
                            <Badge variant={churnData.companies.churnRate < 5 ? "default" : churnData.companies.churnRate < 10 ? "secondary" : "destructive"}>
                              {churnData.companies.churnRate.toFixed(1)}%
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Net Growth Visualization */}
                    <div className="pt-4 border-t">
                      <div className="flex items-center justify-center gap-8">
                        <div className="text-center">
                          <div className="text-3xl font-bold">
                            {churnData.summary.totalActiveUsers}
                          </div>
                          <p className="text-sm text-muted-foreground">Total Active Users</p>
                        </div>
                        <div className="text-center">
                          <div className={`text-3xl font-bold ${
                            (churnData.creators.netGrowth + churnData.companies.netGrowth) >= 0
                              ? 'text-green-600'
                              : 'text-red-600'
                          }`}>
                            {(churnData.creators.netGrowth + churnData.companies.netGrowth) >= 0 ? '+' : ''}
                            {churnData.creators.netGrowth + churnData.companies.netGrowth}
                          </div>
                          <p className="text-sm text-muted-foreground">Net Growth This Period</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    No churn data available for this period.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* User Growth Chart */}
            <Card className="border-card-border">
              <CardHeader>
                <CardTitle>User Growth</CardTitle>
              </CardHeader>
              <CardContent>
                {analytics?.users?.userGrowth && analytics.users.userGrowth.length > 0 ? (
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={analytics.users.userGrowth}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="period" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                        <YAxis className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--popover))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "6px",
                          }}
                        />
                        <Line type="monotone" dataKey="creators" stroke="#2563eb" strokeWidth={2} name="Creators" />
                        <Line type="monotone" dataKey="companies" stroke="#10b981" strokeWidth={2} name="Companies" />
                        <Line type="monotone" dataKey="total" stroke="#8b5cf6" strokeWidth={2} name="Total" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    No user growth data available.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Top Performers */}
            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="border-card-border">
                <CardHeader>
                  <CardTitle>Top Performing Creators</CardTitle>
                </CardHeader>
                <CardContent>
                  {analytics?.users?.topCreators && analytics.users.topCreators.length > 0 ? (
                    <div className="space-y-4">
                      {analytics.users.topCreators.slice(0, 5).map((creator, index) => (
                        <div key={creator.id} className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold text-sm">
                              {index + 1}
                            </div>
                            <div>
                              <div className="font-medium">{creator.name}</div>
                              <div className="text-xs text-muted-foreground">{creator.email}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold font-mono text-green-600">
                              ${creator.earnings.toFixed(2)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {creator.clicks} clicks | {creator.conversions} conv.
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No creator data available.
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-card-border">
                <CardHeader>
                  <CardTitle>Top Companies</CardTitle>
                </CardHeader>
                <CardContent>
                  {analytics?.users?.topCompanies && analytics.users.topCompanies.length > 0 ? (
                    <div className="space-y-4">
                      {analytics.users.topCompanies.slice(0, 5).map((company, index) => (
                        <div key={company.id} className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold text-sm">
                              {index + 1}
                            </div>
                            <div>
                              <div className="font-medium">{company.name}</div>
                              <div className="text-xs text-muted-foreground">{company.offers} offers</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold font-mono">
                              ${company.spend.toFixed(2)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {company.creators} creators
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No company data available.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Platform Tab */}
          <TabsContent value="platform" className="space-y-6">
            {/* Export Actions */}
            <div className="flex justify-end gap-2">
              <Button variant="outline" className="gap-2" onClick={exportPlatformCsv}>
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            </div>

            {/* Platform Stats Grid */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <Card className="border-card-border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Offers</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics?.platform?.totalOffers || 0}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {analytics?.platform?.activeOffers || 0} active | {analytics?.platform?.pendingOffers || 0} pending
                  </p>
                </CardContent>
              </Card>

              <Card className="border-card-border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Applications</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics?.platform?.totalApplications || 0}</div>
                  <p className="text-xs text-muted-foreground mt-1">Creator applications</p>
                </CardContent>
              </Card>

              <Card className="border-card-border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Clicks</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{(analytics?.platform?.totalClicks || 0).toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground mt-1">Tracking link clicks</p>
                </CardContent>
              </Card>

              <Card className="border-card-border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg. Conversion Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {(analytics?.platform?.averageConversionRate || 0).toFixed(2)}%
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {(analytics?.platform?.totalConversions || 0).toLocaleString()} total conversions
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Charts */}
            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="border-card-border">
                <CardHeader>
                  <CardTitle>Offers by Niche</CardTitle>
                </CardHeader>
                <CardContent>
                  {analytics?.platform?.offersByNiche && analytics.platform.offersByNiche.length > 0 ? (
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={analytics.platform.offersByNiche} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                          <YAxis dataKey="niche" type="category" width={100} tick={{ fill: "hsl(var(--muted-foreground))" }} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "hsl(var(--popover))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "6px",
                            }}
                          />
                          <Bar dataKey="count" fill="#2563eb" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      No niche data available.
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-card-border">
                <CardHeader>
                  <CardTitle>Applications by Status</CardTitle>
                </CardHeader>
                <CardContent>
                  {analytics?.platform?.applicationsByStatus && analytics.platform.applicationsByStatus.length > 0 ? (
                    <div className="h-80 flex items-center justify-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsPie>
                          <Pie
                            data={analytics.platform.applicationsByStatus}
                            dataKey="count"
                            nameKey="status"
                            cx="50%"
                            cy="50%"
                            outerRadius={100}
                            label={({ status, percent }: any) => `${status}: ${(percent * 100).toFixed(0)}%`}
                          >
                            {analytics.platform.applicationsByStatus.map((entry, index) => (
                              <Cell key={entry.status} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </RechartsPie>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      No application status data available.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Health Tab - Platform Health Monitoring */}
          <TabsContent value="health" className="space-y-6">
            {/* Health Actions */}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => refetchHealth()}
                disabled={healthLoading}
              >
                <RefreshCw className={`h-4 w-4 ${healthLoading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => createSnapshotMutation.mutate()}
                disabled={createSnapshotMutation.isPending}
              >
                <Activity className="h-4 w-4" />
                Create Snapshot
              </Button>
            </div>

            {/* Alerts */}
            {healthReport?.snapshot?.alerts && healthReport.snapshot.alerts.length > 0 && (
              <div className="space-y-2">
                {healthReport.snapshot.alerts.map((alert, i) => (
                  <div
                    key={i}
                    className={`p-4 rounded-lg flex items-center gap-3 ${
                      alert.severity === "critical"
                        ? "bg-red-50 border border-red-200"
                        : "bg-yellow-50 border border-yellow-200"
                    }`}
                  >
                    <AlertTriangle
                      className={`h-5 w-5 ${
                        alert.severity === "critical" ? "text-red-600" : "text-yellow-600"
                      }`}
                    />
                    <span
                      className={
                        alert.severity === "critical" ? "text-red-800" : "text-yellow-800"
                      }
                    >
                      {alert.message}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Health Scores */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <Card className="border-card-border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Overall Health</CardTitle>
                  <Activity className={`h-4 w-4 ${getHealthColor(healthReport?.snapshot?.overallHealthScore || 100)}`} />
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <div className={`text-3xl font-bold ${getHealthColor(healthReport?.snapshot?.overallHealthScore || 100)}`}>
                      {healthReport?.snapshot?.overallHealthScore || 100}
                    </div>
                    <Badge variant={getHealthBadgeVariant(healthReport?.snapshot?.overallHealthScore || 100)}>
                      {(healthReport?.snapshot?.overallHealthScore || 100) >= 90 ? "Healthy" :
                       (healthReport?.snapshot?.overallHealthScore || 100) >= 70 ? "Fair" :
                       (healthReport?.snapshot?.overallHealthScore || 100) >= 50 ? "Degraded" : "Critical"}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-card-border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">API Health</CardTitle>
                  <Server className={`h-4 w-4 ${getHealthColor(healthReport?.snapshot?.apiHealthScore || 100)}`} />
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${getHealthColor(healthReport?.snapshot?.apiHealthScore || 100)}`}>
                    {healthReport?.snapshot?.apiHealthScore || 100}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-card-border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Storage Health</CardTitle>
                  <HardDrive className={`h-4 w-4 ${getHealthColor(healthReport?.snapshot?.storageHealthScore || 100)}`} />
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${getHealthColor(healthReport?.snapshot?.storageHealthScore || 100)}`}>
                    {healthReport?.snapshot?.storageHealthScore || 100}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-card-border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Database Health</CardTitle>
                  <Database className={`h-4 w-4 ${getHealthColor(healthReport?.snapshot?.databaseHealthScore || 100)}`} />
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${getHealthColor(healthReport?.snapshot?.databaseHealthScore || 100)}`}>
                    {healthReport?.snapshot?.databaseHealthScore || 100}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Key Metrics */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <Card className="border-card-border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
                  <Clock className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {(healthReport?.apiMetrics?.avgResponseTime || 0).toFixed(0)}ms
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {(healthReport?.apiMetrics?.requestsPerMinute || 0)} requests/min
                  </p>
                </CardContent>
              </Card>

              <Card className="border-card-border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
                  <AlertCircle className="h-4 w-4 text-red-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {(healthReport?.apiMetrics?.errorRate || 0).toFixed(2)}%
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {healthReport?.apiMetrics?.errorRequests || 0} errors / {healthReport?.apiMetrics?.totalRequests || 0} total
                  </p>
                </CardContent>
              </Card>

              <Card className="border-card-border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Storage</CardTitle>
                  <HardDrive className="h-4 w-4 text-purple-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatBytes(healthReport?.storage?.totalStorageBytes || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {healthReport?.storage?.totalFiles || 0} files
                  </p>
                </CardContent>
              </Card>

              <Card className="border-card-border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Video Hosting Cost</CardTitle>
                  <DollarSign className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ${(healthReport?.videoCosts?.totalCostUsd || 0).toFixed(2)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {healthReport?.videoCosts?.totalVideos || 0} videos
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* System Info */}
            <div className="grid gap-6 lg:grid-cols-3">
              <Card className="border-card-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">System Resources</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Memory Usage</span>
                    <Badge variant={Number(healthReport?.snapshot?.memoryUsagePercent || 0) > 80 ? "destructive" : "secondary"}>
                      {Number(healthReport?.snapshot?.memoryUsagePercent || 0).toFixed(1)}%
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">CPU Load</span>
                    <Badge variant={Number(healthReport?.snapshot?.cpuUsagePercent || 0) > 80 ? "destructive" : "secondary"}>
                      {Number(healthReport?.snapshot?.cpuUsagePercent || 0).toFixed(1)}%
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Uptime</span>
                    <Badge variant="outline">
                      {formatUptime(Number(healthReport?.snapshot?.uptimeSeconds || 0))}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-card-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Storage Breakdown</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground flex items-center gap-2">
                      <Video className="h-4 w-4" /> Videos
                    </span>
                    <span className="text-sm font-medium">
                      {formatBytes(healthReport?.storage?.videoStorageBytes || 0)} ({healthReport?.storage?.videoFiles || 0})
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground flex items-center gap-2">
                      <FileText className="h-4 w-4" /> Images
                    </span>
                    <span className="text-sm font-medium">
                      {formatBytes(healthReport?.storage?.imageStorageBytes || 0)} ({healthReport?.storage?.imageFiles || 0})
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground flex items-center gap-2">
                      <FileText className="h-4 w-4" /> Documents
                    </span>
                    <span className="text-sm font-medium">
                      {formatBytes(healthReport?.storage?.documentStorageBytes || 0)} ({healthReport?.storage?.documentFiles || 0})
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-card-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Video Hosting Costs</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Storage</span>
                    <span className="text-sm font-medium">${(healthReport?.videoCosts?.storageCostUsd || 0).toFixed(4)}/mo</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Bandwidth</span>
                    <span className="text-sm font-medium">${(healthReport?.videoCosts?.bandwidthCostUsd || 0).toFixed(4)}/mo</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Transcoding</span>
                    <span className="text-sm font-medium">${(healthReport?.videoCosts?.transcodingCostUsd || 0).toFixed(4)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t">
                    <span className="text-sm font-medium">Cost per Video</span>
                    <span className="text-sm font-bold text-green-600">${(healthReport?.videoCosts?.costPerVideoUsd || 0).toFixed(4)}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* API Performance Chart */}
            <Card className="border-card-border">
              <CardHeader>
                <CardTitle>API Response Time & Error Rate</CardTitle>
                <CardDescription>Performance over the last 7 days</CardDescription>
              </CardHeader>
              <CardContent>
                {healthReport?.apiTimeSeries && healthReport.apiTimeSeries.length > 0 ? (
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={healthReport.apiTimeSeries}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="date" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                        <YAxis yAxisId="left" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--popover))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "6px",
                          }}
                        />
                        <Legend />
                        <Line yAxisId="left" type="monotone" dataKey="avgResponseTime" name="Avg Response Time (ms)" stroke="#2563eb" strokeWidth={2} dot={false} />
                        <Line yAxisId="right" type="monotone" dataKey="errorRate" name="Error Rate (%)" stroke="#ef4444" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    No API metrics data available yet. Metrics will appear after some API activity.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Top Endpoints & Errors */}
            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="border-card-border">
                <CardHeader>
                  <CardTitle>Top Endpoints</CardTitle>
                  <CardDescription>Most frequently accessed endpoints</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Endpoint</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead className="text-right">Requests</TableHead>
                        <TableHead className="text-right">Avg Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(healthReport?.apiMetrics?.topEndpoints || []).slice(0, 8).map((ep, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono text-xs">{ep.endpoint}</TableCell>
                          <TableCell><Badge variant="outline">{ep.method}</Badge></TableCell>
                          <TableCell className="text-right">{ep.count}</TableCell>
                          <TableCell className="text-right">{ep.avgTime.toFixed(0)}ms</TableCell>
                        </TableRow>
                      ))}
                      {(!healthReport?.apiMetrics?.topEndpoints || healthReport.apiMetrics.topEndpoints.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground">
                            No endpoint data available
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card className="border-card-border">
                <CardHeader>
                  <CardTitle>Recent Errors</CardTitle>
                  <CardDescription>Latest API errors</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Endpoint</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Message</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(healthReport?.recentErrors || []).slice(0, 8).map((error) => (
                        <TableRow key={error.id}>
                          <TableCell className="font-mono text-xs">{error.endpoint}</TableCell>
                          <TableCell>
                            <Badge variant={error.statusCode >= 500 ? "destructive" : "secondary"}>
                              {error.statusCode}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-xs truncate text-xs">
                            {error.errorMessage || "Unknown error"}
                          </TableCell>
                        </TableRow>
                      ))}
                      {(!healthReport?.recentErrors || healthReport.recentErrors.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-muted-foreground">
                            No recent errors - everything is running smoothly!
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      )}

      <GenericErrorDialog
        open={!!errorDialog}
        onOpenChange={(open) => !open && setErrorDialog(null)}
        title={errorDialog?.title || "Error"}
        description={errorDialog?.message || "An error occurred"}
      />
    </div>
  );
}
