import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { ExternalLink } from "lucide-react";

export interface TutorialFeature {
  accentText: string;
  accentColor: "teal" | "purple" | "orange";
  subtitle: string;
  preview: React.ReactNode;
}

export interface TutorialConfig {
  badgeText: string;
  headline: string;
  features: TutorialFeature[];
  welcomeTitle: string;
  welcomeDescription: string;
  learnMoreText?: string;
  learnMoreLink?: string;
  ctaText: string;
}

// Legacy interface for backwards compatibility
export interface TutorialStep {
  title: string;
  description: string;
  icon?: React.ReactNode;
}

interface FirstTimeTutorialProps {
  open: boolean;
  onComplete: () => void;
  config?: TutorialConfig;
  // Legacy props for backwards compatibility
  steps?: TutorialStep[];
  title?: string;
}

const accentColorClasses = {
  teal: "text-teal-600",
  purple: "text-purple-600",
  orange: "text-amber-600",
};

// Feature Preview Card Component
function FeaturePreviewCard({ feature }: { feature: TutorialFeature }) {
  return (
    <div className="flex flex-col gap-3 p-5 rounded-xl border border-border bg-white min-h-[220px] shadow-sm">
      <div className="space-y-1 text-left">
        <p className={`text-xs font-semibold tracking-wide ${accentColorClasses[feature.accentColor]}`}>
          {feature.accentText}
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">{feature.subtitle}</p>
      </div>
      <div className="flex-1 rounded-lg bg-muted/40 p-3 border border-border/60">
        {feature.preview}
      </div>
    </div>
  );
}

export function FirstTimeTutorial({
  open,
  onComplete,
  config,
  steps,
  title = "Welcome!",
}: FirstTimeTutorialProps) {
  const handleComplete = () => {
    onComplete();
  };

  // If using new config-based approach
  if (config) {
    return (
      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleComplete()}>
        <DialogContent className="sm:max-w-3xl p-0 overflow-hidden">
          <div className="p-6 space-y-6 bg-gradient-to-b from-background to-muted/20">
            {/* Header */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Onboarding guide
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="text-xs px-2 py-1 border-border">
                  {config.badgeText}
                </Badge>
                <h2 className="text-2xl font-semibold leading-snug text-foreground">
                  {config.headline}
                </h2>
              </div>
            </div>

            {/* Feature Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {config.features.map((feature, index) => (
                <FeaturePreviewCard key={index} feature={feature} />
              ))}
            </div>

            {/* Welcome Section */}
            <div className="space-y-2">
              <h3 className="font-semibold text-base">{config.welcomeTitle}</h3>
              <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
                {config.welcomeDescription}
              </DialogDescription>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 bg-muted/30 border-t border-border">
            <div>
              {config.learnMoreLink && (
                <a
                  href={config.learnMoreLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                >
                  {config.learnMoreText || "Learn more"}
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
            <Button onClick={handleComplete}>
              {config.ctaText}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Legacy step-based approach (fallback for backwards compatibility)
  if (steps && steps.length > 0) {
    const [currentStep, setCurrentStep] = React.useState(0);

    const handleNext = () => {
      if (currentStep < steps.length - 1) {
        setCurrentStep(currentStep + 1);
      } else {
        setCurrentStep(0);
        handleComplete();
      }
    };

    const handlePrevious = () => {
      if (currentStep > 0) {
        setCurrentStep(currentStep - 1);
      }
    };

    const handleSkip = () => {
      setCurrentStep(0);
      handleComplete();
    };

    const step = steps[currentStep];
    const isLastStep = currentStep === steps.length - 1;
    const isFirstStep = currentStep === 0;

    if (!step) return null;

    return (
      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleSkip()}>
        <DialogContent className="sm:max-w-md">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">{title}</h2>
              <span className="text-sm text-muted-foreground">
                {currentStep + 1} of {steps.length}
              </span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
              />
            </div>
          </div>

          <div className="py-6 space-y-4">
            {step.icon && (
              <div className="flex justify-center">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  {step.icon}
                </div>
              </div>
            )}
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold">{step.title}</h3>
              <DialogDescription className="text-sm leading-relaxed">
                {step.description}
              </DialogDescription>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex gap-2 w-full sm:w-auto">
              {!isFirstStep && (
                <Button
                  variant="outline"
                  onClick={handlePrevious}
                  className="flex-1 sm:flex-initial gap-1"
                >
                  Back
                </Button>
              )}
              {isFirstStep && (
                <Button
                  variant="ghost"
                  onClick={handleSkip}
                  className="flex-1 sm:flex-initial text-muted-foreground"
                >
                  Skip
                </Button>
              )}
            </div>
            <Button onClick={handleNext} className="flex-1 sm:flex-initial gap-1">
              {isLastStep ? "Ok, Got it!" : "Next"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return null;
}
