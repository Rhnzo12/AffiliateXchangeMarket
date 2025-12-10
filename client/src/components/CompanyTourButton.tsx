import * as React from "react";
import { HelpCircle, RotateCcw } from "lucide-react";
import { Button } from "./ui/button";
import { useCompanyTour } from "../contexts/CompanyTourContext";
import { useLocation } from "wouter";
import { getTourSteps, COMPANY_TOUR_IDS } from "../lib/companyTourConfig";

// Map routes to tour IDs
const routeToTourId: Record<string, string> = {
  "/company": COMPANY_TOUR_IDS.DASHBOARD,
  "/company/dashboard": COMPANY_TOUR_IDS.DASHBOARD,
  "/company/offers": COMPANY_TOUR_IDS.OFFERS,
  "/company/offers/create": COMPANY_TOUR_IDS.OFFER_CREATE,
  "/company/retainers": COMPANY_TOUR_IDS.RETAINERS,
  "/company/creator-workflow": COMPANY_TOUR_IDS.CREATOR_WORKFLOW,
  "/company/videos": COMPANY_TOUR_IDS.CREATOR_WORKFLOW,
  "/company/applications": COMPANY_TOUR_IDS.CREATOR_WORKFLOW,
  "/company/creators": COMPANY_TOUR_IDS.CREATOR_WORKFLOW,
  "/company/analytics": COMPANY_TOUR_IDS.ANALYTICS,
  "/company/reviews": COMPANY_TOUR_IDS.REVIEWS,
  "/company/website-verification": COMPANY_TOUR_IDS.WEBSITE_VERIFICATION,
  "/company/payment-settings": COMPANY_TOUR_IDS.PAYMENT_SETTINGS,
};

function getTourIdFromPath(path: string): string | null {
  // Check exact match first
  if (routeToTourId[path]) {
    return routeToTourId[path];
  }
  // Check for dynamic routes (e.g., /company/offers/:id)
  if (path.startsWith("/company/offers/") && path !== "/company/offers/create") {
    return COMPANY_TOUR_IDS.OFFER_DETAIL;
  }
  if (path.startsWith("/company/retainers/")) {
    return COMPANY_TOUR_IDS.RETAINERS;
  }
  // Default to dashboard if on company route
  if (path === "/" || path.startsWith("/company")) {
    return COMPANY_TOUR_IDS.DASHBOARD;
  }
  return null;
}

export function CompanyTourButton() {
  const { restartTour, isRunning } = useCompanyTour();
  const [location] = useLocation();

  const handleRestartTour = () => {
    const tourId = getTourIdFromPath(location);
    if (tourId) {
      const steps = getTourSteps(tourId);
      if (steps.length > 0) {
        restartTour(tourId, steps);
      }
    }
  };

  const tourId = getTourIdFromPath(location);
  const hasTour = tourId && getTourSteps(tourId).length > 0;

  if (!hasTour) return null;

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleRestartTour}
      disabled={isRunning}
      className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
    >
      <HelpCircle className="h-4 w-4" />
      <span>Restart Page Tour</span>
    </Button>
  );
}

// Wrapper component that safely handles the case when CompanyTourProvider is not available
export function CompanyTourButtonSafe() {
  try {
    return <CompanyTourButton />;
  } catch {
    // Context not available (not a company user)
    return null;
  }
}
