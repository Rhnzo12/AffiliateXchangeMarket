import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { GenericErrorDialog } from "../components/GenericErrorDialog";
import { FirstTimeTutorial } from "../components/FirstTimeTutorial";
import { useTutorial } from "../hooks/useTutorial";
import { TUTORIAL_IDS, creatorDashboardTutorialConfig } from "../lib/tutorialConfig";
import { useCreatorPageTour } from "../components/CreatorTour";
import { CREATOR_TOUR_IDS, dashboardTourSteps } from "../lib/creatorTourConfig";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import {
  TrendingUp,
  Heart,
  Play,
  Settings,
  ClipboardList,
  CreditCard,
  ArrowUpRight,
  Activity,
} from "lucide-react";
import { Link } from "wouter";
import { proxiedSrc } from "../lib/image";
import { TopNavBar } from "../components/TopNavBar";
import { OfferCardSkeleton } from "../components/skeletons";
import { WelcomeCarousel } from "../components/WelcomeCarousel";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// Helper function to format commission display
const formatCommission = (offer: any) => {
  if (offer.commissionAmount) {
    return `$${offer.commissionAmount}`;
  } else if (offer.commissionPercentage) {
    return `${offer.commissionPercentage}%`;
  } else if (offer.commissionRate) {
    return `$${offer.commissionRate}`;
  }
  return "$0";
};

export default function CreatorDashboard() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [errorDialog, setErrorDialog] = useState<{ title: string; message: string } | null>(null);
  const { showTutorial, completeTutorial } = useTutorial(TUTORIAL_IDS.CREATOR_DASHBOARD);

  // Quick Guide Tour - only starts after initial tutorial is dismissed
  useCreatorPageTour(CREATOR_TOUR_IDS.DASHBOARD, dashboardTourSteps, !showTutorial);

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

  const { data: recommendedOffersData, isLoading: offersLoading } = useQuery<any>({
    queryKey: ["/api/offers/recommended"],
    enabled: isAuthenticated,
  });

  const {
    data: analytics,
    isLoading: activityLoading,
    isError: activityError,
    dataUpdatedAt: activityUpdatedAt,
    isFetching: activityFetching,
  } = useQuery<any>({
    queryKey: ["/api/analytics", { range: "7d" }],
    queryFn: async () => {
      const res = await fetch(`/api/analytics?range=7d`, { credentials: "include" });
      if (!res.ok) {
        if (res.status === 401) {
          window.location.href = "/api/login";
          throw new Error("Unauthorized");
        }
        throw new Error("Failed to fetch activity");
      }
      return res.json();
    },
    enabled: isAuthenticated,
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  });

  const formattedActivityUpdatedAt = useMemo(() => {
    if (!activityUpdatedAt) {
      return "Fetching latest activity...";
    }

    return new Date(activityUpdatedAt).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }, [activityUpdatedAt]);

  const activityChartData = useMemo(
    () =>
      (analytics?.chartData || []).map((item: any) => ({
        date: item.date,
        clicks: Number(item.clicks || 0),
        conversions: Number(item.conversions || 0),
        earnings: Number(item.earnings || 0),
      })),
    [analytics?.chartData]
  );

  const hasActivity = useMemo(
    () =>
      activityChartData.some(
        (item: { clicks: number; conversions: number; earnings: number }) =>
          item.clicks > 0 || item.conversions > 0 || item.earnings > 0
      ),
    [activityChartData]
  );

  const snapshotChartData = useMemo(() => {
    if (hasActivity) {
      return activityChartData;
    }

    // Light snapshot data to keep the chart populated when there's no live activity yet
    return [
      { date: "Mon", earnings: 24 },
      { date: "Tue", earnings: 32 },
      { date: "Wed", earnings: 28 },
      { date: "Thu", earnings: 40 },
      { date: "Fri", earnings: 36 },
      { date: "Sat", earnings: 44 },
      { date: "Sun", earnings: 38 },
    ];
  }, [activityChartData, hasActivity]);

  // Handle the recommended offers response
  const recommendedOffers = Array.isArray(recommendedOffersData) ? recommendedOffersData : [];
  const hasNoNiches = recommendedOffersData?.error === 'no_niches';
  const profileNotFound = recommendedOffersData?.error === 'profile_not_found';

  const quickActions = [
    {
      title: "View Applications",
      description: "Track statuses, respond to brands, and keep your pitches up to date.",
      href: "/applications",
      icon: ClipboardList,
      cta: "Manage applications",
    },
    {
      title: "Update Profile & Niches",
      description: "Tune your creator profile so recommendations stay aligned with your audience.",
      href: "/settings",
      icon: Settings,
      cta: "Edit profile",
    },
    {
      title: "Payment Settings",
      description: "Confirm payout details to make sure you get paid without delays.",
      href: "/creator/payment-settings",
      icon: CreditCard,
      cta: "Manage payouts",
    },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <TopNavBar />
      
      {/* Welcome Message */}
      <div>
        <h1 className="text-3xl font-bold">Welcome back, {user?.firstName || 'Creator'}!</h1>
        <p className="text-muted-foreground mt-1">Here's an overview of your creator journey</p>
      </div>

      {/* Welcome Carousel - Perks */}
      <div className="w-full">
        <div className="mb-4">
          <h2 className="text-xl font-semibold">Discover Your Perks</h2>
          <p className="text-sm text-muted-foreground">Everything you need to succeed as a creator</p>
        </div>
        <WelcomeCarousel />
      </div>

      {/* Light analytics snapshot only (full KPIs live in Analytics) */}
      <Card className="border-card-border bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 overflow-hidden">
        <CardContent className="p-6 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Activity className="h-5 w-5 text-primary" />
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex flex-col">
                    <span className="text-2xl font-bold">Activity</span>
                    <span className="text-xs text-muted-foreground">
                      Last updated {activityFetching ? "(refreshing...)" : formattedActivityUpdatedAt}
                    </span>
                  </div>
                </div>
              </div>
            <Link href="/analytics">
              <Button className="gap-2 bg-gray-200 text-black hover:bg-gray-300 border-0">
                <TrendingUp className="h-4 w-4" />
                View full analytics suite
              </Button>
            </Link>
          </div>

          <div className="h-48 w-full relative">
            {activityLoading ? (
              <div className="h-full w-full rounded-lg bg-muted animate-pulse" />
            ) : activityError ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Unable to load activity right now.
              </div>
            ) : (
              <>
                {!hasActivity && (
                  <div className="absolute right-3 top-3 z-10 rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-primary shadow-sm">
                    Snapshot preview
                  </div>
                )}
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={snapshotChartData}
                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="activityFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.25} />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={(value: number, name) =>
                        name === 'earnings' ? `$${value.toFixed(2)}` : value
                      }
                      labelFormatter={(label) => `Date: ${label}`}
                    />
                    <Area
                      type="monotone"
                      dataKey="earnings"
                      name="Earnings"
                      stroke="#0ea5e9"
                      fill="url(#activityFill)"
                      strokeWidth={2}
                      activeDot={{ r: 4 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Performance section replaced with quick actions */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-xl font-semibold">Quick Actions</h2>
          <span className="text-sm text-muted-foreground">Pick where to go next</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Card key={action.title} className="border-card-border h-full">
                <CardContent className="p-6 flex flex-col gap-4 h-full">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold leading-tight">{action.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{action.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 mt-auto">
                    <Link href={action.href}>
                      <Button size="sm" className="gap-2 bg-gray-200 text-black hover:bg-gray-300 border-0">
                        {action.cta}
                        <ArrowUpRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Recommended For You */}
      <div>
        <div className="mb-4">
          <h2 className="text-xl font-semibold">Recommended For You</h2>
          <p className="text-sm text-muted-foreground">Offers matching niche nierd audience</p>
        </div>

        {offersLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="border-card-border animate-pulse">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="h-14 w-14 rounded-lg bg-muted" />
                  <div className="flex-1">
                    <div className="h-5 bg-muted rounded w-32 mb-2" />
                    <div className="h-4 bg-muted rounded w-48" />
                  </div>
                  <div className="h-9 bg-muted rounded w-24" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : hasNoNiches ? (
          <Card className="border-card-border">
            <CardContent className="p-12 text-center">
              <Settings className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-muted-foreground font-medium">Set Your Content Niches</p>
              <p className="text-sm text-muted-foreground mt-2 mb-4">
                Please add your content niches in your profile to get personalized offer recommendations
              </p>
              <Link href="/settings">
                <Button>
                  <Settings className="h-4 w-4 mr-2" />
                  Update Profile
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : profileNotFound ? (
          <Card className="border-card-border">
            <CardContent className="p-12 text-center">
              <Heart className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-muted-foreground">Complete your profile first</p>
              <p className="text-sm text-muted-foreground mt-2 mb-4">
                Create your creator profile to get personalized recommendations
              </p>
              <Link href="/settings">
                <Button>Complete Profile</Button>
              </Link>
            </CardContent>
          </Card>
        ) : !recommendedOffers || recommendedOffers.length === 0 ? (
          <Card className="border-card-border">
            <CardContent className="p-12 text-center">
              <Heart className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-muted-foreground">No recommended offers yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Check back soon for new offers matching your niches
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recommendedOffers.slice(0, 4).map((offer: any) => (
              <Card 
                key={offer.id} 
                className="border-card-border hover:shadow-md hover:border-primary/30 transition-all duration-200"
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    {/* Offer Icon/Image */}
                    <div className="h-14 w-14 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0 overflow-hidden">
                      {offer.featuredImageUrl ? (
                        <img 
                          src={proxiedSrc(offer.featuredImageUrl)} 
                          alt={offer.title} 
                          className="w-full h-full object-cover rounded-lg" 
                        />
                      ) : (
                        <div className="h-8 w-8 rounded-md bg-primary/20 flex items-center justify-center">
                          <Play className="h-4 w-4 text-primary" />
                        </div>
                      )}
                    </div>

                    {/* Offer Details */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-base truncate">{offer.title}</h3>
                      <p className="text-sm text-muted-foreground truncate">
                        Track earnings at your in iche audens of {formatCommission(offer)} per sale
                      </p>
                    </div>

                    {/* View Offer Button */}
                    <Link href={`/offers/${offer.id}`}>
                      <Button size="sm" className="shrink-0">
                        View Offer
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <GenericErrorDialog
        open={!!errorDialog}
        onOpenChange={(open) => !open && setErrorDialog(null)}
        title={errorDialog?.title}
        description={errorDialog?.message}
      />

      <FirstTimeTutorial
        open={showTutorial}
        onComplete={completeTutorial}
        config={creatorDashboardTutorialConfig}
      />
    </div>
  );
}