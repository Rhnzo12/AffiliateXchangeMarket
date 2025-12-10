import * as React from "react";
import { TourStep } from "../contexts/CreatorTourContext";
import {
  LayoutDashboard,
  PanelLeft,
  TrendingUp,
  FileText,
  CalendarClock,
  BarChart3,
  Heart,
  CreditCard,
  Search,
  Filter,
  Zap,
  Compass,
  ClipboardList,
  DollarSign,
} from "lucide-react";

// Tour IDs for each creator page
export const CREATOR_TOUR_IDS = {
  DASHBOARD: "creator-dashboard-tour",
  BROWSE: "creator-browse-tour",
  OFFER_DETAIL: "creator-offer-detail-tour",
  RETAINERS: "creator-retainers-tour",
  RETAINER_DETAIL: "creator-retainer-detail-tour",
  APPLICATIONS: "creator-applications-tour",
  APPLICATION_DETAIL: "creator-application-detail-tour",
  ANALYTICS: "creator-analytics-tour",
  FAVORITES: "creator-favorites-tour",
  PAYMENT_SETTINGS: "creator-payment-settings-tour",
} as const;

// Dashboard Tour Steps
export const dashboardTourSteps: TourStep[] = [
  {
    target: "body",
    title: "Welcome to Your Creator Dashboard!",
    content: "Let's take a quick tour to help you get started. We'll show you the key features to maximize your affiliate earnings.",
    placement: "center",
    icon: <LayoutDashboard className="h-7 w-7 text-primary" />,
  },
  {
    target: "[data-testid='button-sidebar-toggle']",
    title: "Navigation Sidebar",
    content: "Access all your creator features from the sidebar. Click here to expand or collapse it anytime.",
    placement: "right",
    icon: <PanelLeft className="h-7 w-7 text-primary" />,
  },
  {
    target: "[data-testid='nav-browse-offers']",
    title: "Browse Affiliate Offers",
    content: "Discover new affiliate opportunities here. Find offers that match your content niche and audience.",
    placement: "right",
    icon: <Compass className="h-7 w-7 text-primary" />,
  },
  {
    target: "[data-testid='nav-my-applications']",
    title: "Track Your Applications",
    content: "View and manage all your offer applications. Check approval status and track your active partnerships.",
    placement: "right",
    icon: <ClipboardList className="h-7 w-7 text-primary" />,
  },
];

// Browse Offers Tour Steps
export const browseTourSteps: TourStep[] = [
  {
    target: "body",
    title: "Discover Affiliate Offers",
    content: "Browse through available affiliate offers from brands looking to partner with creators like you.",
    placement: "center",
    icon: <TrendingUp className="h-7 w-7 text-primary" />,
  },
  {
    target: "input[placeholder*='Search'], input[type='search'], [data-testid='input-search']",
    title: "Search Offers",
    content: "Use the search bar to find specific offers by name, brand, or keywords related to your niche.",
    placement: "bottom",
    icon: <Search className="h-7 w-7 text-primary" />,
  },
  {
    target: "[data-testid='button-open-filters'], .filter-button, button:has(.lucide-filter)",
    title: "Filter Results",
    content: "Use filters to narrow down offers by platform, niche, commission type, and more to find the perfect match.",
    placement: "bottom",
    icon: <Filter className="h-7 w-7 text-primary" />,
  },
];

// Retainers Page Tour Steps
export const retainersTourSteps: TourStep[] = [
  {
    target: "body",
    title: "Monthly Retainer Contracts",
    content: "Explore monthly retainer opportunities for consistent, recurring income. Brands offer fixed monthly payments for ongoing content creation.",
    placement: "center",
    icon: <CalendarClock className="h-7 w-7 text-primary" />,
  },
  {
    target: "[data-testid='input-retainer-search-header'], input[placeholder*='Search']",
    title: "Search Retainers",
    content: "Search for specific retainer opportunities by brand name, content type, or keywords.",
    placement: "bottom",
    icon: <Search className="h-7 w-7 text-primary" />,
  },
  {
    target: "[data-testid='button-open-retainer-filters'], button:has(.lucide-filter)",
    title: "Filter Opportunities",
    content: "Use filters to find retainers matching your platform, niche, and preferred budget range.",
    placement: "bottom",
    icon: <Filter className="h-7 w-7 text-primary" />,
  },
];

// Applications Page Tour Steps
export const applicationsTourSteps: TourStep[] = [
  {
    target: "body",
    title: "Your Applications",
    content: "Track all your offer and retainer applications in one place. Monitor your approval status and manage active partnerships.",
    placement: "center",
    icon: <FileText className="h-7 w-7 text-primary" />,
  },
  {
    target: "[role='tablist'], .tabs-list",
    title: "Filter by Status",
    content: "Switch between different application statuses: pending, approved, rejected, or completed to easily find what you're looking for.",
    placement: "bottom",
    icon: <Filter className="h-7 w-7 text-primary" />,
  },
];

// Analytics Tour Steps
export const analyticsTourSteps: TourStep[] = [
  {
    target: "body",
    title: "Your Performance Analytics",
    content: "Track your earnings, clicks, and conversions across all your affiliate partnerships. Understand what's working best for your audience.",
    placement: "center",
    icon: <BarChart3 className="h-7 w-7 text-primary" />,
  },
  {
    target: ".recharts-wrapper, [data-testid='analytics-chart'], .chart-container",
    title: "Performance Charts",
    content: "View detailed charts showing your earnings trends, click-through rates, and conversion performance over time.",
    placement: "bottom",
    icon: <TrendingUp className="h-7 w-7 text-primary" />,
  },
];

// Favorites Tour Steps
export const favoritesTourSteps: TourStep[] = [
  {
    target: "body",
    title: "Your Saved Favorites",
    content: "Access all the offers you've saved for later. Bookmark interesting opportunities while browsing and apply when you're ready.",
    placement: "center",
    icon: <Heart className="h-7 w-7 text-primary" />,
  },
];

// Payment Settings Tour Steps
export const paymentSettingsTourSteps: TourStep[] = [
  {
    target: "body",
    title: "Payment Management",
    content: "Configure your payment methods and track your earnings. Set up how you'd like to receive your affiliate commissions.",
    placement: "center",
    icon: <CreditCard className="h-7 w-7 text-primary" />,
  },
  {
    target: "[data-testid='payment-method-section'], .payment-methods, [role='tablist']",
    title: "Payment Methods",
    content: "Add and manage your preferred payment methods. Choose from PayPal, bank transfer, crypto, and more.",
    placement: "bottom",
    icon: <DollarSign className="h-7 w-7 text-primary" />,
  },
];

// Offer Detail Tour Steps
export const offerDetailTourSteps: TourStep[] = [
  {
    target: "body",
    title: "Offer Details",
    content: "Review all the details about this affiliate opportunity including commission rates, requirements, and promotional materials.",
    placement: "center",
    icon: <Zap className="h-7 w-7 text-primary" />,
  },
];

// Retainer Detail Tour Steps
export const retainerDetailTourSteps: TourStep[] = [
  {
    target: "body",
    title: "Retainer Contract Details",
    content: "Review the full details of this monthly retainer including payment terms, content requirements, and deliverables.",
    placement: "center",
    icon: <CalendarClock className="h-7 w-7 text-primary" />,
  },
];

// Application Detail Tour Steps
export const applicationDetailTourSteps: TourStep[] = [
  {
    target: "body",
    title: "Application Details",
    content: "View the full details of your application including status updates, messages from the brand, and next steps.",
    placement: "center",
    icon: <FileText className="h-7 w-7 text-primary" />,
  },
];

// Get tour steps by page ID
export function getTourSteps(pageId: string): TourStep[] {
  switch (pageId) {
    case CREATOR_TOUR_IDS.DASHBOARD:
      return dashboardTourSteps;
    case CREATOR_TOUR_IDS.BROWSE:
      return browseTourSteps;
    case CREATOR_TOUR_IDS.OFFER_DETAIL:
      return offerDetailTourSteps;
    case CREATOR_TOUR_IDS.RETAINERS:
      return retainersTourSteps;
    case CREATOR_TOUR_IDS.RETAINER_DETAIL:
      return retainerDetailTourSteps;
    case CREATOR_TOUR_IDS.APPLICATIONS:
      return applicationsTourSteps;
    case CREATOR_TOUR_IDS.APPLICATION_DETAIL:
      return applicationDetailTourSteps;
    case CREATOR_TOUR_IDS.ANALYTICS:
      return analyticsTourSteps;
    case CREATOR_TOUR_IDS.FAVORITES:
      return favoritesTourSteps;
    case CREATOR_TOUR_IDS.PAYMENT_SETTINGS:
      return paymentSettingsTourSteps;
    default:
      return [];
  }
}
