import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { useToast } from "../hooks/use-toast";
import { apiRequest, queryClient } from "../lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { GenericErrorDialog } from "../components/GenericErrorDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "../components/ui/form";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Checkbox } from "../components/ui/checkbox";
import {
  DollarSign,
  Video,
  Calendar,
  ArrowLeft,
  Upload,
  Play,
  ExternalLink,
  Sparkles,
  ShieldCheck,
  Clock3,
  Info,
  CheckCircle2,
  Send,
} from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "../hooks/useAuth";
import { VideoPlayer } from "../components/VideoPlayer";
import { useSidebar } from "../components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../components/ui/tooltip";
import { uploadToCloudinary } from "../lib/cloudinary-upload";

const uploadDeliverableSchema = z.object({
  platformUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().optional(),
  monthNumber: z.string().min(1, "Month number is required"),
  videoNumber: z.string().min(1, "Video number is required"),
});

type UploadDeliverableForm = z.infer<typeof uploadDeliverableSchema>;

const applyRetainerSchema = z.object({
  message: z
    .string()
    .min(20, "Tell us why you're interested (at least 20 characters)")
    .max(500, "Keep your note under 500 characters"),
  portfolioLinks: z.string().optional(),
  proposedStartDate: z.string().optional(),
  selectedTierId: z.string().optional(),
  acceptTerms: z
    .boolean()
    .refine((val) => val === true, { message: "You need to accept the expectations before applying" })
    .default(false),
});

type ApplyRetainerForm = z.infer<typeof applyRetainerSchema>;

export default function CreatorRetainerDetail() {
  const [, params] = useRoute("/retainers/:id");
  const { toast} = useToast();
  const { user } = useAuth();
  const { state: sidebarState, isMobile } = useSidebar();
  const contractId = params?.id;
  const [open, setOpen] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [resubmitOpen, setResubmitOpen] = useState(false);
  const [selectedDeliverable, setSelectedDeliverable] = useState<any>(null);
  const [resubmitVideoUrl, setResubmitVideoUrl] = useState("");
  const [isResubmitUploading, setIsResubmitUploading] = useState(false);
  const resubmitVideoInputRef = useRef<HTMLInputElement>(null);
  const [applyOpen, setApplyOpen] = useState(false);
  const [errorDialog, setErrorDialog] = useState<{ title: string; message: string } | null>(null);

  const { data: contract, isLoading } = useQuery<any>({
    queryKey: [`/api/retainer-contracts/${contractId}`],
    enabled: !!contractId,
  });

  const { data: myApplication } = useQuery<any>({
    queryKey: ["/api/creator/retainer-applications"],
  });

  const { data: deliverables } = useQuery<any[]>({
    queryKey: [`/api/retainer-contracts/${contractId}/deliverables`],
    enabled: !!contractId && myApplication?.some((app: any) => app.contractId === contractId && app.status === "approved"),
  });

  const form = useForm<UploadDeliverableForm>({
    resolver: zodResolver(uploadDeliverableSchema),
    defaultValues: {
      platformUrl: "",
      title: "",
      description: "",
      monthNumber: "1",
      videoNumber: "1",
    },
  });

  const handleVideoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size (max 500MB)
    if (file.size > 500 * 1024 * 1024) {
      setErrorDialog({
        title: "File Too Large",
        message: "Video file must be less than 500MB",
      });
      return;
    }

    setIsUploading(true);

    try {
      // Use contract ID and creator ID for organized folder structure
      const folder = contractId && user?.id
        ? `creatorlink/retainer/${contractId}/${user.id}`
        : user?.id
        ? `creatorlink/retainer/${user.id}`
        : "creatorlink/retainer";

      // Get Cloudinary upload parameters
      const uploadResponse = await fetch("/api/objects/upload", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          folder,
          resourceType: "video",
          contentType: file.type,
          fileName: file.name,
        }), // Save retainer videos in contract-specific folder
      });
      const uploadData = await uploadResponse.json();

      console.log('[Retainer Upload] Upload parameters received:', uploadData);

      const uploadResult = await uploadToCloudinary(uploadData, file);

      if (uploadResult?.secure_url) {
        const uploadedVideoUrl = uploadResult.secure_url;
        console.log('[Retainer Upload] Final video URL:', uploadedVideoUrl);

        setVideoUrl(uploadedVideoUrl);
        setIsUploading(false);

        toast({
          title: "Success!",
          description: "Video uploaded successfully. Fill in the details below.",
        });
      } else {
        throw new Error("Upload failed");
      }
    } catch (error) {
      console.error("Video upload error:", error);
      setIsUploading(false);
      setErrorDialog({
        title: "Upload Failed",
        message: "Failed to upload video. Please try again.",
      });
    }
  };

  const uploadMutation = useMutation({
    mutationFn: async (data: UploadDeliverableForm) => {
      if (!videoUrl) {
        throw new Error("Please upload a video file first");
      }
      const payload = {
        contractId,
        monthNumber: parseInt(data.monthNumber),
        videoNumber: parseInt(data.videoNumber),
        videoUrl: videoUrl,
        platformUrl: data.platformUrl || undefined,
        title: data.title,
        description: data.description || undefined,
      };
      return await apiRequest("POST", "/api/creator/retainer-deliverables", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/retainer-contracts/${contractId}/deliverables`] });
      toast({
        title: "Deliverable Submitted",
        description: "Your video has been submitted for review.",
      });
      setOpen(false);
      form.reset();
      setVideoUrl("");
    },
    onError: (error: Error) => {
      setErrorDialog({
        title: "Error",
        message: error.message || "Failed to submit deliverable",
      });
    },
  });

  const onSubmit = (data: UploadDeliverableForm) => {
    uploadMutation.mutate(data);
  };

  const resubmitForm = useForm<UploadDeliverableForm>({
    resolver: zodResolver(uploadDeliverableSchema),
  });

  const applyForm = useForm<ApplyRetainerForm>({
    resolver: zodResolver(applyRetainerSchema),
    defaultValues: {
      message: "",
      portfolioLinks: "",
      proposedStartDate: "",
      selectedTierId: "",
      acceptTerms: false,
    },
  });

  const handleResubmitVideo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsResubmitUploading(true);

    try {
      // Use contract ID and creator ID for organized folder structure
      const folder = contractId && user?.id
        ? `creatorlink/retainer/${contractId}/${user.id}`
        : user?.id
        ? `creatorlink/retainer/${user.id}`
        : "creatorlink/retainer";

      // Get Cloudinary upload parameters
      const uploadResponse = await fetch("/api/objects/upload", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ folder, resourceType: "video" }),
      });
      const uploadData = await uploadResponse.json();

      console.log('[Resubmit Upload] Upload parameters received:', uploadData);

      // Create FormData for Cloudinary upload
      const formData = new FormData();
      formData.append('file', file);

      // Add Cloudinary parameters
      if (uploadData.uploadPreset) {
        formData.append('upload_preset', uploadData.uploadPreset);
      } else if (uploadData.signature) {
        formData.append('signature', uploadData.signature);
        formData.append('timestamp', uploadData.timestamp.toString());
        formData.append('api_key', uploadData.apiKey);
      }

      if (uploadData.folder) {
        formData.append('folder', uploadData.folder);
        console.log('[Resubmit Upload] Folder parameter set to:', uploadData.folder);
      }

      console.log('[Resubmit Upload] FormData entries:', Array.from(formData.entries()));

      // Upload video to Cloudinary
      const uploadResult = await fetch(uploadData.uploadUrl, {
        method: "POST",
        body: formData,
      });

      if (uploadResult.ok) {
        const cloudinaryResponse = await uploadResult.json();
        console.log('[Resubmit Upload] Cloudinary response:', cloudinaryResponse);
        const uploadedVideoUrl = cloudinaryResponse.secure_url;
        console.log('[Resubmit Upload] Final video URL:', uploadedVideoUrl);

        setResubmitVideoUrl(uploadedVideoUrl);
        setIsResubmitUploading(false);

        toast({
          title: "Success!",
          description: "Video uploaded successfully. Fill in the rest of the form to resubmit.",
        });
      } else {
        throw new Error("Upload failed");
      }
    } catch (error) {
      console.error("Video upload error:", error);
      setIsResubmitUploading(false);
      setErrorDialog({
        title: "Upload Failed",
        message: "Failed to upload video. Please try again.",
      });
    }
  };

  const resubmitMutation = useMutation({
    mutationFn: async (data: UploadDeliverableForm) => {
      if (!resubmitVideoUrl) {
        throw new Error("Please upload a video file first");
      }
      if (!selectedDeliverable) {
        throw new Error("No deliverable selected");
      }
      const payload = {
        videoUrl: resubmitVideoUrl,
        platformUrl: data.platformUrl || undefined,
        title: data.title,
        description: data.description || undefined,
      };
      return await apiRequest("PATCH", `/api/creator/retainer-deliverables/${selectedDeliverable.id}/resubmit`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/retainer-contracts/${contractId}/deliverables`] });
      toast({
        title: "Revision Submitted",
        description: "Your revised video has been submitted for review.",
      });
      setResubmitOpen(false);
      resubmitForm.reset();
      setResubmitVideoUrl("");
      setSelectedDeliverable(null);
    },
    onError: (error: Error) => {
      setErrorDialog({
        title: "Error",
        message: error.message || "Failed to resubmit deliverable",
      });
    },
  });

  const onResubmit = (data: UploadDeliverableForm) => {
    resubmitMutation.mutate(data);
  };

  const handleResubmitClick = (deliverable: any) => {
    setSelectedDeliverable(deliverable);
    resubmitForm.reset({
      title: deliverable.title,
      description: deliverable.description || "",
      platformUrl: deliverable.platformUrl || "",
      monthNumber: deliverable.monthNumber.toString(),
      videoNumber: deliverable.videoNumber.toString(),
    });
    setResubmitOpen(true);
  };

  const applyMutation = useMutation({
    mutationFn: async (data: ApplyRetainerForm) => {
      const payload = {
        message: data.message,
        portfolioLinks: data.portfolioLinks
          ? data.portfolioLinks.split(",").map((link) => link.trim()).filter(Boolean)
          : [],
        proposedStartDate: data.proposedStartDate || undefined,
        selectedTierId: data.selectedTierId || undefined,
      };
      return await apiRequest("POST", `/api/creator/retainer-contracts/${contractId}/apply`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/creator/retainer-applications"] });
      toast({
        title: "Application Submitted!",
        description: "Your application has been sent. The company will review it soon.",
      });
      setApplyOpen(false);
      applyForm.reset();
    },
    onError: (error: Error) => {
      setErrorDialog({
        title: "Application Failed",
        message: error.message || "Failed to submit application",
      });
    },
  });

  const onApplySubmit = (data: ApplyRetainerForm) => {
    applyMutation.mutate(data);
  };

  if (isLoading) {
    return <div className="space-y-6">Loading...</div>;
  }

  if (!contract) {
    return <div className="space-y-6">Contract not found</div>;
  }

  const currentApplication = myApplication?.find((app: any) => app.contractId === contractId);
  const isApproved = currentApplication?.status === "approved";
  const isPending = currentApplication?.status === "pending";

  const contractMonthlyAmount = Number(contract.monthlyAmount) || 0;
  const contractVideosPerMonth = Math.max(1, Number(contract.videosPerMonth) || 1);
  const basePerVideo = contractMonthlyAmount / contractVideosPerMonth;
  // Default total fee estimate (4% platform + 3% processing). Actual fees may vary for partnership companies.
  const DEFAULT_TOTAL_FEE = 0.07;
  const platformFee = contractMonthlyAmount * DEFAULT_TOTAL_FEE;
  const creatorTakeHome = Math.max(contractMonthlyAmount - platformFee, 0);
  const hasRetainerTiers = Array.isArray(contract.retainerTiers) && contract.retainerTiers.length > 0;

  const formatCurrency = (value: number, options?: Intl.NumberFormatOptions) =>
    value.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      ...options,
      style: "currency",
      currency: "USD",
    });

  const formatSecondsToMinutes = (seconds?: number) => {
    if (!seconds) return undefined;
    const minutes = Math.ceil(seconds / 60);
    return `${minutes} min${minutes !== 1 ? "s" : ""}`;
  };

  const calculatePerVideoCost = (monthlyAmount: number, videosPerMonth: number) => {
    const safeVideos = Math.max(1, Number(videosPerMonth) || 1);
    return monthlyAmount / safeVideos;
  };

  const tierSummaries = (contract.retainerTiers || []).map((tier: any) => {
    const monthlyAmount = Number(tier.monthlyAmount) || 0;
    const videosPerMonth = Math.max(1, Number(tier.videosPerMonth) || 1);
    return {
      ...tier,
      monthlyAmount,
      videosPerMonth,
      perVideoCost: calculatePerVideoCost(monthlyAmount, videosPerMonth),
    };
  });

  const bestValueTier = tierSummaries.length > 0
    ? tierSummaries.reduce((best: any, tier: any) => {
        if (tier.perVideoCost < best.perVideoCost) {
          return tier;
        }
        return best;
      })
    : null;

  const getValidationBadge = (label: string, isValid: boolean) => (
    <Badge variant={isValid ? "outline" : "destructive"} className="gap-1">
      {isValid ? <CheckCircle2 className="h-3 w-3" /> : <Info className="h-3 w-3" />}
      {label}
    </Badge>
  );

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "pending_review":
        return "default";
      case "approved":
        return "outline";
      case "revision_requested":
        return "secondary";
      case "rejected":
        return "destructive";
      default:
        return "secondary";
    }
  };

  return (
    <div className="space-y-6 pb-24">
      <div className="flex items-center gap-4">
        <Link href="/retainers">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-3xl font-bold" data-testid="heading-contract-title">
              {contract.title}
            </h1>
            {currentApplication && (
              <Badge variant={isApproved ? "outline" : isPending ? "default" : "destructive"}>
                {currentApplication.status}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground">
            by {contract.company?.tradeName || contract.company?.legalName || "Company"}
          </p>
        </div>
        {isApproved && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-submit-deliverable">
                <Upload className="h-4 w-4 mr-2" />
                Submit Video
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Submit Deliverable</DialogTitle>
                <DialogDescription>
                  Upload a new video for this retainer contract
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="monthNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Month Number</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="1"
                              data-testid="input-month-number"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="videoNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Video Number</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="1"
                              data-testid="input-video-number"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription className="text-xs">
                            Within this month
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Video Title</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter video title"
                            data-testid="input-video-title"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description (Optional)</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Add any notes about this video"
                            rows={3}
                            data-testid="input-description"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="space-y-2">
                    <label htmlFor="video-upload" className="block text-sm font-medium mb-2">
                      Video File
                    </label>
                    <input
                      type="file"
                      id="video-upload"
                      ref={videoInputRef}
                      accept="video/*"
                      onChange={handleVideoUpload}
                      disabled={isUploading}
                      className="hidden"
                      aria-label="Upload video file"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => videoInputRef.current?.click()}
                      disabled={isUploading}
                      className="w-full"
                    >
                      {isUploading ? (
                        <>
                          <Upload className="h-4 w-4 mr-2 animate-pulse" />
                          Uploading...
                        </>
                      ) : videoUrl ? (
                        <>
                          <Video className="h-4 w-4 mr-2" />
                          Video Uploaded \u2713
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Choose Video File
                        </>
                      )}
                    </Button>
                    {videoUrl && (
                      <p className="text-xs text-green-600">
                        \u2713 Video uploaded successfully
                      </p>
                    )}
                    {!videoUrl && (
                      <p className="text-xs text-muted-foreground">
                        Select your video file (max 500MB)
                      </p>
                    )}
                  </div>

                  <FormField
                    control={form.control}
                    name="platformUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Platform URL (Optional)</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="https://tiktok.com/@brand/video/..."
                            data-testid="input-platform-url"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription className="text-xs">
                          Link to the video on {contract.requiredPlatform}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setOpen(false);
                        form.reset();
                        setVideoUrl("");
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={uploadMutation.isPending}
                      data-testid="button-submit-upload"
                    >
                      {uploadMutation.isPending ? "Submitting..." : "Submit Video"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Resubmit Revision Dialog */}
      <Dialog open={resubmitOpen} onOpenChange={setResubmitOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Resubmit Revision</DialogTitle>
            <DialogDescription>
              Upload a new video to address the requested revisions for Month {selectedDeliverable?.monthNumber}, Video #{selectedDeliverable?.videoNumber}
            </DialogDescription>
          </DialogHeader>
          <Form {...resubmitForm}>
            <form onSubmit={resubmitForm.handleSubmit(onResubmit)} className="space-y-4">
              <FormField
                control={resubmitForm.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Video Title</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter video title" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={resubmitForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Add any notes about this video" rows={3} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div>
                <FormLabel htmlFor="resubmit-video-upload">Upload New Video</FormLabel>
                <div className="mt-2">
                  <input
                    type="file"
                    id="resubmit-video-upload"
                    ref={resubmitVideoInputRef}
                    onChange={handleResubmitVideo}
                    accept="video/*"
                    className="hidden"
                    aria-label="Upload new video for resubmission"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => resubmitVideoInputRef.current?.click()}
                    disabled={isResubmitUploading}
                    className="w-full"
                  >
                    {isResubmitUploading ? (
                      <>
                        <span className="animate-spin mr-2">⏳</span>
                        Uploading...
                      </>
                    ) : resubmitVideoUrl ? (
                      <>
                        <Play className="h-4 w-4 mr-2" />
                        Video Uploaded - Click to Replace
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Choose Video File
                      </>
                    )}
                  </Button>
                  {resubmitVideoUrl && (
                    <p className="text-xs text-green-600 mt-2">\u2713 Video ready to submit</p>
                  )}
                </div>
              </div>

              <FormField
                control={resubmitForm.control}
                name="platformUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Platform URL (Optional)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="https://youtube.com/watch?v=..." />
                    </FormControl>
                    <FormDescription>
                      Link to where this video is published
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <input type="hidden" {...resubmitForm.register("monthNumber")} />
              <input type="hidden" {...resubmitForm.register("videoNumber")} />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setResubmitOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={resubmitMutation.isPending || !resubmitVideoUrl || isResubmitUploading}
                >
                  {resubmitMutation.isPending ? "Submitting..." : "Submit Revision"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Apply Dialog */}
      <Dialog open={applyOpen} onOpenChange={setApplyOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Apply to {contract?.title}</DialogTitle>
            <DialogDescription>
              Submit your application for this monthly retainer opportunity
            </DialogDescription>
          </DialogHeader>
          <Form {...applyForm}>
            <form onSubmit={applyForm.handleSubmit(onApplySubmit)} className="space-y-4">
              <FormField
                control={applyForm.control}
                name="message"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Why are you interested?</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Share your niche, experience, and why this brand is a great fit."
                        rows={5}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Minimum 20 characters, maximum 500
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={applyForm.control}
                name="portfolioLinks"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Portfolio Links (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="https://tiktok.com/@yourprofile, https://instagram.com/yourprofile"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Comma-separated URLs to your social profiles
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={applyForm.control}
                name="proposedStartDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Proposed Start Date (Optional)</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={applyForm.control}
                name="acceptTerms"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <div className="flex items-start gap-2 rounded-md border bg-background p-3">
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      <div className="space-y-1 text-sm">
                        <FormLabel className="text-sm">I understand the deliverables</FormLabel>
                        <p className="text-muted-foreground text-xs">
                          {contract?.videosPerMonth} videos per month for {contract?.durationMonths} months, following the posted schedule and approval requirements.
                        </p>
                      </div>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setApplyOpen(false);
                    applyForm.reset();
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={applyMutation.isPending}>
                  {applyMutation.isPending ? "Submitting..." : "Submit Application"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <div className="grid gap-4 xl:grid-cols-[1.8fr_1.1fr]">
        <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-sky-500 text-white rounded-2xl p-6 shadow-lg space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="uppercase text-xs tracking-[0.2em] text-white/70">Monthly Retainer</p>
              <div className="text-4xl font-bold">
                {formatCurrency(bestValueTier?.monthlyAmount ?? contractMonthlyAmount)}
              </div>
              <p className="text-sm text-white/80">
                {bestValueTier?.videosPerMonth ?? contractVideosPerMonth} videos / month ·
                {" "}
                {formatCurrency(
                  calculatePerVideoCost(
                    bestValueTier?.monthlyAmount ?? contractMonthlyAmount,
                    bestValueTier?.videosPerMonth ?? contractVideosPerMonth
                  ),
                  { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                )} per video
              </p>
            </div>

            <div className="flex flex-col items-end gap-2 text-sm">
              <Badge variant="outline" className="bg-white/10 text-white border-white/30">
                <Calendar className="h-3.5 w-3.5 mr-1" /> {contract.durationMonths} month contract
              </Badge>
              {hasRetainerTiers && bestValueTier && (
                <Badge className="bg-emerald-500 text-white border-none">
                  <Sparkles className="h-3.5 w-3.5 mr-1" /> Best value: {bestValueTier.name}
                </Badge>
              )}
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <div className="bg-white/10 rounded-xl p-3 backdrop-blur">
              <div className="flex items-center gap-2 text-sm text-white/80">
                <DollarSign className="h-4 w-4" /> Platform fee
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5" />
                    </TooltipTrigger>
                    <TooltipContent>AffiliateXchange charges a 7% platform fee.</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="text-lg font-semibold">{formatCurrency(platformFee, { maximumFractionDigits: 0 })}</p>
              <p className="text-xs text-white/70">You take home {formatCurrency(creatorTakeHome, { maximumFractionDigits: 0 })}</p>
            </div>

            <div className="bg-white/10 rounded-xl p-3 backdrop-blur">
              <div className="flex items-center gap-2 text-sm text-white/80">
                <Video className="h-4 w-4" /> Deliverables
              </div>
              <p className="text-lg font-semibold">
                {contractVideosPerMonth} / month
              </p>
              <p className="text-xs text-white/70">Minimum length {formatSecondsToMinutes(contract.minimumVideoLengthSeconds) || "per brief"}</p>
            </div>

            <div className="bg-white/10 rounded-xl p-3 backdrop-blur">
              <div className="flex items-center gap-2 text-sm text-white/80">
                <ShieldCheck className="h-4 w-4" /> Terms
              </div>
              <p className="text-lg font-semibold flex items-center gap-2">
                {contract.contentApprovalRequired ? "Approval required" : "Self-approve"}
              </p>
              <p className="text-xs text-white/70">
                {contract.exclusivityRequired ? "Exclusivity applies" : "Open to multiple brands"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {getValidationBadge("Content approval", !!contract.contentApprovalRequired)}
            {getValidationBadge("Exclusivity", !!contract.exclusivityRequired)}
            {getValidationBadge("Posting schedule", !!contract.postingSchedule)}
            {getValidationBadge("Min video length", !!contract.minimumVideoLengthSeconds)}
          </div>
        </div>

        <div className="space-y-4">
          <Card className="border-card-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Timeline & Fees</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock3 className="h-4 w-4" /> Contract length
                </div>
                <span className="font-semibold">{contract.durationMonths} months</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <DollarSign className="h-4 w-4" /> Monthly retainer
                </div>
                <span className="font-semibold">
                  {formatCurrency(contractMonthlyAmount, { maximumFractionDigits: 0 })}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Video className="h-4 w-4" /> Value per video
                </div>
                <span className="font-semibold">
                  {formatCurrency(basePerVideo, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-card-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Posting Schedule</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>{contract.postingSchedule || "No custom posting schedule provided."}</p>
              {contract.minimumVideoLengthSeconds && (
                <p className="text-xs text-foreground/80">Minimum length: {formatSecondsToMinutes(contract.minimumVideoLengthSeconds)}</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Tabs defaultValue="details" className="space-y-6">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          {isApproved && (
            <TabsTrigger value="deliverables" data-testid="tab-deliverables">
              My Deliverables ({deliverables?.length || 0})
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="details" className="space-y-6">
          <Card className="border-card-border">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <CardTitle>Tiered Packages</CardTitle>
              <p className="text-sm text-muted-foreground">Up to 5 tiers · auto-calculated per-video cost</p>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {hasRetainerTiers ? (
                tierSummaries.map((tier: any, index: number) => (
                  <div
                    key={`${tier.name}-${index}`}
                    className="rounded-xl border border-card-border p-4 bg-muted/30 shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <Badge variant="outline">{tier.name}</Badge>
                      <span className="text-xs text-muted-foreground">{tier.durationMonths} months</span>
                    </div>
                    <div className="mt-3 text-2xl font-bold">{formatCurrency(tier.monthlyAmount)}</div>
                    <p className="text-sm text-muted-foreground">
                      {tier.videosPerMonth} videos / month ·
                      {" "}
                      {formatCurrency(tier.perVideoCost, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                      {" "}
                      per video
                    </p>
                    <div className="mt-3 h-1.5 rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-sky-400 to-indigo-500"
                        style={{ width: `${Math.min(100, (tier.videosPerMonth / (contractVideosPerMonth || 1)) * 100)}%` }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">Value per video</p>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-card-border p-6 bg-muted/20 col-span-full">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Info className="h-4 w-4" />
                    No additional tiers were provided. Using base package details.
                  </div>
                  <div className="mt-3 text-lg font-semibold">
                    {contractVideosPerMonth} videos / month · {formatCurrency(basePerVideo, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} per video
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid lg:grid-cols-2 gap-4">
            <Card className="border-card-border">
              <CardHeader>
                <CardTitle>Deliverable Requirements</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Video className="h-4 w-4 text-primary" />
                  {contract.minimumVideoLengthSeconds
                    ? `Minimum length: ${formatSecondsToMinutes(contract.minimumVideoLengthSeconds)}`
                    : "Length per creative brief"}
                </div>
                <div className="flex items-center gap-2">
                  <Clock3 className="h-4 w-4 text-primary" />
                  {contract.postingSchedule || "Posting schedule will be coordinated directly."}
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  {contract.videosPerMonth} videos required each month
                </div>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  {contract.durationMonths} month agreement
                </div>
              </CardContent>
            </Card>

            <Card className="border-card-border">
              <CardHeader>
                <CardTitle>Additional Terms</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary" /> Content approval
                  </div>
                  <Badge variant={contract.contentApprovalRequired ? "outline" : "secondary"}>
                    {contract.contentApprovalRequired ? "Required" : "Not required"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary" /> Exclusivity
                  </div>
                  <Badge variant={contract.exclusivityRequired ? "destructive" : "outline"}>
                    {contract.exclusivityRequired ? "Exclusive" : "No exclusivity"}
                  </Badge>
                </div>
                {contract.minimumFollowers && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" /> Minimum followers
                    </div>
                    <span className="font-semibold text-foreground">
                      {contract.minimumFollowers.toLocaleString()}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="border-card-border">
            <CardHeader>
              <CardTitle>Contract Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Description</h4>
                <p className="text-muted-foreground">{contract.description}</p>
              </div>

              <div className="grid sm:grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <h4 className="font-semibold mb-1">Required Platform</h4>
                  <p className="text-muted-foreground">{contract.requiredPlatform}</p>
                </div>
                {contract.minimumFollowers && (
                  <div>
                    <h4 className="font-semibold mb-1">Minimum Followers</h4>
                    <p className="text-muted-foreground">
                      {contract.minimumFollowers.toLocaleString()}
                    </p>
                  </div>
                )}
              </div>

              {contract.platformAccountDetails && (
                <div className="pt-4 border-t">
                  <h4 className="font-semibold mb-2">Platform Account Details</h4>
                  <p className="text-muted-foreground">{contract.platformAccountDetails}</p>
                </div>
              )}

              {contract.contentGuidelines && (
                <div className="pt-4 border-t">
                  <h4 className="font-semibold mb-2">Content Guidelines</h4>
                  <p className="text-muted-foreground">{contract.contentGuidelines}</p>
                </div>
              )}

              {contract.brandSafetyRequirements && (
                <div className="pt-4 border-t">
                  <h4 className="font-semibold mb-2">Brand Safety Requirements</h4>
                  <p className="text-muted-foreground">{contract.brandSafetyRequirements}</p>
                </div>
              )}

              {contract.niches && contract.niches.length > 0 && (
                <div className="pt-4 border-t">
                  <h4 className="font-semibold mb-2">Target Niches</h4>
                  <div className="flex gap-2 flex-wrap">
                    {contract.niches.map((niche: string, index: number) => (
                      <Badge key={index} variant="outline">
                        {niche}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-card-border">
            <CardHeader>
              <CardTitle>Live Summary Preview</CardTitle>
              <p className="text-sm text-muted-foreground">Real-time breakdown using company-provided details.</p>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span>Gross monthly</span>
                  <span className="font-semibold">{formatCurrency(contractMonthlyAmount, { maximumFractionDigits: 0 })}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Platform fee (7%)</span>
                  <span className="font-semibold">{formatCurrency(platformFee, { maximumFractionDigits: 0 })}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Net to creator</span>
                  <span className="font-semibold text-emerald-600">
                    {formatCurrency(creatorTakeHome, { maximumFractionDigits: 0 })}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span>Videos per month</span>
                  <span className="font-semibold">{contractVideosPerMonth}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Value per video</span>
                  <span className="font-semibold">
                    {formatCurrency(basePerVideo, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                {bestValueTier && (
                  <div className="flex items-center justify-between">
                    <span>Best tier preview</span>
                    <span className="font-semibold">
                      {bestValueTier.name} · {formatCurrency(bestValueTier.perVideoCost, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/video
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {isApproved && (
          <TabsContent value="deliverables" className="space-y-6">
            {deliverables && deliverables.length > 0 ? (
              <div className="grid gap-4">
                {deliverables.map((deliverable: any) => (
                  <Card
                    key={deliverable.id}
                    className="border-card-border"
                    data-testid={`deliverable-card-${deliverable.id}`}
                  >
                    <CardContent className="p-6">
                      <div className="grid lg:grid-cols-[320px_1fr] gap-6">
                        {/* Left Column: Video */}
                        <div className="space-y-3">
                          <div className="rounded-lg overflow-hidden bg-black border-2 border-border">
                            <VideoPlayer
                              videoUrl={deliverable.videoUrl}
                              className="w-full aspect-video"
                            />
                          </div>

                          {/* Status Badge */}
                          <div className="flex justify-center">
                            <Badge variant={getStatusBadgeVariant(deliverable.status)} className="text-xs">
                              {deliverable.status.replace("_", " ")}
                            </Badge>
                          </div>
                        </div>

                        {/* Right Column: Details */}
                        <div className="space-y-4">
                          {/* Header */}
                          <div>
                            <h3 className="text-xl font-bold">{deliverable.title}</h3>
                            <p className="text-sm text-muted-foreground">
                              Month {deliverable.monthNumber} - Video #{deliverable.videoNumber}
                            </p>
                          </div>

                          {/* Description */}
                          {deliverable.description && (
                            <div>
                              <h4 className="font-semibold text-sm mb-1">Description</h4>
                              <p className="text-sm text-muted-foreground">
                                {deliverable.description}
                              </p>
                            </div>
                          )}

                          {/* Platform Link */}
                          {deliverable.platformUrl && (
                            <div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => window.open(deliverable.platformUrl, "_blank")}
                                data-testid={`button-view-platform-${deliverable.id}`}
                              >
                                <ExternalLink className="h-3 w-3 mr-1" />
                                View on Platform
                              </Button>
                            </div>
                          )}

                          {/* Review Notes */}
                          {deliverable.reviewNotes && (
                            <div className="pt-3 border-t">
                              <h4 className="font-semibold text-sm mb-1">Review Notes</h4>
                              <p className="text-sm text-muted-foreground">
                                {deliverable.reviewNotes}
                              </p>
                            </div>
                          )}

                          {/* Resubmit Button for Revision Requested */}
                          {deliverable.status === 'revision_requested' && (
                            <div className="pt-3 border-t">
                              <Button
                                onClick={() => handleResubmitClick(deliverable)}
                                className="w-full"
                                variant="default"
                              >
                                <Upload className="h-4 w-4 mr-2" />
                                Resubmit Revision
                              </Button>
                            </div>
                          )}

                          {/* Timestamps */}
                          <div className="pt-3 border-t space-y-1">
                            {deliverable.submittedAt && (
                              <p className="text-xs text-muted-foreground">
                                📤 Submitted {format(new Date(deliverable.submittedAt), "MMM d, yyyy 'at' h:mm a")}
                              </p>
                            )}
                            {deliverable.reviewedAt && (
                              <p className="text-xs text-muted-foreground">
                                \u2705 Reviewed {format(new Date(deliverable.reviewedAt), "MMM d, yyyy 'at' h:mm a")}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="border-card-border">
                <CardContent className="p-12 text-center">
                  <Video className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    No deliverables submitted yet. Click "Submit Video" to upload your first video.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        )}
      </Tabs>

      {/* Sticky Apply Button */}
      {!currentApplication && (
        <div
          className="fixed bottom-0 right-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-t z-50"
          style={{
            left: isMobile ? 0 : sidebarState === 'expanded' ? 'var(--sidebar-width, 16rem)' : 'var(--sidebar-width-icon, 3rem)'
          }}
        >
          <div className="container max-w-7xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <p className="font-semibold text-sm sm:text-base">{contract.title}</p>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {formatCurrency(contractMonthlyAmount)} / month · {contractVideosPerMonth} videos
                </p>
              </div>
              <Dialog open={applyOpen} onOpenChange={setApplyOpen}>
                <DialogTrigger asChild>
                  <Button className="w-full sm:w-auto" variant="default" data-testid="button-apply-retainer-sticky">
                    <Send className="h-4 w-4 mr-2" />
                    Apply Now
                  </Button>
                </DialogTrigger>
              </Dialog>
            </div>
          </div>
        </div>
      )}

      <GenericErrorDialog
        open={!!errorDialog}
        onOpenChange={(open) => !open && setErrorDialog(null)}
        title={errorDialog?.title || "Error"}
        description={errorDialog?.message || "An error occurred"}
      />
    </div>
  );
}
