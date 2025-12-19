import * as React from "react";
import type { TutorialStep, TutorialConfig } from "../components/FirstTimeTutorial";

// Tutorial IDs
export const TUTORIAL_IDS = {
  CREATOR_DASHBOARD: "creator-dashboard-tutorial",
  COMPANY_DASHBOARD: "company-dashboard-tutorial",
  BROWSE_PAGE: "browse-page-tutorial",
  ANALYTICS: "analytics-tutorial",
} as const;

// ============================================
// Preview Components for Tutorial Cards
// ============================================

// Creator Dashboard Preview: Analytics Chart
function AnalyticsPreview() {
  return (
    <div className="w-full max-w-[200px] space-y-3">
      <div className="rounded-lg border border-border bg-white p-3">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Revenue trend</span>
          <span>Last 7 days</span>
        </div>
        <div className="mt-3 grid grid-cols-7 gap-1 h-16 items-end">
          {[20, 45, 35, 70, 60, 80, 65].map((height, i) => (
            <div key={i} className="rounded-sm bg-primary/15 overflow-hidden h-full">
              <div className="w-full bg-primary" style={{ height: `${height}%` }} />
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs font-semibold text-foreground">+$1,234 compared to prior period</p>
      </div>
    </div>
  );
}

// Creator Dashboard Preview: Offer Card
function OfferCardPreview() {
  return (
    <div className="w-full max-w-[200px] rounded-lg border border-border bg-white p-3">
      <div className="flex items-center gap-3 mb-3">
        <div className="h-10 w-10 rounded-md border border-primary/30 bg-primary/5" />
        <div className="space-y-1">
          <p className="text-xs font-semibold text-foreground">Brand partnership</p>
          <p className="text-[10px] text-muted-foreground">Lifestyle • Multi-channel</p>
        </div>
      </div>
      <div className="space-y-1 text-[11px] text-muted-foreground">
        <div className="flex items-center justify-between">
          <span>Commission</span>
          <span className="text-foreground font-semibold">15% tiered</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Deliverables</span>
          <span className="text-foreground">Video + static</span>
        </div>
      </div>
    </div>
  );
}

// Creator Dashboard Preview: Quick Actions
function QuickActionsPreview() {
  return (
    <div className="w-full max-w-[200px] rounded-lg border border-border bg-white p-3 space-y-2">
      {["Browse offers", "Review applications", "Update settings"].map((label, i) => (
        <div
          key={label}
          className="flex items-center justify-between rounded-md border border-border/60 bg-muted/30 px-3 py-2"
        >
          <span className="text-[11px] font-medium text-foreground">{label}</span>
          <span className="text-[10px] text-muted-foreground">{i === 0 ? "2 min" : i === 1 ? "3 min" : "1 min"}</span>
        </div>
      ))}
    </div>
  );
}

// Company Dashboard Preview: Stats Cards
function StatsPreview() {
  return (
    <div className="w-full max-w-[200px] rounded-lg border border-border bg-white p-3 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: "Active creators", value: "24", delta: "+6 this month" },
          { label: "Live offers", value: "8", delta: "Stable" },
          { label: "Clicks", value: "1.2K", delta: "+14%" },
          { label: "Applications", value: "45", delta: "4 awaiting review" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-md bg-muted/30 border border-border/60 p-2">
            <p className="text-[10px] text-muted-foreground">{stat.label}</p>
            <p className="text-sm font-semibold text-foreground">{stat.value}</p>
            <p className="text-[10px] text-emerald-600">{stat.delta}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// Company Dashboard Preview: Create Offer
function CreateOfferPreview() {
  return (
    <div className="w-full max-w-[200px] rounded-lg border border-border bg-white p-3 space-y-2">
      <p className="text-[11px] font-semibold text-foreground">Create a new offer</p>
      <div className="space-y-2 text-[11px] text-muted-foreground">
        {["Define brief", "Set compensation", "Publish to marketplace"].map((step, i) => (
          <div key={step} className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-primary" />
            <div className="flex-1 flex items-center justify-between">
              <span>{step}</span>
              <span className="text-[10px] text-muted-foreground">Step {i + 1}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Company Dashboard Preview: Applications List
function ApplicationsPreview() {
  return (
    <div className="w-full max-w-[200px] rounded-lg border border-border bg-white p-3 space-y-2">
      {["Pending review", "Approved", "Needs clarification"].map((status, i) => (
        <div key={status} className="flex items-center justify-between p-2 rounded-md border border-border/60 bg-muted/30">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-full bg-gradient-to-br from-primary/10 to-primary/5 border border-border" />
            <span className="text-[11px] font-medium text-foreground">Creator {i + 1}</span>
          </div>
          <span className="text-[10px] text-muted-foreground">{status}</span>
        </div>
      ))}
    </div>
  );
}

// Browse Page Preview: Search & Filter
function SearchFilterPreview() {
  return (
    <div className="w-full max-w-[200px] rounded-lg border border-border bg-white p-3 space-y-2">
      <div className="p-2 rounded-md border border-border mb-1 bg-muted/30 text-[10px] text-muted-foreground">
        Search offers by category, niche, or commission type
      </div>
      <div className="flex gap-1 flex-wrap">
        {["Fashion", "Tech", "Health"].map((cat, i) => (
          <span
            key={cat}
            className={`text-[9px] px-2 py-1 rounded-full border ${
              i === 0 ? "bg-primary text-primary-foreground border-primary" : "bg-muted/50 border-border"
            }`}
          >
            {cat}
          </span>
        ))}
      </div>
    </div>
  );
}

// Browse Page Preview: Offer Grid
function OfferGridPreview() {
  return (
    <div className="w-full max-w-[200px] grid grid-cols-2 gap-2">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="rounded-md border border-border bg-white p-2">
          <div className="h-8 w-full rounded-sm bg-muted/50 mb-1" />
          <div className="h-1.5 w-3/4 bg-muted rounded" />
          <div className="h-1 w-1/2 bg-muted rounded mt-1" />
        </div>
      ))}
    </div>
  );
}

// Browse Page Preview: Favorites
function FavoritesPreview() {
  return (
    <div className="w-full max-w-[200px] rounded-lg border border-border bg-white p-3">
      <p className="text-[11px] font-semibold mb-2 text-foreground">Saved offers</p>
      <div className="space-y-1.5">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center justify-between p-1.5 rounded-md border border-border/60 bg-muted/30">
            <span className="text-[10px] font-medium">Saved Offer {i}</span>
            <span className="text-[9px] text-muted-foreground">Pinned</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Analytics Preview: Earnings Dashboard
function EarningsDashboardPreview() {
  return (
    <div className="w-full max-w-[200px] rounded-lg border border-border bg-white p-3">
      <div className="text-[11px] text-muted-foreground">Total earnings</div>
      <div className="text-lg font-bold text-foreground mb-2">$2,847.50</div>
      <div className="flex items-end gap-1 h-10">
        {[30, 45, 35, 60, 50, 75, 65].map((height, i) => (
          <div key={i} className="flex-1 bg-primary/10 rounded-t" style={{ height: `${height}%` }}>
            <div className="w-full bg-primary rounded-t" style={{ height: `${height * 0.7}%` }} />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between mt-2 text-[10px] text-muted-foreground">
        <span>Month over month</span>
        <span className="text-emerald-600 font-semibold">+12.5%</span>
      </div>
    </div>
  );
}

// Analytics Preview: Performance Charts
function PerformanceChartsPreview() {
  return (
    <div className="w-full max-w-[200px] rounded-lg border border-border bg-white p-3 space-y-2">
      <div className="text-[11px] font-semibold text-foreground">Performance snapshot</div>
      {[{ label: "Clicks", value: 0.75 }, { label: "Conversions", value: 0.52 }, { label: "Growth", value: 0.66 }].map(
        (metric) => (
          <div key={metric.label} className="space-y-1">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>{metric.label}</span>
              <span className="text-foreground font-semibold">{Math.round(metric.value * 100)}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full" style={{ width: `${metric.value * 100}%` }} />
            </div>
          </div>
        )
      )}
    </div>
  );
}

// Analytics Preview: Export Options
function ExportOptionsPreview() {
  return (
    <div className="w-full max-w-[200px] rounded-lg border border-border bg-white p-3 space-y-2">
      <div className="text-[11px] font-semibold text-foreground">Export data</div>
      {["PDF report", "CSV export", "Analytics API"].map((item, i) => (
        <div key={item} className="flex items-center justify-between p-2 rounded-md border border-border/60 bg-muted/30">
          <span className="text-[10px] font-medium">{item}</span>
          <span className="text-[9px] text-muted-foreground">{i === 0 ? "For leadership" : i === 1 ? "For finance" : "For devs"}</span>
        </div>
      ))}
    </div>
  );
}

// ============================================
// New Tutorial Configs (Star Shop Style)
// ============================================

export const creatorDashboardTutorialConfig: TutorialConfig = {
  badgeText: "Creator workspace",
  headline: "Essentials to grow partnerships",
  features: [
    {
      accentText: "Performance insights",
      accentColor: "teal",
      subtitle: "Concise view of your recent revenue trends",
      preview: <AnalyticsPreview />,
    },
    {
      accentText: "Offer pipeline",
      accentColor: "purple",
      subtitle: "Prioritized brands and commission details",
      preview: <OfferCardPreview />,
    },
    {
      accentText: "Operational shortcuts",
      accentColor: "orange",
      subtitle: "Stay organized with clear next steps",
      preview: <QuickActionsPreview />,
    },
  ],
  welcomeTitle: "Creator dashboard overview",
  welcomeDescription:
    "Track performance, review recommended offers, and keep your deliverables organized from one streamlined workspace. Update your niches in Settings to tailor recommendations to your audience.",
  learnMoreText: "View help center",
  learnMoreLink: "/help",
  ctaText: "Get Started",
};

export const companyDashboardTutorialConfig: TutorialConfig = {
  badgeText: "Business account",
  headline: "Key steps to engage top creators",
  features: [
    {
      accentText: "Performance overview",
      accentColor: "teal",
      subtitle: "Operational metrics across creators and offers",
      preview: <StatsPreview />,
    },
    {
      accentText: "Offer creation",
      accentColor: "purple",
      subtitle: "Standardized steps to publish quality briefs",
      preview: <CreateOfferPreview />,
    },
    {
      accentText: "Application review",
      accentColor: "orange",
      subtitle: "Consistent approvals and communication",
      preview: <ApplicationsPreview />,
    },
  ],
  welcomeTitle: "Welcome to your company dashboard",
  welcomeDescription:
    "Run campaigns with clear visibility. Publish offers, review applications with consistent criteria, and monitor performance without distractions. Your workspace is built for professional teams managing creator partnerships.",
  learnMoreText: "View help center",
  learnMoreLink: "/help",
  ctaText: "Get Started",
};

export const browsePageTutorialConfig: TutorialConfig = {
  badgeText: "Offer discovery",
  headline: "Find partnerships efficiently",
  features: [
    {
      accentText: "Smart search",
      accentColor: "teal",
      subtitle: "Filter by category, niche, or commission type",
      preview: <SearchFilterPreview />,
    },
    {
      accentText: "Curated catalog",
      accentColor: "purple",
      subtitle: "Structured offer cards from verified brands",
      preview: <OfferGridPreview />,
    },
    {
      accentText: "Workspace favorites",
      accentColor: "orange",
      subtitle: "Save and revisit shortlists quickly",
      preview: <FavoritesPreview />,
    },
  ],
  welcomeTitle: "Discover affiliate opportunities",
  welcomeDescription:
    "Search and evaluate offers that align with your brand and audience. Use filters to refine results, compare compensation, and maintain a shortlist of opportunities worth pursuing.",
  learnMoreText: "Browse tips",
  learnMoreLink: "/help",
  ctaText: "Start Browsing",
};

export const analyticsTutorialConfig: TutorialConfig = {
  badgeText: "Reporting",
  headline: "Clear performance reporting",
  features: [
    {
      accentText: "Track earnings",
      accentColor: "teal",
      subtitle: "Transparent revenue trends and pacing",
      preview: <EarningsDashboardPreview />,
    },
    {
      accentText: "Engagement quality",
      accentColor: "purple",
      subtitle: "Clicks, conversions, and growth in one view",
      preview: <PerformanceChartsPreview />,
    },
    {
      accentText: "Shareable reports",
      accentColor: "orange",
      subtitle: "Consistent exports for stakeholders",
      preview: <ExportOptionsPreview />,
    },
  ],
  welcomeTitle: "Welcome to your analytics dashboard",
  welcomeDescription:
    "Monitor affiliate performance with focused reporting. Review earnings, conversion quality, and growth trajectories, then export summaries aligned to leadership, finance, or technical audiences.",
  learnMoreText: "View analytics guide",
  learnMoreLink: "/help",
  ctaText: "Get Started",
};

// ============================================
// Legacy Step-based Configs (Backwards Compatibility)
// ============================================

// Creator Dashboard Tutorial Steps
export const creatorDashboardTutorialSteps: TutorialStep[] = [
  {
    title: "Welcome to Your Dashboard!",
    description:
      "This is your central hub for managing your affiliate campaigns. Here you can track your performance, view recommended offers, and take quick actions.",
  },
  {
    title: "Discover Your Perks",
    description:
      "Check out the carousel above to learn about all the benefits of being a creator on our platform, including competitive commissions and real-time analytics.",
  },
  {
    title: "Track Your Activity",
    description:
      "The activity chart shows your earnings over time. You can see trends in your performance and click 'View full analytics suite' for detailed insights.",
  },
  {
    title: "Quick Actions",
    description:
      "Use the Quick Actions cards to navigate to common tasks like browsing offers, viewing applications, checking messages, and updating your profile.",
  },
  {
    title: "Recommended Offers",
    description:
      "We match you with offers based on your content niches. Make sure to set up your niches in Settings to get personalized recommendations!",
  },
];

// Company Dashboard Tutorial Steps
export const companyDashboardTutorialSteps: TutorialStep[] = [
  {
    title: "Welcome to Your Company Dashboard!",
    description:
      "This is your command center for managing affiliate campaigns. Track creator performance, manage applications, and monitor your offers.",
  },
  {
    title: "Create New Offers",
    description:
      "Click the 'Create New Offer' button to post new affiliate opportunities. Creators will be able to discover and apply to your offers.",
  },
  {
    title: "Monitor Your Stats",
    description:
      "The stats cards show your active creators, live offers, total applications, and click performance at a glance.",
  },
  {
    title: "Manage Applications",
    description:
      "Review creator applications in the 'Recent Applications' section. You can approve, reject, or mark work as complete from here.",
  },
  {
    title: "Top Performing Creators",
    description:
      "See which creators are driving the most results for your campaigns. Use this insight to build stronger partnerships.",
  },
];

// Browse Page Tutorial Steps
export const browsePageTutorialSteps: TutorialStep[] = [
  {
    title: "Discover Affiliate Offers",
    description:
      "Welcome to the Browse page! Here you can find affiliate opportunities from verified brands that match your content style.",
  },
  {
    title: "Filter by Category",
    description:
      "Use the category pills at the top to quickly filter offers by type. Select 'Trending' for popular offers or choose specific niches.",
  },
  {
    title: "Advanced Filters",
    description:
      "Click the 'Filters' button to access advanced options like commission type, minimum payout, company rating, and more.",
  },
  {
    title: "Save Your Favorite Offers",
    description:
      "Click the heart icon on any offer card to save it to your favorites. You can access them later from the Favorites page.",
  },
  {
    title: "Save Your Searches",
    description:
      "Found a useful filter combination? Save it using the 'Save search' button to quickly apply the same filters later.",
  },
];
