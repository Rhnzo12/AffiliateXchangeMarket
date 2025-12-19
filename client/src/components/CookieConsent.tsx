import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Checkbox } from "./ui/checkbox";
import { Label } from "./ui/label";
import { Separator } from "./ui/separator";

interface CookiePreferences {
  essential: boolean;
  analytics: boolean;
  marketing: boolean;
}

const COOKIE_CONSENT_KEY = "cookie-consent";
const COOKIE_PREFERENCES_KEY = "cookie-preferences";

export function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>({
    essential: true, // Always true
    analytics: false,
    marketing: false,
  });

  useEffect(() => {
    // Check if user has already made a choice
    const consentGiven = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!consentGiven) {
      // Small delay to avoid showing banner immediately on page load
      setTimeout(() => setShowBanner(true), 1000);
    } else {
      // Load saved preferences
      const savedPreferences = localStorage.getItem(COOKIE_PREFERENCES_KEY);
      if (savedPreferences) {
        try {
          setPreferences(JSON.parse(savedPreferences));
        } catch (error) {
          console.error("Failed to parse cookie preferences:", error);
        }
      }
    }
  }, []);

  const savePreferences = (prefs: CookiePreferences) => {
    localStorage.setItem(COOKIE_CONSENT_KEY, "true");
    localStorage.setItem(COOKIE_PREFERENCES_KEY, JSON.stringify(prefs));
    setPreferences(prefs);
    setShowBanner(false);
    setShowSettings(false);

    // Apply preferences (in a real app, this would configure analytics/marketing tools)
    if (prefs.analytics) {
      // Enable Google Analytics, etc.
    }
    if (prefs.marketing) {
      // Enable marketing pixels, etc.
    }
  };

  const acceptAll = () => {
    savePreferences({
      essential: true,
      analytics: true,
      marketing: true,
    });
  };

  const acceptEssential = () => {
    savePreferences({
      essential: true,
      analytics: false,
      marketing: false,
    });
  };

  const saveCustomPreferences = () => {
    savePreferences(preferences);
  };

  if (!showBanner) {
    return null;
  }

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 z-50 p-3 sm:p-4">
        <div className="mx-auto w-full max-w-3xl rounded-xl border border-white/20 bg-gradient-to-br from-[#7b3bb7] via-[#c94d9f] to-[#ff7b67] text-white shadow-2xl">
          <div className="flex items-start gap-3 p-4 sm:p-5">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowBanner(false)}
              className="text-white hover:bg-white/10"
            >
              <X className="h-4 w-4" />
            </Button>
            <div className="flex-1 space-y-3 sm:space-y-2">
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">We value your privacy</h3>
                <p className="text-sm leading-relaxed text-white/90">
                  We use cookies to improve your experience and personalize content. Choose
                  how we use cookies or manage your preferences anytime.
                  <span className="block pt-2 text-sm">
                    <a
                      href="/cookie-policy"
                      className="underline transition hover:text-white"
                    >
                      Cookie Policy
                    </a>
                  </span>
                </p>
              </div>

              <div className="flex flex-col gap-2 text-sm font-medium sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap gap-2 sm:gap-3">
                  <Button
                    onClick={acceptAll}
                    size="sm"
                    className="rounded-md bg-white text-black hover:bg-white/90"
                  >
                    Accept all
                  </Button>
                  <Button
                    onClick={acceptEssential}
                    size="sm"
                    variant="outline"
                    className="border-white/60 text-white hover:bg-white/10 hover:text-white"
                  >
                    Essential only
                  </Button>
                </div>
                <button
                  onClick={() => setShowSettings(true)}
                  className="text-white underline transition hover:text-white/80"
                >
                  Manage preferences
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Cookie Preferences</DialogTitle>
            <DialogDescription>
              Manage your cookie preferences. Essential cookies are required for the site
              to function and cannot be disabled.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-3">
              <div className="flex items-start space-x-3 p-3 rounded-lg bg-muted/50">
                <Checkbox
                  id="essential"
                  checked={true}
                  disabled
                  className="mt-1"
                />
                <div className="flex-1 space-y-1">
                  <Label htmlFor="essential" className="font-semibold cursor-not-allowed">
                    Essential Cookies
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Required for the website to function properly. These cookies enable
                    core functionality such as security, authentication, and accessibility.
                    Cannot be disabled.
                  </p>
                </div>
              </div>

              <Separator />

              <div className="flex items-start space-x-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                <Checkbox
                  id="analytics"
                  checked={preferences.analytics}
                  onCheckedChange={(checked) =>
                    setPreferences((prev) => ({ ...prev, analytics: checked as boolean }))
                  }
                  className="mt-1"
                />
                <div className="flex-1 space-y-1">
                  <Label htmlFor="analytics" className="font-semibold cursor-pointer">
                    Analytics Cookies
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Help us understand how visitors interact with our website by
                    collecting and reporting information anonymously. This helps us improve
                    our services.
                  </p>
                </div>
              </div>

              <Separator />

              <div className="flex items-start space-x-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                <Checkbox
                  id="marketing"
                  checked={preferences.marketing}
                  onCheckedChange={(checked) =>
                    setPreferences((prev) => ({ ...prev, marketing: checked as boolean }))
                  }
                  className="mt-1"
                />
                <div className="flex-1 space-y-1">
                  <Label htmlFor="marketing" className="font-semibold cursor-pointer">
                    Marketing Cookies
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Used to track visitors across websites to display relevant
                    advertisements and measure the effectiveness of advertising campaigns.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button onClick={saveCustomPreferences} className="flex-1">
              Save Preferences
            </Button>
            <Button onClick={acceptAll} variant="outline" className="flex-1">
              Accept All
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
