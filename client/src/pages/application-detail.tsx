import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Separator } from "../components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
import {
  Copy,
  ExternalLink,
  MessageSquare,
  TrendingUp,
  FileText,
  Clock,
  CheckCircle2,
  Star,
  ArrowLeft,
  Calendar,
  DollarSign,
  Building2,
  AlertCircle,
  XCircle,
  QrCode,
  Download,
} from "lucide-react";
import { proxiedSrc } from "../lib/image";
import { TopNavBar } from "../components/TopNavBar";
import { GenericErrorDialog } from "../components/GenericErrorDialog";
import { useCreatorPageTour } from "../components/CreatorTour";
import { CREATOR_TOUR_IDS, applicationDetailTourSteps } from "../lib/creatorTourConfig";

const STATUS_CONFIG: Record<string, any> = {
  pending: {
    variant: "secondary" as const,
    icon: Clock,
    color: "text-yellow-600",
    bg: "bg-yellow-50 dark:bg-yellow-950/20",
    description: "Your application is under review",
  },
  approved: {
    variant: "default" as const,
    icon: CheckCircle2,
    color: "text-green-600",
    bg: "bg-green-50 dark:bg-green-950/20",
    description: "Congratulations! Your application has been approved",
  },
  active: {
    variant: "default" as const,
    icon: TrendingUp,
    color: "text-blue-600",
    bg: "bg-blue-50 dark:bg-blue-950/20",
    description: "Your promotion is active and tracking",
  },
  completed: {
    variant: "secondary" as const,
    icon: CheckCircle2,
    color: "text-gray-600",
    bg: "bg-gray-50 dark:bg-gray-950/20",
    description: "This application has been completed",
  },
  rejected: {
    variant: "destructive" as const,
    icon: XCircle,
    color: "text-red-600",
    bg: "bg-red-50 dark:bg-red-950/20",
    description: "Application was not approved",
  },
};

// Helper function to format commission display
const formatCommission = (offer: any) => {
  if (!offer) return "$0";

  if (offer.commissionAmount) {
    return `$${offer.commissionAmount}`;
  } else if (offer.commissionPercentage) {
    return `${offer.commissionPercentage}%`;
  } else if (offer.commissionRate) {
    return `$${offer.commissionRate}`;
  }
  return "$0";
};

interface ReviewFormData {
  applicationId: string;
  companyId: string;
  reviewText: string;
  overallRating: number;
  paymentSpeedRating: number;
  communicationRating: number;
  offerQualityRating: number;
  supportRating: number;
}

const StarRating = ({ rating, onRatingChange }: { rating: number; onRatingChange: (rating: number) => void }) => {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onRatingChange(star)}
          className="focus:outline-none"
          aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
        >
          <Star
            className={`h-6 w-6 cursor-pointer transition-colors ${
              star <= rating
                ? "fill-yellow-400 text-yellow-400"
                : "text-gray-300 hover:text-yellow-200"
            }`}
          />
        </button>
      ))}
    </div>
  );
};

export default function ApplicationDetail() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [, params] = useRoute("/applications/:id");
  const applicationId = params?.id;

  // Quick tour for application detail page
  useCreatorPageTour(CREATOR_TOUR_IDS.APPLICATION_DETAIL, applicationDetailTourSteps);

  const [reviewDialog, setReviewDialog] = useState(false);
  const [reviewForm, setReviewForm] = useState<ReviewFormData>({
    applicationId: "",
    companyId: "",
    reviewText: "",
    overallRating: 0,
    paymentSpeedRating: 0,
    communicationRating: 0,
    offerQualityRating: 0,
    supportRating: 0,
  });

  // Generic error dialog state
  const [errorDialog, setErrorDialog] = useState({
    open: false,
    title: "Error",
    description: "An error occurred",
    errorDetails: "",
  });

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      window.location.href = "/login";
    }
  }, [isAuthenticated, isLoading]);

  // Fetch specific application
  const { data: application, isLoading: applicationLoading } = useQuery<any>({
    queryKey: [`/api/applications/${applicationId}`],
    enabled: isAuthenticated && !!applicationId,
  });

  // Fetch user's reviews to check if this application has been reviewed
  const { data: userReviews = [] } = useQuery<any[]>({
    queryKey: ["/api/user/reviews"],
    enabled: isAuthenticated,
  });

  const submitReviewMutation = useMutation({
    mutationFn: async (reviewData: ReviewFormData) => {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(reviewData),
      });

      if (!res.ok) {
        const error = await res.text();
        throw new Error(error || "Failed to submit review");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/reviews"] });
      toast({
        title: "Review submitted",
        description: "Thank you for your feedback!",
      });
      setReviewDialog(false);
      setReviewForm({
        applicationId: "",
        companyId: "",
        reviewText: "",
        overallRating: 0,
        paymentSpeedRating: 0,
        communicationRating: 0,
        offerQualityRating: 0,
        supportRating: 0,
      });
    },
    onError: (error: Error) => {
      setErrorDialog({
        open: true,
        title: "Review Submission Error",
        description: "We couldn't submit your review at this time. Please try again later.",
        errorDetails: error.message,
      });
    },
  });

  const copyTrackingLink = (link: string) => {
    navigator.clipboard.writeText(link);
    toast({
      title: "Copied!",
      description: "Tracking link copied to clipboard",
    });
  };

  const downloadQRCode = async () => {
    if (!applicationId) return;

    try {
      const response = await fetch(`/api/applications/${applicationId}/qrcode`, {
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        setErrorDialog({
          open: true,
          title: "QR Code Generation Error",
          description: "We couldn't generate the QR code at this time. Please try again later.",
          errorDetails: error.message || "Failed to generate QR code",
        });
        return;
      }

      const data = await response.json();

      // Create a download link for the QR code
      const link = document.createElement('a');
      link.href = data.qrCodeDataUrl;
      link.download = `tracking-link-qr-${applicationId}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Success!",
        description: "QR code downloaded successfully",
      });
    } catch (error: any) {
      setErrorDialog({
        open: true,
        title: "QR Code Download Error",
        description: "We couldn't download the QR code at this time. Please try again later.",
        errorDetails: error.message || "Failed to download QR code",
      });
    }
  };

  const getExistingReview = () => {
    return userReviews.find((review: any) => review.applicationId === applicationId);
  };

  const handleOpenReviewDialog = () => {
    const existingReview = getExistingReview();

    setReviewDialog(true);

    if (existingReview) {
      // Editing existing review
      setReviewForm({
        applicationId: applicationId || "",
        companyId: application?.offer?.companyId || "",
        reviewText: existingReview.reviewText || "",
        overallRating: existingReview.overallRating || 0,
        paymentSpeedRating: existingReview.paymentSpeedRating || 0,
        communicationRating: existingReview.communicationRating || 0,
        offerQualityRating: existingReview.offerQualityRating || 0,
        supportRating: existingReview.supportRating || 0,
      });
    } else {
      // New review
      setReviewForm({
        applicationId: applicationId || "",
        companyId: application?.offer?.companyId || "",
        reviewText: "",
        overallRating: 0,
        paymentSpeedRating: 0,
        communicationRating: 0,
        offerQualityRating: 0,
        supportRating: 0,
      });
    }
  };

  const handleSubmitReview = () => {
    if (reviewForm.overallRating === 0) {
      setErrorDialog({
        open: true,
        title: "Rating Required",
        description: "Please provide an overall rating before submitting your review.",
        errorDetails: "",
      });
      return;
    }

    submitReviewMutation.mutate(reviewForm);
  };

  if (isLoading || applicationLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-lg">Loading...</div>
      </div>
    );
  }

  if (!application) {
    return (
      <div className="space-y-6">
        <Link href="/applications">
          <Button variant="ghost" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Applications
          </Button>
        </Link>
        <Card>
          <CardContent className="p-12 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-2">Application not found</h3>
            <p className="text-muted-foreground mb-4">
              This application doesn't exist or you don't have permission to view it.
            </p>
            <Link href="/applications">
              <Button>View All Applications</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[application.status] || STATUS_CONFIG.pending;
  const StatusIcon = statusConfig.icon;
  const canShowReviewButton = application.status === 'approved' || application.status === 'active';
  const existingReview = getExistingReview();

  return (
    <div className="space-y-6">
      <TopNavBar />
      {/* Header with Back Button */}
      <div className="flex items-center justify-between">
        <Link href="/applications">
          <Button variant="ghost" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Applications
          </Button>
        </Link>
      </div>

      {/* Status Banner */}
      <Card className={`border-l-4 ${statusConfig.color}`}>
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-full ${statusConfig.bg}`}>
              <StatusIcon className={`h-6 w-6 ${statusConfig.color}`} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-2xl font-bold">Application Status</h2>
                <Badge {...statusConfig} className="gap-1">
                  <StatusIcon className="h-3 w-3" />
                  {application.status}
                </Badge>
              </div>
              <p className="text-muted-foreground">{statusConfig.description}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Content - Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Offer Details */}
          <Card>
            <CardHeader>
              <CardTitle>Offer Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Featured Image */}
              {application.offer?.featuredImageUrl && (
                <div className="aspect-video rounded-lg overflow-hidden">
                  <img
                    src={proxiedSrc(application.offer.featuredImageUrl)}
                    alt={application.offer.title}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
              )}

              {/* Offer Info */}
              <div>
                <Link href={`/offers/${application.offer?.id}`}>
                  <h3 className="text-xl font-semibold hover:text-primary cursor-pointer mb-2">
                    {application.offer?.title || "Untitled Offer"}
                  </h3>
                </Link>
                <div className="flex items-center gap-2 text-muted-foreground mb-4">
                  <Building2 className="h-4 w-4" />
                  <span>{application.offer?.company?.tradeName || "Company"}</span>
                </div>
                <p className="text-muted-foreground">
                  {application.offer?.shortDescription || application.offer?.fullDescription || "No description available"}
                </p>
              </div>

              <Separator />

              {/* Commission Info */}
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Commission</div>
                  <div className="text-2xl font-bold font-mono">
                    {formatCommission(application.offer)}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Type</div>
                  <Badge variant="secondary" className="mt-1">
                    {application.offer?.commissionType?.replace(/_/g, ' ') || 'Standard'}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Cookie Duration</div>
                  <div className="text-lg font-medium">
                    {application.offer?.cookieDuration ? `${application.offer.cookieDuration} days` : 'N/A'}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tracking Link (if approved) */}
          {(application.status === 'approved' || application.status === 'active') && application.trackingLink && (
            <Card className="border-2 border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ExternalLink className="h-5 w-5 text-blue-600" />
                  Your Tracking Link
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Use this unique link in your content to track clicks and conversions. Every sale made through this link will be attributed to you.
                </p>

                {/* Tracking Link Display */}
                <div className="bg-white dark:bg-gray-900 rounded-lg border-2 border-blue-200 dark:border-blue-700 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <code className="text-sm text-blue-600 dark:text-blue-400 break-all">
                        {application.trackingLink}
                      </code>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyTrackingLink(application.trackingLink)}
                      className="flex-shrink-0"
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copy
                    </Button>
                  </div>
                </div>

                {/* Tracking Code */}
                {application.trackingCode && (
                  <div className="bg-white dark:bg-gray-900 rounded-lg border border-blue-200 dark:border-blue-700 p-3">
                    <div className="text-xs text-blue-600 dark:text-blue-400 font-mono">
                      <span className="font-semibold">Tracking Code:</span> {application.trackingCode}
                    </div>
                  </div>
                )}

                {/* Quick Action Buttons */}
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open(application.trackingLink, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Test Link
                  </Button>
                  <Link href={`/analytics/${application.id}`}>
                    <Button size="sm" variant="default" className="w-full">
                      <TrendingUp className="h-4 w-4 mr-2" />
                      Analytics
                    </Button>
                  </Link>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={downloadQRCode}
                    className="col-span-2"
                  >
                    <QrCode className="h-4 w-4 mr-2" />
                    Download QR Code
                  </Button>
                </div>

                <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-950/30 p-3 rounded-lg">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>Keep this link safe and use it consistently across all platforms</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Application Message */}
          {application.message && (
            <Card>
              <CardHeader>
                <CardTitle>Your Application Message</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground whitespace-pre-wrap">{application.message}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar - Right Column */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {application.trackingLink && (
                <Link href={`/analytics/${application.id}`}>
                  <Button className="w-full gap-2" variant="outline">
                    <TrendingUp className="h-4 w-4" />
                    View Analytics
                  </Button>
                </Link>
              )}
              <Link href={`/messages?application=${application.id}`}>
                <Button className="w-full gap-2" variant="outline">
                  <MessageSquare className="h-4 w-4" />
                  Message Company
                </Button>
              </Link>
              <Link href={`/offers/${application.offer?.id}`}>
                <Button className="w-full gap-2" variant="outline">
                  <ExternalLink className="h-4 w-4" />
                  View Full Offer
                </Button>
              </Link>
              {canShowReviewButton && (
                <Button
                  className="w-full gap-2"
                  variant={existingReview ? "outline" : "default"}
                  onClick={handleOpenReviewDialog}
                >
                  <Star className="h-4 w-4" />
                  {existingReview ? "Edit Review" : "Leave Review"}
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Application Timeline */}
          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-950/20">
                  <Calendar className="h-4 w-4 text-blue-600" />
                </div>
                <div className="flex-1">
                  <div className="font-medium">Applied</div>
                  <div className="text-sm text-muted-foreground">
                    {new Date(application.createdAt).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              </div>

              {application.approvedAt && (
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-full bg-green-100 dark:bg-green-950/20">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">Approved</div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(application.approvedAt).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                </div>
              )}

              {application.completedAt && (
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-full bg-gray-100 dark:bg-gray-950/20">
                    <CheckCircle2 className="h-4 w-4 text-gray-600" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">Completed</div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(application.completedAt).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Company Info */}
          {application.offer?.company && (
            <Card>
              <CardHeader>
                <CardTitle>About the Company</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  {application.offer.company.logoUrl ? (
                    <img
                      src={proxiedSrc(application.offer.company.logoUrl)}
                      alt={application.offer.company.tradeName}
                      className="h-12 w-12 rounded-lg object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center">
                      <Building2 className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <div>
                    <div className="font-semibold">
                      {application.offer.company.tradeName || application.offer.company.legalName}
                    </div>
                    {application.offer.company.industry && (
                      <div className="text-sm text-muted-foreground">
                        {application.offer.company.industry}
                      </div>
                    )}
                  </div>
                </div>
                {application.offer.company.description && (
                  <>
                    <Separator />
                    <p className="text-sm text-muted-foreground line-clamp-4">
                      {application.offer.company.description}
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Review Dialog */}
      <Dialog open={reviewDialog} onOpenChange={setReviewDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {existingReview ? "Edit Review" : "Leave a Review"}
            </DialogTitle>
            <DialogDescription>
              Share your experience working with {application.offer?.company?.tradeName || "this company"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {/* Overall Rating */}
            <div className="space-y-2">
              <Label className="text-base">Overall Rating *</Label>
              <StarRating
                rating={reviewForm.overallRating}
                onRatingChange={(rating) => setReviewForm({ ...reviewForm, overallRating: rating })}
              />
            </div>

            {/* Review Text */}
            <div className="space-y-2">
              <Label htmlFor="reviewText" className="text-base">Your Review</Label>
              <Textarea
                id="reviewText"
                placeholder="Share your experience working with this company..."
                value={reviewForm.reviewText}
                onChange={(e) => setReviewForm({ ...reviewForm, reviewText: e.target.value })}
                rows={4}
                className="resize-none"
              />
            </div>

            {/* Detailed Ratings */}
            <div className="space-y-4 border-t pt-4">
              <h4 className="font-medium">Detailed Ratings (Optional)</h4>

              <div className="space-y-2">
                <Label>Payment Speed</Label>
                <StarRating
                  rating={reviewForm.paymentSpeedRating}
                  onRatingChange={(rating) => setReviewForm({ ...reviewForm, paymentSpeedRating: rating })}
                />
              </div>

              <div className="space-y-2">
                <Label>Communication</Label>
                <StarRating
                  rating={reviewForm.communicationRating}
                  onRatingChange={(rating) => setReviewForm({ ...reviewForm, communicationRating: rating })}
                />
              </div>

              <div className="space-y-2">
                <Label>Offer Quality</Label>
                <StarRating
                  rating={reviewForm.offerQualityRating}
                  onRatingChange={(rating) => setReviewForm({ ...reviewForm, offerQualityRating: rating })}
                />
              </div>

              <div className="space-y-2">
                <Label>Support</Label>
                <StarRating
                  rating={reviewForm.supportRating}
                  onRatingChange={(rating) => setReviewForm({ ...reviewForm, supportRating: rating })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t pt-4">
              <Button
                variant="outline"
                onClick={() => setReviewDialog(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmitReview}
                disabled={submitReviewMutation.isPending || reviewForm.overallRating === 0}
              >
                {submitReviewMutation.isPending ? "Submitting..." : "Submit Review"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
  );
}