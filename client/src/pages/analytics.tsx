import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
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
  Globe2,
  Users,
} from "lucide-react";
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
} from 'recharts';
import { TopNavBar } from "../components/TopNavBar";
import { StatsGridSkeleton, ChartSkeleton } from "../components/skeletons";
import { GenericErrorDialog } from "../components/GenericErrorDialog";

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

export default function Analytics() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [dateRange, setDateRange] = useState("30d");
  const [, params] = useRoute("/analytics/:id");
  const applicationId = params?.id;
  const [errorDialog, setErrorDialog] = useState<{ title: string; message: string } | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      window.location.href = "/login";
    }
  }, [isAuthenticated, isLoading]);

  const isCompany = user?.role === 'company';

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
    enabled: isAuthenticated,
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

  const conversionFunnel = (isCompany ? analytics?.conversionFunnel : undefined) as
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

  const acquisitionSources: { source: string; creators: number }[] = isCompany
    ? (analytics?.acquisitionSources || []).map((item: any) => ({
        source: item.source || "Direct/Other",
        creators: Number(item.creators || 0),
      }))
    : [];

  const geography: { country: string; count: number }[] = isCompany
    ? (analytics?.geography || []).map((item: any) => ({
        country: item.country || "Unknown",
        count: Number(item.count || 0),
      }))
    : [];

  const conversionRate = Number(analytics?.conversionRate ?? 0);
  const maxGeoCount = geography.reduce((max: number, item) => Math.max(max, item.count), 0);

  const totalSpend = Number(analytics?.totalSpent ?? 0);
  const totalEarnings = Number(analytics?.totalEarnings ?? 0);
  const primaryTotal = isCompany ? (totalSpend || totalEarnings) : totalEarnings;

  const affiliateBreakdown = isCompany
    ? Number(analytics?.affiliateSpent || 0)
    : Number(analytics?.affiliateEarnings || 0);
  const retainerBreakdown = isCompany
    ? Number(analytics?.retainerSpent || 0)
    : Number(analytics?.retainerEarnings || 0);

  const totalClicks = Number(analytics?.totalClicks || 0);
  const uniqueClicks = Number(analytics?.uniqueClicks || 0);
  const conversions = Number(analytics?.conversions || 0);
  const activeOffers = Number(analytics?.activeOffers || 0);
  const activeCreators = isCompany ? Number(analytics?.activeCreators || 0) : undefined;

  const exportData = () => {
    if (!analytics) {
      setErrorDialog({
        title: "No data to export",
        message: "There is no analytics data available",
      });
      return;
    }

    const csvContent = [
      ['Date', 'Clicks', 'Conversions', 'Earnings'],
      ...chartData.map((item: any) => [
        item.date,
        item.clicks || 0,
        item.conversions || 0,
        item.earnings || 0
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${dateRange}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

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

    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) {
      setErrorDialog({
        title: "Popup blocked",
        message: "Allow popups to generate the PDF report.",
      });
      return;
    }

    const now = new Date().toLocaleString();

    const summaryRows: Array<[string, string]> = isCompany
      ? [
          ["Total Spend", `$${Number(analytics.totalSpent || analytics.totalEarnings || 0).toFixed(2)}`],
          ["Affiliate Spend", `$${Number(analytics.affiliateSpent || 0).toFixed(2)}`],
          ["Retainer Spend", `$${Number(analytics.retainerSpent || 0).toFixed(2)}`],
          ["Total Clicks", `${Number(analytics.totalClicks || 0).toLocaleString()}`],
          ["Conversions", `${Number(analytics.conversions || 0).toLocaleString()}`],
          ["Conversion Rate", `${conversionRate.toFixed(1)}%`],
          ["Active Offers", `${Number(analytics.activeOffers || 0)}`],
          ["Active Creators", `${Number(analytics.activeCreators || 0)}`],
        ]
      : [
          ["Total Earnings", `$${Number(analytics.totalEarnings || 0).toFixed(2)}`],
          ["Affiliate Earnings", `$${Number(analytics.affiliateEarnings || 0).toFixed(2)}`],
          ["Retainer Earnings", `$${Number(analytics.retainerEarnings || 0).toFixed(2)}`],
          ["Total Clicks", `${Number(analytics.totalClicks || 0).toLocaleString()}`],
          ["Conversions", `${Number(analytics.conversions || 0).toLocaleString()}`],
          ["Conversion Rate", `${conversionRate.toFixed(1)}%`],
          ["Active Offers", `${Number(analytics.activeOffers || 0)}`],
        ];

    const timelineSummary = chartData
      .map(
        (item: TimelinePoint) =>
          `${item.date}: ${item.clicks.toLocaleString()} clicks, ${item.conversions.toLocaleString()} conversions, $${item.earnings.toFixed(2)} earnings`,
      )
      .join("<br/>");

    const acquisitionSummary = acquisitionSources.length
      ? acquisitionSources.map((item: { source: string; creators: number }) => `${item.source}: ${item.creators} creators`).join("<br/>")
      : "No acquisition data available.";

    const geographySummary = geography.length
      ? geography.map((item: { country: string; count: number }) => `${item.country}: ${item.count}`).join("<br/>")
      : "No geographic data available.";

    printWindow.document.write(`<!DOCTYPE html>
      <html>
        <head>
          <title>Analytics Report</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
            h1 { font-size: 24px; margin-bottom: 4px; }
            h2 { font-size: 18px; margin-top: 24px; margin-bottom: 8px; }
            table { border-collapse: collapse; width: 100%; margin-top: 12px; }
            td { border: 1px solid #e5e7eb; padding: 8px; font-size: 14px; }
            .muted { color: #6b7280; font-size: 12px; }
          </style>
        </head>
        <body>
          <h1>${applicationId
            ? isCompany
              ? "Application Analytics Report"
              : "Application Performance Report"
            : isCompany
              ? "Company Analytics Report"
              : "Creator Analytics Report"}</h1>
          <div class="muted">Generated ${now}</div>
          <h2>Summary</h2>
          <table>
            ${summaryRows.map(([label, value]) => `<tr><td><strong>${label}</strong></td><td>${value}</td></tr>`).join("")}
          </table>
          <h2>Performance Timeline</h2>
          <div>${timelineSummary || "No timeline data available."}</div>
          <h2>Conversion Funnel</h2>
          <div>${
            conversionFunnel
              ? `Applied: ${conversionFunnel.applied}<br/>Approved: ${conversionFunnel.approved}<br/>Active: ${conversionFunnel.active}<br/>Paused: ${conversionFunnel.paused}<br/>Completed: ${conversionFunnel.completed}<br/>Converted: ${conversionFunnel.conversions}`
              : "No funnel data available."
          }</div>
          <h2>Top Acquisition Sources</h2>
          <div>${acquisitionSummary}</div>
          <h2>Geographic Heatmap</h2>
          <div>${geographySummary}</div>
        </body>
      </html>`);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 300);

    toast({
      title: "PDF ready",
      description: "Use the browser dialog to save the report as PDF.",
    });
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

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="animate-pulse text-lg">Loading...</div>
    </div>;
  }

  if (analyticsLoading) {
    return (
      <div className="space-y-8">
        <TopNavBar />
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

  const renderCreatorAnalytics = () => (
    <div className="space-y-8">
      <TopNavBar />
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
          <Button
            variant="outline"
            data-testid="button-export"
            className="gap-2"
            onClick={exportData}
            disabled={!analytics || chartData.length === 0}
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
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

      {/* Enhanced Performance Graph with Wave-like Lines */}
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
                    {/* Gradient for clicks line */}
                    <linearGradient id="colorClicks" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                    {/* Gradient for conversions line */}
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
                  {/* Average Click Reference Line */}
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
                  {/* Average Conversion Reference Line */}
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
                  {/* Wave-like Line for Clicks */}
                  <Line 
                    type="natural"
                    dataKey="clicks" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    dot={{ 
                      r: 6,
                      strokeWidth: 3, 
                      fill: 'hsl(var(--background))',
                      stroke: 'hsl(var(--primary))',
                    }}
                    activeDot={{ 
                      r: 8,
                      strokeWidth: 3,
                      fill: 'hsl(var(--primary))',
                      stroke: 'hsl(var(--background))',
                    }}
                    name="clicks"
                    fill="url(#colorClicks)"
                    animationDuration={1000}
                    animationEasing="ease-in-out"
                  />
                  {/* Wave-like Line for Conversions */}
                 <Line 
                    type="monotone" 
                    dataKey="clicks" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={3}
                    strokeLinecap="round"  
                    strokeLinejoin="round"  
                    dot={{ 
                      r: 6,  
                      strokeWidth: 3, 
                      fill: 'hsl(var(--background))',
                      stroke: 'hsl(var(--primary))',
                    }}
                    activeDot={{ 
                      r: 8,  
                      strokeWidth: 3,
                      fill: 'hsl(var(--primary))',
                      stroke: 'hsl(var(--background))',
                      filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))'  
                    }}
                    name="Clicks"
                    fill="url(#colorClicks)"
                    animationDuration={1000}  
                    animationEasing="ease-in-out"
                  />
                    <Line 
                      type="natural"  
                      dataKey="conversions" 
                      stroke="#f97316" 
                      strokeWidth={3}
                      strokeLinecap="round"  
                      strokeLinejoin="round"  
                      dot={{ 
                        r: 6,  
                        strokeWidth: 3, 
                        fill: 'hsl(var(--background))',
                        stroke: '#f97316',
                      }}
                      activeDot={{ 
                        r: 8,  
                        strokeWidth: 3,
                        fill: '#f97316',
                        stroke: 'hsl(var(--background))',
                        filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' 
                      }}
                      name="Conversions"
                      fill="url(#colorConversions)"
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

      {/* Offer breakdown section */}
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
    </div>
  );

  if (!isCompany) {
    return renderCreatorAnalytics();
  }

  return (
    <div className="space-y-8">
      <TopNavBar />
      
      {/* Header */}
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
          <Button
            variant="outline"
            data-testid="button-export"
            className="gap-2"
            onClick={exportData}
            disabled={!analytics || chartData.length === 0}
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            onClick={exportPdf}
            disabled={!analytics}
          >
            <FileText className="h-4 w-4" />
            PDF Report
          </Button>
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

      {/* Stats Grid */}
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

      {/* Trend Charts */}
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

      {/* Conversion & Acquisition */}
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

      {/* Geography & Offer Breakdown */}
      <div className={`grid gap-6 ${!applicationId ? "lg:grid-cols-2" : ""}`}>
        <Card className="border-card-border">
          <CardHeader>
            <CardTitle>Geographic Heatmap</CardTitle>
          </CardHeader>
          <CardContent>
            {geography.length > 0 ? (
              <div className="space-y-3">
                {geography.map((entry: { country: string; count: number }) => (
                  <div key={entry.country} className="flex items-center gap-3">
                    <div className="w-32 text-sm font-medium truncate" title={entry.country}>
                      {entry.country}
                    </div>
                    <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-primary/30 to-primary"
                        style={{ width: maxGeoCount ? `${(entry.count / maxGeoCount) * 100}%` : '4px' }}
                      />
                    </div>
                    <div className="w-10 text-xs text-muted-foreground text-right">{entry.count}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Globe2 className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                <p className="text-muted-foreground">No geographic data yet</p>
                <p className="text-sm text-muted-foreground mt-1">Clicks with location data will appear here.</p>
              </div>
            )}
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
        isOpen={!!errorDialog}
        onClose={() => setErrorDialog(null)}
        title={errorDialog?.title || "Error"}
        message={errorDialog?.message || "An error occurred"}
      />
    </div>
  );
}