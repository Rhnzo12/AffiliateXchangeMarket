import * as React from "react";
import { HelpCircle } from "lucide-react";
import { Button } from "./ui/button";
import { useCreatorTour } from "../contexts/CreatorTourContext";
import { useLocation } from "wouter";
import { getTourSteps, CREATOR_TOUR_IDS } from "../lib/creatorTourConfig";

// Map routes to tour IDs
const routeToTourId: Record<string, string> = {
  "/": CREATOR_TOUR_IDS.DASHBOARD,
  "/creator/dashboard": CREATOR_TOUR_IDS.DASHBOARD,
  "/browse": CREATOR_TOUR_IDS.BROWSE,
  "/retainers": CREATOR_TOUR_IDS.RETAINERS,
  "/applications": CREATOR_TOUR_IDS.APPLICATIONS,
  "/analytics": CREATOR_TOUR_IDS.ANALYTICS,
  "/favorites": CREATOR_TOUR_IDS.FAVORITES,
  "/creator/payment-settings": CREATOR_TOUR_IDS.PAYMENT_SETTINGS,
};

function getTourIdFromPath(path: string): string | null {
  // Check exact match first
  if (routeToTourId[path]) {
    return routeToTourId[path];
  }
  // Check for dynamic routes
  if (path.startsWith("/offers/")) {
    return CREATOR_TOUR_IDS.OFFER_DETAIL;
  }
  if (path.startsWith("/retainers/")) {
    return CREATOR_TOUR_IDS.RETAINER_DETAIL;
  }
  if (path.startsWith("/applications/")) {
    return CREATOR_TOUR_IDS.APPLICATION_DETAIL;
  }
  if (path.startsWith("/analytics/")) {
    return CREATOR_TOUR_IDS.ANALYTICS;
  }
  // Default to dashboard if on root
  if (path === "/") {
    return CREATOR_TOUR_IDS.DASHBOARD;
  }
  return null;
}

export function CreatorTourButton() {
  const { restartTour, isRunning } = useCreatorTour();
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

// Wrapper component that safely handles the case when CreatorTourProvider is not available
export function CreatorTourButtonSafe() {
  try {
    return <CreatorTourButton />;
  } catch {
    // Context not available (not a creator user)
    return null;
  }
}
