import { useEffect, useState, useMemo } from "react";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/use-toast";
import { useTutorial } from "../hooks/useTutorial";
import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { FirstTimeTutorial } from "../components/FirstTimeTutorial";
import { TUTORIAL_IDS, analyticsTutorialConfig } from "../lib/tutorialConfig";
import { useCreatorPageTour } from "../components/CreatorTour";
import { CREATOR_TOUR_IDS, analyticsTourSteps as creatorAnalyticsTourSteps } from "../lib/creatorTourConfig";
import { useCompanyPageTour } from "../components/CompanyTour";
import { COMPANY_TOUR_IDS, analyticsTourSteps as companyAnalyticsTourSteps } from "../lib/companyTourConfig";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  DollarSign,
  TrendingUp,
  MousePointerClick,
  Target,
  Download,
  ArrowLeft,
  FileText,
  Share2,
  Users,
  Calendar,
} from "lucide-react";
import { exportAnalyticsPDF, downloadCSV, type AnalyticsData } from "../lib/export-utils";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  FunnelChart,
  Funnel,
  LabelList,
  BarChart,
  Bar,
} from 'recharts';
import { StatsGridSkeleton, ChartSkeleton } from "../components/skeletons";
import { GenericErrorDialog } from "../components/GenericErrorDialog";
import { GeographicHeatmap } from "../components/GeographicHeatmap";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";

const DATE_RANGES = [
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" },
  { value: "90d", label: "Last 90 Days" },
  { value: "all", label: "All Time" },
];

const TIMELINE_SERIES = [
  { key: "pending", label: "Pending", color: "#fbbf24" },
  { key: "approved", label: "Approved", color: "#60a5fa" },
  { key: "active", label: "Active", color: "#34d399" },
  { key: "paused", label: "Paused", color: "#94a3b8" },
  { key: "completed", label: "Completed", color: "#c084fc" },
];

const PIE_COLORS = ["#2563eb", "#f97316", "#10b981", "#a855f7", "#facc15", "#ec4899"];

type TimelinePoint = {
  date: string;
  isoDate?: string;
  clicks: number;
  conversions: number;
  earnings: number;
};

type ApplicationTimelinePoint = {
  date: string;
  isoDate?: string;
  total: number;
  pending: number;
  approved: number;
  active: number;
  paused: number;
  completed: number;
};

type MonthlyEarningsPoint = {
  month: string;
  earnings: number;
  affiliate: number;
  retainer: number;
};

// Wrapper component that routes to the appropriate analytics view
export default function Analytics() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const isCompany = user?.role === 'company';

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      window.location.href = "/login";
    }
  }, [isAuthenticated, isLoading]);

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="animate-pulse text-lg">Loading...</div>
    </div>;
  }

  // Route to appropriate analytics component based on user role
  if (isCompany) {
    return <CompanyAnalytics />;
  }

  return <CreatorAnalytics />;
}

// Creator Analytics Component (with tour hook)
function CreatorAnalytics() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [dateRange, setDateRange] = useState("all");
  const [, params] = useRoute("/analytics/:id");
  const applicationId = params?.id;
  const [errorDialog, setErrorDialog] = useState<{ title: string; message: string } | null>(null);
  const { showTutorial, completeTutorial } = useTutorial(TUTORIAL_IDS.ANALYTICS);

  // Quick Guide Tour - for creator users, after initial tutorial is dismissed
  const isCreator = user?.role === 'creator';
  useCreatorPageTour(CREATOR_TOUR_IDS.ANALYTICS, creatorAnalyticsTourSteps, isCreator && !showTutorial);

  const { data: analytics, isLoading: analyticsLoading } = useQuery<any>({
    queryKey: ["/api/analytics", { range: dateRange, applicationId }],
    queryFn: async () => {
      const url = applicationId
        ? `/api/analytics?range=${dateRange}&applicationId=${applicationId}`
        : `/api/analytics?range=${dateRange}`;
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) {
        if (res.status === 401) {
          window.location.href = "/login";
          throw new Error('Unauthorized');
        }
        throw new Error('Failed to fetch analytics');
      }
      return res.json();
    },
    enabled: true,
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const chartData: TimelinePoint[] = (analytics?.chartData || []).map((item: any) => ({
    date: item.date,
    isoDate: item.isoDate,
    clicks: Number(item.clicks || 0),
    conversions: Number(item.conversions || 0),
    earnings: Number(item.earnings || 0),
  }));

  // Generate Monthly Earnings Data from chartData
  const monthlyEarningsData: MonthlyEarningsPoint[] = useMemo(() => {
    if (!chartData || chartData.length === 0) return [];
    
    // If API provides monthly data, use it
    if (analytics?.monthlyEarnings && Array.isArray(analytics.monthlyEarnings)) {
      return analytics.monthlyEarnings.map((item: any) => ({
        month: item.month,
        earnings: Number(item.earnings || 0),
        affiliate: Number(item.affiliate || 0),
        retainer: Number(item.retainer || 0),
      }));
    }
    
    // Otherwise, aggregate from chartData by month
    const monthlyMap = new Map<string, { earnings: number; affiliate: number; retainer: number }>();
    
    chartData.forEach((item) => {
      const dateStr = item.isoDate || item.date;
      let monthKey: string;
      
      try {
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          monthKey = date.toLocaleDateString('en-US', { month: 'short' });
        } else {
          monthKey = 'Unknown';
        }
      } catch {
        monthKey = 'Unknown';
      }
      
      const existing = monthlyMap.get(monthKey) || { earnings: 0, affiliate: 0, retainer: 0 };
      monthlyMap.set(monthKey, {
        earnings: existing.earnings + item.earnings,
        affiliate: existing.affiliate + item.earnings * 0.6, // Estimate split if not provided
        retainer: existing.retainer + item.earnings * 0.4,
      });
    });
    
    return Array.from(monthlyMap.entries()).map(([month, data]) => ({
      month,
      earnings: data.earnings,
      affiliate: data.affiliate,
      retainer: data.retainer,
    }));
  }, [chartData, analytics?.monthlyEarnings]);

  const applicationsTimeline: ApplicationTimelinePoint[] = (analytics?.applicationsTimeline || []).map((item: any) => ({
    date: item.date,
    isoDate: item.isoDate,
    total: Number(item.total || 0),
    pending: Number(item.pending || 0),
    approved: Number(item.approved || 0),
    active: Number(item.active || 0),
    paused: Number(item.paused || 0),
    completed: Number(item.completed || 0),
  }));

  // Creators don't have these company-specific metrics
  const conversionFunnel = undefined;
  const funnelChartData: { name: string; value: number }[] = [];
  const acquisitionSources: { source: string; creators: number }[] = [];
  const geography: { country: string; count: number }[] = [];

  const conversionRate = Number(analytics?.conversionRate ?? 0);

  const totalEarnings = Number(analytics?.totalEarnings ?? 0);
  const primaryTotal = totalEarnings;

  const affiliateBreakdown = Number(analytics?.affiliateEarnings || 0);
  const retainerBreakdown = Number(analytics?.retainerEarnings || 0);

  const totalClicks = Number(analytics?.totalClicks || 0);
  const uniqueClicks = Number(analytics?.uniqueClicks || 0);
  const conversions = Number(analytics?.conversions || 0);
  const activeOffers = Number(analytics?.activeOffers || 0);
  const activeCreators = undefined;

  const exportData = () => {
    if (!analytics) {
      setErrorDialog({
        title: "No data to export",
        message: "There is no analytics data available",
      });
      return;
    }

    const headers = ['Date', 'Clicks', 'Conversions', 'Earnings'];
    const data = chartData.map((item: TimelinePoint) => [
      item.date,
      item.clicks.toString(),
      item.conversions.toString(),
      `$${item.earnings.toFixed(2)}`,
    ]);

    downloadCSV(data, `analytics-${dateRange}`, headers);

    toast({
      title: "Data exported",
      description: "Your analytics data has been downloaded as CSV",
    });
  };

  const exportPdf = () => {
    if (!analytics) {
      setErrorDialog({
        title: "No data to export",
        message: "There is no analytics data available",
      });
      return;
    }

    try {
      const analyticsExport: AnalyticsData = {
        totalEarnings: Number(analytics.totalEarnings || 0),
        totalSpent: Number(analytics.totalSpent || 0),
        affiliateEarnings: Number(analytics.affiliateEarnings || 0),
        affiliateSpent: Number(analytics.affiliateSpent || 0),
        retainerEarnings: Number(analytics.retainerEarnings || 0),
        retainerSpent: Number(analytics.retainerSpent || 0),
        totalClicks,
        uniqueClicks,
        conversions,
        conversionRate,
        activeOffers,
        activeCreators,
        chartData,
        offerBreakdown: analytics.offerBreakdown,
        conversionFunnel,
        acquisitionSources,
        geography,
        applicationsTimeline,
      };

      exportAnalyticsPDF(analyticsExport, {
        isCompany: false,
        dateRange,
        applicationId,
        offerTitle: analytics?.offerTitle,
      });

      toast({
        title: "PDF exported",
        description: "Your analytics report has been downloaded.",
      });
    } catch (error) {
      setErrorDialog({
        title: "Export failed",
        message: "Unable to generate PDF report. Please try again.",
      });
    }
  };

  const sendToZapier = async () => {
    if (!analytics) {
      setErrorDialog({
        title: "No data to export",
        message: "There is no analytics data available",
      });
      return;
    }

    const webhookUrl = window.prompt("Enter the Zapier webhook URL");
    if (!webhookUrl) {
      return;
    }

    try {
      const res = await fetch("/api/analytics/export/zapier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          webhookUrl,
          payload: {
            range: dateRange,
            totals: {
              totalSpent: Number(analytics.totalSpent || 0),
              totalClicks: Number(analytics.totalClicks || 0),
              conversions: Number(analytics.conversions || 0),
              conversionRate,
            },
            timeline: chartData,
            applicationsTimeline,
            funnel: conversionFunnel,
            acquisition: acquisitionSources,
            geography,
          },
        }),
      });

      if (!res.ok) {
        const message = await res.text();
        throw new Error(message || "Failed to send webhook");
      }

      toast({
        title: "Zapier webhook sent",
        description: "Analytics data delivered to the configured URL.",
      });
    } catch (err: any) {
      setErrorDialog({
        title: "Zapier export failed",
        message: err.message || "Unable to send data to Zapier.",
      });
    }
  };

  if (analyticsLoading) {
    return (
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
            <p className="text-muted-foreground mt-1">Track your performance across all offers</p>
          </div>
        </div>
        <StatsGridSkeleton count={4} />
        <ChartSkeleton />
      </div>
    );
  }

  // Custom tooltip for Monthly Earnings chart
  const MonthlyEarningsTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover border border-border rounded-lg shadow-lg p-3">
          <p className="font-semibold mb-2">{label}</p>
          <div className="space-y-1 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Total:</span>
              <span className="font-mono font-semibold">${payload[0]?.payload?.earnings?.toFixed(2) || '0.00'}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary" />
                <span className="text-muted-foreground">Affiliate:</span>
              </div>
              <span className="font-mono">${payload[0]?.value?.toFixed(2) || '0.00'}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-purple-500" />
                <span className="text-muted-foreground">Retainer:</span>
              </div>
              <span className="font-mono">${payload[1]?.value?.toFixed(2) || '0.00'}</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  // Render creator analytics view
  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          {applicationId && (
            <Link href="/applications">
              <Button variant="ghost" size="sm" className="mb-2 gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Applications
              </Button>
            </Link>
          )}
          <h1 className="text-3xl font-bold">
            {applicationId ? "Application Analytics" : "Analytics Dashboard"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {applicationId
              ? "Track performance for this specific application"
              : "Track your performance across all offers"}
          </p>
          {analytics?.offerTitle && applicationId && (
            <p className="text-sm font-medium text-primary mt-2">
              {analytics.offerTitle}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-40" data-testid="select-date-range">
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                data-testid="button-export"
                className="gap-2"
                disabled={!analytics}
              >
                <Download className="h-4 w-4" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={exportData}
                disabled={!analytics || chartData.length === 0}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={exportPdf}
                disabled={!analytics}
                className="gap-2"
              >
                <FileText className="h-4 w-4" />
                PDF Report
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Stats Grid - ALL KPIs consolidated here */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-card-border shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-green-600 dark:text-green-400">
              ${primaryTotal.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Affiliate ${affiliateBreakdown.toFixed(2)} • Retainer ${retainerBreakdown.toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card className="border-card-border shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Offers</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeOffers}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Offers you're approved or active in
            </p>
          </CardContent>
        </Card>

        <Card className="border-card-border shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clicks</CardTitle>
            <MousePointerClick className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalClicks.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {uniqueClicks.toLocaleString()} unique visitors
            </p>
          </CardContent>
        </Card>

        <Card className="border-card-border shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {conversionRate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {conversions.toLocaleString()} conversions
            </p>
          </CardContent>
        </Card>
      </div>

      {/* NEW: Monthly Earnings Chart */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-card-border shadow-sm">
          <CardHeader className="border-b bg-muted/30">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Monthly Earnings</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Your earnings breakdown by month
                </p>
              </div>
              <Calendar className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {monthlyEarningsData.length > 0 ? (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyEarningsData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" vertical={false} />
                    <XAxis 
                      dataKey="month" 
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis 
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `$${value}`}
                    />
                    <Tooltip content={<MonthlyEarningsTooltip />} />
                    <Bar 
                      dataKey="affiliate" 
                      stackId="earnings"
                      fill="hsl(var(--primary))" 
                      radius={[0, 0, 0, 0]}
                      name="Affiliate"
                    />
                    <Bar 
                      dataKey="retainer" 
                      stackId="earnings"
                      fill="#a855f7" 
                      radius={[4, 4, 0, 0]}
                      name="Retainer"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-center py-16">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-muted/50 mb-4">
                  <Calendar className="h-7 w-7 text-muted-foreground/50" />
                </div>
                <p className="text-base font-medium text-muted-foreground">No monthly data yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Earnings will appear once you start generating revenue
                </p>
              </div>
            )}
            {/* Legend */}
            {monthlyEarningsData.length > 0 && (
              <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-primary" />
                  <span className="text-sm text-muted-foreground">Affiliate</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-purple-500" />
                  <span className="text-sm text-muted-foreground">Retainer</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Click Timeline Chart */}
        <Card className="border-card-border shadow-sm">
          <CardHeader className="border-b bg-muted/30">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Click Timeline</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Daily click activity over time
                </p>
              </div>
              <MousePointerClick className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {chartData.length > 0 ? (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="clickGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" vertical={false} />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis 
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        padding: '8px 12px',
                      }}
                      formatter={(value: any) => [value.toLocaleString(), 'Clicks']}
                    />
                    <Area
                      type="monotone"
                      dataKey="clicks"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      fill="url(#clickGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-center py-16">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-muted/50 mb-4">
                  <MousePointerClick className="h-7 w-7 text-muted-foreground/50" />
                </div>
                <p className="text-base font-medium text-muted-foreground">No click data yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Clicks will appear once traffic flows to your links
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Performance Overview - Clicks & Conversions */}
      <Card className="border-card-border shadow-sm">
        <CardHeader className="border-b bg-muted/30">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-xl">Performance Overview</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Track your clicks and conversions over time
              </p>
            </div>
            <div className="flex gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-primary" />
                <span className="text-muted-foreground">Clicks</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-orange-500" />
                <span className="text-muted-foreground">Conversions</span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {chartData.length > 0 ? (
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart 
                  data={chartData}
                  margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorClicks" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorConversions" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid 
                    strokeDasharray="3 3" 
                    className="stroke-muted/50" 
                    vertical={false}
                  />
                  <XAxis 
                    dataKey="date" 
                    className="text-xs" 
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={false}
                    axisLine={false}
                    height={50}
                    angle={-45}
                    textAnchor="end"
                  />
                  <YAxis 
                    className="text-xs" 
                    tick={{ fill: 'hsl(var(--muted-foreground))' }} 
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    width={60}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '12px',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                      padding: '12px',
                    }}
                    labelStyle={{ 
                      fontWeight: 600,
                      marginBottom: '8px',
                      color: 'hsl(var(--foreground))',
                    }}
                    formatter={(value: any, name: string) => {
                      const label = name === 'clicks' ? 'Clicks' : 'Conversions';
                      return [value.toLocaleString(), label];
                    }}
                  />
                  <ReferenceLine 
                    y={chartData.reduce((sum, d) => sum + d.clicks, 0) / chartData.length} 
                    stroke="hsl(var(--primary))" 
                    strokeDasharray="5 5"
                    strokeOpacity={0.6}
                    label={{ 
                      value: 'Avg Clicks', 
                      position: 'right',
                      fill: 'hsl(var(--primary))',
                      fontSize: 11,
                      fontWeight: 500
                    }}
                  />
                  <ReferenceLine 
                    y={chartData.reduce((sum, d) => sum + d.conversions, 0) / chartData.length} 
                    stroke="#f97316" 
                    strokeDasharray="5 5"
                    strokeOpacity={0.6}
                    label={{ 
                      value: 'Avg Conv.', 
                      position: 'right',
                      fill: '#f97316',
                      fontSize: 11,
                      fontWeight: 500
                    }}
                  />
                  <Line 
                    type="monotone"
                    dataKey="clicks" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    dot={{ 
                      r: 4,
                      strokeWidth: 2, 
                      fill: 'hsl(var(--background))',
                      stroke: 'hsl(var(--primary))',
                    }}
                    activeDot={{ 
                      r: 6,
                      strokeWidth: 2,
                      fill: 'hsl(var(--primary))',
                      stroke: 'hsl(var(--background))',
                    }}
                    name="clicks"
                    animationDuration={1000}
                    animationEasing="ease-in-out"
                  />
                  <Line 
                    type="monotone"  
                    dataKey="conversions" 
                    stroke="#f97316" 
                    strokeWidth={3}
                    strokeLinecap="round"  
                    strokeLinejoin="round"  
                    dot={{ 
                      r: 4,  
                      strokeWidth: 2, 
                      fill: 'hsl(var(--background))',
                      stroke: '#f97316',
                    }}
                    activeDot={{ 
                      r: 6,  
                      strokeWidth: 2,
                      fill: '#f97316',
                      stroke: 'hsl(var(--background))',
                    }}
                    name="conversions"
                    animationDuration={1000}  
                    animationEasing="ease-in-out"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="text-center py-20">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted/50 mb-4">
                <MousePointerClick className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <p className="text-lg font-medium text-muted-foreground">No tracking data yet</p>
              <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
                Your click data will appear here once traffic starts flowing to your tracking links.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Offer Performance Table */}
      {!applicationId && (
        <Card className="border-card-border shadow-sm">
          <CardHeader className="border-b bg-muted/30">
            <CardTitle className="text-xl">Performance by Offer</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              See how each offer is performing
            </p>
          </CardHeader>
          <CardContent className="pt-6">
            {analytics?.offerBreakdown && analytics.offerBreakdown.length > 0 ? (
              <div className="space-y-3">
                {analytics.offerBreakdown.map((offer: any) => (
                  <div
                    key={offer.offerId}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 hover:border-primary/50 transition-all duration-200 cursor-pointer"
                  >
                    <div className="flex-1 min-w-0 pr-4">
                      <h4 className="font-semibold text-base truncate">{offer.offerTitle}</h4>
                      <p className="text-sm text-muted-foreground truncate">{offer.companyName}</p>
                    </div>
                    <div className="grid grid-cols-3 gap-6 text-center flex-shrink-0">
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Clicks</div>
                        <div className="font-semibold text-lg">{(offer.clicks || 0).toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Conv.</div>
                        <div className="font-semibold text-lg">{(offer.conversions || 0).toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Earned</div>
                        <div className="font-semibold font-mono text-lg text-green-600 dark:text-green-400">
                          ${Number(offer.earnings || 0).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-20">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted/50 mb-4">
                  <TrendingUp className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <p className="text-lg font-medium text-muted-foreground">No active offers yet</p>
                <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
                  Apply to offers to start tracking your performance across different campaigns.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <FirstTimeTutorial
        open={showTutorial}
        onComplete={completeTutorial}
        config={analyticsTutorialConfig}
      />

      <GenericErrorDialog
        open={!!errorDialog}
        onOpenChange={(open) => !open && setErrorDialog(null)}
        title={errorDialog?.title || "Error"}
        description={errorDialog?.message || "An error occurred"}
      />
    </div>
  );
}

// Company Analytics Component (with tour hook)
function CompanyAnalytics() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [dateRange, setDateRange] = useState("all");
  const [, params] = useRoute("/analytics/:id");
  const applicationId = params?.id;
  const [errorDialog, setErrorDialog] = useState<{ title: string; message: string } | null>(null);

  // Quick Guide Tour - for company users
  const isCompany = user?.role === 'company';
  useCompanyPageTour(COMPANY_TOUR_IDS.ANALYTICS, companyAnalyticsTourSteps, isCompany);

  const { data: analytics, isLoading: analyticsLoading } = useQuery<any>({
    queryKey: ["/api/analytics", { range: dateRange, applicationId }],
    queryFn: async () => {
      const url = applicationId
        ? `/api/analytics?range=${dateRange}&applicationId=${applicationId}`
        : `/api/analytics?range=${dateRange}`;
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) {
        if (res.status === 401) {
          window.location.href = "/login";
          throw new Error('Unauthorized');
        }
        throw new Error('Failed to fetch analytics');
      }
      return res.json();
    },
    enabled: true,
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const chartData: TimelinePoint[] = (analytics?.chartData || []).map((item: any) => ({
    date: item.date,
    isoDate: item.isoDate,
    clicks: Number(item.clicks || 0),
    conversions: Number(item.conversions || 0),
    earnings: Number(item.earnings || 0),
  }));

  const applicationsTimeline: ApplicationTimelinePoint[] = (analytics?.applicationsTimeline || []).map((item: any) => ({
    date: item.date,
    isoDate: item.isoDate,
    total: Number(item.total || 0),
    pending: Number(item.pending || 0),
    approved: Number(item.approved || 0),
    active: Number(item.active || 0),
    paused: Number(item.paused || 0),
    completed: Number(item.completed || 0),
  }));

  const conversionFunnel = analytics?.conversionFunnel as
    | { applied: number; approved: number; active: number; paused: number; completed: number; conversions: number }
    | undefined;

  const funnelChartData: { name: string; value: number }[] = conversionFunnel
    ? [
        { name: "Applied", value: conversionFunnel.applied },
        { name: "Approved", value: conversionFunnel.approved },
        { name: "Active", value: conversionFunnel.active },
        { name: "Paused", value: conversionFunnel.paused },
        { name: "Completed", value: conversionFunnel.completed },
        { name: "Converted", value: conversionFunnel.conversions },
      ]
    : [];

  const acquisitionSources: { source: string; creators: number }[] = (analytics?.acquisitionSources || []).map((item: any) => ({
    source: item.source || "Direct/Other",
    creators: Number(item.creators || 0),
  }));

  const geography: { country: string; count: number }[] = (analytics?.geography || []).map((item: any) => ({
    country: item.country || "Unknown",
    count: Number(item.count || 0),
  }));

  const conversionRate = Number(analytics?.conversionRate ?? 0);
  const totalSpend = Number(analytics?.totalSpent ?? 0);
  const totalEarnings = Number(analytics?.totalEarnings ?? 0);
  const primaryTotal = totalSpend || totalEarnings;
  const affiliateBreakdown = Number(analytics?.affiliateSpent || 0);
  const retainerBreakdown = Number(analytics?.retainerSpent || 0);
  const totalClicks = Number(analytics?.totalClicks || 0);
  const uniqueClicks = Number(analytics?.uniqueClicks || 0);
  const conversions = Number(analytics?.conversions || 0);
  const activeOffers = Number(analytics?.activeOffers || 0);
  const activeCreators = Number(analytics?.activeCreators || 0);

  const exportData = () => {
    if (!analytics) {
      setErrorDialog({
        title: "No data to export",
        message: "There is no analytics data available",
      });
      return;
    }

    const headers = ['Date', 'Clicks', 'Conversions', 'Earnings'];
    const data = chartData.map((item: TimelinePoint) => [
      item.date,
      item.clicks.toString(),
      item.conversions.toString(),
      `$${item.earnings.toFixed(2)}`,
    ]);

    downloadCSV(data, `analytics-${dateRange}`, headers);

    toast({
      title: "Data exported",
      description: "Your analytics data has been downloaded as CSV",
    });
  };

  const exportPdf = () => {
    if (!analytics) {
      setErrorDialog({
        title: "No data to export",
        message: "There is no analytics data available",
      });
      return;
    }

    try {
      const analyticsExport: AnalyticsData = {
        totalEarnings: Number(analytics.totalEarnings || 0),
        totalSpent: Number(analytics.totalSpent || 0),
        affiliateEarnings: Number(analytics.affiliateEarnings || 0),
        affiliateSpent: Number(analytics.affiliateSpent || 0),
        retainerEarnings: Number(analytics.retainerEarnings || 0),
        retainerSpent: Number(analytics.retainerSpent || 0),
        totalClicks,
        uniqueClicks,
        conversions,
        conversionRate,
        activeOffers,
        activeCreators,
        chartData,
        offerBreakdown: analytics.offerBreakdown,
        conversionFunnel,
        acquisitionSources,
        geography,
        applicationsTimeline,
      };

      exportAnalyticsPDF(analyticsExport, {
        isCompany: true,
        dateRange,
        applicationId,
        offerTitle: analytics?.offerTitle,
      });

      toast({
        title: "PDF exported",
        description: "Your analytics report has been downloaded.",
      });
    } catch (error) {
      setErrorDialog({
        title: "Export failed",
        message: "Unable to generate PDF report. Please try again.",
      });
    }
  };

  const sendToZapier = async () => {
    if (!analytics) {
      setErrorDialog({
        title: "No data to export",
        message: "There is no analytics data available",
      });
      return;
    }

    const webhookUrl = window.prompt("Enter the Zapier webhook URL");
    if (!webhookUrl) {
      return;
    }

    try {
      const res = await fetch("/api/analytics/export/zapier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          webhookUrl,
          payload: {
            range: dateRange,
            totals: {
              totalSpent: Number(analytics.totalSpent || 0),
              totalClicks: Number(analytics.totalClicks || 0),
              conversions: Number(analytics.conversions || 0),
              conversionRate,
            },
            timeline: chartData,
            applicationsTimeline,
            funnel: conversionFunnel,
            acquisition: acquisitionSources,
            geography,
          },
        }),
      });

      if (!res.ok) {
        const message = await res.text();
        throw new Error(message || "Failed to send webhook");
      }

      toast({
        title: "Zapier webhook sent",
        description: "Analytics data delivered to the configured URL.",
      });
    } catch (err: any) {
      setErrorDialog({
        title: "Zapier export failed",
        message: err.message || "Unable to send data to Zapier.",
      });
    }
  };

  if (analyticsLoading) {
    return (
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
            <p className="text-muted-foreground mt-1">Track your performance across all offers</p>
          </div>
        </div>
        <StatsGridSkeleton count={4} />
        <ChartSkeleton />
      </div>
    );
  }

  // Render company analytics view
  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          {applicationId && (
            <Link href="/applications">
              <Button variant="ghost" size="sm" className="mb-2 gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Applications
              </Button>
            </Link>
          )}
          <h1 className="text-3xl font-bold">
            {applicationId ? "Application Analytics" : "Analytics Dashboard"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {applicationId
              ? "Track performance for this specific application"
              : "Track your performance across all offers"}
          </p>
          {analytics?.offerTitle && applicationId && (
            <p className="text-sm font-medium text-primary mt-2">
              {analytics.offerTitle}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-40" data-testid="select-date-range">
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                data-testid="button-export"
                className="gap-2"
                disabled={!analytics}
              >
                <Download className="h-4 w-4" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={exportData}
                disabled={!analytics || chartData.length === 0}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={exportPdf}
                disabled={!analytics}
                className="gap-2"
              >
                <FileText className="h-4 w-4" />
                PDF Report
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {!applicationId && (
            <Button
              variant="outline"
              className="gap-2"
              onClick={sendToZapier}
              disabled={!analytics}
            >
              <Share2 className="h-4 w-4" />
              Zapier Webhook
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-card-border">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Spend</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">
              ${primaryTotal.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Affiliate ${affiliateBreakdown.toFixed(2)} • Retainer ${retainerBreakdown.toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card className="border-card-border">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Offers</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeOffers}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {activeCreators ?? 0} active creators
            </p>
          </CardContent>
        </Card>

        <Card className="border-card-border">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clicks</CardTitle>
            <MousePointerClick className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalClicks}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {uniqueClicks} unique visitors
            </p>
          </CardContent>
        </Card>

        <Card className="border-card-border">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {conversionRate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {conversions} conversions
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-card-border">
          <CardHeader>
            <CardTitle>Applications Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            {applicationsTimeline.length > 0 ? (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={applicationsTimeline}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px',
                      }}
                    />
                    {TIMELINE_SERIES.map((series) => (
                      <Area
                        key={series.key}
                        type="monotone"
                        dataKey={series.key}
                        stackId="1"
                        name={series.label}
                        stroke={series.color}
                        fill={series.color}
                        fillOpacity={0.35}
                      />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                <p className="text-muted-foreground">No application data in this range</p>
                <p className="text-sm text-muted-foreground mt-1">Adjust the date range to see application trends.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-card-border">
          <CardHeader>
            <CardTitle>Clicks & Conversions</CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px',
                      }}
                    />
                    <Line type="monotone" dataKey="clicks" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="conversions" stroke="#f97316" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-center py-12">
                <MousePointerClick className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                <p className="text-muted-foreground">No tracking data yet</p>
                <p className="text-sm text-muted-foreground mt-1">Your click data will appear once traffic flows in.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-card-border">
          <CardHeader>
            <CardTitle>Conversion Funnel</CardTitle>
          </CardHeader>
          <CardContent>
            {funnelChartData.length > 0 ? (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <FunnelChart>
                    <Tooltip />
                    <Funnel dataKey="value" data={funnelChartData} isAnimationActive={false}>
                      <LabelList position="right" fill="#111827" stroke="none" dataKey="name" />
                    </Funnel>
                  </FunnelChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-center py-12">
                <Target className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                <p className="text-muted-foreground">No funnel data yet</p>
                <p className="text-sm text-muted-foreground mt-1">Approve applications to populate the funnel.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-card-border">
          <CardHeader>
            <CardTitle>Creator Acquisition by Source</CardTitle>
          </CardHeader>
          <CardContent>
            {acquisitionSources.length > 0 ? (
              <div className="h-80 flex flex-col">
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Tooltip />
                      <Pie data={acquisitionSources} dataKey="creators" nameKey="source" innerRadius={60} outerRadius={100}>
                        {acquisitionSources.map((entry: any, index: number) => (
                          <Cell key={entry.source} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2 pt-4 text-sm">
                  {acquisitionSources.map((entry: { source: string; creators: number }) => (
                    <div key={entry.source} className="flex items-center justify-between">
                      <span>{entry.source}</span>
                      <span className="text-muted-foreground">{entry.creators} creators</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <TrendingUp className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                <p className="text-muted-foreground">No acquisition data yet</p>
                <p className="text-sm text-muted-foreground mt-1">UTM tags will populate this view automatically.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className={`grid gap-6 ${!applicationId ? "lg:grid-cols-2" : ""}`}>
        <Card className="border-card-border">
          <CardHeader>
            <CardTitle>Creator Geographic Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <GeographicHeatmap data={geography} />
          </CardContent>
        </Card>

        {!applicationId && (
          <Card className="border-card-border">
            <CardHeader>
              <CardTitle>Performance by Offer</CardTitle>
            </CardHeader>
            <CardContent>
              {analytics?.offerBreakdown && analytics.offerBreakdown.length > 0 ? (
                <div className="space-y-4">
                  {analytics.offerBreakdown.map((offer: any) => (
                    <div key={offer.offerId} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <h4 className="font-semibold">{offer.offerTitle}</h4>
                        <p className="text-sm text-muted-foreground">{offer.companyName}</p>
                      </div>
                      <div className="grid grid-cols-3 gap-6 text-center">
                        <div>
                          <div className="text-xs text-muted-foreground">Clicks</div>
                          <div className="font-semibold">{offer.clicks || 0}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Conv.</div>
                          <div className="font-semibold">{offer.conversions || 0}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Spent</div>
                          <div className="font-semibold font-mono">${Number(offer.earnings || 0).toFixed(2)}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <TrendingUp className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                  <p className="text-muted-foreground">No active offers yet</p>
                  <p className="text-sm text-muted-foreground mt-1">Apply to offers to start tracking performance</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <GenericErrorDialog
        open={!!errorDialog}
        onOpenChange={(open) => !open && setErrorDialog(null)}
        title={errorDialog?.title || "Error"}
        description={errorDialog?.message || "An error occurred"}
      />
    </div>
  );
}