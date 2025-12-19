import { useEffect, useRef, useState } from "react";
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
import { loginSchema } from "../../../shared/validation";
import { motion } from "framer-motion";

type LoginForm = z.infer<typeof loginSchema>;

export default function Login() {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isSliding, setIsSliding] = useState(false);
  const [activeVariant, setActiveVariant] = useState<"primary" | "secondary">("primary");
  const slideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  const startSlideAnimation = () => {
    if (isSliding) return;
    setIsSliding(true);

    if (slideTimeoutRef.current) {
      clearTimeout(slideTimeoutRef.current);
    }

    slideTimeoutRef.current = setTimeout(() => {
      setActiveVariant((prev) => (prev === "primary" ? "secondary" : "primary"));
      setIsSliding(false);
    }, 750);
  };

  useEffect(() => {
    return () => {
      if (slideTimeoutRef.current) {
        clearTimeout(slideTimeoutRef.current);
      }
    };
  }, []);

  // Render 2FA verification form
  if (requires2FA) {
    return (
      <motion.div
        className="relative min-h-screen bg-background flex items-center justify-center overflow-hidden p-4"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        <AnimatedBackground />
        <motion.div
          className="w-full max-w-md space-y-6"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="flex items-center justify-center gap-2">
            <img src="/logo.png" alt="AffiliateXchange Logo" className="h-10 w-10 rounded-md object-cover" />
            <span className="text-2xl font-bold">AffiliateXchange</span>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          >
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
          </motion.div>

          {/* Generic Error Dialog */}
          <GenericErrorDialog
            open={errorDialog.open}
            onOpenChange={(open) => setErrorDialog({ ...errorDialog, open })}
            title={errorDialog.title}
            description={errorDialog.description}
            errorDetails={errorDialog.errorDetails}
            variant="error"
          />
        </motion.div>
      </motion.div>
    );
  }

  // Regular login form
  return (
    <motion.div
      className="relative min-h-screen bg-slate-950 flex items-center justify-center overflow-hidden p-4"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      <AnimatedBackground />
      <motion.div
        className="relative w-full max-w-4xl"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="absolute inset-0 rounded-[30px] bg-gradient-to-br from-cyan-500/10 via-slate-900 to-slate-950 blur-2xl" />
        <div className="relative overflow-hidden rounded-[30px] border border-white/5 bg-white/5 shadow-2xl shadow-cyan-500/10 backdrop-blur-xl">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(23,162,184,0.25),transparent_40%),radial-gradient(circle_at_80%_0%,rgba(59,130,246,0.12),transparent_35%),radial-gradient(circle_at_50%_80%,rgba(16,185,129,0.14),transparent_38%)] opacity-80" />
          <div className="relative px-4 py-6 sm:px-10 sm:py-12">
            <div className="flex items-center justify-center gap-3 pb-8">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 shadow-lg shadow-cyan-500/10 ring-1 ring-white/20">
                <img src="/logo.png" alt="AffiliateXchange Logo" className="h-10 w-10 rounded-lg object-cover" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">AffiliateXchange</p>
                <p className="text-3xl font-semibold text-white">Welcome back</p>
                <p className="text-sm text-cyan-50/80">Sign in to continue scaling your partnerships</p>
              </div>
            </div>

            <div className="relative min-h-[520px] md:min-h-[540px]">
              <div className="absolute inset-0">
                <div
                  className={`absolute inset-0 transform transition-transform duration-[750ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
                    isSliding ? "-translate-x-[115%] opacity-90" : "translate-x-0 opacity-100"
                  }`}
                >
                  <LoginCardContent
                    form={form}
                    showPassword={showPassword}
                    setShowPassword={setShowPassword}
                    isLoading={isLoading}
                    handleSubmit={onSubmit}
                    handleGoogleLogin={handleGoogleLogin}
                    onStartSlide={startSlideAnimation}
                    variant={activeVariant}
                  />
                </div>

                <div
                  className={`absolute inset-0 transform transition-transform duration-[750ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
                    isSliding ? "translate-x-0 opacity-100" : "translate-x-[120%] opacity-0"
                  } pointer-events-none`}
                >
                  <LoginCardContent
                    form={form}
                    showPassword={showPassword}
                    setShowPassword={setShowPassword}
                    isLoading={isLoading}
                    handleSubmit={onSubmit}
                    handleGoogleLogin={handleGoogleLogin}
                    onStartSlide={startSlideAnimation}
                    variant={activeVariant === "primary" ? "secondary" : "primary"}
                    subdued
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Generic Error Dialog */}
        <GenericErrorDialog
          open={errorDialog.open}
          onOpenChange={(open) => setErrorDialog({ ...errorDialog, open })}
          title={errorDialog.title}
          description={errorDialog.description}
          errorDetails={errorDialog.errorDetails}
          variant="error"
        />
      </motion.div>
    </motion.div>
  );
}

type LoginCardContentProps = {
  form: ReturnType<typeof useForm<LoginForm>>;
  showPassword: boolean;
  setShowPassword: (value: boolean) => void;
  isLoading: boolean;
  handleSubmit: (data: LoginForm) => Promise<void>;
  handleGoogleLogin: () => void;
  onStartSlide: () => void;
  variant: "primary" | "secondary";
  subdued?: boolean;
};

function LoginCardContent({
  form,
  showPassword,
  setShowPassword,
  isLoading,
  handleSubmit,
  handleGoogleLogin,
  onStartSlide,
  variant,
  subdued,
}: LoginCardContentProps) {
  const accentClasses =
    variant === "primary"
      ? "bg-white/10 ring-1 ring-white/10 shadow-lg shadow-cyan-500/20"
      : "bg-slate-950/80 ring-1 ring-white/5 shadow-lg shadow-slate-900/40 backdrop-blur";

  return (
    <Card className={`${accentClasses} border-white/10 text-white`}>
      <CardHeader className="space-y-1">
        <CardTitle className="flex items-center gap-2 text-2xl text-white">
          <Shield className="h-5 w-5 text-cyan-300" /> Secure sign in
        </CardTitle>
        <CardDescription className="text-cyan-50/70">
          Access your dashboard with enterprise-grade protection
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm text-cyan-50/90">Username</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="johndoe"
                      {...field}
                      data-testid="input-username"
                      className="border-white/10 bg-white/5 text-white placeholder:text-white/50 focus-visible:ring-2 focus-visible:ring-cyan-400/60"
                    />
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
                  <FormLabel className="text-sm text-cyan-50/90">Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        {...field}
                        data-testid="input-password"
                        className="border-white/10 bg-white/5 pr-12 text-white placeholder:text-white/50 focus-visible:ring-2 focus-visible:ring-cyan-400/60"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-cyan-100/80 transition-colors hover:text-white"
                        data-testid="toggle-password-visibility"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-full bg-cyan-500 text-white shadow-lg shadow-cyan-500/30 transition-transform duration-300 hover:-translate-y-0.5 hover:bg-cyan-400"
              disabled={isLoading}
              data-testid="button-login"
              onClick={onStartSlide}
            >
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </Form>

        <div className="relative my-5">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-white/10" />
          </div>
          <div className="relative flex justify-center text-xs uppercase tracking-[0.2em]">
            <span className="bg-white/5 px-3 text-cyan-50/70">Or continue with</span>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full border-white/20 bg-white/5 text-white hover:border-cyan-400/70 hover:bg-cyan-500/10"
          onClick={handleGoogleLogin}
          disabled={isLoading}
          data-testid="button-google-login"
        >
          <Mail className="mr-2 h-4 w-4" />
          Continue with Google
        </Button>

        <div className="mt-6 grid grid-cols-1 gap-3 text-sm text-cyan-50/80 sm:grid-cols-2">
          <Link href="/register" className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/5 px-3 py-2 transition hover:border-cyan-400/50 hover:bg-cyan-500/5" data-testid="link-register">
            <span className="h-2 w-2 rounded-full bg-cyan-400" />
            Create account
          </Link>
          <Link
            href="/forgot-password"
            className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/5 px-3 py-2 transition hover:border-cyan-400/50 hover:bg-cyan-500/5"
          >
            <span className="h-2 w-2 rounded-full bg-cyan-200" />
            Forgot your password?
          </Link>
        </div>

        <div className="mt-6 rounded-2xl border border-white/5 bg-white/5 p-4 text-center text-xs text-cyan-50/60">
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/privacy-policy" className="hover:text-white transition-colors">
              <a className="hover:text-white">Privacy Policy</a>
            </Link>
            <span>•</span>
            <Link href="/terms-of-service" className="hover:text-white transition-colors">
              <a className="hover:text-white">Terms of Service</a>
            </Link>
          </div>
        </div>

        {subdued && (
          <div className="mt-4 flex items-center justify-center gap-2 text-xs text-cyan-100/60">
            <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-cyan-300" />
            Sliding in...
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AnimatedBackground() {
  return (
    <>
      <motion.div
        className="absolute -left-24 -top-24 h-56 w-56 rounded-full bg-primary/10 blur-3xl"
        initial={{ scale: 0.9, opacity: 0.4 }}
        animate={{ scale: [0.9, 1.05, 0.95, 1], opacity: [0.4, 0.55, 0.5, 0.45] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -right-20 top-10 h-64 w-64 rounded-full bg-secondary/10 blur-3xl"
        initial={{ scale: 0.9, opacity: 0.35 }}
        animate={{ scale: [0.9, 1.07, 0.95, 1.02], opacity: [0.35, 0.5, 0.45, 0.4] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute left-1/2 bottom-0 h-48 w-48 -translate-x-1/2 rounded-full bg-muted/40 blur-3xl"
        initial={{ scale: 0.85, opacity: 0.3 }}
        animate={{ scale: [0.85, 1.05, 0.9, 1], opacity: [0.3, 0.45, 0.4, 0.35] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
      />
    </>
  );
}
