import * as React from "react";
import { TourStep } from "../contexts/CompanyTourContext";
import {
  LayoutDashboard,
  PanelLeft,
  Plus,
  FileText,
  TrendingUp,
  Filter,
  Edit,
  DollarSign,
  CalendarClock,
  Users,
  Video,
  BarChart3,
  Star,
  ShieldCheck,
  CreditCard,
  Download,
  Eye,
  CheckCircle2,
} from "lucide-react";

// Tour IDs for each company page
export const COMPANY_TOUR_IDS = {
  DASHBOARD: "company-dashboard-tour",
  OFFERS: "company-offers-tour",
  OFFER_CREATE: "company-offer-create-tour",
  OFFER_DETAIL: "company-offer-detail-tour",
  RETAINERS: "company-retainers-tour",
  RETAINER_DETAIL: "company-retainer-detail-tour",
  CREATOR_WORKFLOW: "company-creator-workflow-tour",
  ANALYTICS: "company-analytics-tour",
  REVIEWS: "company-reviews-tour",
  WEBSITE_VERIFICATION: "company-website-verification-tour",
  PAYMENT_SETTINGS: "company-payment-settings-tour",
} as const;

// Dashboard Tour Steps
export const dashboardTourSteps: TourStep[] = [
  {
    target: "body",
    title: "Welcome to Your Company Dashboard!",
    content: "Let's take a quick tour to help you get started. We'll show you the key features and how to make the most of your company account.",
    placement: "center",
    icon: <LayoutDashboard className="h-7 w-7 text-primary" />,
  },
  {
    target: "[data-testid='button-sidebar-toggle']",
    title: "Navigation Sidebar",
    content: "Access all your company features from the sidebar. Click here to expand or collapse it anytime.",
    placement: "right",
    icon: <PanelLeft className="h-7 w-7 text-primary" />,
  },
  {
    target: "[data-testid='button-create-offer']",
    title: "Create Your First Offer",
    content: "Start attracting creators by creating affiliate offers. Click here to set up commission rates, requirements, and promotional materials.",
    placement: "bottom",
    icon: <Plus className="h-7 w-7 text-primary" />,
  },
  {
    target: "[data-testid='badge-applications-count']",
    title: "Manage Applications",
    content: "Review and manage creator applications here. You can approve, reject, or mark work as complete directly from the dashboard.",
    placement: "left",
    icon: <FileText className="h-7 w-7 text-primary" />,
  },
];

// Offers Page Tour Steps
export const offersTourSteps: TourStep[] = [
  {
    target: "body",
    title: "Your Offers Hub",
    content: "This is where you manage all your affiliate offers. Create, edit, and track the performance of each offer.",
    placement: "center",
    icon: <TrendingUp className="h-7 w-7 text-primary" />,
  },
  {
    target: "[data-testid='button-create-offer']",
    title: "Create New Offer",
    content: "Click here to create a new affiliate offer. You can set commission rates, add promotional materials, and define creator requirements.",
    placement: "bottom",
    icon: <Plus className="h-7 w-7 text-primary" />,
  },
  {
    target: ".grid.md\\:grid-cols-2",
    title: "Filter Your Offers",
    content: "Use these filters to find specific offers by status, commission type, or niche category.",
    placement: "bottom",
    icon: <Filter className="h-7 w-7 text-primary" />,
  },
];

// Offer Create Tour Steps
export const offerCreateTourSteps: TourStep[] = [
  {
    target: "body",
    title: "Create Your Affiliate Offer",
    content: "Let's walk through creating an offer that will attract quality creators to promote your products or services.",
    placement: "center",
    icon: <Edit className="h-7 w-7 text-primary" />,
  },
  {
    target: "input[name='title']",
    title: "Offer Title",
    content: "Give your offer a compelling title that clearly describes what creators will be promoting.",
    placement: "bottom",
    icon: <FileText className="h-7 w-7 text-primary" />,
  },
  {
    target: "select, [role='combobox']",
    title: "Commission Settings",
    content: "Set your commission type and rate. Higher commissions typically attract more creators!",
    placement: "bottom",
    icon: <DollarSign className="h-7 w-7 text-primary" />,
  },
];

// Offer Detail Tour Steps
export const offerDetailTourSteps: TourStep[] = [
  {
    target: "body",
    title: "Offer Details",
    content: "View and manage your offer details. From here you can see performance metrics, edit settings, and manage applications.",
    placement: "center",
    icon: <Eye className="h-7 w-7 text-primary" />,
  },
];

// Retainers Page Tour Steps
export const retainersTourSteps: TourStep[] = [
  {
    target: "body",
    title: "Monthly Retainer Contracts",
    content: "Manage ongoing partnerships with creators through monthly retainer contracts. This provides consistent promotion for your brand.",
    placement: "center",
    icon: <CalendarClock className="h-7 w-7 text-primary" />,
  },
];

// Retainer Detail Tour Steps
export const retainerDetailTourSteps: TourStep[] = [
  {
    target: "body",
    title: "Retainer Contract Details",
    content: "Review the retainer contract details, manage creator applications, and track deliverables submitted by creators.",
    placement: "center",
    icon: <CheckCircle2 className="h-7 w-7 text-primary" />,
  },
];

// Creator Workflow Tour Steps
export const creatorWorkflowTourSteps: TourStep[] = [
  {
    target: "body",
    title: "Creator Workflow Hub",
    content: "This is your central hub for managing all creator-related activities. Review applications, track active creators, and manage submitted content.",
    placement: "center",
    icon: <Users className="h-7 w-7 text-primary" />,
  },
  {
    target: "[role='tablist']",
    title: "Switch Between Views",
    content: "Use these tabs to switch between Applications, Active Creators, and Video submissions.",
    placement: "bottom",
    icon: <Video className="h-7 w-7 text-primary" />,
  },
];

// Analytics Tour Steps
export const analyticsTourSteps: TourStep[] = [
  {
    target: "body",
    title: "Analytics Dashboard",
    content: "Track your campaign performance with detailed analytics. Monitor clicks, conversions, and revenue across all your offers.",
    placement: "center",
    icon: <BarChart3 className="h-7 w-7 text-primary" />,
  },
  {
    target: ".recharts-wrapper, [data-testid='analytics-chart'], .chart-container",
    title: "Performance Charts",
    content: "View detailed charts showing your spending trends, creator activity, and conversion performance over time.",
    placement: "bottom",
    icon: <TrendingUp className="h-7 w-7 text-primary" />,
  },
  {
    target: "[data-testid='button-export']",
    title: "Export Data",
    content: "Download your analytics data as PDF or CSV for detailed reporting and analysis.",
    placement: "bottom",
    icon: <Download className="h-7 w-7 text-primary" />,
  },
];

// Reviews Tour Steps
export const reviewsTourSteps: TourStep[] = [
  {
    target: "body",
    title: "Company Reviews",
    content: "View and respond to reviews from creators. Building a positive reputation helps attract quality creators to your offers.",
    placement: "center",
    icon: <Star className="h-7 w-7 text-primary" />,
  },
];

// Website Verification Tour Steps
export const websiteVerificationTourSteps: TourStep[] = [
  {
    target: "body",
    title: "Verify Your Website",
    content: "Verify ownership of your website to build trust with creators. Verified companies get a special badge and higher visibility.",
    placement: "center",
    icon: <ShieldCheck className="h-7 w-7 text-primary" />,
  },
];

// Payment Settings Tour Steps
export const paymentSettingsTourSteps: TourStep[] = [
  {
    target: "body",
    title: "Payment Settings",
    content: "Configure your payment methods and manage creator payouts. Set up automatic payments to keep your creators happy!",
    placement: "center",
    icon: <CreditCard className="h-7 w-7 text-primary" />,
  },
];

// Get tour steps by page ID
export function getTourSteps(pageId: string): TourStep[] {
  switch (pageId) {
    case COMPANY_TOUR_IDS.DASHBOARD:
      return dashboardTourSteps;
    case COMPANY_TOUR_IDS.OFFERS:
      return offersTourSteps;
    case COMPANY_TOUR_IDS.OFFER_CREATE:
      return offerCreateTourSteps;
    case COMPANY_TOUR_IDS.OFFER_DETAIL:
      return offerDetailTourSteps;
    case COMPANY_TOUR_IDS.RETAINERS:
      return retainersTourSteps;
    case COMPANY_TOUR_IDS.RETAINER_DETAIL:
      return retainerDetailTourSteps;
    case COMPANY_TOUR_IDS.CREATOR_WORKFLOW:
      return creatorWorkflowTourSteps;
    case COMPANY_TOUR_IDS.ANALYTICS:
      return analyticsTourSteps;
    case COMPANY_TOUR_IDS.REVIEWS:
      return reviewsTourSteps;
    case COMPANY_TOUR_IDS.WEBSITE_VERIFICATION:
      return websiteVerificationTourSteps;
    case COMPANY_TOUR_IDS.PAYMENT_SETTINGS:
      return paymentSettingsTourSteps;
    default:
      return [];
  }
}
