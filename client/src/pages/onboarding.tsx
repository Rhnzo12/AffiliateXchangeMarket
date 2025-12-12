import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Building2, Sparkles } from "lucide-react";
import { apiRequest } from "../lib/queryClient";
import { useToast } from "../hooks/use-toast";
import { useLocation } from "wouter";
import { GenericErrorDialog } from "../components/GenericErrorDialog";

export default function Onboarding() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedRole, setSelectedRole] = useState<'creator' | 'company' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorDialog, setErrorDialog] = useState<{ open: boolean; title: string; description: string }>({
    open: false,
    title: "",
    description: "",
  });

  const handleRoleSelection = async () => {
    if (!selectedRole) return;

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/user/role", {
        method: "POST",
        body: JSON.stringify({ role: selectedRole }),
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to set role");
      }

      toast({
        title: "Welcome!",
        description: `Your account has been set up as a ${selectedRole}.`,
      });

      // Force page reload to refresh user session and redirect to appropriate dashboard
      window.location.href = selectedRole === 'creator' ? '/browse' : '/company/dashboard';
    } catch (error: any) {
      setErrorDialog({
        open: true,
        title: "Error",
        description: error.message || "Failed to set role",
      });
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">Welcome to AffiliateXchange</h1>
          <p className="text-muted-foreground">Choose how you'd like to use the platform</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Creator Card */}
          <Card 
            className={`cursor-pointer transition-all hover-elevate ${
              selectedRole === 'creator' ? 'ring-2 ring-primary' : ''
            }`}
            onClick={() => setSelectedRole('creator')}
            data-testid="card-role-creator"
          >
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 rounded-lg bg-primary/10">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>I'm a Creator</CardTitle>
              </div>
              <CardDescription>
                Monetize your content by promoting brands and earning commissions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">✓</span>
                  <span>Browse and apply to affiliate offers</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">✓</span>
                  <span>Get unique tracking links</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">✓</span>
                  <span>Earn commissions on sales</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">✓</span>
                  <span>Track performance analytics</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Company Card */}
          <Card 
            className={`cursor-pointer transition-all hover-elevate ${
              selectedRole === 'company' ? 'ring-2 ring-primary' : ''
            }`}
            onClick={() => setSelectedRole('company')}
            data-testid="card-role-company"
          >
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 rounded-lg bg-primary/10">
                  <Building2 className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>I'm a Company</CardTitle>
              </div>
              <CardDescription>
                Connect with creators to promote your products and services
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">✓</span>
                  <span>Create affiliate offers</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">✓</span>
                  <span>Manage creator partnerships</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">✓</span>
                  <span>Track campaign performance</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">✓</span>
                  <span>Approve creator work</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 text-center">
          <Button
            size="lg"
            onClick={handleRoleSelection}
            disabled={!selectedRole || isSubmitting}
            className="min-w-48"
            data-testid="button-continue"
          >
            {isSubmitting ? "Setting up..." : "Continue"}
          </Button>
        </div>
      </div>

      <GenericErrorDialog
        open={errorDialog.open}
        onOpenChange={(open) => setErrorDialog({ ...errorDialog, open })}
        title={errorDialog.title}
        description={errorDialog.description}
        variant="error"
      />
    </div>
  );
}
