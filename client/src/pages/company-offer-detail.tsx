import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Alert, AlertDescription } from "../components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import {
  ArrowLeft,
  Star,
  Play,
  DollarSign,
  Clock,
  Users,
  Edit,
  Video,
  Shield,
  Hash,
  Upload,
  Trash2,
  AlertCircle,
  CheckCircle2,
  MousePointer,
  Wallet,
  TrendingUp,
  Info,
  Pause,
  X,
  Loader2
} from "lucide-react";
import { proxiedSrc } from "../lib/image";
import { apiRequest, queryClient } from "../lib/queryClient";
import { TopNavBar } from "../components/TopNavBar";
import { VideoPlayer } from "../components/VideoPlayer";
import { DetailPageSkeleton } from "../components/skeletons";
import { GenericErrorDialog } from "../components/GenericErrorDialog";
import { uploadToCloudinary } from "../lib/cloudinary-upload";
import { useCompanyPageTour } from "../components/CompanyTour";
import { COMPANY_TOUR_IDS, offerDetailTourSteps } from "../lib/companyTourConfig";

// Helper function to format commission display
const formatCommission = (offer: any) => {
  if (!offer) return "$0";

  if (offer.commissionAmount) {
    const amount = typeof offer.commissionAmount === 'number'
      ? offer.commissionAmount
      : parseFloat(offer.commissionAmount);
    return `$${amount.toFixed(2)}`;
  } else if (offer.commissionPercentage) {
    const percentage = typeof offer.commissionPercentage === 'number'
      ? offer.commissionPercentage
      : parseFloat(offer.commissionPercentage);
    return `${percentage}%`;
  } else if (offer.commissionRate) {
    const rate = typeof offer.commissionRate === 'number'
      ? offer.commissionRate
      : parseFloat(offer.commissionRate);
    return `$${rate.toFixed(2)}`;
  }
  return "$0";
};

// Helper to get commission type label
const getCommissionTypeLabel = (offer: any) => {
  if (!offer?.commissionType) return "per sale";
  return offer.commissionType.replace(/_/g, " ");
};

// Helper function to generate thumbnail from video
const generateThumbnail = async (videoUrl: string): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    // Use video proxy endpoint which supports range requests needed for video playback
    const proxiedUrl = `/proxy/video?url=${encodeURIComponent(videoUrl)}`;
    video.src = proxiedUrl;
    video.muted = true;

    const timeout = setTimeout(() => {
      reject(new Error('Thumbnail generation timed out'));
    }, 15000);

    video.addEventListener('loadeddata', () => {
      try {
        const seekTime = Math.min(1, video.duration * 0.1);
        video.currentTime = seekTime;
      } catch (error) {
        clearTimeout(timeout);
        reject(new Error('Failed to seek video'));
      }
    });

    video.addEventListener('seeked', () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 1280;
        canvas.height = video.videoHeight || 720;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          clearTimeout(timeout);
          reject(new Error('Could not get canvas context'));
          return;
        }

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(
          (blob) => {
            clearTimeout(timeout);
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to create thumbnail blob'));
            }
          },
          'image/jpeg',
          0.8
        );
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });

    video.addEventListener('error', (e) => {
      clearTimeout(timeout);
      reject(new Error('Failed to load video for thumbnail generation'));
    });
  });
};

export default function CompanyOfferDetail() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [, params] = useRoute("/company/offers/:id");
  const [, setLocation] = useLocation();
  const offerId = params?.id;

  const [activeSection, setActiveSection] = useState("overview");
  const [isScrolling, setIsScrolling] = useState(false);
  const [showVideoDialog, setShowVideoDialog] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<any>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [videoTitle, setVideoTitle] = useState("");
  const [videoDescription, setVideoDescription] = useState("");
  const [creatorCredit, setCreatorCredit] = useState("");
  const [originalPlatform, setOriginalPlatform] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [errorDialog, setErrorDialog] = useState({ open: false, title: "Error", description: "An error occurred", errorDetails: "" });

  // Delete/Suspend dialog state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showSuspendDialog, setShowSuspendDialog] = useState(false);
  const [actionReason, setActionReason] = useState("");

  // Refs for sections
  const overviewRef = useRef<HTMLDivElement>(null);
  const videosRef = useRef<HTMLDivElement>(null);
  const applicationsRef = useRef<HTMLDivElement>(null);

  // Quick tour for offer detail page
  useCompanyPageTour(COMPANY_TOUR_IDS.OFFER_DETAIL, offerDetailTourSteps);

  // Auth check
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setErrorDialog({
        open: true,
        title: "Authentication Required",
        description: "Please log in to view offer details.",
        errorDetails: "You must be logged in to access this page.",
      });
      setTimeout(() => {
        window.location.href = "/login";
      }, 500);
    }
  }, [isAuthenticated, isLoading]);

  // Scroll spy with IntersectionObserver
  useEffect(() => {
    const observerOptions = {
      root: null,
      rootMargin: "-100px 0px -60% 0px",
      threshold: [0, 0.1, 0.25, 0.5, 0.75, 1],
    };

    const observerCallback = (entries: IntersectionObserverEntry[]) => {
      if (isScrolling) return;

      let mostVisibleEntry = entries[0];
      let maxRatio = 0;

      entries.forEach((entry) => {
        if (entry.isIntersecting && entry.intersectionRatio > maxRatio) {
          maxRatio = entry.intersectionRatio;
          mostVisibleEntry = entry;
        }
      });

      if (mostVisibleEntry?.isIntersecting) {
        const sectionId = mostVisibleEntry.target.getAttribute("data-section");
        if (sectionId) {
          setActiveSection(sectionId);
        }
      }
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);

    const sections = [overviewRef, videosRef, applicationsRef];
    sections.forEach((ref) => {
      if (ref.current) {
        observer.observe(ref.current);
      }
    });

    return () => {
      sections.forEach((ref) => {
        if (ref.current) {
          observer.unobserve(ref.current);
        }
      });
    };
  }, [isScrolling]);

  // Smooth scroll to section
  const scrollToSection = (sectionId: string) => {
    setActiveSection(sectionId);
    setIsScrolling(true);

    const refs: Record<string, React.RefObject<HTMLDivElement>> = {
      overview: overviewRef,
      videos: videosRef,
      applications: applicationsRef,
    };

    const ref = refs[sectionId];
    if (ref.current) {
      const stickyNavElement = document.querySelector('[data-sticky-nav]');
      const navHeight = stickyNavElement ? stickyNavElement.getBoundingClientRect().height : 100;

      const elementPosition = ref.current.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - navHeight - 20;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });

      setTimeout(() => {
        setIsScrolling(false);
      }, 1000);
    }
  };

  // Fetch offer details
  const { data: offer, isLoading: offerLoading } = useQuery<any>({
    queryKey: [`/api/offers/${offerId}`],
    enabled: !!offerId && isAuthenticated,
  });

  // Fetch applications for this offer
  const { data: applications = [] } = useQuery<any[]>({
    queryKey: ["/api/company/applications"],
    enabled: isAuthenticated,
  });

  // Fetch videos
  const { data: videos = [], isLoading: videosLoading } = useQuery<any[]>({
    queryKey: [`/api/offers/${offerId}/videos`],
    enabled: !!offerId && isAuthenticated,
  });

  // Filter applications for this offer
  const offerApplications = applications.filter((app: any) => app.offerId === offerId);

  // Video management
  const handleDialogOpenChange = useCallback((open: boolean) => {
    setShowVideoDialog(open);
    if (!open) {
      setVideoUrl("");
      setThumbnailUrl("");
      setVideoTitle("");
      setVideoDescription("");
      setCreatorCredit("");
      setOriginalPlatform("");
      setIsUploading(false);
    }
  }, []);

  const createVideoMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", `/api/offers/${offerId}/videos`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/offers/${offerId}/videos`] });
      handleDialogOpenChange(false);
      toast({
        title: "Success",
        description: "Video added successfully",
      });
    },
    onError: (error: any) => {
      setErrorDialog({
        open: true,
        title: "Video Addition Error",
        description: "Failed to add the video to your offer. Please try again.",
        errorDetails: error.message || "Failed to add video",
      });
    },
  });

  const deleteVideoMutation = useMutation({
    mutationFn: async (videoId: string) => {
      return await apiRequest("DELETE", `/api/offer-videos/${videoId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/offers/${offerId}/videos`] });
      toast({
        title: "Success",
        description: "Video deleted successfully",
      });
    },
    onError: (error: any) => {
      setErrorDialog({
        open: true,
        title: "Deletion Error",
        description: "Failed to delete the video. Please try again.",
        errorDetails: error.message || "Failed to delete video",
      });
    },
  });

  // Request delete mutation
  const requestDeleteMutation = useMutation({
    mutationFn: async (reason: string) => {
      return await apiRequest("POST", `/api/offers/${offerId}/request-delete`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/offers/${offerId}`] });
      setShowDeleteDialog(false);
      setActionReason("");
      toast({
        title: "Delete Request Submitted",
        description: "Your deletion request has been sent to the admin for approval.",
      });
    },
    onError: (error: any) => {
      setErrorDialog({
        open: true,
        title: "Request Failed",
        description: "Failed to submit deletion request. Please try again.",
        errorDetails: error.message || "Failed to request deletion",
      });
    },
  });

  // Request suspend mutation
  const requestSuspendMutation = useMutation({
    mutationFn: async (reason: string) => {
      return await apiRequest("POST", `/api/offers/${offerId}/request-suspend`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/offers/${offerId}`] });
      setShowSuspendDialog(false);
      setActionReason("");
      toast({
        title: "Suspend Request Submitted",
        description: "Your suspension request has been sent to the admin for approval.",
      });
    },
    onError: (error: any) => {
      setErrorDialog({
        open: true,
        title: "Request Failed",
        description: "Failed to submit suspension request. Please try again.",
        errorDetails: error.message || "Failed to request suspension",
      });
    },
  });

  // Cancel pending action mutation
  const cancelPendingActionMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/offers/${offerId}/cancel-pending-action`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/offers/${offerId}`] });
      toast({
        title: "Request Cancelled",
        description: "Your pending request has been cancelled.",
      });
    },
    onError: (error: any) => {
      setErrorDialog({
        open: true,
        title: "Cancellation Failed",
        description: "Failed to cancel the pending request. Please try again.",
        errorDetails: error.message || "Failed to cancel request",
      });
    },
  });

  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const videoExtensions = ['.mp4', '.mov', '.avi', '.wmv', '.flv', '.webm', '.mkv', '.m4v'];
    const isVideo = videoExtensions.some(ext => file.name.toLowerCase().endsWith(ext));

    if (!isVideo) {
      setErrorDialog({
        open: true,
        title: "Invalid File Type",
        description: "Please upload a video file (MP4, MOV, AVI, WebM, etc.)",
        errorDetails: `File type not supported: ${file.name}`,
      });
      return;
    }

    if (file.size > 524288000) {
      setErrorDialog({
        open: true,
        title: "File Too Large",
        description: "Video file must be less than 500MB. Please compress your video or choose a smaller file.",
        errorDetails: `File size: ${(file.size / (1024 * 1024)).toFixed(2)} MB (limit: 500 MB)`,
      });
      return;
    }

    setIsUploading(true);

    try {
      // Validate we have the required IDs
      if (!offer?.companyId || !offerId) {
        setErrorDialog({
          open: true,
          title: "Upload Error",
          description: "Unable to upload video. Please refresh the page and try again.",
          errorDetails: `Missing required information: ${!offer?.companyId ? 'Company ID' : ''} ${!offerId ? 'Offer ID' : ''}`,
        });
        setIsUploading(false);
        return;
      }

      // Use nested folder structure: creatorlink/videos/{companyId}/{offerId}
      const folder = `creatorlink/videos/${offer.companyId}/${offerId}`;

      const uploadResponse = await fetch("/api/objects/upload", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          folder,
          resourceType: "video",
          contentType: file.type,
          fileName: file.name,
        }),
      });
      const uploadData = await uploadResponse.json();

      const uploadResult = await uploadToCloudinary(uploadData, file);

      if (uploadResult?.secure_url) {
        // Save full Cloudinary URL like creator profile does
        const uploadedVideoUrl = uploadResult.secure_url;
        const storedVideoUrl = uploadedVideoUrl;

        toast({
          title: "Video Uploaded",
          description: "Generating thumbnail...",
        });

        try {
          const thumbnailBlob = await generateThumbnail(uploadedVideoUrl);

          // Use the same nested folder structure for thumbnails
          const thumbnailFolder = `creatorlink/videos/thumbnails/${offer.companyId}/${offerId}`;

          const thumbUploadResponse = await fetch("/api/objects/upload", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              folder: thumbnailFolder,
              resourceType: "image",
              contentType: 'image/jpeg',
              fileName: 'thumbnail.jpg',
            }),
          });
          const thumbUploadData = await thumbUploadResponse.json();

          const thumbnailUploadResult = await uploadToCloudinary(thumbUploadData, new File([thumbnailBlob], 'thumbnail.jpg'));

          if (thumbnailUploadResult?.secure_url) {
            // Save full Cloudinary URL like creator profile does
            const uploadedThumbnailUrl = thumbnailUploadResult.secure_url;
            const storedThumbnailUrl = uploadedThumbnailUrl;

            setVideoUrl(storedVideoUrl);
            setThumbnailUrl(storedThumbnailUrl);
            setIsUploading(false);

            toast({
              title: "Success!",
              description: "Video and thumbnail uploaded successfully. Fill in the details below.",
            });
          } else {
            setVideoUrl(storedVideoUrl);
            setIsUploading(false);
            toast({
              title: "Video Uploaded",
              description: "Video uploaded but thumbnail generation failed. You can still proceed.",
            });
          }
        } catch (thumbnailError) {
          setVideoUrl(storedVideoUrl);
          setIsUploading(false);
          toast({
            title: "Video Uploaded",
            description: "Video uploaded but thumbnail generation failed. You can still proceed.",
          });
        }
      } else {
        throw new Error("Upload failed");
      }
    } catch (error) {
      setIsUploading(false);
      setErrorDialog({
        open: true,
        title: "Video Upload Error",
        description: "Failed to upload video. Please check your internet connection and try again.",
        errorDetails: error instanceof Error ? error.message : "Upload failed",
      });
    }
  }, [toast, offer, offerId]); // Include offer and offerId so callback sees updated values

  const handleSubmitVideo = useCallback(() => {
    if (!videoUrl) {
      setErrorDialog({
        open: true,
        title: "Video Required",
        description: "Please upload a video file before submitting.",
        errorDetails: "No video file has been uploaded yet.",
      });
      return;
    }

    if (!videoTitle.trim()) {
      setErrorDialog({
        open: true,
        title: "Title Required",
        description: "Please provide a title for your video before submitting.",
        errorDetails: "Video title field is empty.",
      });
      return;
    }

    createVideoMutation.mutate({
      videoUrl,
      thumbnailUrl: thumbnailUrl || null,
      title: videoTitle.trim(),
      description: videoDescription.trim(),
      creatorCredit: creatorCredit.trim(),
      originalPlatform: originalPlatform.trim(),
    });
  }, [videoUrl, thumbnailUrl, videoTitle, videoDescription, creatorCredit, originalPlatform, createVideoMutation, toast]);

  const videoCount = videos.length;
  const canAddMoreVideos = videoCount < 12;
  const hasMinimumVideos = videoCount >= 6;

  const VideoUploader = useMemo(() => (
    <div className="relative">
      <input
        type="file"
        accept="video/*"
        onChange={handleFileSelect}
        disabled={isUploading}
        className="hidden"
        id="video-file-input"
      />
      <label
        htmlFor="video-file-input"
        className={`border-2 border-dashed rounded-lg p-6 text-center hover:border-primary transition-colors cursor-pointer block ${
          isUploading ? 'opacity-50 cursor-not-allowed' : ''
        }`}
      >
        <div className="flex flex-col items-center gap-2">
          {isUploading ? (
            <>
              <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                <Upload className="h-6 w-6 text-blue-600 animate-pulse" />
              </div>
              <div className="text-sm font-medium text-blue-600">
                Uploading Video...
              </div>
            </>
          ) : videoUrl ? (
            <>
              <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                <Video className="h-6 w-6 text-green-600" />
              </div>
              <div className="text-sm font-medium text-green-600">
                Video Ready ✓
              </div>
            </>
          ) : (
            <>
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Upload className="h-6 w-6 text-primary" />
              </div>
              <div className="text-sm font-medium">
                Browse and Select Video
              </div>
              <div className="text-xs text-muted-foreground">
                MP4, MOV, AVI, WebM (max 500MB)
              </div>
            </>
          )}
        </div>
      </label>
    </div>
  ), [videoUrl, isUploading, handleFileSelect]);

  // Loading state
  if (isLoading || offerLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <TopNavBar />
        <DetailPageSkeleton />
      </div>
    );
  }

  // Not found state
  if (!offer) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="max-w-md">
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground mb-4">Offer not found</p>
            <Button onClick={() => setLocation("/company/offers")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to My Offers
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const company = offer.company;
  const companyName = company?.tradeName || company?.legalName || "My Company";

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 pb-24">
      <TopNavBar />

      {/* Top Navigation Bar */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/company/offers")}
            className="h-10 w-10 rounded-full hover:bg-accent"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>

          <div className="flex items-center gap-2">
            {/* Show pending action status */}
            {offer.pendingAction && (
              <Badge variant="outline" className="gap-1 text-yellow-600 border-yellow-600">
                <Loader2 className="h-3 w-3 animate-spin" />
                Pending {offer.pendingAction === 'delete' ? 'Deletion' : 'Suspension'}
              </Badge>
            )}

            {/* Cancel pending action button */}
            {offer.pendingAction && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => cancelPendingActionMutation.mutate()}
                disabled={cancelPendingActionMutation.isPending}
                className="gap-1 text-gray-600"
              >
                {cancelPendingActionMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <X className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">Cancel Request</span>
              </Button>
            )}

            {/* Suspend button - only show if not already suspended and no pending action */}
            {!offer.pendingAction && offer.status !== 'paused' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSuspendDialog(true)}
                className="gap-1 text-yellow-600 border-yellow-600 hover:bg-yellow-50"
              >
                <Pause className="h-4 w-4" />
                <span className="hidden sm:inline">Suspend</span>
              </Button>
            )}

            {/* Delete button - only show if no pending action */}
            {!offer.pendingAction && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDeleteDialog(true)}
                className="gap-1 text-red-600 border-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
                <span className="hidden sm:inline">Delete</span>
              </Button>
            )}

            <Link href={`/company/offers/${offerId}/edit`}>
              <Button variant="outline" className="gap-2">
                <Edit className="h-4 w-4" />
                <span className="hidden sm:inline">Edit Offer</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Hero Section with Gradient Background */}
      <div className="relative">
        <div className="h-[280px] sm:h-[320px] relative overflow-hidden">
          {offer.featuredImageUrl ? (
            <div className="absolute inset-0">
              <img
                src={proxiedSrc(offer.featuredImageUrl)}
                alt={offer.title}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/50 to-gray-50" />
            </div>
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-primary/20 to-background">
              <div
                className="absolute inset-0 opacity-10"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
                }}
              />
            </div>
          )}
        </div>

        {/* Company Info Card - Overlapping Hero */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="relative -mt-28 sm:-mt-32">
            <Card className="border-2 shadow-2xl rounded-2xl">
              <CardContent className="p-6 sm:p-8">
                {/* Company Logo Circle */}
                <div className="flex justify-start -mt-16 sm:-mt-20 mb-6 ml-4">
                  <div className="relative">
                    <Avatar className="h-32 w-32 sm:h-36 sm:w-36 border-4 border-background shadow-2xl ring-2 ring-primary/20">
                      <AvatarImage
                        src={proxiedSrc(company?.logoUrl)}
                        alt={companyName}
                        referrerPolicy="no-referrer"
                      />
                      <AvatarFallback className="text-3xl sm:text-4xl font-bold bg-gradient-to-br from-primary to-purple-600 text-white">
                        {companyName[0]}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                </div>

                {/* Title & Status */}
                <div className="text-left mb-8">
                  <div className="flex items-center gap-3 mb-3">
                    <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900">
                      {offer.title}
                    </h1>
                    <Badge
                      variant={offer.status === 'approved' ? 'default' : 'secondary'}
                      className="px-3 py-1 text-sm"
                    >
                      {offer.status}
                    </Badge>
                  </div>

                  {offer.company?.tradeName && (
                    <p className="text-gray-600 text-base sm:text-lg">
                      by {offer.company.tradeName}
                    </p>
                  )}
                </div>

                {/* Commission Card */}
                <div className="bg-white rounded-2xl p-6 sm:p-8 mb-8 border-2 border-gray-200 shadow-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-baseline gap-3 mb-2">
                        <div className="text-5xl sm:text-6xl font-bold text-green-600">
                          {formatCommission(offer)}
                        </div>
                      </div>
                      <div className="text-lg sm:text-xl text-gray-700 font-medium capitalize mb-4">
                        {getCommissionTypeLabel(offer)}
                      </div>

                      {(offer.cookieDuration || offer.averageOrderValue) && (
                        <div className="flex items-center gap-4 flex-wrap text-sm text-gray-600">
                          {offer.cookieDuration && (
                            <div className="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-lg">
                              <Clock className="h-4 w-4 text-gray-600" />
                              <span className="font-medium">{offer.cookieDuration}-day cookie</span>
                            </div>
                          )}
                          {offer.averageOrderValue && (
                            <div className="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-lg">
                              <TrendingUp className="h-4 w-4 text-gray-600" />
                              <span className="font-medium">Avg: ${offer.averageOrderValue}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-3 gap-4 sm:gap-6 mb-8">
                  <div className="text-center bg-white rounded-xl p-4 border border-gray-200">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-white mb-3">
                      <Users className="h-6 w-6 text-gray-700" strokeWidth={1.5} />
                    </div>
                    <div className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">
                      {offerApplications.length}
                    </div>
                    <div className="text-xs sm:text-sm text-gray-600 font-medium">Applications</div>
                  </div>

                  <div className="text-center bg-white rounded-xl p-4 border border-gray-200">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-white mb-3">
                      <MousePointer className="h-6 w-6 text-gray-700" strokeWidth={1.5} />
                    </div>
                    <div className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">
                      {offer.viewCount || 0}
                    </div>
                    <div className="text-xs sm:text-sm text-gray-600 font-medium">Views</div>
                  </div>

                  <div className="text-center bg-white rounded-xl p-4 border border-gray-200">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-white mb-3">
                      <Wallet className="h-6 w-6 text-gray-700" strokeWidth={1.5} />
                    </div>
                    <div className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">
                      {videos.length}
                    </div>
                    <div className="text-xs sm:text-sm text-gray-600 font-medium">Videos</div>
                  </div>
                </div>

                {/* Hashtag Badges */}
                {(offer.primaryNiche || offer.secondaryNiche) && (
                  <div className="flex flex-wrap gap-3 pt-8 border-t">
                    {offer.primaryNiche && (
                      <Badge variant="secondary" className="text-xs sm:text-sm px-4 py-2 rounded-xl hover:bg-gray-200 transition-colors">
                        <Hash className="h-4 w-4 mr-1.5" />
                        {offer.primaryNiche}
                      </Badge>
                    )}
                    {offer.secondaryNiche && (
                      <Badge variant="secondary" className="text-xs sm:text-sm px-4 py-2 rounded-xl hover:bg-gray-200 transition-colors">
                        <Hash className="h-4 w-4 mr-1.5" />
                        {offer.secondaryNiche}
                      </Badge>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Sticky Tab Navigation */}
      <div
        data-sticky-nav
        className="sticky top-[57px] sm:top-[65px] z-40 bg-background/95 backdrop-blur-sm border-b shadow-sm mt-6 sm:mt-8"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex overflow-x-auto hide-scrollbar gap-8">
            <button
              onClick={() => scrollToSection("overview")}
              className={`relative px-4 py-4 font-semibold text-sm sm:text-base transition-all whitespace-nowrap ${
                activeSection === "overview"
                  ? "text-primary"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              Overview
              {activeSection === "overview" && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-t-full" />
              )}
            </button>
            <button
              onClick={() => scrollToSection("videos")}
              className={`relative px-4 py-4 font-semibold text-sm sm:text-base transition-all whitespace-nowrap ${
                activeSection === "videos"
                  ? "text-primary"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              Videos
              {activeSection === "videos" && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-t-full" />
              )}
            </button>
            <button
              onClick={() => scrollToSection("applications")}
              className={`relative px-4 py-4 font-semibold text-sm sm:text-base transition-all whitespace-nowrap ${
                activeSection === "applications"
                  ? "text-primary"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              Applications
              {activeSection === "applications" && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-t-full" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Content Sections */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-12 sm:space-y-16">
        {/* Overview Section */}
        <div ref={overviewRef} data-section="overview" className="scroll-mt-32">
          <Card className="rounded-2xl shadow-lg">
            <CardHeader>
              <CardTitle className="text-xl sm:text-2xl lg:text-3xl flex items-center gap-3">
                <Info className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
                About This Offer
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="prose prose-sm sm:prose max-w-none">
                <p className="text-muted-foreground text-base sm:text-lg whitespace-pre-wrap leading-relaxed">
                  {offer.fullDescription || offer.description || offer.shortDescription || "No description available."}
                </p>
              </div>

              {/* Commission Details Grid */}
              <div className="grid sm:grid-cols-2 gap-4 sm:gap-6 pt-6 border-t">
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-xl">
                  <div className="text-xs sm:text-sm text-gray-600 mb-2">Commission Rate</div>
                  <div className="text-3xl sm:text-4xl font-bold text-green-600 mb-2">
                    {formatCommission(offer)}
                  </div>
                  <Badge variant="secondary" className="mt-2 text-xs capitalize bg-white/60">
                    {getCommissionTypeLabel(offer)}
                  </Badge>
                </div>

                {offer.paymentSchedule && (
                  <div className="bg-gradient-to-br from-blue-50 to-cyan-50 p-6 rounded-xl">
                    <div className="text-xs sm:text-sm text-gray-600 mb-2">Payment Schedule</div>
                    <div className="text-xl sm:text-2xl font-bold text-blue-600 capitalize">
                      {offer.paymentSchedule.replace(/_/g, ' ')}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Videos Section */}
        <div ref={videosRef} data-section="videos" className="scroll-mt-32">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Video className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
              <h2 className="text-xl sm:text-2xl font-bold">
                Promotional Videos {videos.length > 0 && `(${videos.length})`}
              </h2>
            </div>
            <Button
              onClick={() => setShowVideoDialog(true)}
              disabled={!canAddMoreVideos || createVideoMutation.isPending}
              className="gap-2"
            >
              <Upload className="h-4 w-4" />
              Add Video
            </Button>
          </div>

          {!hasMinimumVideos && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                You need at least 6 videos to publish this offer. Currently: {videoCount}/6
              </AlertDescription>
            </Alert>
          )}

          {videosLoading ? (
            <Card className="rounded-2xl">
              <CardContent className="p-12 sm:p-16 text-center">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent mb-4"></div>
                <p className="text-muted-foreground">Loading videos...</p>
              </CardContent>
            </Card>
          ) : !videos || videos.length === 0 ? (
            <Card className="rounded-2xl">
              <CardContent className="p-12 sm:p-16 text-center">
                <Video className="h-12 w-12 sm:h-16 sm:w-16 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground">No videos uploaded yet</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Add promotional videos to help creators understand your offer
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
              {videos.map((video: any) => (
                <Card
                  key={video.id}
                  className="hover:shadow-xl transition-all duration-300 cursor-pointer overflow-hidden group rounded-xl relative"
                  onClick={() => setSelectedVideo(video)}
                >
                  <div className="aspect-video relative bg-gradient-to-br from-purple-400 via-pink-400 to-blue-400 overflow-hidden">
                    {video.thumbnailUrl ? (
                      <img
                        src={proxiedSrc(video.thumbnailUrl)}
                        alt={video.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Video className="h-12 w-12 text-white/50" />
                      </div>
                    )}

                    {/* Play Button Overlay */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-300 flex items-center justify-center">
                      <div className="bg-white/90 backdrop-blur rounded-full p-3 transform scale-0 group-hover:scale-100 transition-transform duration-300">
                        <Play className="h-6 w-6 sm:h-8 sm:w-8 text-primary fill-primary" />
                      </div>
                    </div>

                    {/* Delete Button */}
                    <button
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteVideoMutation.mutate(video.id);
                      }}
                      aria-label="Delete video"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <CardContent className="p-4">
                    <h4 className="font-semibold text-sm line-clamp-2 mb-1">
                      {video.title || "Untitled Video"}
                    </h4>
                    {video.creatorCredit && (
                      <p className="text-xs text-muted-foreground">by {video.creatorCredit}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Applications Section */}
        <div ref={applicationsRef} data-section="applications" className="scroll-mt-32">
          <div className="flex items-center gap-2 mb-6">
            <Users className="h-5 w-5 sm:h-6 sm:w-6 text-green-500" />
            <h2 className="text-xl sm:text-2xl font-bold">Applications</h2>
          </div>

          <Card className="rounded-2xl">
            <CardContent className="p-6 sm:p-8">
              {offerApplications.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle2 className="h-12 w-12 sm:h-16 sm:w-16 text-muted-foreground/20 mx-auto mb-4" />
                  <p className="text-muted-foreground text-base sm:text-lg font-medium">No applications yet</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Creators will apply to your offer once it's published
                  </p>
                </div>
              ) : (
                <div className="space-y-8">
                  {offerApplications.map((app: any) => (
                    <div key={app.id} className="border-b pb-8 last:border-0 last:pb-0">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="font-semibold text-lg">
                            {app.creatorName || 'Creator'}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            Applied {new Date(app.createdAt).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })}
                          </p>
                        </div>
                        <Badge variant={app.status === 'approved' ? 'default' : 'secondary'}>
                          {app.status}
                        </Badge>
                      </div>
                      {app.message && (
                        <p className="text-sm text-muted-foreground mb-4">{app.message}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Video Upload Dialog */}
      <Dialog open={showVideoDialog} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Promotional Video</DialogTitle>
            <DialogDescription>
              Select a video file to automatically upload (max 500MB), then fill in the details below
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="video-upload">
                Video File <span className="text-destructive">*</span>
              </Label>
              {VideoUploader}
            </div>

            <div className="space-y-2">
              <Label htmlFor="video-title">
                Video Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="video-title"
                value={videoTitle}
                onChange={(e) => setVideoTitle(e.target.value)}
                placeholder="e.g., Product Demo, Tutorial, Review"
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="video-description">Description</Label>
              <Textarea
                id="video-description"
                value={videoDescription}
                onChange={(e) => setVideoDescription(e.target.value)}
                placeholder="Provide a brief description of what this video shows..."
                rows={4}
                maxLength={500}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="creator-credit">Creator Credit</Label>
                <Input
                  id="creator-credit"
                  value={creatorCredit}
                  onChange={(e) => setCreatorCredit(e.target.value)}
                  placeholder="@username or creator name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="original-platform">Original Platform</Label>
                <Input
                  id="original-platform"
                  value={originalPlatform}
                  onChange={(e) => setOriginalPlatform(e.target.value)}
                  placeholder="TikTok, Instagram, YouTube"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => handleDialogOpenChange(false)}
              disabled={createVideoMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitVideo}
              disabled={!videoUrl || !videoTitle || isUploading || createVideoMutation.isPending}
            >
              {createVideoMutation.isPending ? "Adding..." : "Add Video"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Video Player Dialog */}
      {selectedVideo && (
        <Dialog open={!!selectedVideo} onOpenChange={() => setSelectedVideo(null)}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>{selectedVideo.title || "Video"}</DialogTitle>
              <DialogDescription>
                {selectedVideo.description || "Preview this promotional video"}
              </DialogDescription>
            </DialogHeader>
            {selectedVideo.videoUrl ? (
              <div className="w-full">
                <VideoPlayer
                  videoUrl={selectedVideo.videoUrl}
                  thumbnail={selectedVideo.thumbnailUrl}
                  autoPlay
                  className="aspect-video w-full"
                />
              </div>
            ) : (
              <div className="aspect-video bg-black rounded-lg overflow-hidden flex items-center justify-center text-white">
                <div className="text-center">
                  <Video className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p>Video not available</p>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Request Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={(open) => {
        setShowDeleteDialog(open);
        if (!open) setActionReason("");
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Request Offer Deletion
            </DialogTitle>
            <DialogDescription>
              This will submit a deletion request to the admin for approval. The offer will remain active until approved.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Once approved, this action cannot be undone. All applications, videos, and data associated with this offer will be permanently deleted.
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Label htmlFor="delete-reason">Reason for deletion (optional)</Label>
              <Textarea
                id="delete-reason"
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder="Why do you want to delete this offer?"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteDialog(false);
                setActionReason("");
              }}
              disabled={requestDeleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => requestDeleteMutation.mutate(actionReason)}
              disabled={requestDeleteMutation.isPending}
            >
              {requestDeleteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Submitting...
                </>
              ) : (
                "Request Deletion"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Suspend Request Dialog */}
      <Dialog open={showSuspendDialog} onOpenChange={(open) => {
        setShowSuspendDialog(open);
        if (!open) setActionReason("");
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-yellow-600 flex items-center gap-2">
              <Pause className="h-5 w-5" />
              Request Offer Suspension
            </DialogTitle>
            <DialogDescription>
              This will submit a suspension request to the admin for approval. The offer will remain active until approved.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Once suspended, the offer will not be visible to creators. You can request to resume it later by contacting the admin.
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Label htmlFor="suspend-reason">Reason for suspension (optional)</Label>
              <Textarea
                id="suspend-reason"
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder="Why do you want to suspend this offer?"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setShowSuspendDialog(false);
                setActionReason("");
              }}
              disabled={requestSuspendMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              className="bg-yellow-600 hover:bg-yellow-700"
              onClick={() => requestSuspendMutation.mutate(actionReason)}
              disabled={requestSuspendMutation.isPending}
            >
              {requestSuspendMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Submitting...
                </>
              ) : (
                "Request Suspension"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Error Dialog */}
      <GenericErrorDialog
        open={errorDialog.open}
        onOpenChange={(open) => setErrorDialog({ ...errorDialog, open })}
        title={errorDialog.title}
        description={errorDialog.description}
        errorDetails={errorDialog.errorDetails}
        variant="error"
      />

      <style>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}