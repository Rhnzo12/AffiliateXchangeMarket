import { useEffect, useState, useRef } from "react";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { apiRequest, queryClient } from "../lib/queryClient";
import { isUnauthorizedError } from "../lib/authUtils";
import { GenericErrorDialog } from "../components/GenericErrorDialog";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Textarea } from "../components/ui/textarea";
import { Checkbox } from "../components/ui/checkbox";
import { Label } from "../components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "../components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Heart,
  Star,
  Play,
  CheckCircle2,
  DollarSign,
  Clock,
  MapPin,
  Users,
  Check,
  ArrowLeft,
  TrendingUp,
  MousePointer,
  Wallet,
  Video,
  Globe,
  Sparkles,
  Shield,
  Verified,
  Hash,
  ExternalLink,
  AlertTriangle
} from "lucide-react";
import { proxiedSrc } from "../lib/image";
import { TopNavBar } from "../components/TopNavBar";
import { VideoPlayer } from "../components/VideoPlayer";
import { DetailPageSkeleton } from "../components/skeletons";

// Helper function to format duration in seconds to MM:SS
function formatDuration(seconds: number | string): string {
  if (!seconds) return "0:00";
  
  // If it's already formatted (string like "3:45"), return as is
  if (typeof seconds === 'string' && seconds.includes(':')) {
    return seconds;
  }
  
  // Convert to number if string
  const numSeconds = typeof seconds === 'string' ? parseInt(seconds, 10) : seconds;
  
  if (isNaN(numSeconds) || numSeconds === 0) return "0:00";
  
  const mins = Math.floor(numSeconds / 60);
  const secs = Math.floor(numSeconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// Helper function to format commission display - FIXED: No $ with %
const formatCommission = (offer: any) => {
  if (!offer) return "$0";
  
  if (offer.commissionAmount !== undefined && offer.commissionAmount !== null) {
    const amount = typeof offer.commissionAmount === "string"
      ? parseFloat(offer.commissionAmount)
      : offer.commissionAmount;

    if (!isNaN(amount)) {
      return `$${Number(amount).toFixed(2)}`;
    }
  }

  if (offer.commissionPercentage !== undefined && offer.commissionPercentage !== null) {
    return `${offer.commissionPercentage}%`; // Just percentage, no $ sign
  }

  if (offer.commissionRate !== undefined && offer.commissionRate !== null) {
    const rate = typeof offer.commissionRate === "string"
      ? parseFloat(offer.commissionRate)
      : offer.commissionRate;

    if (!isNaN(rate)) {
      return `$${Number(rate).toFixed(2)}`;
    }
  }
  return "$0";
};

// Helper to get commission type label
const getCommissionTypeLabel = (offer: any) => {
  if (!offer?.commissionType) return "per sale";
  return offer.commissionType.replace(/_/g, " ");
};

// Helper to format response time for display
const formatResponseTime = (hours: number | null | undefined) => {
  if (hours === null || hours === undefined) return "No responses yet";
  if (hours < 1) return "Responds < 1hr";
  if (hours < 24) return `Responds in ${hours}hrs`;
  return `Responds in ${Math.round(hours / 24)}d`;
};

export default function OfferDetail() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [, params] = useRoute("/offers/:id");
  const [, setLocation] = useLocation();
  const offerId = params?.id;

  const [showApplyDialog, setShowApplyDialog] = useState(false);
  const [showVideoPlatformDialog, setShowVideoPlatformDialog] = useState(false);
  const [applicationMessage, setApplicationMessage] = useState("");
  const [preferredCommission, setPreferredCommission] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<any>(null);
  const [activeSection, setActiveSection] = useState("overview");
  const [isScrolling, setIsScrolling] = useState(false);
  const [errorDialog, setErrorDialog] = useState({ open: false, title: "Error", description: "An error occurred", errorDetails: "" });

  // Refs for sections
  const overviewRef = useRef<HTMLDivElement>(null);
  const videosRef = useRef<HTMLDivElement>(null);
  const requirementsRef = useRef<HTMLDivElement>(null);
  const reviewsRef = useRef<HTMLDivElement>(null);

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
        window.location.href = "/api/login";
      }, 500);
    }
  }, [isAuthenticated, isLoading]);

  // Improved scroll spy with IntersectionObserver
  useEffect(() => {
    const observerOptions = {
      root: null,
      rootMargin: "-100px 0px -60% 0px",
      threshold: [0, 0.1, 0.25, 0.5, 0.75, 1],
    };

    const observerCallback = (entries: IntersectionObserverEntry[]) => {
      if (isScrolling) return;

      // Find the most visible section
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

    const sections = [overviewRef, videosRef, requirementsRef, reviewsRef];
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
      requirements: requirementsRef,
      reviews: reviewsRef,
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

  // Fetch offer details with company and videos
  const { data: offer, isLoading: offerLoading } = useQuery<any>({
    queryKey: [`/api/offers/${offerId}`],
    enabled: !!offerId && isAuthenticated,
  });

  // Fetch company response time
  const { data: responseTimeData } = useQuery<any>({
    queryKey: [`/api/companies/${offer?.companyId}/response-time`],
    enabled: !!offer?.companyId,
  });

  // Check if favorited
  const { data: isFavorite } = useQuery<boolean>({
    queryKey: [`/api/favorites/${offerId}`],
    enabled: !!offerId && isAuthenticated,
  });

  // Fetch user's applications
  const { data: applications } = useQuery<any[]>({
    queryKey: ["/api/applications"],
    enabled: isAuthenticated,
  });

  // Fetch reviews
  const { data: reviews, isLoading: reviewsLoading } = useQuery<any[]>({
    queryKey: [`/api/offers/${offerId}/reviews`],
    enabled: !!offerId,
  });

  // Check if user already applied
  const existingApplication = applications?.find(
    app => app.offer?.id === offerId || app.offerId === offerId
  );
  const hasApplied = !!existingApplication;
  const applicationStatus = existingApplication?.status;

  // Debug log to check application matching
  console.log('[OfferDetail] Checking application status:', {
    offerId,
    hasApplications: !!applications,
    applicationCount: applications?.length,
    existingApplication: existingApplication?.id,
    hasApplied,
    applicationStatus
  });

  // Get apply button configuration based on status
  const getApplyButtonConfig = () => {
    if (!hasApplied) {
      return {
        text: "Apply Now",
        disabled: false,
        variant: "default" as const,
        icon: null,
      };
    }

    // If already applied, gray out the button
    switch (applicationStatus) {
      case "pending":
        return {
          text: "Applied - Pending",
          disabled: true,
          variant: "secondary" as const,
          icon: <Clock className="h-4 w-4" />,
        };
      case "approved":
        return {
          text: "Applied - Approved",
          disabled: true,
          variant: "outline" as const,
          icon: <CheckCircle2 className="h-4 w-4" />,
        };
      case "active":
        return {
          text: "Applied - Active",
          disabled: true,
          variant: "outline" as const,
          icon: <Check className="h-4 w-4" />,
        };
      case "rejected":
        return {
          text: "Applied - Rejected",
          disabled: true,
          variant: "outline" as const,
          icon: <Check className="h-4 w-4" />,
        };
      default:
        return {
          text: "Already Applied",
          disabled: true,
          variant: "secondary" as const,
          icon: <Check className="h-4 w-4" />,
        };
    }
  };

  const buttonConfig = getApplyButtonConfig();

  // Toggle favorite mutation
  const favoriteMutation = useMutation({
    mutationFn: async () => {
      if (isFavorite) {
        await apiRequest("DELETE", `/api/favorites/${offerId}`);
      } else {
        await apiRequest("POST", "/api/favorites", { offerId: offerId });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/favorites/${offerId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/favorites"] });
      toast({
        title: isFavorite ? "Removed from favorites" : "Added to favorites",
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        setErrorDialog({
          open: true,
          title: "Session Expired",
          description: "Your session has expired. Please log in again to continue.",
          errorDetails: error.message || "Unauthorized access",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      setErrorDialog({
        open: true,
        title: "Favorites Error",
        description: "Unable to update your favorites list. Please try again.",
        errorDetails: error.message || "Failed to update favorites",
      });
    },
  });

  // Apply mutation - FIXED: Send offerId as string, not number
  const applyMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        offerId: offerId, // Keep as string - don't convert to Number
        message: applicationMessage,
      };
      
      // Only include preferredCommission if it has a value
      if (preferredCommission) {
        payload.preferredCommission = preferredCommission;
      }
      
      return await apiRequest("POST", "/api/applications", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/applications"] });
      setShowApplyDialog(false);
      toast({
        title: "Application Submitted!",
        description: "You'll hear back within 48 hours. Check My Applications for updates.",
      });
      setApplicationMessage("");
      setPreferredCommission("");
      setTermsAccepted(false);
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        setErrorDialog({
          open: true,
          title: "Session Expired",
          description: "Your session has expired. Please log in again to continue.",
          errorDetails: error.message || "Unauthorized access",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }

      // Check if this is a video platform requirement error
      if (error.message && error.message.includes("video platform")) {
        setShowApplyDialog(false);
        setShowVideoPlatformDialog(true);
        return;
      }

      setErrorDialog({
        open: true,
        title: "Application Error",
        description: "Unable to submit your application. Please try again.",
        errorDetails: error.message || "Failed to submit application",
      });
    },
  });

  // Calculate average rating
  const averageRating = offer?.company?.averageRating || 
    (reviews && reviews.length > 0 
      ? reviews.reduce((acc: number, r: any) => acc + (r.overallRating || 0), 0) / reviews.length 
      : 0);

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
            <Button onClick={() => setLocation("/browse")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Browse
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 pb-24">
      <TopNavBar />
      {/* Top Navigation Bar */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/browse")}
            className="h-10 w-10 rounded-full hover:bg-accent"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          
          <Button
            variant="outline"
            onClick={() => favoriteMutation.mutate()}
            disabled={favoriteMutation.isPending}
            className="gap-2"
          >
            <Heart 
              className={`h-4 w-4 transition-all ${
                isFavorite ? 'fill-red-500 text-red-500' : ''
              }`} 
            />
            <span className="hidden sm:inline">
              {isFavorite ? 'Saved' : 'Save'}
            </span>
          </Button>
        </div>
      </div>

      {/* Hero Section with Gradient Background */}
      <div className="relative">
        {/* Hero Background */}
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
                {/* Company Logo Circle - Overlapping - IMPROVED: Larger size */}
                <div className="flex justify-start -mt-16 sm:-mt-20 mb-6 ml-4">
                  <div className="relative">
                    <Avatar className="h-32 w-32 sm:h-36 sm:w-36 border-4 border-background shadow-2xl ring-2 ring-primary/20">
                      <AvatarImage
                        src={proxiedSrc(offer.company?.logoUrl)}
                        alt={offer.company?.tradeName}
                      />
                      <AvatarFallback className="text-3xl sm:text-4xl font-bold bg-gradient-to-br from-primary to-purple-600 text-white">
                        {offer.company?.tradeName?.[0] || offer.title[0]}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                </div>

                {/* Company Name & Verification - IMPROVED: Better spacing */}
                <div className="text-left mb-8">
                  <div className="flex items-center gap-3 mb-3">
                    <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900">
                      {offer.company?.tradeName || offer.company?.legalName || offer.title}
                    </h1>
                    {offer.company?.status === 'approved' && (
                      <Badge className="bg-green-500 hover:bg-green-600 text-white gap-1.5 px-3 py-1 text-sm">
                        <Verified className="h-4 w-4" />
                        Verified
                      </Badge>
                    )}
                  </div>
                  
                  {/* Star Rating - IMPROVED: Better styling */}
                  {averageRating > 0 && (
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`h-5 w-5 ${
                              star <= Math.round(averageRating)
                                ? "fill-yellow-400 text-yellow-400"
                                : "fill-gray-200 text-gray-200"
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-base font-medium text-gray-900">
                        {averageRating.toFixed(1)}
                      </span>
                      <span className="text-gray-400">•</span>
                      <span className="text-gray-600">
                        {reviews?.length || 0} reviews
                      </span>
                    </div>
                  )}
                  
                  {/* Company Description - NEW: Added */}
                  {offer.company?.description && (
                    <p className="text-gray-600 text-base sm:text-lg leading-relaxed">
                      {offer.company.description}
                    </p>
                  )}
                </div>

                {/* IMPROVED Commission Card - White Background */}
                <div className="bg-white rounded-2xl p-6 sm:p-8 mb-8 border-2 border-gray-200 shadow-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-baseline gap-3 mb-2">
                        <div className="text-5xl sm:text-6xl font-bold text-green-600">
                          {formatCommission(offer)}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 mb-4">
                        <div className="text-lg sm:text-xl text-gray-700 font-medium capitalize">
                          {getCommissionTypeLabel(offer)}
                        </div>
                        <div className="flex items-center gap-1.5 text-sm text-gray-600 bg-gray-100 px-3 py-1.5 rounded-lg">
                          <Users className="h-4 w-4" />
                          <span className="font-medium">{offer.activeCreatorsCount || 0} active</span>
                        </div>
                      </div>
                      
                      {/* Additional Commission Details - IMPROVED: Pill style */}
                      {(offer.cookieDuration || offer.averageOrderValue || responseTimeData) && (
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
                          {responseTimeData && (
                            <div className="flex items-center gap-2 bg-blue-100 px-3 py-1.5 rounded-lg">
                              <Clock className="h-4 w-4 text-blue-600" />
                              <span className="font-medium text-blue-700">{formatResponseTime(responseTimeData.responseTimeHours)}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Application Status Banner - Show when user has already applied */}
                {hasApplied && existingApplication && (
                  <div className={`rounded-2xl p-6 mb-8 border-2 ${
                    applicationStatus === 'approved' || applicationStatus === 'active'
                      ? 'bg-green-50 border-green-200'
                      : applicationStatus === 'rejected'
                      ? 'bg-red-50 border-red-200'
                      : 'bg-blue-50 border-blue-200'
                  }`}>
                    <div className="flex items-start gap-4">
                      <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
                        applicationStatus === 'approved' || applicationStatus === 'active'
                          ? 'bg-green-100'
                          : applicationStatus === 'rejected'
                          ? 'bg-red-100'
                          : 'bg-blue-100'
                      }`}>
                        {applicationStatus === 'approved' || applicationStatus === 'active' ? (
                          <CheckCircle2 className={`h-6 w-6 ${
                            applicationStatus === 'approved' || applicationStatus === 'active'
                              ? 'text-green-600'
                              : 'text-blue-600'
                          }`} />
                        ) : (
                          <Clock className={`h-6 w-6 ${
                            applicationStatus === 'rejected' ? 'text-red-600' : 'text-blue-600'
                          }`} />
                        )}
                      </div>
                      <div className="flex-1">
                        <h3 className={`text-lg font-semibold mb-1 ${
                          applicationStatus === 'approved' || applicationStatus === 'active'
                            ? 'text-green-900'
                            : applicationStatus === 'rejected'
                            ? 'text-red-900'
                            : 'text-blue-900'
                        }`}>
                          {applicationStatus === 'approved' 
                            ? 'Application Approved'
                            : applicationStatus === 'active'
                            ? 'Active Campaign'
                            : applicationStatus === 'rejected'
                            ? 'Application Not Approved'
                            : 'Application Pending Review'}
                        </h3>
                        <p className={`text-sm mb-3 ${
                          applicationStatus === 'approved' || applicationStatus === 'active'
                            ? 'text-green-700'
                            : applicationStatus === 'rejected'
                            ? 'text-red-700'
                            : 'text-blue-700'
                        }`}>
                          {applicationStatus === 'approved'
                            ? 'Your application has been approved! You can now start promoting this offer.'
                            : applicationStatus === 'active'
                            ? 'Your campaign is active. Keep up the great work!'
                            : applicationStatus === 'rejected'
                            ? 'Unfortunately, your application was not approved at this time.'
                            : 'Your application is being reviewed. You\'ll hear back within 48 hours.'}
                        </p>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <span className="font-medium">Applied on:</span>
                          <span>
                            {new Date(existingApplication.createdAt).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })}
                          </span>
                          <span className="text-gray-400">•</span>
                          <span className="text-gray-500">
                            {new Date(existingApplication.createdAt).toLocaleTimeString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* IMPROVED Stats Row - White background with outlined icons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
                  <div className="text-center bg-white rounded-xl p-4 border border-gray-200">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-white mb-3">
                      <Users className="h-6 w-6 text-gray-700" strokeWidth={1.5} />
                    </div>
                    <div className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">
                      {offer.activeCreatorsCount || 0}
                    </div>
                    <div className="text-xs sm:text-sm text-gray-600 font-medium">Active Creators</div>
                  </div>

                  <div className="text-center bg-white rounded-xl p-4 border border-gray-200">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-white mb-3">
                      <MousePointer className="h-6 w-6 text-gray-700" strokeWidth={1.5} />
                    </div>
                    <div className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">
                      {offer.totalClicks || 0}
                    </div>
                    <div className="text-xs sm:text-sm text-gray-600 font-medium">Total Clicks</div>
                  </div>
                  
                  <div className="text-center bg-white rounded-xl p-4 border border-gray-200">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-white mb-3">
                      <Wallet className="h-6 w-6 text-gray-700" strokeWidth={1.5} />
                    </div>
                    <div className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">
                      ${offer.minimumPayout || 50}
                    </div>
                    <div className="text-xs sm:text-sm text-gray-600 font-medium">Min Payout</div>
                  </div>

                  <div className="text-center bg-white rounded-xl p-4 border border-gray-200">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-white mb-3">
                      <Clock className="h-6 w-6 text-gray-700" strokeWidth={1.5} />
                    </div>
                    <div className="text-lg sm:text-xl font-bold text-gray-900 mb-1">
                      {formatResponseTime(responseTimeData?.responseTimeHours)}
                    </div>
                    <div className="text-xs sm:text-sm text-gray-600 font-medium">Company Response Time</div>
                  </div>
                </div>

                {/* IMPROVED Hashtag Badges - Better styling with rounded-xl */}
                {(offer.primaryNiche || offer.secondaryNiche || offer.additionalNiches?.length > 0) && (
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
                    {offer.additionalNiches?.map((niche: string) => (
                      <Badge key={niche} variant="secondary" className="text-xs sm:text-sm px-4 py-2 rounded-xl hover:bg-gray-200 transition-colors">
                        <Hash className="h-4 w-4 mr-1.5" />
                        {niche}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* IMPROVED Sticky Tab Navigation - Better active indicator */}
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
              onClick={() => scrollToSection("requirements")}
              className={`relative px-4 py-4 font-semibold text-sm sm:text-base transition-all whitespace-nowrap ${
                activeSection === "requirements"
                  ? "text-primary"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              Creator Requirements
              {activeSection === "requirements" && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-t-full" />
              )}
            </button>
            <button
              onClick={() => scrollToSection("reviews")}
              className={`relative px-4 py-4 font-semibold text-sm sm:text-base transition-all whitespace-nowrap ${
                activeSection === "reviews"
                  ? "text-primary"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              Creator Reviews
              {activeSection === "reviews" && (
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
                <Sparkles className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
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
                
                {offer.minimumPayout && (
                  <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-6 rounded-xl">
                    <div className="text-xs sm:text-sm text-gray-600 mb-2">Minimum Payout</div>
                    <div className="text-xl sm:text-2xl font-bold font-mono text-purple-600">
                      ${offer.minimumPayout}
                    </div>
                  </div>
                )}
                
                {offer.cookieDuration && (
                  <div className="bg-gradient-to-br from-orange-50 to-amber-50 p-6 rounded-xl">
                    <div className="text-xs sm:text-sm text-gray-600 mb-2">Cookie Duration</div>
                    <div className="text-xl sm:text-2xl font-bold text-orange-600">
                      {offer.cookieDuration} days
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* About the Company */}
          {offer.company && (
            <Card className="mt-6 rounded-2xl shadow-lg">
              <CardHeader>
                <CardTitle className="text-xl sm:text-2xl lg:text-3xl flex items-center gap-3">
                  <TrendingUp className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
                  About {offer.company.tradeName || offer.company.legalName}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {offer.company.description && (
                  <p className="text-muted-foreground text-base sm:text-lg whitespace-pre-wrap leading-relaxed">
                    {offer.company.description}
                  </p>
                )}

                <div className="grid gap-4">
                  {offer.company.industry && (
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <TrendingUp className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="font-medium">Industry</div>
                        <div className="text-sm text-muted-foreground capitalize">
                          {offer.company.industry.replace(/_/g, ' ')}
                        </div>
                      </div>
                    </div>
                  )}

                  {offer.company.websiteUrl && (
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Globe className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">Website</div>
                        <a 
                          href={offer.company.websiteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline break-all flex items-center gap-1"
                        >
                          {offer.company.websiteUrl.replace(/^https?:\/\//, '')}
                          <ExternalLink className="h-3 w-3 flex-shrink-0" />
                        </a>
                      </div>
                    </div>
                  )}

                  {offer.company.yearFounded && (
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Clock className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="font-medium">Founded</div>
                        <div className="text-sm text-muted-foreground">{offer.company.yearFounded}</div>
                      </div>
                    </div>
                  )}

                  {offer.company.companySize && (
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Users className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="font-medium">Company Size</div>
                        <div className="text-sm text-muted-foreground capitalize">
                          {offer.company.companySize.replace(/_/g, ' ')}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Videos Section */}
        <div ref={videosRef} data-section="videos" className="scroll-mt-32">
          <div className="flex items-center gap-2 mb-6">
            <Video className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            <h2 className="text-xl sm:text-2xl font-bold">
              Example Videos {offer.videos?.length > 0 && `(${offer.videos.length})`}
            </h2>
          </div>
          
          {!offer.videos || offer.videos.length === 0 ? (
            <Card className="rounded-2xl">
              <CardContent className="p-12 sm:p-16 text-center">
                <Video className="h-12 w-12 sm:h-16 sm:w-16 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground">No example videos available yet</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Videos will be added soon to help you understand the offer better
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
              {offer.videos.map((video: any) => (
                <Card
                  key={video.id}
                  className="hover:shadow-xl transition-all duration-300 cursor-pointer overflow-hidden group rounded-xl"
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

                    {/* Duration Badge - Always Show */}
                    <div className="absolute bottom-2 right-2 bg-black/90 text-white px-2 py-1 rounded text-xs font-medium">
                      {video.duration ? formatDuration(video.duration) : "0:00"}
                    </div>
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

        {/* Requirements Section */}
        <div ref={requirementsRef} data-section="requirements" className="scroll-mt-32">
          <div className="flex items-center gap-2 mb-6">
            <Shield className="h-5 w-5 sm:h-6 sm:w-6 text-green-500" />
            <h2 className="text-xl sm:text-2xl font-bold">Creator Requirements</h2>
          </div>
          
          <Card className="rounded-2xl">
            <CardContent className="p-6 sm:p-8 space-y-6">
              {/* Minimum Followers */}
              {offer.minimumFollowers && (
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
                    <Users className="h-6 w-6 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-base sm:text-lg mb-1">
                      Minimum {offer.minimumFollowers.toLocaleString()} followers
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Required on at least one platform (YouTube, TikTok, or Instagram)
                    </div>
                  </div>
                </div>
              )}

              {/* Allowed Platforms */}
              {offer.allowedPlatforms && offer.allowedPlatforms.length > 0 && (
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <Video className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-base sm:text-lg mb-1">
                      Platforms: {offer.allowedPlatforms.join(", ")}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Content must be posted on these platforms
                    </div>
                  </div>
                </div>
              )}

              {/* Geographic Requirements */}
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-xl bg-cyan-100 flex items-center justify-center flex-shrink-0">
                  <Globe className="h-6 w-6 text-cyan-600" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-base sm:text-lg mb-1">
                    Location: {offer.geographicRestrictions && offer.geographicRestrictions.length > 0
                      ? offer.geographicRestrictions.join(", ")
                      : "Worldwide"}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {offer.geographicRestrictions && offer.geographicRestrictions.length > 0
                      ? "Limited to specific regions for this offer"
                      : "No geographic restrictions - creators from all countries welcome"}
                  </div>
                </div>
              </div>

              {/* Age Restrictions */}
              {offer.ageRestriction && (
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="h-6 w-6 text-amber-600" />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-base sm:text-lg mb-1">
                      Age Restriction: {offer.ageRestriction}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Your audience must primarily be {offer.ageRestriction} to promote this offer
                    </div>
                  </div>
                </div>
              )}

              {/* Content Style */}
              {offer.contentStyleRequirements && (
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-xl bg-pink-100 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="h-6 w-6 text-pink-600" />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-base sm:text-lg mb-1">
                      Content Style
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {offer.contentStyleRequirements}
                    </div>
                  </div>
                </div>
              )}

              {/* Brand Safety */}
              {offer.brandSafetyRequirements && (
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
                    <Shield className="h-6 w-6 text-orange-600" />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-base sm:text-lg mb-1">
                      Brand Safety Guidelines
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {offer.brandSafetyRequirements}
                    </div>
                  </div>
                </div>
              )}

              {/* General Requirements */}
              {(offer.creatorRequirements || offer.requirements) && (
                <div className="pt-6 border-t">
                  <h4 className="font-semibold mb-3">Additional Requirements</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                    {offer.creatorRequirements || offer.requirements}
                  </p>
                </div>
              )}

              {/* No requirements message */}
              {!offer.minimumFollowers &&
               !offer.allowedPlatforms?.length &&
               !offer.ageRestriction &&
               !offer.contentStyleRequirements &&
               !offer.brandSafetyRequirements &&
               !offer.creatorRequirements &&
               !offer.requirements && (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 text-green-500/30 mx-auto mb-4" />
                  <p className="font-medium">No specific requirements</p>
                  <p className="text-sm mt-2">All creators are welcome to apply!</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Reviews Section */}
        <div ref={reviewsRef} data-section="reviews" className="scroll-mt-32">
          <div className="flex items-center gap-2 mb-6">
            <Star className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-500" />
            <h2 className="text-xl sm:text-2xl font-bold">Creator Reviews</h2>
          </div>
          
          <Card className="rounded-2xl">
            <CardContent className="p-6 sm:p-8">
              {reviewsLoading ? (
                <div className="text-center py-12">
                  <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent mb-4"></div>
                  <p className="text-muted-foreground">Loading reviews...</p>
                </div>
              ) : !reviews || reviews.length === 0 ? (
                <div className="text-center py-12">
                  <Star className="h-12 w-12 sm:h-16 sm:w-16 text-muted-foreground/20 mx-auto mb-4" />
                  <p className="text-muted-foreground text-base sm:text-lg font-medium">No reviews yet</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Be the first creator to work with this offer and share your experience
                  </p>
                </div>
              ) : (
                <div className="space-y-8">
                  {reviews.map((review: any) => (
                    <div key={review.id} className="border-b pb-8 last:border-0 last:pb-0">
                      <div className="flex items-start justify-between mb-4 flex-wrap gap-4">
                        <div>
                          <div className="flex items-center gap-3 mb-2">
                            <div className="flex">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                  key={star}
                                  className={`h-4 w-4 sm:h-5 sm:w-5 ${
                                    star <= review.overallRating
                                      ? "fill-yellow-400 text-yellow-400"
                                      : "fill-gray-200 text-gray-200"
                                  }`}
                                />
                              ))}
                            </div>
                            <span className="font-semibold text-sm sm:text-base">
                              {review.overallRating.toFixed(1)}/5
                            </span>
                          </div>
                          <p className="text-xs sm:text-sm text-muted-foreground">
                            {new Date(review.createdAt).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })}
                          </p>
                        </div>
                      </div>

                      {review.reviewText && (
                        <p className="mb-4 leading-relaxed text-sm sm:text-base">{review.reviewText}</p>
                      )}

                      {/* Rating breakdown */}
                      {(review.paymentSpeedRating || review.communicationRating || 
                        review.offerQualityRating || review.supportRating) && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs sm:text-sm">
                          {review.paymentSpeedRating && (
                            <div>
                              <div className="text-muted-foreground mb-1">Payment Speed</div>
                              <div className="flex items-center gap-1">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <Star
                                    key={star}
                                    className={`h-3 w-3 ${
                                      star <= review.paymentSpeedRating
                                        ? "fill-yellow-400 text-yellow-400"
                                        : "fill-gray-200 text-gray-200"
                                    }`}
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                          {review.communicationRating && (
                            <div>
                              <div className="text-muted-foreground mb-1">Communication</div>
                              <div className="flex items-center gap-1">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <Star
                                    key={star}
                                    className={`h-3 w-3 ${
                                      star <= review.communicationRating
                                        ? "fill-yellow-400 text-yellow-400"
                                        : "fill-gray-200 text-gray-200"
                                    }`}
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                          {review.offerQualityRating && (
                            <div>
                              <div className="text-muted-foreground mb-1">Offer Quality</div>
                              <div className="flex items-center gap-1">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <Star
                                    key={star}
                                    className={`h-3 w-3 ${
                                      star <= review.offerQualityRating
                                        ? "fill-yellow-400 text-yellow-400"
                                        : "fill-gray-200 text-gray-200"
                                    }`}
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                          {review.supportRating && (
                            <div>
                              <div className="text-muted-foreground mb-1">Support</div>
                              <div className="flex items-center gap-1">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <Star
                                    key={star}
                                    className={`h-3 w-3 ${
                                      star <= review.supportRating
                                        ? "fill-yellow-400 text-yellow-400"
                                        : "fill-gray-200 text-gray-200"
                                    }`}
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Company Response */}
                      {review.companyResponse && (
                        <div className="mt-6 bg-muted/50 rounded-lg p-4">
                          <div className="flex items-start gap-3">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <CheckCircle2 className="h-4 w-4 text-primary" />
                            </div>
                            <div className="flex-1">
                              <p className="font-medium text-sm mb-2">Company Response</p>
                              <p className="text-sm text-muted-foreground">{review.companyResponse}</p>
                              {review.companyRespondedAt && (
                                <p className="text-xs text-muted-foreground mt-2">
                                  Responded on {new Date(review.companyRespondedAt).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Sticky Apply Button */}
      <div className="fixed bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur-lg shadow-2xl p-3 sm:p-4 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <div>
              <div className="text-xs text-muted-foreground">Earn Commission</div>
              <div className="text-lg sm:text-2xl font-bold text-green-600">
                {formatCommission(offer)}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {hasApplied && existingApplication?.createdAt && (
              <Badge variant="secondary" className="hidden md:flex text-xs">
                Applied {new Date(existingApplication.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </Badge>
            )}
            
            <Dialog open={showApplyDialog} onOpenChange={setShowApplyDialog}>
              <DialogTrigger asChild>
                <Button
                  size="lg"
                  className="gap-2 text-sm sm:text-base rounded-xl shadow-lg hover:shadow-xl transition-all"
                  variant={buttonConfig.variant}
                  disabled={buttonConfig.disabled}
                >
                  {buttonConfig.icon}
                  {buttonConfig.text}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                {hasApplied && existingApplication ? (
                  // Show "Already Applied" message
                  <>
                    <DialogHeader>
                      <DialogTitle>Application Already Submitted</DialogTitle>
                      <DialogDescription>
                        You have already applied to this offer
                      </DialogDescription>
                    </DialogHeader>

                    <div className="py-6">
                      <div className={`rounded-lg p-6 ${
                        applicationStatus === 'approved' || applicationStatus === 'active'
                          ? 'bg-green-50 border-2 border-green-200'
                          : applicationStatus === 'rejected'
                          ? 'bg-red-50 border-2 border-red-200'
                          : 'bg-blue-50 border-2 border-blue-200'
                      }`}>
                        <div className="flex items-start gap-4">
                          <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
                            applicationStatus === 'approved' || applicationStatus === 'active'
                              ? 'bg-green-100'
                              : applicationStatus === 'rejected'
                              ? 'bg-red-100'
                              : 'bg-blue-100'
                          }`}>
                            {applicationStatus === 'approved' || applicationStatus === 'active' ? (
                              <CheckCircle2 className="h-6 w-6 text-green-600" />
                            ) : (
                              <Clock className={`h-6 w-6 ${
                                applicationStatus === 'rejected' ? 'text-red-600' : 'text-blue-600'
                              }`} />
                            )}
                          </div>
                          <div className="flex-1">
                            <h3 className={`text-lg font-semibold mb-2 ${
                              applicationStatus === 'approved' || applicationStatus === 'active'
                                ? 'text-green-900'
                                : applicationStatus === 'rejected'
                                ? 'text-red-900'
                                : 'text-blue-900'
                            }`}>
                              {applicationStatus === 'approved' 
                                ? 'Application Approved'
                                : applicationStatus === 'active'
                                ? 'Active Campaign'
                                : applicationStatus === 'rejected'
                                ? 'Application Not Approved'
                                : 'Application Pending Review'}
                            </h3>
                            <p className={`text-sm mb-4 ${
                              applicationStatus === 'approved' || applicationStatus === 'active'
                                ? 'text-green-700'
                                : applicationStatus === 'rejected'
                                ? 'text-red-700'
                                : 'text-blue-700'
                            }`}>
                              {applicationStatus === 'approved'
                                ? 'Your application has been approved! You can now start promoting this offer.'
                                : applicationStatus === 'active'
                                ? 'Your campaign is active. Keep up the great work!'
                                : applicationStatus === 'rejected'
                                ? 'Unfortunately, your application was not approved at this time. You cannot reapply to this offer.'
                                : 'Your application is being reviewed. You\'ll hear back within 48 hours. You cannot submit another application while this one is pending.'}
                            </p>
                            <div className="flex items-center gap-2 text-sm text-gray-600 bg-white/50 rounded-lg p-3">
                              <Clock className="h-4 w-4" />
                              <span className="font-medium">Applied on:</span>
                              <span>
                                {new Date(existingApplication.createdAt).toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric',
                                })}
                              </span>
                              <span>at</span>
                              <span>
                                {new Date(existingApplication.createdAt).toLocaleTimeString('en-US', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setShowApplyDialog(false)}
                      >
                        Close
                      </Button>
                    </DialogFooter>
                  </>
                ) : (
                  // Show application form
                  <>
                    <DialogHeader>
                      <DialogTitle>Apply to {offer.title}</DialogTitle>
                      <DialogDescription>
                        Tell {offer.company?.tradeName || 'the company'} why you're interested in promoting their offer
                      </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="message">Why are you interested? *</Label>
                        <Textarea
                          id="message"
                          placeholder="Share details about your audience, content style, and why you'd be a great fit for this offer..."
                          value={applicationMessage}
                          onChange={(e) => setApplicationMessage(e.target.value.slice(0, 500))}
                          className="min-h-32 resize-none"
                        />
                        <p className="text-xs text-muted-foreground text-right">
                          {applicationMessage.length}/500 characters
                        </p>
                      </div>

                      {offer.commissionType === 'hybrid' && (
                        <div className="space-y-2">
                          <Label htmlFor="commission">Preferred Commission Model</Label>
                          <Select value={preferredCommission} onValueChange={setPreferredCommission}>
                            <SelectTrigger id="commission">
                              <SelectValue placeholder="Select your preferred model" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="default">Standard Commission</SelectItem>
                              <SelectItem value="per_sale">Per Sale</SelectItem>
                              <SelectItem value="retainer">Monthly Retainer</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      <div className="flex items-start gap-2 pt-4">
                        <Checkbox
                          id="terms"
                          checked={termsAccepted}
                          onCheckedChange={(checked) => setTermsAccepted(checked as boolean)}
                        />
                        <Label htmlFor="terms" className="text-sm font-normal cursor-pointer leading-relaxed">
                          I accept the terms and conditions and agree to promote this offer ethically and authentically to my audience
                        </Label>
                      </div>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                      <Button
                        variant="outline"
                        onClick={() => setShowApplyDialog(false)}
                        disabled={applyMutation.isPending}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={() => applyMutation.mutate()}
                        disabled={!applicationMessage.trim() || !termsAccepted || applyMutation.isPending}
                      >
                        {applyMutation.isPending ? (
                          <>
                            <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-current border-r-transparent mr-2"></div>
                            Submitting...
                          </>
                        ) : (
                          "Submit Application"
                        )}
                      </Button>
                    </DialogFooter>
                  </>
                )}
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Video Player Dialog */}
      {selectedVideo && (
        <Dialog open={!!selectedVideo} onOpenChange={() => setSelectedVideo(null)}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>{selectedVideo.title || "Video"}</DialogTitle>
              <DialogDescription>
                {selectedVideo.description || "Preview this example video"}
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

      {/* Video Platform Requirement Dialog */}
      <AlertDialog open={showVideoPlatformDialog} onOpenChange={setShowVideoPlatformDialog}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-orange-600">
              <AlertTriangle className="h-6 w-6" />
              Video Platform Required
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4 pt-2">
              <p className="text-base font-semibold text-foreground">
                You must add at least one video platform to your profile before applying to offers.
              </p>
              <p className="text-sm">
                We only accept <strong>video content creators</strong> with an active presence on:
              </p>
              <ul className="list-disc list-inside space-y-1.5 ml-2 text-sm">
                <li><strong>YouTube</strong> - Video channels</li>
                <li><strong>TikTok</strong> - Short-form video content</li>
                <li><strong>Instagram</strong> - Reels and video content</li>
              </ul>
              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mt-4">
                <p className="text-sm text-blue-900 dark:text-blue-100">
                  <strong>💡 Next Step:</strong> Add your video platform URL in your profile settings, then come back to apply!
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogAction
              onClick={() => {
                setShowVideoPlatformDialog(false);
                setLocation("/settings");
              }}
              className="w-full sm:w-auto"
            >
              Go to Settings
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Hide scrollbar for tab navigation */}
      <style>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      {/* Error Dialog */}
      <GenericErrorDialog
        open={errorDialog.open}
        onOpenChange={(open) => setErrorDialog({ ...errorDialog, open })}
        title={errorDialog.title}
        description={errorDialog.description}
        errorDetails={errorDialog.errorDetails}
        variant="error"
      />
    </div>
  );
}