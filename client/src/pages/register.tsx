import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "../components/ui/form";
import { Input } from "../components/ui/input";
import { RadioGroup, RadioGroupItem } from "../components/ui/radio-group";
import { Checkbox } from "../components/ui/checkbox";
import { useToast } from "../hooks/use-toast";
import { Zap, Mail, Check, X } from "lucide-react";
import { Link } from "wouter";
import { GenericErrorDialog } from "../components/GenericErrorDialog";
import { registrationSchema, validatePasswordComplexity } from "../../../shared/validation";

type RegisterForm = z.infer<typeof registrationSchema>;

export default function Register() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const [errorDialog, setErrorDialog] = useState({
    open: false,
    title: "Error",
    description: "An error occurred",
    errorDetails: "",
  });

  const [passwordValue, setPasswordValue] = useState("");
  const passwordRequirements = validatePasswordComplexity(passwordValue);

  const form = useForm<RegisterForm>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
      firstName: "",
      lastName: "",
      role: "creator",
      acceptTerms: false,
    },
  });

  const onSubmit = async (data: RegisterForm) => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: data.username,
          email: data.email,
          password: data.password,
          firstName: data.firstName,
          lastName: data.lastName,
          role: data.role,
        }),
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Registration failed");
      }

      toast({
        title: "Success!",
        description: "Account created successfully. Redirecting...",
      });

      // Redirect based on role
      setTimeout(() => {
        window.location.href = data.role === "creator" ? "/creator-onboarding" : "/company-onboarding";
      }, 1000);
    } catch (error: any) {
      setErrorDialog({
        open: true,
        title: "Registration Failed",
        description: "We couldn't create your account. Please check your information and try again.",
        errorDetails: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignup = () => {
    // Redirect to Google OAuth endpoint
    window.location.href = "/api/auth/google";
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center justify-center gap-2">
          <img src="/logo.png" alt="AffiliateXchange Logo" className="h-10 w-10 rounded-md object-cover" />
          <span className="text-2xl font-bold">AffiliateXchange</span>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Create your account</CardTitle>
            <CardDescription>Join the marketplace and start earning</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>I am a</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="grid grid-cols-2 gap-4"
                        >
                          <div>
                            <RadioGroupItem
                              value="creator"
                              id="creator"
                              className="peer sr-only"
                            />
                            <label
                              htmlFor="creator"
                              className="flex items-center justify-center rounded-md border-2 border-muted bg-card p-4 hover-elevate active-elevate-2 peer-data-[state=checked]:border-primary cursor-pointer"
                              data-testid="role-creator"
                            >
                              <span className="text-sm font-medium">Creator</span>
                            </label>
                          </div>
                          <div>
                            <RadioGroupItem
                              value="company"
                              id="company"
                              className="peer sr-only"
                            />
                            <label
                              htmlFor="company"
                              className="flex items-center justify-center rounded-md border-2 border-muted bg-card p-4 hover-elevate active-elevate-2 peer-data-[state=checked]:border-primary cursor-pointer"
                              data-testid="role-company"
                            >
                              <span className="text-sm font-medium">Company</span>
                            </label>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="john@example.com" {...field} data-testid="input-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name</FormLabel>
                        <FormControl>
                          <Input placeholder="John" {...field} data-testid="input-firstname" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Doe" {...field} data-testid="input-lastname" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="••••••••"
                          {...field}
                          data-testid="input-password"
                          onChange={(e) => {
                            field.onChange(e);
                            setPasswordValue(e.target.value);
                          }}
                        />
                      </FormControl>
                      {passwordValue && (
                        <div className="mt-2 space-y-1 text-xs">
                          <p className="text-muted-foreground font-medium">Password requirements:</p>
                          {[
                            { label: "At least 8 characters", met: passwordValue.length >= 8 },
                            { label: "One uppercase letter", met: /[A-Z]/.test(passwordValue) },
                            { label: "One lowercase letter", met: /[a-z]/.test(passwordValue) },
                            { label: "One number", met: /[0-9]/.test(passwordValue) },
                            { label: "One special character (!@#$%^&*...)", met: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(passwordValue) },
                          ].map((req) => (
                            <div key={req.label} className="flex items-center gap-1.5">
                              {req.met ? (
                                <Check className="h-3 w-3 text-green-500" />
                              ) : (
                                <X className="h-3 w-3 text-muted-foreground" />
                              )}
                              <span className={req.met ? "text-green-600" : "text-muted-foreground"}>
                                {req.label}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} data-testid="input-confirm-password" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="acceptTerms"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-accept-terms"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="text-sm font-normal">
                          I agree to the{" "}
                          <Link href="/terms-of-service">
                            <a className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
                              Terms of Service
                            </a>
                          </Link>
                          {" "}and{" "}
                          <Link href="/privacy-policy">
                            <a className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
                              Privacy Policy
                            </a>
                          </Link>
                        </FormLabel>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading}
                  data-testid="button-register"
                >
                  {isLoading ? "Creating account..." : "Create Account"}
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
              onClick={handleGoogleSignup}
              disabled={isLoading}
              data-testid="button-google-signup"
            >
              <Mail className="mr-2 h-4 w-4" />
              Continue with Google
            </Button>

            <div className="mt-4 text-center text-sm">
              Already have an account?{" "}
              <Link href="/login" className="text-primary hover:underline" data-testid="link-login">
                Sign in
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
