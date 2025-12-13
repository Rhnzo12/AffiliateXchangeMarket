import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { TopNavBar } from "../components/TopNavBar";
import { apiRequest, queryClient } from "../lib/queryClient";
import { GenericErrorDialog } from "../components/GenericErrorDialog";
import {
  Globe,
  CheckCircle2,
  XCircle,
  Copy,
  RefreshCw,
  AlertTriangle,
  Code,
  Server,
  ArrowLeft,
  ShieldCheck,
  Clock,
  ExternalLink,
} from "lucide-react";
import { Link } from "wouter";
import { useCompanyPageTour } from "../components/CompanyTour";
import { COMPANY_TOUR_IDS, websiteVerificationTourSteps } from "../lib/companyTourConfig";

type VerificationData = {
  websiteUrl: string | null;
  websiteVerified: boolean;
  websiteVerificationToken: string | null;
  websiteVerificationMethod: 'meta_tag' | 'dns_txt' | null;
  websiteVerifiedAt: string | null;
  instructions: {
    meta_tag: string;
    dns_txt: string;
  } | null;
};

export default function CompanyWebsiteVerification() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<'meta_tag' | 'dns_txt'>('meta_tag');
  const [errorDialog, setErrorDialog] = useState<{ title: string; message: string } | null>(null);

  // Quick tour for website verification page
  useCompanyPageTour(COMPANY_TOUR_IDS.WEBSITE_VERIFICATION, websiteVerificationTourSteps);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setErrorDialog({
        title: "Unauthorized",
        message: "You are logged out. Logging in again...",
      });
      setTimeout(() => {
        window.location.href = "/login";
      }, 500);
    }
  }, [isAuthenticated, isLoading]);

  // Fetch verification status
  const { data: verificationData, isLoading: loadingVerification, refetch } = useQuery<VerificationData>({
    queryKey: ["/api/company/website-verification"],
    enabled: isAuthenticated,
  });

  // Generate verification token
  const generateTokenMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/company/generate-verification-token");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company/website-verification"] });
      toast({
        title: "Token Generated",
        description: "Verification token has been generated. Follow the instructions to verify your website.",
      });
    },
    onError: (error: any) => {
      setErrorDialog({
        title: "Error",
        message: error.message || "Failed to generate verification token",
      });
    },
  });

  // Verify website
  const verifyWebsiteMutation = useMutation({
    mutationFn: async (method: 'meta_tag' | 'dns_txt') => {
      const response = await apiRequest("POST", "/api/company/verify-website", { method });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/company/website-verification"] });
      toast({
        title: "Verification Successful",
        description: data.message || "Your website has been verified!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Verification Failed",
        description: error.message || "Could not verify website. Please check your setup and try again.",
        variant: "destructive",
      });
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Code copied to clipboard",
    });
  };

  if (isLoading || loadingVerification) {
    return (
      <div className="space-y-6">
        <TopNavBar />
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-pulse text-lg">Loading verification status...</div>
        </div>
      </div>
    );
  }

  const metaTagCode = verificationData?.websiteVerificationToken
    ? `<meta name="affiliatexchange-site-verification" content="${verificationData.websiteVerificationToken}">`
    : '';

  const dnsRecord = verificationData?.websiteVerificationToken || '';

  return (
    <div className="space-y-6">
      <TopNavBar />

      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/company/dashboard">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>
      </div>

      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <ShieldCheck className="h-8 w-8 text-primary" />
          Website Verification
        </h1>
        <p className="text-muted-foreground mt-2">
          Verify ownership of your website to build trust with creators and improve your company's credibility.
        </p>
      </div>

      {/* Current Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Verification Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Website URL</p>
              <p className="font-medium">
                {verificationData?.websiteUrl ? (
                  <a
                    href={verificationData.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline flex items-center gap-1"
                  >
                    {verificationData.websiteUrl}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <span className="text-muted-foreground">No website URL configured</span>
                )}
              </p>
            </div>
            <div>
              {verificationData?.websiteVerified ? (
                <Badge className="bg-green-100 text-green-800 border-green-200 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Verified
                </Badge>
              ) : (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Not Verified
                </Badge>
              )}
            </div>
          </div>

          {verificationData?.websiteVerified && verificationData.websiteVerifiedAt && (
            <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-900">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <p className="font-medium text-green-800 dark:text-green-200">Website Verified</p>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    Verified via {verificationData.websiteVerificationMethod === 'meta_tag' ? 'Meta Tag' : 'DNS TXT Record'} on{' '}
                    {new Date(verificationData.websiteVerifiedAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              </div>
            </div>
          )}

          {!verificationData?.websiteUrl && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Website Required</AlertTitle>
              <AlertDescription>
                Please add a website URL to your company profile before you can verify your website ownership.
                <Link href="/company-onboarding">
                  <Button variant="link" className="p-0 h-auto ml-1">
                    Update Profile
                  </Button>
                </Link>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Verification Instructions */}
      {verificationData?.websiteUrl && !verificationData?.websiteVerified && (
        <Card>
          <CardHeader>
            <CardTitle>Verify Your Website</CardTitle>
            <CardDescription>
              Choose one of the methods below to verify ownership of your website.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Generate Token Button */}
            {!verificationData?.websiteVerificationToken && (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">
                  Generate a verification token to begin the verification process.
                </p>
                <Button
                  onClick={() => generateTokenMutation.mutate()}
                  disabled={generateTokenMutation.isPending}
                >
                  {generateTokenMutation.isPending ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    'Generate Verification Token'
                  )}
                </Button>
              </div>
            )}

            {verificationData?.websiteVerificationToken && (
              <>
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'meta_tag' | 'dns_txt')}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="meta_tag" className="flex items-center gap-2">
                      <Code className="h-4 w-4" />
                      HTML Meta Tag
                    </TabsTrigger>
                    <TabsTrigger value="dns_txt" className="flex items-center gap-2">
                      <Server className="h-4 w-4" />
                      DNS TXT Record
                    </TabsTrigger>
                  </TabsList>

                  {/* Meta Tag Method */}
                  <TabsContent value="meta_tag" className="space-y-4">
                    <div className="space-y-3">
                      <h4 className="font-medium">Instructions:</h4>
                      <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                        <li>Copy the meta tag below</li>
                        <li>Add it to the <code className="bg-muted px-1 rounded">&lt;head&gt;</code> section of your website's homepage</li>
                        <li>Ensure the meta tag is publicly accessible (not behind authentication)</li>
                        <li>Click "Verify" to complete the verification</li>
                      </ol>
                    </div>

                    <div className="relative">
                      <pre className="p-4 bg-muted rounded-lg text-sm overflow-x-auto">
                        <code>{metaTagCode}</code>
                      </pre>
                      <Button
                        variant="outline"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={() => copyToClipboard(metaTagCode)}
                      >
                        <Copy className="h-4 w-4 mr-1" />
                        Copy
                      </Button>
                    </div>

                    <Button
                      onClick={() => verifyWebsiteMutation.mutate('meta_tag')}
                      disabled={verifyWebsiteMutation.isPending}
                      className="w-full"
                    >
                      {verifyWebsiteMutation.isPending ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Verifying...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Verify via Meta Tag
                        </>
                      )}
                    </Button>
                  </TabsContent>

                  {/* DNS TXT Method */}
                  <TabsContent value="dns_txt" className="space-y-4">
                    <div className="space-y-3">
                      <h4 className="font-medium">Instructions:</h4>
                      <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                        <li>Access your domain's DNS settings (usually through your domain registrar or hosting provider)</li>
                        <li>Create a new TXT record for your domain</li>
                        <li>Set the value to the verification token below</li>
                        <li>Wait for DNS propagation (may take up to 48 hours, usually faster)</li>
                        <li>Click "Verify" to complete the verification</li>
                      </ol>
                    </div>

                    <div>
                      <p className="text-sm text-muted-foreground mb-2">DNS TXT Record Value:</p>
                      <div className="relative">
                        <pre className="p-4 bg-muted rounded-lg text-sm overflow-x-auto">
                          <code>{dnsRecord}</code>
                        </pre>
                        <Button
                          variant="outline"
                          size="sm"
                          className="absolute top-2 right-2"
                          onClick={() => copyToClipboard(dnsRecord)}
                        >
                          <Copy className="h-4 w-4 mr-1" />
                          Copy
                        </Button>
                      </div>
                    </div>

                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Note</AlertTitle>
                      <AlertDescription>
                        DNS changes can take time to propagate. If verification fails immediately, please wait a few minutes and try again.
                      </AlertDescription>
                    </Alert>

                    <Button
                      onClick={() => verifyWebsiteMutation.mutate('dns_txt')}
                      disabled={verifyWebsiteMutation.isPending}
                      className="w-full"
                    >
                      {verifyWebsiteMutation.isPending ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Verifying...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Verify via DNS TXT Record
                        </>
                      )}
                    </Button>
                  </TabsContent>
                </Tabs>

                {/* Regenerate Token */}
                <div className="pt-4 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => generateTokenMutation.mutate()}
                    disabled={generateTokenMutation.isPending}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${generateTokenMutation.isPending ? 'animate-spin' : ''}`} />
                    Regenerate Token
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2">
                    Regenerating the token will invalidate the previous one.
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Benefits of Verification */}
      <Card>
        <CardHeader>
          <CardTitle>Why Verify Your Website?</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-start gap-3">
              <ShieldCheck className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium">Build Trust</p>
                <p className="text-sm text-muted-foreground">
                  Verified companies are more likely to attract quality creators.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium">Verification Badge</p>
                <p className="text-sm text-muted-foreground">
                  Display a verification badge on your company profile and offers.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Globe className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium">Confirm Legitimacy</p>
                <p className="text-sm text-muted-foreground">
                  Prove that you own and control your business website.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Dialog */}
      <GenericErrorDialog
        open={!!errorDialog}
        onOpenChange={() => setErrorDialog(null)}
        title={errorDialog?.title || "Error"}
        description={errorDialog?.message || "An error occurred"}
        variant="error"
      />
    </div>
  );
}
