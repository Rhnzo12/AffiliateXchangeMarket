import { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/use-toast";
import { useLocation } from "wouter";
import { queryClient } from "../lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Progress } from "../components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Badge } from "../components/ui/badge";
import { Checkbox } from "../components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import {
  Sparkles,
  Upload,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  X,
  ChevronsUpDown,
  Video,
  CreditCard
} from "lucide-react";

const STEPS = [
  { id: 1, title: "Profile Image", description: "Upload your profile picture" },
  { id: 2, title: "Content Niches", description: "Select your content categories" },
  { id: 3, title: "Video Platforms", description: "Connect your social channels" },
  { id: 4, title: "Payment Method", description: "How you'll get paid" },
  { id: 5, title: "Review", description: "Confirm and submit" },
];

export default function CreatorOnboarding() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Step 1: Profile Image
  const [profileImageUrl, setProfileImageUrl] = useState("");

  // Step 2: Niches
  const [selectedNiches, setSelectedNiches] = useState<string[]>([]);

  // Step 3: Video Platforms
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [youtubeFollowers, setYoutubeFollowers] = useState("");
  const [tiktokUrl, setTiktokUrl] = useState("");
  const [tiktokFollowers, setTiktokFollowers] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [instagramFollowers, setInstagramFollowers] = useState("");

  // Step 4: Payment Method
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [payoutEmail, setPayoutEmail] = useState("");
  const [bankRoutingNumber, setBankRoutingNumber] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [paypalEmail, setPaypalEmail] = useState("");
  const [cryptoWalletAddress, setCryptoWalletAddress] = useState("");
  const [cryptoNetwork, setCryptoNetwork] = useState("");

  // Check if user should be here
  useEffect(() => {
    if (user && user.role !== 'creator') {
      setLocation('/company/dashboard');
    }
  }, [user, setLocation]);

  // Fetch niches from API
  const { data: niches = [], isLoading: nichesLoading } = useQuery<Array<{ id: string; name: string; description: string | null; isActive: boolean }>>({
    queryKey: ["/api/niches"],
  });

  // Convert niches to the format expected by the component
  const AVAILABLE_NICHES = niches.map(niche => ({
    value: niche.name.toLowerCase().replace(/\s+/g, '_'),
    label: niche.name
  }));

  const calculateProgress = () => {
    return ((currentStep - 1) / (STEPS.length - 1)) * 100;
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const isImage = imageExtensions.some(ext => file.name.toLowerCase().endsWith(ext));

    if (!isImage) {
      toast({
        title: "Invalid File Type",
        description: "Please upload an image file (JPG, PNG, GIF, WebP)",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 5242880) {
      toast({
        title: "File Too Large",
        description: "Image file must be less than 5MB",
        variant: "destructive",
      });
      return;
    }

    setIsUploadingImage(true);

    try {
      // Use user ID for organized folder structure
      const folder = user?.id
        ? `creatorprofile/${user.id}`
        : "creatorprofile";

      const uploadResponse = await fetch("/api/objects/upload", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ folder, resourceType: "image" }),
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to get upload URL");
      }

      const uploadData = await uploadResponse.json();

      const formData = new FormData();
      formData.append('file', file);

      if (uploadData.uploadPreset) {
        formData.append('upload_preset', uploadData.uploadPreset);
      } else if (uploadData.signature) {
        formData.append('signature', uploadData.signature);
        formData.append('timestamp', uploadData.timestamp.toString());
        formData.append('api_key', uploadData.apiKey);
      }

      if (uploadData.folder) {
        formData.append('folder', uploadData.folder);
      }

      const uploadResult = await fetch(uploadData.uploadUrl, {
        method: "POST",
        body: formData,
      });

      if (!uploadResult.ok) {
        throw new Error("Failed to upload file");
      }

      const cloudinaryResponse = await uploadResult.json();
      setProfileImageUrl(cloudinaryResponse.secure_url);

      toast({
        title: "Success!",
        description: "Profile image uploaded successfully.",
      });
    } catch (error) {
      console.error("Image upload error:", error);
      toast({
        title: "Upload Failed",
        description: "Failed to upload image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploadingImage(false);
    }
  };

  const toggleNiche = (niche: string) => {
    setSelectedNiches(prev =>
      prev.includes(niche)
        ? prev.filter(n => n !== niche)
        : [...prev, niche]
    );
  };

  const removeNiche = (niche: string) => {
    setSelectedNiches(prev => prev.filter(n => n !== niche));
  };

  const validateStep = (step: number) => {
    switch (step) {
      case 2:
        if (selectedNiches.length === 0) {
          toast({
            title: "Please Select Niches",
            description: "Select at least one content niche to help us recommend relevant offers.",
            variant: "destructive",
          });
          return false;
        }
        return true;

      case 3: {
        const hasVideoPlatform = youtubeUrl || tiktokUrl || instagramUrl;
        if (!hasVideoPlatform) {
          toast({
            title: "Video Platform Required",
            description: "Add at least one video platform (YouTube, TikTok, or Instagram) to continue.",
            variant: "destructive",
          });
          return false;
        }
        return true;
      }

      case 4:
        if (!paymentMethod) {
          toast({
            title: "Payment Method",
            description: "Select how you'd like to get paid or choose to set it up later.",
            variant: "destructive",
          });
          return false;
        }

        if (paymentMethod === "setup_later") {
          return true;
        }

        if (paymentMethod === "etransfer" && !payoutEmail) {
          toast({
            title: "Payment details required",
            description: "Add an e-transfer email to continue.",
            variant: "destructive",
          });
          return false;
        }

        if (paymentMethod === "wire" && (!bankRoutingNumber || !bankAccountNumber)) {
          toast({
            title: "Payment details required",
            description: "Add your bank routing and account number to continue.",
            variant: "destructive",
          });
          return false;
        }

        if (paymentMethod === "paypal" && !paypalEmail) {
          toast({
            title: "Payment details required",
            description: "Add your PayPal email to continue.",
            variant: "destructive",
          });
          return false;
        }

        if (paymentMethod === "crypto" && (!cryptoWalletAddress || !cryptoNetwork)) {
          toast({
            title: "Payment details required",
            description: "Add your wallet address and network to continue.",
            variant: "destructive",
          });
          return false;
        }

        return true;

      default:
        return true;
    }
  };

  const handleSetUpLater = () => {
    setPaymentMethod("setup_later");
    setCurrentStep(prev => Math.min(prev + 1, STEPS.length));
  };

  const handleNext = () => {
    if (!validateStep(currentStep)) return;

    if (currentStep === STEPS.length) {
      handleComplete();
    } else {
      setCurrentStep(prev => Math.min(prev + 1, STEPS.length));
    }
  };

  const handleSkip = () => {
    // Skip entire onboarding and go to browse
    setLocation("/browse");
  };

  const handleComplete = async () => {
    const videoValid = validateStep(3);
    const paymentValid = validateStep(4);

    if (!videoValid || !paymentValid) {
      setCurrentStep(!videoValid ? 3 : 4);
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        profileImageUrl: profileImageUrl || null,
        niches: selectedNiches,
        youtubeUrl: youtubeUrl || null,
        youtubeFollowers: youtubeFollowers ? parseInt(youtubeFollowers) : null,
        tiktokUrl: tiktokUrl || null,
        tiktokFollowers: tiktokFollowers ? parseInt(tiktokFollowers) : null,
        instagramUrl: instagramUrl || null,
        instagramFollowers: instagramFollowers ? parseInt(instagramFollowers) : null,
      };

      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save profile");
      }

      toast({
        title: "Success!",
        description: "Your profile has been set up. Let's find some offers!",
      });

      // Refresh user data and redirect
      await queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      setTimeout(() => {
        setLocation("/browse");
      }, 1000);
    } catch (error: any) {
      console.error("Onboarding error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <Alert>
              <Sparkles className="h-4 w-4" />
              <AlertTitle>Welcome to AffiliateXchange!</AlertTitle>
              <AlertDescription>
                Let's set up your creator profile. This helps companies find you and recommend relevant offers.
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <Label>Profile Image (Optional)</Label>
              <p className="text-sm text-muted-foreground">
                Upload a profile picture to personalize your account
              </p>

              <div className="flex flex-col items-center gap-4">
                {profileImageUrl ? (
                  <div className="relative">
                    <Avatar className="h-32 w-32">
                      <AvatarImage src={profileImageUrl} alt="Profile" />
                      <AvatarFallback className="text-2xl">
                        {user?.firstName?.[0] || user?.username?.[0] || 'C'}
                      </AvatarFallback>
                    </Avatar>
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute -top-2 -right-2"
                      onClick={() => setProfileImageUrl("")}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="w-full">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      disabled={isUploadingImage}
                      className="hidden"
                      id="image-upload"
                    />
                    <label
                      htmlFor="image-upload"
                      className={`border-2 border-dashed rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer block ${
                        isUploadingImage ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      <div className="flex flex-col items-center gap-2">
                        {isUploadingImage ? (
                          <>
                            <Upload className="h-8 w-8 text-blue-600 animate-pulse" />
                            <div className="text-sm font-medium text-blue-600">
                              Uploading Image...
                            </div>
                          </>
                        ) : (
                          <>
                            <Upload className="h-8 w-8 text-primary" />
                            <div className="text-sm font-medium">
                              Click to upload profile image
                            </div>
                            <div className="text-xs text-muted-foreground">
                              JPG, PNG, GIF, WebP (max 5MB)
                            </div>
                          </>
                        )}
                      </div>
                    </label>
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Select Your Content Niches</AlertTitle>
              <AlertDescription>
                Choose the categories that best describe your content. This helps us recommend offers that match your audience.
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <Label>Content Niches <span className="text-red-500">*</span></Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between font-normal"
                  >
                    {selectedNiches.length === 0 ? (
                      <span className="text-muted-foreground">Select your content niches...</span>
                    ) : (
                      <span>{selectedNiches.length} niche{selectedNiches.length !== 1 ? 's' : ''} selected</span>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <div className="max-h-[300px] overflow-y-auto p-4 space-y-2">
                    {nichesLoading ? (
                      <div className="text-sm text-muted-foreground p-2">Loading niches...</div>
                    ) : AVAILABLE_NICHES.length === 0 ? (
                      <div className="text-sm text-muted-foreground p-2">No niches available</div>
                    ) : (
                      AVAILABLE_NICHES.map((niche) => (
                        <div key={niche.value} className="flex items-center space-x-2">
                          <Checkbox
                            id={`niche-${niche.value}`}
                            checked={selectedNiches.includes(niche.value)}
                            onCheckedChange={() => toggleNiche(niche.value)}
                          />
                          <label
                            htmlFor={`niche-${niche.value}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                          >
                            {niche.label}
                          </label>
                        </div>
                      ))
                    )}
                  </div>
                </PopoverContent>
              </Popover>

              {selectedNiches.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedNiches.map((nicheValue) => {
                    const niche = AVAILABLE_NICHES.find(n => n.value === nicheValue);
                    return (
                      <Badge key={nicheValue} variant="secondary" className="gap-1">
                        {niche?.label || nicheValue}
                        <button
                          type="button"
                          onClick={() => removeNiche(nicheValue)}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    );
                  })}
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Select at least one niche. You can add more or change them later in settings.
              </p>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <Alert className={!youtubeUrl && !tiktokUrl && !instagramUrl ? 'border-red-500 bg-red-50 dark:bg-red-950/20' : 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'}>
              <Video className={`h-5 w-5 ${!youtubeUrl && !tiktokUrl && !instagramUrl ? 'text-red-600' : 'text-blue-600'}`} />
              <AlertTitle className={!youtubeUrl && !tiktokUrl && !instagramUrl ? 'text-red-900 dark:text-red-300' : 'text-blue-900 dark:text-blue-300'}>
                {!youtubeUrl && !tiktokUrl && !instagramUrl ? '⚠️ Video Platform Required' : '✓ Video Platform Added'}
              </AlertTitle>
              <AlertDescription className={!youtubeUrl && !tiktokUrl && !instagramUrl ? 'text-red-800 dark:text-red-200' : 'text-blue-800 dark:text-blue-200'}>
                {!youtubeUrl && !tiktokUrl && !instagramUrl ? (
                  <>
                    <strong>Add at least one video platform to continue.</strong>
                    <br />
                    We only accept video content creators (YouTube, TikTok, or Instagram Reels).
                  </>
                ) : (
                  <>
                    <strong>Great!</strong> You've added a video platform. Companies can now see your reach.
                  </>
                )}
              </AlertDescription>
            </Alert>

            <div className="space-y-6">
              {/* YouTube */}
              <div className="space-y-3 p-4 border rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-red-500 flex items-center justify-center">
                    <span className="text-white font-bold text-sm">YT</span>
                  </div>
                  <Label className="text-base font-semibold">YouTube</Label>
                </div>
                <Input
                  type="url"
                  placeholder="https://youtube.com/@yourchannel"
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                />
                <Input
                  type="number"
                  placeholder="Subscriber count"
                  value={youtubeFollowers}
                  onChange={(e) => setYoutubeFollowers(e.target.value)}
                />
              </div>

              {/* TikTok */}
              <div className="space-y-3 p-4 border rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-black dark:bg-white flex items-center justify-center">
                    <span className="text-white dark:text-black font-bold text-sm">TT</span>
                  </div>
                  <Label className="text-base font-semibold">TikTok</Label>
                </div>
                <Input
                  type="url"
                  placeholder="https://tiktok.com/@yourusername"
                  value={tiktokUrl}
                  onChange={(e) => setTiktokUrl(e.target.value)}
                />
                <Input
                  type="number"
                  placeholder="Follower count"
                  value={tiktokFollowers}
                  onChange={(e) => setTiktokFollowers(e.target.value)}
                />
              </div>

              {/* Instagram */}
              <div className="space-y-3 p-4 border rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 flex items-center justify-center">
                    <span className="text-white font-bold text-sm">IG</span>
                  </div>
                  <Label className="text-base font-semibold">Instagram</Label>
                </div>
                <Input
                  type="url"
                  placeholder="https://instagram.com/yourusername"
                  value={instagramUrl}
                  onChange={(e) => setInstagramUrl(e.target.value)}
                />
                <Input
                  type="number"
                  placeholder="Follower count"
                  value={instagramFollowers}
                  onChange={(e) => setInstagramFollowers(e.target.value)}
                />
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <Alert>
              <CreditCard className="h-4 w-4" />
              <AlertTitle>Choose how you want to get paid</AlertTitle>
              <AlertDescription>
                Select a primary payout method now or set it up later in Payment Settings.
              </AlertDescription>
            </Alert>

            <div className="grid gap-4 md:grid-cols-2">
              <button
                type="button"
                onClick={() => setPaymentMethod("paypal")}
                className={`rounded-lg border p-4 text-left transition hover:border-primary ${paymentMethod === 'paypal' ? 'border-primary shadow-sm ring-2 ring-primary/20' : 'border-border'}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">PayPal</p>
                    <p className="text-sm text-muted-foreground">Fast payouts to your PayPal email</p>
                  </div>
                  <Badge variant={paymentMethod === 'paypal' ? 'default' : 'outline'}>
                    {paymentMethod === 'paypal' ? 'Selected' : 'Choose'}
                  </Badge>
                </div>
                {paymentMethod === "paypal" && (
                  <div className="mt-4 space-y-2">
                    <Label className="text-xs text-muted-foreground">PayPal Email</Label>
                    <Input
                      type="email"
                      placeholder="you@example.com"
                      value={paypalEmail}
                      onChange={(e) => setPaypalEmail(e.target.value)}
                    />
                  </div>
                )}
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod("etransfer")}
                className={`rounded-lg border p-4 text-left transition hover:border-primary ${paymentMethod === 'etransfer' ? 'border-primary shadow-sm ring-2 ring-primary/20' : 'border-border'}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">E-transfer</p>
                    <p className="text-sm text-muted-foreground">Send payouts to your email</p>
                  </div>
                  <Badge variant={paymentMethod === 'etransfer' ? 'default' : 'outline'}>
                    {paymentMethod === 'etransfer' ? 'Selected' : 'Choose'}
                  </Badge>
                </div>
                {paymentMethod === "etransfer" && (
                  <div className="mt-4 space-y-2">
                    <Label className="text-xs text-muted-foreground">Payout Email</Label>
                    <Input
                      type="email"
                      placeholder="payments@you.com"
                      value={payoutEmail}
                      onChange={(e) => setPayoutEmail(e.target.value)}
                    />
                  </div>
                )}
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod("wire")}
                className={`rounded-lg border p-4 text-left transition hover:border-primary ${paymentMethod === 'wire' ? 'border-primary shadow-sm ring-2 ring-primary/20' : 'border-border'}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">Bank Wire / ACH</p>
                    <p className="text-sm text-muted-foreground">Deposit directly to your bank</p>
                  </div>
                  <Badge variant={paymentMethod === 'wire' ? 'default' : 'outline'}>
                    {paymentMethod === 'wire' ? 'Selected' : 'Choose'}
                  </Badge>
                </div>
                {paymentMethod === "wire" && (
                  <div className="mt-4 space-y-3">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Routing Number</Label>
                      <Input
                        placeholder="123456789"
                        value={bankRoutingNumber}
                        onChange={(e) => setBankRoutingNumber(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Account Number</Label>
                      <Input
                        placeholder="000123456789"
                        value={bankAccountNumber}
                        onChange={(e) => setBankAccountNumber(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod("crypto")}
                className={`rounded-lg border p-4 text-left transition hover:border-primary ${paymentMethod === 'crypto' ? 'border-primary shadow-sm ring-2 ring-primary/20' : 'border-border'}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">Crypto</p>
                    <p className="text-sm text-muted-foreground">USDT/USDC on your preferred chain</p>
                  </div>
                  <Badge variant={paymentMethod === 'crypto' ? 'default' : 'outline'}>
                    {paymentMethod === 'crypto' ? 'Selected' : 'Choose'}
                  </Badge>
                </div>
                {paymentMethod === "crypto" && (
                  <div className="mt-4 space-y-3">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Wallet Address</Label>
                      <Input
                        placeholder="0xabc..."
                        value={cryptoWalletAddress}
                        onChange={(e) => setCryptoWalletAddress(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Network</Label>
                      <Select value={cryptoNetwork} onValueChange={setCryptoNetwork}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select network" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ethereum">Ethereum</SelectItem>
                          <SelectItem value="polygon">Polygon</SelectItem>
                          <SelectItem value="solana">Solana</SelectItem>
                          <SelectItem value="bitcoin">Bitcoin</SelectItem>
                          <SelectItem value="tron">Tron (TRC-20)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-muted/20 p-4">
              <div>
                <p className="font-semibold">Prefer to decide later?</p>
                <p className="text-sm text-muted-foreground">You can finish payout setup any time in Payment Settings.</p>
              </div>
              <Button variant="outline" onClick={handleSetUpLater}>
                Set up later
              </Button>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-6">
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Ready to submit</AlertTitle>
              <AlertDescription>Review your details before completing setup.</AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div className="rounded-lg border p-4">
                <h3 className="font-semibold mb-3">Profile</h3>
                <div className="flex items-center gap-3">
                  <Avatar className="h-14 w-14">
                    {profileImageUrl ? (
                      <AvatarImage src={profileImageUrl} alt="Profile" />
                    ) : (
                      <AvatarFallback>{user?.firstName?.[0] || user?.username?.[0] || 'C'}</AvatarFallback>
                    )}
                  </Avatar>
                  <div>
                    <p className="font-medium">{user?.firstName} {user?.lastName || ''}</p>
                    <p className="text-sm text-muted-foreground">{user?.email}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border p-4">
                <h3 className="font-semibold mb-3">Content Niches</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedNiches.map(nicheValue => {
                    const niche = AVAILABLE_NICHES.find(n => n.value === nicheValue);
                    return (
                      <Badge key={nicheValue} variant="secondary">
                        {niche?.label || nicheValue}
                      </Badge>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-lg border p-4 space-y-2">
                <h3 className="font-semibold">Video Platforms</h3>
                <div className="text-sm text-muted-foreground space-y-1">
                  {youtubeUrl && <div>• YouTube ({youtubeFollowers || 'followers not set'})</div>}
                  {tiktokUrl && <div>• TikTok ({tiktokFollowers || 'followers not set'})</div>}
                  {instagramUrl && <div>• Instagram ({instagramFollowers || 'followers not set'})</div>}
                </div>
              </div>

              <div className="rounded-lg border p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Payment Method
                </h3>
                {paymentMethod === "setup_later" || !paymentMethod ? (
                  <p className="text-sm text-muted-foreground">You'll finish payout setup later in Payment Settings.</p>
                ) : (
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <dt className="text-muted-foreground">Method:</dt>
                    <dd className="font-medium capitalize">{paymentMethod === "wire" ? "Wire / ACH" : paymentMethod}</dd>

                    {paymentMethod === "etransfer" && (
                      <>
                        <dt className="text-muted-foreground">Payout Email:</dt>
                        <dd className="font-medium">{payoutEmail}</dd>
                      </>
                    )}

                    {paymentMethod === "wire" && (
                      <>
                        <dt className="text-muted-foreground">Routing Number:</dt>
                        <dd className="font-medium">{bankRoutingNumber || "-"}</dd>
                        <dt className="text-muted-foreground">Account Number:</dt>
                        <dd className="font-medium">{bankAccountNumber ? `****${bankAccountNumber.slice(-4)}` : "-"}</dd>
                      </>
                    )}

                    {paymentMethod === "paypal" && (
                      <>
                        <dt className="text-muted-foreground">PayPal:</dt>
                        <dd className="font-medium">{paypalEmail}</dd>
                      </>
                    )}

                    {paymentMethod === "crypto" && (
                      <>
                        <dt className="text-muted-foreground">Wallet:</dt>
                        <dd className="font-medium">{cryptoWalletAddress}</dd>
                        <dt className="text-muted-foreground">Network:</dt>
                        <dd className="font-medium capitalize">{cryptoNetwork}</dd>
                      </>
                    )}
                  </dl>
                )}
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <img src="/logo.png" alt="AffiliateXchange Logo" className="h-10 w-10 rounded-md object-cover" />
            <span className="text-2xl font-bold">AffiliateXchange</span>
          </div>
          <h1 className="text-3xl font-bold mb-2">Creator Profile Setup</h1>
          <p className="text-muted-foreground">Let's get you started with affiliate offers</p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between mb-2">
            {STEPS.map((step, index) => (
              <div
                key={step.id}
                className={`flex-1 text-center ${index < STEPS.length - 1 ? 'mr-2' : ''}`}
              >
                <div
                  className={`text-xs font-medium mb-1 ${
                    currentStep >= step.id ? 'text-primary' : 'text-muted-foreground'
                  }`}
                >
                  {step.title}
                </div>
              </div>
            ))}
          </div>
          <Progress value={calculateProgress()} className="h-2" />
          <div className="text-center mt-2 text-sm text-muted-foreground">
            Step {currentStep} of {STEPS.length}
          </div>
        </div>

        {/* Content Card */}
        <Card>
          <CardHeader>
            <CardTitle>{STEPS[currentStep - 1].title}</CardTitle>
            <CardDescription>{STEPS[currentStep - 1].description}</CardDescription>
          </CardHeader>
          <CardContent>
            {renderStepContent()}

            {/* Navigation Buttons */}
            <div className="flex justify-between mt-8 pt-6 border-t">
              <Button
                variant="outline"
                onClick={handleSkip}
                disabled={isSubmitting}
              >
                Skip for Now
              </Button>

              <Button
                onClick={handleNext}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  "Saving..."
                ) : currentStep === STEPS.length ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Complete Setup
                  </>
                ) : (
                  <>
                    Continue
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Help Text */}
        <div className="mt-6 text-center text-sm text-muted-foreground">
          <p>You can always update your profile later in Settings</p>
        </div>
      </div>
    </div>
  );
}
