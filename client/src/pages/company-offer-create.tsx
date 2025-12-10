import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Badge } from "../components/ui/badge";
import { Checkbox } from "../components/ui/checkbox";
import { ArrowLeft, Upload, Video, Play, Trash2, AlertCircle, Image as ImageIcon, X, FileText, Users, Globe, Shield, AlertTriangle, Clock } from "lucide-react";
import { Link } from "wouter";
import { proxiedSrc } from "../lib/image";
import { VideoPlayer } from "../components/VideoPlayer";
import { Progress } from "../components/ui/progress";
import { GenericErrorDialog } from "../components/GenericErrorDialog";
import { uploadToCloudinary } from "../lib/cloudinary-upload";

// Helper function to generate thumbnail from video
const generateThumbnail = async (videoUrl: string): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    // Use proxied URL to avoid CORS issues
    const proxiedUrl = `/proxy/image?url=${encodeURIComponent(videoUrl)}`;
    video.src = proxiedUrl;
    video.muted = true;

    const timeout = setTimeout(() => {
      reject(new Error('Thumbnail generation timed out'));
    }, 15000); // 15 second timeout

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

interface VideoData {
  videoFile: File;
  videoUrl?: string; // Temporary preview URL
  thumbnailUrl?: string; // Will be uploaded after offer creation
  title: string;
  description: string;
  creatorCredit: string;
  originalPlatform: string;
}

export default function CompanyOfferCreate() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/company/offers/:id/edit");
  const offerId = params?.id;
  const isEditMode = !!offerId;

  // Error dialog state
  const [errorDialog, setErrorDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
  }>({
    open: false,
    title: "",
    description: "",
  });

  // Exit confirmation dialog state
  const [showExitConfirmation, setShowExitConfirmation] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const [exitMessage, setExitMessage] = useState<{ title: string; description: string }>({
    title: "Leave Page?",
    description: "Are you sure you want to leave this page?",
  });

  const [formData, setFormData] = useState({
    title: "",
    productName: "",
    shortDescription: "",
    fullDescription: "",
    primaryNiche: "",
    productUrl: "",
    commissionType: "per_sale" as const,
    commissionRate: "",
    commissionAmount: "",
    status: "draft" as const,
    featuredImageUrl: "",
    // Creator Requirements
    minimumFollowers: "",
    allowedPlatforms: [] as string[],
    geographicRestrictions: [] as string[],
    ageRestriction: "no_restriction",
    contentStyleRequirements: "",
    brandSafetyRequirements: "",
  });

  // Video upload states
  const [videos, setVideos] = useState<VideoData[]>([]);
  const [showVideoDialog, setShowVideoDialog] = useState(false);
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);
  const [selectedVideoUrl, setSelectedVideoUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadingThumbnail, setIsUploadingThumbnail] = useState(false);
  const [currentUploadVideoIndex, setCurrentUploadVideoIndex] = useState<number | null>(null);
  const [videoUploadProgress, setVideoUploadProgress] = useState(0);
  const [offerUploadProgress, setOfferUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState("");

  // Store thumbnail file for upload after offer creation
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [currentVideo, setCurrentVideo] = useState<{
    videoFile: File | null;
    videoUrl: string;
    thumbnailUrl: string;
    title: string;
    description: string;
    creatorCredit: string;
    originalPlatform: string;
  }>({
    videoFile: null,
    videoUrl: "",
    thumbnailUrl: "",
    title: "",
    description: "",
    creatorCredit: "",
    originalPlatform: "",
  });

  // Check if form has unsaved changes
  const hasUnsavedChanges = useCallback(() => {
    const hasFormData =
      formData.title.trim() !== "" ||
      formData.productName.trim() !== "" ||
      formData.shortDescription.trim() !== "" ||
      formData.fullDescription.trim() !== "" ||
      formData.primaryNiche.trim() !== "" ||
      formData.productUrl.trim() !== "" ||
      formData.commissionRate !== "" ||
      formData.commissionAmount !== "" ||
      formData.featuredImageUrl !== "" ||
      formData.minimumFollowers !== "" ||
      formData.allowedPlatforms.length > 0 ||
      formData.geographicRestrictions.length > 0 ||
      formData.ageRestriction !== "no_restriction" ||
      formData.contentStyleRequirements !== "" ||
      formData.brandSafetyRequirements !== "";

    const hasVideos = videos.length > 0;
    const hasThumbnail = thumbnailFile !== null;

    return hasFormData || hasVideos || hasThumbnail;
  }, [formData, videos, thumbnailFile]);

  // Handle navigation - always show confirmation
  const handleNavigationAttempt = useCallback((targetPath: string) => {
    setPendingNavigation(targetPath);

    if (hasUnsavedChanges()) {
      setExitMessage({
        title: "Unsaved Changes",
        description: "You have unsaved changes in your offer. Are you sure you want to leave this page? All your progress will be lost.",
      });
    } else {
      setExitMessage({
        title: "Leave Page?",
        description: "You haven't added any information yet. Are you sure you want to leave this page?",
      });
    }

    setShowExitConfirmation(true);
  }, [hasUnsavedChanges]);

  // Confirm navigation and leave page
  const confirmNavigation = useCallback(() => {
    setShowExitConfirmation(false);
    if (pendingNavigation) {
      // Remove the popstate listener temporarily to allow navigation
      window.removeEventListener("popstate", () => {});
      setLocation(pendingNavigation);
      setPendingNavigation(null);
    }
  }, [pendingNavigation, setLocation]);

  // Cancel navigation and stay on page
  const cancelNavigation = useCallback(() => {
    setShowExitConfirmation(false);
    setPendingNavigation(null);
  }, []);

  // Warn before browser close/refresh
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges()) {
        e.preventDefault();
        e.returnValue = "";
        return "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Handle browser back/forward navigation - always show confirmation
  useEffect(() => {
    // Push a state to detect when user tries to go back
    window.history.pushState(null, "", window.location.href);

    const handlePopState = () => {
      // Push state again to prevent navigation
      window.history.pushState(null, "", window.location.href);
      setPendingNavigation(isEditMode ? `/company/offers/${offerId}` : "/company/offers");

      if (hasUnsavedChanges()) {
        setExitMessage({
          title: "Unsaved Changes",
          description: "You have unsaved changes in your offer. Are you sure you want to leave this page? All your progress will be lost.",
        });
      } else {
        setExitMessage({
          title: "Leave Page?",
          description: "You haven't added any information yet. Are you sure you want to leave this page?",
        });
      }

      setShowExitConfirmation(true);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [hasUnsavedChanges]);

  // Intercept all link clicks to show confirmation before navigating
  useEffect(() => {
    const handleLinkClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest("a");

      if (anchor) {
        const href = anchor.getAttribute("href");
        // Only intercept internal navigation links (not external links or same-page anchors)
        const isCurrentPage = href?.startsWith("/company/offers/create") ||
                              (isEditMode && href?.startsWith(`/company/offers/${offerId}/edit`));
        if (href && href.startsWith("/") && !isCurrentPage) {
          e.preventDefault();
          e.stopPropagation();

          setPendingNavigation(href);

          if (hasUnsavedChanges()) {
            setExitMessage({
              title: "Unsaved Changes",
              description: "You have unsaved changes in your offer. Are you sure you want to leave this page? All your progress will be lost.",
            });
          } else {
            setExitMessage({
              title: "Leave Page?",
              description: "You haven't added any information yet. Are you sure you want to leave this page?",
            });
          }

          setShowExitConfirmation(true);
        }
      }
    };

    // Use capture phase to intercept before the link navigates
    document.addEventListener("click", handleLinkClick, true);
    return () => document.removeEventListener("click", handleLinkClick, true);
  }, [hasUnsavedChanges]);

  const sectionRefs = {
    basics: useRef<HTMLDivElement>(null),
    requirements: useRef<HTMLDivElement>(null),
    assets: useRef<HTMLDivElement>(null),
  } as const;

  const sections = [
    {
      key: "basics" as const,
      title: "Offer Basics",
      description: "Thumbnail, product name, and descriptions",
    },
    {
      key: "requirements" as const,
      title: "Requirements & Targeting",
      description: "Creator requirements and niche",
    },
    {
      key: "assets" as const,
      title: "Payout & Assets",
      description: "Product link, payout details, and promotional videos",
    },
  ];

  const [currentStep, setCurrentStep] = useState(0);
  const activeSection = sections[currentStep].key;

  const scrollToSection = (key: (typeof sections)[number]["key"]) => {
    const targetIndex = sections.findIndex((section) => section.key === key);
    if (targetIndex !== -1) {
      setCurrentStep(targetIndex);
      sectionRefs[key].current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const goToNextSection = () => {
    setCurrentStep((prev) => Math.min(prev + 1, sections.length - 1));
  };

  const goToPreviousSection = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  useEffect(() => {
    const key = sections[currentStep].key;
    sectionRefs[key].current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [currentStep]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setErrorDialog({
        open: true,
        title: "Unauthorized",
        description: "Please log in to create offers",
      });
      setTimeout(() => {
        window.location.href = "/login";
      }, 500);
    }
  }, [isAuthenticated, isLoading]);

  // Fetch company profile to get company ID for folder organization
  const { data: companyProfile } = useQuery<{ id: string }>({
    queryKey: ["/api/profile"],
  });

  // Fetch company stats to check approval status
  const { data: companyStats } = useQuery<any>({
    queryKey: ["/api/company/stats"],
    enabled: isAuthenticated,
  });

  const isCompanyPending = companyStats?.companyProfile?.status === 'pending';

  // Fetch niches from API
  const { data: niches = [], isLoading: nichesLoading } = useQuery<Array<{ id: string; name: string; description: string | null; isActive: boolean }>>({
    queryKey: ["/api/niches"],
  });

  // Fetch existing offer data if in edit mode
  const { data: existingOffer, isLoading: offerLoading } = useQuery<any>({
    queryKey: [`/api/offers/${offerId}`],
    enabled: isEditMode && !!offerId && isAuthenticated,
  });

  // Fetch existing videos if in edit mode
  const { data: existingVideos = [] } = useQuery<any[]>({
    queryKey: [`/api/offers/${offerId}/videos`],
    enabled: isEditMode && !!offerId && isAuthenticated,
  });

  // Populate form data when editing
  useEffect(() => {
    if (isEditMode && existingOffer) {
      setFormData({
        title: existingOffer.title || "",
        productName: existingOffer.productName || "",
        shortDescription: existingOffer.shortDescription || "",
        fullDescription: existingOffer.fullDescription || "",
        primaryNiche: existingOffer.primaryNiche || "",
        productUrl: existingOffer.productUrl || "",
        commissionType: existingOffer.commissionType || "per_sale",
        commissionRate: existingOffer.commissionPercentage?.toString() || "",
        commissionAmount: existingOffer.commissionAmount?.toString() || "",
        status: existingOffer.status || "draft",
        featuredImageUrl: existingOffer.featuredImageUrl || "",
        minimumFollowers: existingOffer.minimumFollowers?.toString() || "",
        allowedPlatforms: existingOffer.allowedPlatforms || [],
        geographicRestrictions: existingOffer.geographicRestrictions || [],
        ageRestriction: existingOffer.ageRestriction || "no_restriction",
        contentStyleRequirements: existingOffer.contentStyleRequirements || "",
        brandSafetyRequirements: existingOffer.brandSafetyRequirements || "",
      });
    }
  }, [isEditMode, existingOffer]);

  const uploadWithProgress = (
    uploadParams: any,
    file: File,
    onProgress: (progress: number) => void,
  ) => uploadToCloudinary(uploadParams, file, onProgress);

  const createOfferMutation = useMutation({
    mutationFn: async (data: typeof formData & { videos: VideoData[] }) => {
      // Step 1: Create or update the offer
      setUploadStatus(isEditMode ? "Updating offer..." : "Creating draft offer...");
      setOfferUploadProgress(5);
      setCurrentUploadVideoIndex(null);
      setVideoUploadProgress(0);

      const offerPayload = {
        title: data.title,
        productName: data.productName,
        shortDescription: data.shortDescription,
        fullDescription: data.fullDescription,
        primaryNiche: data.primaryNiche,
        productUrl: data.productUrl,
        commissionType: data.commissionType,
        commissionPercentage: data.commissionType === "per_sale" && data.commissionRate
          ? data.commissionRate
          : null,
        commissionAmount: data.commissionType !== "per_sale" && data.commissionAmount
          ? data.commissionAmount
          : null,
        status: isEditMode ? data.status : 'draft', // Keep existing status when editing
        featuredImageUrl: data.featuredImageUrl || null,
        // Creator Requirements
        minimumFollowers: data.minimumFollowers ? parseInt(data.minimumFollowers) : null,
        allowedPlatforms: data.allowedPlatforms.length > 0 ? data.allowedPlatforms : null,
        geographicRestrictions: data.geographicRestrictions.length > 0 ? data.geographicRestrictions : null,
        ageRestriction: data.ageRestriction !== "no_restriction" ? data.ageRestriction : null,
        contentStyleRequirements: data.contentStyleRequirements || null,
        brandSafetyRequirements: data.brandSafetyRequirements || null,
      };

      console.log(isEditMode ? "Updating offer with payload:" : "Creating offer with payload:", offerPayload);

      let currentOfferId = offerId;

      if (isEditMode && offerId) {
        // Update existing offer
        const offerResponse = await fetch(`/api/offers/${offerId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify(offerPayload),
        });

        if (!offerResponse.ok) {
          const errorData = await offerResponse.json();
          throw new Error(errorData.error || errorData.message || "Failed to update offer");
        }

        const offerData = await offerResponse.json();
        console.log("Offer updated:", offerData);
      } else {
        // Create new offer
        const offerResponse = await fetch("/api/offers", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify(offerPayload),
        });

        if (!offerResponse.ok) {
          const errorData = await offerResponse.json();
          throw new Error(errorData.error || errorData.message || "Failed to create offer");
        }

        const offerData = await offerResponse.json();
        console.log("Full offer response:", offerData);

        currentOfferId = offerData?.id;
        console.log("Extracted offer ID:", currentOfferId);

        if (!currentOfferId) {
          console.error("No offer ID found in response:", offerData);
          throw new Error("Failed to get offer ID from response");
        }
      }

      const companyId = companyProfile?.id;
      if (!companyId) {
        throw new Error("Company profile not loaded or ID not found");
      }

      // Step 1.5: Upload thumbnail if provided
      if (thumbnailFile && currentOfferId) {
        console.log("Uploading offer thumbnail...");
        try {
          const thumbnailFolder = `creatorlink/videos/thumbnails/${companyId}/${currentOfferId}`;
          const thumbUploadResponse = await fetch("/api/objects/upload", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              folder: thumbnailFolder,
              resourceType: "image",
              contentType: thumbnailFile.type,
              fileName: thumbnailFile.name,
            }),
          });
          const thumbUploadData = await thumbUploadResponse.json();

          const thumbUploadResult = await uploadToCloudinary(thumbUploadData, thumbnailFile);

          if (thumbUploadResult?.secure_url) {
            // Save full Cloudinary URL like creator profile does
            const storedThumbnailUrl = thumbUploadResult.secure_url;

            // Update offer with thumbnail URL
            await fetch(`/api/offers/${currentOfferId}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ featuredImageUrl: storedThumbnailUrl }),
            });

            console.log("Thumbnail uploaded and offer updated:", storedThumbnailUrl);
          }
        } catch (thumbnailError) {
          console.error("Failed to upload thumbnail:", thumbnailError);
          // Continue without thumbnail - don't fail the entire offer creation
        }
      }

      // Step 2: Upload each video to Cloudinary with company ID and offer ID folder structure
      if (data.videos && data.videos.length > 0 && currentOfferId) {
        console.log(`Uploading ${data.videos.length} videos to offer ${currentOfferId}`);
        setUploadStatus("Preparing video uploads...");
        setOfferUploadProgress(20);

        const totalVideos = data.videos.length;
        const perVideoPortion = totalVideos > 0 ? 70 / totalVideos : 0;

        for (let i = 0; i < data.videos.length; i++) {
          const video = data.videos[i];
          console.log(`Uploading video ${i + 1}/${data.videos.length}:`, video.title);
          setCurrentUploadVideoIndex(i);
          setVideoUploadProgress(0);
          setUploadStatus(`Uploading video ${i + 1} of ${totalVideos}: ${video.title}`);

          try {
            // Upload video to Cloudinary with company ID and offer ID in path
            const videoFolder = `creatorlink/videos/${companyId}/${currentOfferId}`;
            const uploadResponse = await fetch("/api/objects/upload", {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                folder: videoFolder,
                resourceType: "video",
                contentType: video.videoFile.type,
                fileName: video.videoFile.name,
              }),
            });
            const uploadData = await uploadResponse.json();

            // Upload video to Cloudinary with progress tracking
            const cloudinaryResponse = await uploadWithProgress(
              uploadData,
              video.videoFile,
              (progress) => {
                setVideoUploadProgress(progress);
                const progressValue = 20 + perVideoPortion * i + (perVideoPortion * progress) / 100;
                setOfferUploadProgress(Math.min(95, Math.round(progressValue)));
              },
            );
            // Save full Cloudinary URL like creator profile does
            const uploadedVideoUrl = cloudinaryResponse.secure_url;
            const storedVideoUrl = uploadedVideoUrl;

            setVideoUploadProgress(100);
            setOfferUploadProgress(Math.min(95, Math.round(20 + perVideoPortion * (i + 1))));

            // Generate and upload thumbnail
            let uploadedThumbnailUrl = null;
            try {
              const thumbnailBlob = await generateThumbnail(uploadedVideoUrl);
              const thumbnailFolder = `creatorlink/videos/thumbnails/${companyId}/${currentOfferId}`;

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
                uploadedThumbnailUrl = thumbnailUploadResult.secure_url;
              }
            } catch (thumbnailError) {
              console.error('Thumbnail generation error:', thumbnailError);
              // Continue without thumbnail
            }

            // Create video record in database
            const videoPayload = {
              videoUrl: storedVideoUrl,
              thumbnailUrl: uploadedThumbnailUrl,
              title: video.title,
              description: video.description || "",
              creatorCredit: video.creatorCredit || "",
              originalPlatform: video.originalPlatform || "",
            };

            console.log(`Video ${i + 1} payload:`, videoPayload);

            const videoResponse = await fetch(`/api/offers/${currentOfferId}/videos`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              credentials: "include",
              body: JSON.stringify(videoPayload),
            });

            if (!videoResponse.ok) {
              const errorData = await videoResponse.json();
              throw new Error(errorData.message || "Failed to create video record");
            }

            const videoData = await videoResponse.json();
            console.log(`Video ${i + 1} uploaded successfully:`, videoData);
          } catch (videoError: any) {
            console.error(`Failed to upload video ${i + 1}:`, videoError);
            throw new Error(`Failed to upload video: ${video.title} - ${videoError.message || 'Unknown error'}`);
          }
        }

        console.log("All videos uploaded successfully");
      }

      // Step 3: Submit offer for review (validates 6-12 video requirement on server)
      // Skip submission step if in edit mode
      if (!isEditMode && currentOfferId) {
        console.log(`Submitting offer ${currentOfferId} for review...`);
        setUploadStatus("Submitting offer for review...");
        setOfferUploadProgress(97);
        const submitResponse = await fetch(`/api/offers/${currentOfferId}/submit-for-review`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
        });

        if (!submitResponse.ok) {
          const errorData = await submitResponse.json();
          throw new Error(errorData.message || "Failed to submit offer for review");
        }

        const submitData = await submitResponse.json();
        console.log("Offer submitted for review:", submitData);
        setOfferUploadProgress(100);
        setUploadStatus("Offer submitted for review");

        return submitData;
      } else {
        setOfferUploadProgress(100);
        setUploadStatus(isEditMode ? "Offer updated" : "Offer saved");
        return { id: currentOfferId };
      }
    },
    onSuccess: (data) => {
      console.log(isEditMode ? "Offer update complete:" : "Offer creation complete:", data);
      toast({
        title: isEditMode ? "Offer Updated" : "Offer Submitted for Review",
        description: isEditMode
          ? "Your offer has been successfully updated"
          : `Your offer has been submitted for admin review with ${data.videoCount || videos.length} video(s)`,
      });
      setOfferUploadProgress(0);
      setUploadStatus("");
      setCurrentUploadVideoIndex(null);
      setVideoUploadProgress(0);
      setLocation(isEditMode ? `/company/offers/${offerId}` : "/company/offers");
    },
    onError: (error: any) => {
      console.error(isEditMode ? "Offer update error:" : "Offer creation error:", error);
      setErrorDialog({
        open: true,
        title: "Error",
        description: error.message || (isEditMode ? "Failed to update offer" : "Failed to create offer"),
      });
      setOfferUploadProgress(0);
      setUploadStatus("");
      setCurrentUploadVideoIndex(null);
      setVideoUploadProgress(0);
    },
  });

  // Handle offer thumbnail selection (store for upload after offer creation)
  const handleThumbnailSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const isImage = imageExtensions.some(ext => file.name.toLowerCase().endsWith(ext));

    if (!isImage) {
      setErrorDialog({
        open: true,
        title: "Invalid File Type",
        description: "Please upload an image file (JPG, PNG, GIF, WebP)",
      });
      return;
    }

    if (file.size > 10485760) { // 10MB
      setErrorDialog({
        open: true,
        title: "File Too Large",
        description: "Image file must be less than 10MB",
      });
      return;
    }

    // Store file for upload after offer creation
    setThumbnailFile(file);

    // Create preview URL for display
    const previewUrl = URL.createObjectURL(file);
    setFormData(prev => ({ ...prev, featuredImageUrl: previewUrl }));

    toast({
      title: "Thumbnail Selected",
      description: "Thumbnail will be uploaded when you create the offer.",
    });
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const videoExtensions = ['.mp4', '.mov', '.avi', '.wmv', '.flv', '.webm', '.mkv', '.m4v'];
    const isVideo = videoExtensions.some(ext => file.name.toLowerCase().endsWith(ext));

    if (!isVideo) {
      setErrorDialog({
        open: true,
        title: "Invalid File Type",
        description: "Please upload a video file (MP4, MOV, AVI, WebM, etc.)",
      });
      return;
    }

    if (file.size > 524288000) {
      setErrorDialog({
        open: true,
        title: "File Too Large",
        description: "Video file must be less than 500MB",
      });
      return;
    }

    // Store file for later upload with offer ID
    // Create temporary preview URL
    if (currentVideo.videoUrl) {
      URL.revokeObjectURL(currentVideo.videoUrl);
    }

    const previewUrl = URL.createObjectURL(file);

    setCurrentVideo(prev => ({
      ...prev,
      videoFile: file,
      videoUrl: previewUrl,
    }));

    setIsUploading(false);
    setVideoUploadProgress(0);

    toast({
      title: "Video Selected",
      description: "Video will be uploaded when you create the offer.",
    });
  };

  const handleAddVideo = () => {
    if (!currentVideo.videoFile) {
      setErrorDialog({
        open: true,
        title: "Video Required",
        description: "Please select a video file",
      });
      return;
    }

    if (!currentVideo.title.trim()) {
      setErrorDialog({
        open: true,
        title: "Title Required",
        description: "Please provide a title for your video",
      });
      return;
    }

    setVideos([...videos, currentVideo as VideoData]);
    setShowVideoDialog(false);
    setCurrentVideo({
      videoFile: null,
      videoUrl: "",
      thumbnailUrl: "",
      title: "",
      description: "",
      creatorCredit: "",
      originalPlatform: "",
    });

    toast({
      title: "Video Added",
      description: `${videos.length + 1} video(s) ready to upload with offer`,
    });
  };

  const handleRemoveVideo = (index: number) => {
    setVideos(videos.filter((_, i) => i !== index));
    toast({
      title: "Video Removed",
      description: "Video removed from upload queue",
    });
  };

  const handlePlayVideo = (videoUrl: string) => {
    setSelectedVideoUrl(videoUrl);
    setShowVideoPlayer(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      setErrorDialog({
        open: true,
        title: "Validation Error",
        description: "Please enter an offer title",
      });
      return;
    }

    if (!formData.productName.trim()) {
      setErrorDialog({
        open: true,
        title: "Validation Error",
        description: "Please enter a product name",
      });
      return;
    }

    if (!formData.shortDescription.trim()) {
      setErrorDialog({
        open: true,
        title: "Validation Error",
        description: "Please enter a short description",
      });
      return;
    }

    if (!formData.fullDescription.trim()) {
      setErrorDialog({
        open: true,
        title: "Validation Error",
        description: "Please enter a full description",
      });
      return;
    }

    if (!formData.primaryNiche.trim()) {
      setErrorDialog({
        open: true,
        title: "Validation Error",
        description: "Please select a primary niche",
      });
      return;
    }

    if (!formData.productUrl.trim()) {
      setErrorDialog({
        open: true,
        title: "Validation Error",
        description: "Please enter a product URL",
      });
      return;
    }

    let productUrl = formData.productUrl.trim();
    if (!productUrl.match(/^https?:\/\//i)) {
      if (productUrl.includes('.')) {
        productUrl = 'https://' + productUrl;
        setFormData({ ...formData, productUrl: productUrl });
      } else {
        setErrorDialog({
          open: true,
          title: "Validation Error",
          description: "Please enter a valid URL",
        });
        return;
      }
    }

    if (formData.commissionType === "per_sale" && !formData.commissionRate) {
      setErrorDialog({
        open: true,
        title: "Validation Error",
        description: "Please enter a commission rate",
      });
      return;
    }

    if (formData.commissionType === "per_sale" && formData.commissionRate) {
      const rate = parseFloat(formData.commissionRate);
      if (isNaN(rate) || rate <= 0 || rate > 100) {
        setErrorDialog({
          open: true,
          title: "Validation Error",
          description: "Commission rate must be between 0 and 100",
        });
        return;
      }
    }

    if (formData.commissionType !== "per_sale" && !formData.commissionAmount) {
      setErrorDialog({
        open: true,
        title: "Validation Error",
        description: "Please enter a commission amount",
      });
      return;
    }

    if (formData.commissionType !== "per_sale" && formData.commissionAmount) {
      const amount = parseFloat(formData.commissionAmount);
      if (isNaN(amount) || amount <= 0) {
        setErrorDialog({
          open: true,
          title: "Validation Error",
          description: "Commission amount must be greater than 0",
        });
        return;
      }
    }

    // When creating new offer, require 6 videos
    // When editing, allow saving without videos (existing videos are separate)
    if (!isEditMode && videos.length < 6) {
      setErrorDialog({
        open: true,
        title: "Videos Required",
        description: `Please upload at least 6 videos (currently: ${videos.length})`,
      });
      return;
    }

    createOfferMutation.mutate({ ...formData, videos });
  };

  if (isLoading || (isEditMode && offerLoading)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          data-testid="button-back"
          onClick={() => handleNavigationAttempt(isEditMode ? `/company/offers/${offerId}` : "/company/offers")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">{isEditMode ? "Edit Offer" : "Create New Offer"}</h1>
          <p className="text-muted-foreground mt-1">
            {isEditMode ? "Update your affiliate offer details" : "Set up an affiliate offer for creators to promote"}
          </p>
        </div>
      </div>

      {/* Company Approval Pending Banner */}
      {isCompanyPending && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-800">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-500 shrink-0" />
          <p className="flex-1 text-sm text-amber-800 dark:text-amber-200">
            <span className="font-medium">Company Approval Pending:</span> Your company registration is under review. You'll be able to create offers once approved.
          </p>
          <Badge variant="outline" className="border-amber-400 text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/50">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        </div>
      )}

      <Card className="border-card-border">
        <CardHeader>
          <CardTitle>Offer Details</CardTitle>
          <p className="text-sm text-muted-foreground">
            Build your offer in three focused sections: basics, requirements, and assets.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-3">
            {sections.map((section, index) => (
              <button
                key={section.key}
                type="button"
                onClick={() => scrollToSection(section.key)}
                className={`w-full rounded-lg border p-3 text-left transition-colors ${
                  activeSection === section.key ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`h-10 w-10 rounded-full border flex items-center justify-center text-sm font-semibold ${
                      activeSection === section.key
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {index + 1}
                  </div>
                  <div className="space-y-1">
                    <div className="font-semibold leading-tight">{section.title}</div>
                    <p className="text-xs text-muted-foreground leading-snug">{section.description}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-10">
            <div
              ref={sectionRefs.basics}
              className={`space-y-4 rounded-lg border p-4 bg-muted/10 ${
                activeSection === "basics" ? "" : "hidden"
              }`}
              id="offer-basics"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold">Offer Basics</h3>
                </div>
                <span className="text-xs text-muted-foreground">Step 1 of 3</span>
              </div>

              {/* Offer Thumbnail Upload */}
              <div className="space-y-2">
                <Label>Offer Thumbnail *</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Upload a featured image for your offer (recommended: 1200x675px)
                </p>
                <div className="relative">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleThumbnailSelect}
                    disabled={isUploadingThumbnail}
                    className="hidden"
                    id="thumbnail-input"
                  />
                  <label
                    htmlFor="thumbnail-input"
                    className={`border-2 border-dashed rounded-lg p-6 text-center hover:border-primary transition-colors cursor-pointer block ${
                      isUploadingThumbnail ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    {formData.featuredImageUrl ? (
                      <div className="relative">
                        <img
                          src={proxiedSrc(formData.featuredImageUrl)}
                          alt="Offer thumbnail"
                          className="w-full h-48 object-cover rounded-lg"
                          referrerPolicy="no-referrer"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute top-2 right-2"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setFormData(prev => ({ ...prev, featuredImageUrl: "" }));
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        {isUploadingThumbnail ? (
                          <>
                            <Upload className="h-8 w-8 text-blue-600 animate-pulse" />
                            <div className="text-sm font-medium text-blue-600">
                              Uploading Thumbnail...
                            </div>
                          </>
                        ) : (
                          <>
                            <ImageIcon className="h-8 w-8 text-primary" />
                            <div className="text-sm font-medium">
                              Click to upload offer thumbnail
                            </div>
                            <div className="text-xs text-muted-foreground">
                              JPG, PNG, GIF, WebP (max 10MB)
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">Offer Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Premium Fitness App Affiliate Program"
                  maxLength={100}
                  data-testid="input-title"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="productName">Product Name *</Label>
                <Input
                  id="productName"
                  value={formData.productName}
                  onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                  placeholder="e.g., FitPro Premium"
                  data-testid="input-product-name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="shortDescription">Short Description * (Max 200 characters)</Label>
                <Textarea
                  id="shortDescription"
                  value={formData.shortDescription}
                  onChange={(e) => setFormData({ ...formData, shortDescription: e.target.value })}
                  placeholder="Brief summary for search results and previews..."
                  maxLength={200}
                  rows={2}
                  data-testid="input-short-description"
                />
                <p className="text-xs text-muted-foreground">
                  {formData.shortDescription.length}/200 characters
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fullDescription">Full Description *</Label>
                <Textarea
                  id="fullDescription"
                  value={formData.fullDescription}
                  onChange={(e) => setFormData({ ...formData, fullDescription: e.target.value })}
                  placeholder="Detailed description of your offer, target audience, benefits..."
                  rows={6}
                  data-testid="input-full-description"
                />
              </div>

              <div className="flex justify-end pt-2">
                <Button type="button" onClick={goToNextSection} data-testid="button-next-requirements">
                  Next: Requirements
                </Button>
              </div>
            </div>

            <div
              ref={sectionRefs.requirements}
              className={`space-y-4 rounded-lg border p-4 bg-muted/10 ${
                activeSection === "requirements" ? "" : "hidden"
              }`}
              id="creator-requirements"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold">Requirements & Targeting</h3>
                </div>
                <span className="text-xs text-muted-foreground">Step 2 of 3</span>
              </div>

              {/* Creator Requirements Section */}
              <Card className="border-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Creator Requirements
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Define specific requirements for creators who want to promote this offer
                  </p>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Minimum Followers */}
                  <div className="space-y-2">
                    <Label htmlFor="minimumFollowers">Minimum Followers/Subscribers (Optional)</Label>
                    <Input
                      id="minimumFollowers"
                      type="number"
                      min="0"
                      value={formData.minimumFollowers}
                      onChange={(e) => setFormData({ ...formData, minimumFollowers: e.target.value })}
                      placeholder="e.g., 10000"
                      data-testid="input-minimum-followers"
                    />
                    <p className="text-xs text-muted-foreground">
                      Minimum follower count required across any platform
                    </p>
                  </div>

                  {/* Allowed Platforms */}
                  <div className="space-y-3">
                    <Label>Allowed Platforms</Label>
                    <p className="text-xs text-muted-foreground">
                      Select which platforms creators can use to promote this offer
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { value: "YouTube", label: "YouTube" },
                        { value: "TikTok", label: "TikTok" },
                        { value: "Instagram", label: "Instagram" },
                        { value: "Facebook", label: "Facebook" },
                        { value: "Snapchat", label: "Snapchat" },
                        { value: "X/Twitter", label: "X/Twitter" },
                        { value: "LinkedIn", label: "LinkedIn" },
                        { value: "Other", label: "Other" },
                      ].map((platform) => (
                        <div key={platform.value} className="flex items-center space-x-2">
                          <Checkbox
                            id={`platform-${platform.value}`}
                            checked={formData.allowedPlatforms.includes(platform.value)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setFormData({
                                  ...formData,
                                  allowedPlatforms: [...formData.allowedPlatforms, platform.value]
                                });
                              } else {
                                setFormData({
                                  ...formData,
                                  allowedPlatforms: formData.allowedPlatforms.filter(p => p !== platform.value)
                                });
                              }
                            }}
                          />
                          <label
                            htmlFor={`platform-${platform.value}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
                            {platform.label}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Geographic Restrictions */}
                  <div className="space-y-2">
                    <Label htmlFor="geographicRestrictions" className="flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      Geographic Restrictions
                    </Label>
                    <p className="text-xs text-muted-foreground mb-2">
                      Enter countries separated by commas, or type "Worldwide" for no restrictions
                    </p>
                    <Input
                      id="geographicRestrictions"
                      value={formData.geographicRestrictions.join(", ")}
                      onChange={(e) => {
                        const value = e.target.value;
                        const countries = value.split(",").map(c => c.trim()).filter(c => c);
                        setFormData({ ...formData, geographicRestrictions: countries });
                      }}
                      placeholder="e.g., United States, Canada, United Kingdom or Worldwide"
                      data-testid="input-geographic-restrictions"
                    />
                  </div>

                  {/* Age Restrictions */}
                  <div className="space-y-2">
                    <Label htmlFor="ageRestriction">Age Restrictions</Label>
                    <Select
                      value={formData.ageRestriction}
                      onValueChange={(value) => setFormData({ ...formData, ageRestriction: value })}
                    >
                      <SelectTrigger id="ageRestriction" data-testid="select-age-restriction">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="no_restriction">No Restriction</SelectItem>
                        <SelectItem value="18+">18+ Only</SelectItem>
                        <SelectItem value="21+">21+ Only</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Age restriction for creator audience
                    </p>
                  </div>

                  {/* Content Style Requirements */}
                  <div className="space-y-2">
                    <Label htmlFor="contentStyleRequirements" className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Content Style Requirements (Optional)
                    </Label>
                    <p className="text-xs text-muted-foreground mb-2">
                      Describe the style and tone of content you're looking for (max 500 characters)
                    </p>
                    <Textarea
                      id="contentStyleRequirements"
                      value={formData.contentStyleRequirements}
                      onChange={(e) => setFormData({ ...formData, contentStyleRequirements: e.target.value })}
                      placeholder="e.g., Authentic product reviews, educational tutorials, lifestyle vlogs showcasing the product naturally..."
                      rows={3}
                      maxLength={500}
                      data-testid="input-content-style-requirements"
                    />
                    <p className="text-xs text-muted-foreground">
                      {formData.contentStyleRequirements.length}/500 characters
                    </p>
                  </div>

                  {/* Brand Safety Requirements */}
                  <div className="space-y-2">
                    <Label htmlFor="brandSafetyRequirements" className="flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      Brand Safety Requirements (Optional)
                    </Label>
                    <p className="text-xs text-muted-foreground mb-2">
                      Specify any brand safety guidelines or content restrictions (max 500 characters)
                    </p>
                    <Textarea
                      id="brandSafetyRequirements"
                      value={formData.brandSafetyRequirements}
                      onChange={(e) => setFormData({ ...formData, brandSafetyRequirements: e.target.value })}
                      placeholder="e.g., Family-friendly content only, no profanity, no controversial topics, must align with our brand values..."
                      rows={3}
                      maxLength={500}
                      data-testid="input-brand-safety-requirements"
                    />
                    <p className="text-xs text-muted-foreground">
                      {formData.brandSafetyRequirements.length}/500 characters
                    </p>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-2">
                <Label htmlFor="primaryNiche">Primary Niche *</Label>
                <Select
                  value={formData.primaryNiche}
                  onValueChange={(value) => setFormData({ ...formData, primaryNiche: value })}
                >
                  <SelectTrigger id="primaryNiche" data-testid="select-primary-niche">
                    <SelectValue placeholder="Select a niche" />
                  </SelectTrigger>
                  <SelectContent>
                    {nichesLoading ? (
                      <SelectItem value="loading" disabled>Loading niches...</SelectItem>
                    ) : niches.length === 0 ? (
                      <SelectItem value="none" disabled>No niches available</SelectItem>
                    ) : (
                      niches.map((niche) => (
                        <SelectItem key={niche.id} value={niche.name.toLowerCase().replace(/\s+/g, '_')}>
                          {niche.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-wrap justify-between gap-3 pt-2">
                <Button type="button" variant="outline" onClick={goToPreviousSection} data-testid="button-back-basics">
                  Back to Basics
                </Button>
                <Button type="button" onClick={goToNextSection} data-testid="button-next-assets">
                  Next: Payout & Assets
                </Button>
              </div>
            </div>

            <div
              ref={sectionRefs.assets}
              className={`space-y-4 rounded-lg border p-4 bg-muted/10 ${
                activeSection === "assets" ? "" : "hidden"
              }`}
              id="offer-assets"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Video className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold">Payout & Assets</h3>
                </div>
                <span className="text-xs text-muted-foreground">Step 3 of 3</span>
              </div>

              <div className="space-y-2">
                <Label htmlFor="productUrl">Product URL *</Label>
                <Input
                  id="productUrl"
                  value={formData.productUrl}
                  onChange={(e) => setFormData({ ...formData, productUrl: e.target.value })}
                  placeholder="https://yourproduct.com"
                  data-testid="input-product-url"
                />
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="commissionType">Commission Type *</Label>
                  <Select
                    value={formData.commissionType}
                    onValueChange={(value: any) =>
                      setFormData({ ...formData, commissionType: value })
                    }
                  >
                    <SelectTrigger id="commissionType" data-testid="select-commission-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="per_sale">Per Sale (Percentage)</SelectItem>
                      <SelectItem value="per_lead">Per Lead (Flat Rate)</SelectItem>
                      <SelectItem value="per_click">Per Click (CPC)</SelectItem>
                      <SelectItem value="monthly_retainer">Monthly Retainer</SelectItem>
                      <SelectItem value="hybrid">Hybrid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.commissionType === "per_sale" ? (
                  <div className="space-y-2">
                    <Label htmlFor="commissionRate">Commission Rate (%) *</Label>
                    <Input
                      id="commissionRate"
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={formData.commissionRate}
                      onChange={(e) =>
                        setFormData({ ...formData, commissionRate: e.target.value })
                      }
                      placeholder="e.g., 10"
                      data-testid="input-commission-rate"
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="commissionAmount">Commission Amount ($) *</Label>
                    <Input
                      id="commissionAmount"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.commissionAmount}
                      onChange={(e) =>
                        setFormData({ ...formData, commissionAmount: e.target.value })
                      }
                      placeholder="e.g., 50.00"
                      data-testid="input-commission-amount"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: any) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger id="status" data-testid="select-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="live">Live</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Draft offers are not visible to creators
                </p>
              </div>

              {/* Video Upload Section */}
              <Card className="border-2 border-dashed">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Video className="h-5 w-5" />
                    Promotional Videos *
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Upload 6-12 videos showcasing your product
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!isEditMode && videos.length < 6 && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        You need at least 6 videos to create this offer. Currently: {videos.length}/6
                      </AlertDescription>
                    </Alert>
                  )}
                  {isEditMode && (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Edit mode: Existing videos are managed from the offer detail page. Only new videos added here will be uploaded.
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      {videos.length} of 12 videos added
                    </div>
                    <Button
                      type="button"
                      onClick={() => setShowVideoDialog(true)}
                      disabled={videos.length >= 12}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Add Video
                    </Button>
                  </div>

                  {videos.length > 0 && (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {videos.map((video, index) => (
                        <Card key={index} className="overflow-hidden">
                          <CardContent className="p-4 space-y-2">
                            <div
                              className="aspect-video bg-muted rounded-md relative overflow-hidden cursor-pointer group"
                              onClick={() => video.videoUrl && handlePlayVideo(video.videoUrl)}
                            >
                              {video.thumbnailUrl ? (
                                <>
                                  <img
                                    src={proxiedSrc(video.thumbnailUrl)}
                                    alt={video.title}
                                    className="w-full h-full object-cover"
                                    referrerPolicy="no-referrer"
                                  />
                                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Play className="h-12 w-12 text-white" />
                                  </div>
                                </>
                              ) : video.videoUrl ? (
                                <video
                                  src={video.videoUrl}
                                  className="w-full h-full object-cover"
                                  muted
                                  controls
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Video className="h-8 w-8 text-muted-foreground" />
                                </div>
                              )}
                            </div>
                            <div>
                              <h4 className="font-semibold text-sm line-clamp-1">
                                {video.title}
                              </h4>
                              {video.creatorCredit && (
                                <p className="text-xs text-muted-foreground">
                                  by {video.creatorCredit}
                                </p>
                              )}
                            </div>
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              className="w-full"
                              onClick={() => handleRemoveVideo(index)}
                            >
                              <Trash2 className="h-3 w-3 mr-2" />
                              Remove
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {(createOfferMutation.isPending || offerUploadProgress > 0) && (
                <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                  <div className="flex items-center justify-between text-sm font-medium">
                    <span>{uploadStatus || "Uploading offer..."}</span>
                    <span>{Math.round(offerUploadProgress)}%</span>
                  </div>
                  <Progress value={offerUploadProgress || 5} />
                  {currentUploadVideoIndex !== null && (
                    <div className="text-xs text-muted-foreground">
                      Video {currentUploadVideoIndex + 1} of {videos.length} • {videoUploadProgress}%
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-3 pt-4 items-center justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={goToPreviousSection}
                >
                  Back to Requirements
                </Button>
                <div className="flex gap-3">
                  <Button
                    type="submit"
                    disabled={createOfferMutation.isPending || (!isEditMode && videos.length < 6) || isCompanyPending}
                    data-testid="button-create-offer"
                    title={isCompanyPending ? "Your company must be approved before creating offers" : undefined}
                  >
                    {createOfferMutation.isPending
                      ? `${isEditMode ? 'Updating' : 'Creating'}...${offerUploadProgress ? ` ${offerUploadProgress}%` : ""}`
                      : isEditMode ? "Update Offer" : "Create Offer"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    data-testid="button-cancel"
                    onClick={() => handleNavigationAttempt(isEditMode ? `/company/offers/${offerId}` : "/company/offers")}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Video Upload Dialog */}
      <Dialog open={showVideoDialog} onOpenChange={setShowVideoDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Promotional Video</DialogTitle>
            <DialogDescription>
              Upload a video file (max 500MB) and fill in the details
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Video File *</Label>
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
                        <Upload className="h-8 w-8 text-blue-600 animate-pulse" />
                        <div className="text-sm font-medium text-blue-600">
                          Uploading & Generating Thumbnail...
                        </div>
                      </>
                    ) : currentVideo.videoUrl ? (
                      <>
                        <Video className="h-8 w-8 text-green-600" />
                        <div className="text-sm font-medium text-green-600">
                          Video Ready \u2713
                        </div>
                        {currentVideo.thumbnailUrl && (
                          <div className="text-xs text-green-600">
                            Thumbnail generated \u2713
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <Upload className="h-8 w-8 text-primary" />
                        <div className="text-sm font-medium">
                          Click to upload video
                        </div>
                        <div className="text-xs text-muted-foreground">
                          MP4, MOV, WebM (max 500MB)
                        </div>
                      </>
                    )}
                  </div>
                </label>
              </div>
            </div>

            {currentVideo.videoUrl && (
              <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
                <div className="flex items-center justify-between text-sm font-medium">
                  <span>Video Preview</span>
                  {createOfferMutation.isPending && (
                    <span className="text-xs text-muted-foreground">{videoUploadProgress}% uploaded</span>
                  )}
                </div>
                <video
                  src={currentVideo.videoUrl}
                  controls
                  muted
                  className="w-full rounded-md aspect-video bg-black object-cover"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="video-title">Video Title *</Label>
              <Input
                id="video-title"
                value={currentVideo.title}
                onChange={(e) => setCurrentVideo({ ...currentVideo, title: e.target.value })}
                placeholder="e.g., Product Demo, Tutorial"
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="video-description">Description</Label>
              <Textarea
                id="video-description"
                value={currentVideo.description}
                onChange={(e) => setCurrentVideo({ ...currentVideo, description: e.target.value })}
                placeholder="Brief description..."
                rows={3}
                maxLength={500}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="creator-credit">Creator Credit</Label>
                <Input
                  id="creator-credit"
                  value={currentVideo.creatorCredit}
                  onChange={(e) => setCurrentVideo({ ...currentVideo, creatorCredit: e.target.value })}
                  placeholder="@username"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="original-platform">Platform</Label>
                <Input
                  id="original-platform"
                  value={currentVideo.originalPlatform}
                  onChange={(e) => setCurrentVideo({ ...currentVideo, originalPlatform: e.target.value })}
                  placeholder="TikTok, Instagram"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowVideoDialog(false);
                setCurrentVideo({
                  videoFile: null,
                  videoUrl: "",
                  thumbnailUrl: "",
                  title: "",
                  description: "",
                  creatorCredit: "",
                  originalPlatform: "",
                });
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddVideo}
              disabled={!currentVideo.videoUrl || !currentVideo.title || isUploading}
            >
              Add Video
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Video Player Dialog */}
      <Dialog open={showVideoPlayer} onOpenChange={setShowVideoPlayer}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Video Preview</DialogTitle>
            <DialogDescription>
              Preview your promotional video
            </DialogDescription>
          </DialogHeader>
          {selectedVideoUrl && (
            <div className="w-full">
              <VideoPlayer
                videoUrl={selectedVideoUrl}
                autoPlay
                className="aspect-video w-full"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Error Dialog */}
      <GenericErrorDialog
        open={errorDialog.open}
        onOpenChange={(open) => setErrorDialog({ ...errorDialog, open })}
        title={errorDialog.title}
        description={errorDialog.description}
        variant="error"
      />

      {/* Exit Confirmation Dialog */}
      <Dialog open={showExitConfirmation} onOpenChange={setShowExitConfirmation}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              {exitMessage.title}
            </DialogTitle>
            <DialogDescription>
              {exitMessage.description}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={cancelNavigation}>
              Continue
            </Button>
            <Button variant="destructive" onClick={confirmNavigation}>
              Leave Page
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}