import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "../components/ui/form";
import { Input } from "../components/ui/input";
import { useToast } from "../hooks/use-toast";
import { Mail, Eye, EyeOff, Shield, ArrowLeft, Key } from "lucide-react";
import { Link, useSearch } from "wouter";
import { GenericErrorDialog } from "../components/GenericErrorDialog";

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function Login() {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();
  const [errorDialog, setErrorDialog] = useState({
    open: false,
    title: "Error",
    description: "An error occurred",
    errorDetails: "",
  });

  // 2FA state
  const [requires2FA, setRequires2FA] = useState(false);
  const [pending2FAUserId, setPending2FAUserId] = useState<string | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [isVerifying2FA, setIsVerifying2FA] = useState(false);
  const [useBackupCode, setUseBackupCode] = useState(false);

  // Check for 2FA redirect from Google OAuth
  const searchString = useSearch();

  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const require2fa = params.get("require2fa");
    const userId = params.get("userId");

    if (require2fa === "true" && userId) {
      setRequires2FA(true);
      setPending2FAUserId(userId);
    }
  }, [searchString]);

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Login failed");
      }

      const result = await response.json();

      // Check if 2FA is required
      if (result.requiresTwoFactor) {
        setRequires2FA(true);
        setPending2FAUserId(result.userId);
        toast({
          title: "Two-Factor Authentication Required",
          description: "Please enter your authentication code to continue.",
        });
        return;
      }

      toast({
        title: "Welcome back!",
        description: "Login successful. Redirecting...",
      });

      // Redirect based on role
      setTimeout(() => {
        if (result.role === "creator") {
          window.location.href = "/browse";
        } else if (result.role === "company") {
          window.location.href = "/company/dashboard";
        } else if (result.role === "admin") {
          window.location.href = "/admin";
        } else {
          window.location.href = "/";
        }
      }, 1000);
    } catch (error: any) {
      setErrorDialog({
        open: true,
        title: "Login Failed",
        description: "We couldn't sign you in. Please check your credentials and try again.",
        errorDetails: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!pending2FAUserId || !twoFactorCode) return;

    setIsVerifying2FA(true);
    try {
      const response = await fetch("/api/auth/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: pending2FAUserId,
          code: twoFactorCode,
          isBackupCode: useBackupCode,
        }),
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Verification failed");
      }

      const result = await response.json();

      toast({
        title: "Welcome back!",
        description: "Login successful. Redirecting...",
      });

      // Redirect based on role
      setTimeout(() => {
        if (result.role === "creator") {
          window.location.href = "/browse";
        } else if (result.role === "company") {
          window.location.href = "/company/dashboard";
        } else if (result.role === "admin") {
          window.location.href = "/admin";
        } else {
          window.location.href = "/";
        }
      }, 1000);
    } catch (error: any) {
      setErrorDialog({
        open: true,
        title: "Verification Failed",
        description: "The code you entered is invalid. Please try again.",
        errorDetails: error.message,
      });
    } finally {
      setIsVerifying2FA(false);
    }
  };

  const handleBack = () => {
    setRequires2FA(false);
    setPending2FAUserId(null);
    setTwoFactorCode("");
    setUseBackupCode(false);
    // Clear URL params
    window.history.replaceState({}, "", "/login");
  };

  const handleGoogleLogin = () => {
    // Redirect to Google OAuth endpoint
    window.location.href = "/api/auth/google";
  };

  // Render 2FA verification form
  if (requires2FA) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6">
          <div className="flex items-center justify-center gap-2">
            <img src="/logo.png" alt="AffiliateXchange Logo" className="h-10 w-10 rounded-md object-cover" />
            <span className="text-2xl font-bold">AffiliateXchange</span>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleBack}
                  className="h-8 w-8"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Two-Factor Authentication
                  </CardTitle>
                  <CardDescription>
                    {useBackupCode
                      ? "Enter one of your backup codes"
                      : "Enter the 6-digit code from your authenticator app"}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleVerify2FA} className="space-y-4">
                <div className="space-y-2">
                  <Input
                    value={twoFactorCode}
                    onChange={(e) => {
                      if (useBackupCode) {
                        // Allow alphanumeric and dashes for backup codes
                        setTwoFactorCode(e.target.value.toUpperCase().slice(0, 9));
                      } else {
                        // Only digits for TOTP
                        setTwoFactorCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                      }
                    }}
                    placeholder={useBackupCode ? "XXXX-XXXX" : "000000"}
                    className={`text-center text-2xl tracking-widest font-mono ${
                      useBackupCode ? "" : ""
                    }`}
                    maxLength={useBackupCode ? 9 : 6}
                    autoComplete="one-time-code"
                    autoFocus
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={
                    isVerifying2FA ||
                    (useBackupCode
                      ? twoFactorCode.replace(/-/g, "").length !== 8
                      : twoFactorCode.length !== 6)
                  }
                >
                  {isVerifying2FA ? "Verifying..." : "Verify"}
                </Button>

                <div className="text-center">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setUseBackupCode(!useBackupCode);
                      setTwoFactorCode("");
                    }}
                    className="text-sm"
                  >
                    {useBackupCode ? (
                      <>
                        <Shield className="h-4 w-4 mr-1" />
                        Use authenticator app instead
                      </>
                    ) : (
                      <>
                        <Key className="h-4 w-4 mr-1" />
                        Use a backup code instead
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Generic Error Dialog */}
          <GenericErrorDialog
            open={errorDialog.open}
            onOpenChange={(open) => setErrorDialog({ ...errorDialog, open })}
            title={errorDialog.title}
            description={errorDialog.description}
            errorDetails={errorDialog.errorDetails}
            variant="error"
          />
        </div>
      </div>
    );
  }

  // Regular login form
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center justify-center gap-2">
          <img src="/logo.png" alt="AffiliateXchange Logo" className="h-10 w-10 rounded-md object-cover" />
          <span className="text-2xl font-bold">AffiliateXchange</span>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Welcome back</CardTitle>
            <CardDescription>Sign in to your account to continue</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <Input placeholder="johndoe" {...field} data-testid="input-username" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showPassword ? "text" : "password"}
                            placeholder="••••••••"
                            {...field}
                            data-testid="input-password"
                            className="pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            data-testid="toggle-password-visibility"
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading}
                  data-testid="button-login"
                >
                  {isLoading ? "Signing in..." : "Sign In"}
                </Button>
              </form>
            </Form>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleGoogleLogin}
              disabled={isLoading}
              data-testid="button-google-login"
            >
              <Mail className="mr-2 h-4 w-4" />
              Continue with Google
            </Button>

            <div className="mt-4 text-center text-sm">
              Don't have an account?{" "}
              <Link href="/register" className="text-primary hover:underline" data-testid="link-register">
                Create account
              </Link>
            </div>

            <div className="mt-2 text-center text-sm">
              <Link href="/forgot-password" className="text-muted-foreground hover:text-primary hover:underline">
                Forgot your password?
              </Link>
            </div>

            <div className="mt-4 pt-4 border-t text-center text-xs text-muted-foreground">
              <div className="flex justify-center gap-4">
                <Link href="/privacy-policy">
                  <a className="hover:text-foreground transition-colors">
                    Privacy Policy
                  </a>
                </Link>
                <span>•</span>
                <Link href="/terms-of-service">
                  <a className="hover:text-foreground transition-colors">
                    Terms of Service
                  </a>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Generic Error Dialog */}
        <GenericErrorDialog
          open={errorDialog.open}
          onOpenChange={(open) => setErrorDialog({ ...errorDialog, open })}
          title={errorDialog.title}
          description={errorDialog.description}
          errorDetails={errorDialog.errorDetails}
          variant="error"
        />
      </div>
    </div>
  );
}
