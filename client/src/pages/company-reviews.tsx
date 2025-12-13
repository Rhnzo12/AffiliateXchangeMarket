import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Star, MessageSquare, Reply, Filter, Search, X } from "lucide-react";
import { Input } from "../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { formatDistanceToNow } from "date-fns";
import { TopNavBar } from "../components/TopNavBar";
import { GenericErrorDialog } from "../components/GenericErrorDialog";
import { proxiedSrc } from "../lib/image";
import { useCompanyPageTour } from "../components/CompanyTour";
import { COMPANY_TOUR_IDS, reviewsTourSteps } from "../lib/companyTourConfig";

export default function CompanyReviews() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();

  // Quick tour for reviews page
  useCompanyPageTour(COMPANY_TOUR_IDS.REVIEWS, reviewsTourSteps);

  const [responseDialog, setResponseDialog] = useState<{ open: boolean; reviewId: string | null; response: string }>({
    open: false,
    reviewId: null,
    response: "",
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [ratingFilter, setRatingFilter] = useState("all");
  const [offerFilter, setOfferFilter] = useState("all");
  const [responseFilter, setResponseFilter] = useState("all");
  const [errorDialog, setErrorDialog] = useState<{ open: boolean; title: string; description: string }>({
    open: false,
    title: "",
    description: "",
  });

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setErrorDialog({
        open: true,
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
      });
      setTimeout(() => {
        window.location.href = "/login";
      }, 500);
    }
  }, [isAuthenticated, isLoading]);

  const { data: companyReviews = [], isLoading: loadingReviews } = useQuery<any[]>({
    queryKey: ["/api/company/reviews"],
    enabled: isAuthenticated,
  });

  const uniqueOfferOptions = useMemo(() => {
    const map = new Map<string, string>();
    companyReviews.forEach((review: any) => {
      if (review.offer?.id && review.offer?.title) {
        map.set(review.offer.id, review.offer.title);
      }
    });
    return Array.from(map.entries());
  }, [companyReviews]);

  const filteredReviews = useMemo(() => {
    return companyReviews.filter((review: any) => {
      const matchesSearch = searchTerm
        ? [
            review.reviewText,
            review.creator?.firstName,
            review.creator?.lastName,
            review.offer?.title,
          ]
            .filter(Boolean)
            .some((value) => value.toLowerCase().includes(searchTerm.toLowerCase()))
        : true;

      const matchesRating = (() => {
        if (ratingFilter === "all") return true;
        if (ratingFilter === "5") return review.overallRating === 5;
        if (ratingFilter === "4plus") return review.overallRating >= 4;
        if (ratingFilter === "3orless") return review.overallRating <= 3;
        return true;
      })();

      const matchesOffer = offerFilter === "all" || review.offer?.id === offerFilter;

      const matchesResponse = (() => {
        if (responseFilter === "all") return true;
        if (responseFilter === "responded") return Boolean(review.companyResponse);
        if (responseFilter === "no-response") return !review.companyResponse;
        return true;
      })();

      return matchesSearch && matchesRating && matchesOffer && matchesResponse;
    });
  }, [companyReviews, offerFilter, ratingFilter, responseFilter, searchTerm]);

  const hasActiveFilters =
    searchTerm.trim().length > 0 ||
    ratingFilter !== "all" ||
    offerFilter !== "all" ||
    responseFilter !== "all";

  const clearFilters = () => {
    setSearchTerm("");
    setRatingFilter("all");
    setOfferFilter("all");
    setResponseFilter("all");
  };

  const submitResponseMutation = useMutation({
    mutationFn: async ({ reviewId, response }: { reviewId: string; response: string }) => {
      const res = await fetch(`/api/reviews/${reviewId}/respond`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ response }),
      });

      if (!res.ok) {
        const error = await res.text();
        throw new Error(error || "Failed to submit response");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company/reviews"] });
      toast({
        title: "Response submitted",
        description: "Your response has been posted successfully",
      });
      setResponseDialog({ open: false, reviewId: null, response: "" });
    },
    onError: (error: Error) => {
      setErrorDialog({
        open: true,
        title: "Error",
        description: error.message,
      });
    },
  });

  const handleOpenResponseDialog = (reviewId: string) => {
    setResponseDialog({ open: true, reviewId, response: "" });
  };

  const handleSubmitResponse = () => {
    if (!responseDialog.reviewId || !responseDialog.response.trim()) {
      setErrorDialog({
        open: true,
        title: "Error",
        description: "Please enter a response",
      });
      return;
    }

    submitResponseMutation.mutate({
      reviewId: responseDialog.reviewId,
      response: responseDialog.response.trim(),
    });
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${
              star <= rating
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-muted-foreground/30'
            }`}
          />
        ))}
      </div>
    );
  };

  const averageRating = companyReviews.length > 0
    ? (companyReviews.reduce((sum: number, r: any) => sum + r.overallRating, 0) / companyReviews.length).toFixed(1)
    : '0.0';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <TopNavBar />
      <div>
        <h1 className="text-3xl font-bold">Reviews</h1>
        <p className="text-muted-foreground mt-1">
          See what creators are saying about your offers
        </p>
      </div>

      <Card className="border-card-border">
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Filter className="h-4 w-4" />
              <span className="text-sm font-semibold uppercase tracking-wider">Search & Filter</span>
            </div>
            <div className="sm:ml-auto text-sm text-muted-foreground">
              Showing <span className="font-semibold text-foreground">{filteredReviews.length}</span> of {companyReviews.length}
              {` review${companyReviews.length === 1 ? "" : "s"}`}
            </div>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" className="text-xs sm:ml-4" onClick={clearFilters}>
                <X className="h-3 w-3 mr-1" />
                Clear Filters
              </Button>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium">Search</label>
              <Input
                placeholder="Search by creator, offer, or keywords"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Rating</label>
              <Select value={ratingFilter} onValueChange={setRatingFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All ratings" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Ratings</SelectItem>
                  <SelectItem value="5">5 stars</SelectItem>
                  <SelectItem value="4plus">4 stars & up</SelectItem>
                  <SelectItem value="3orless">3 stars & below</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Offer</label>
              <Select value={offerFilter} onValueChange={setOfferFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All offers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Offers</SelectItem>
                  {uniqueOfferOptions.map(([id, title]) => (
                    <SelectItem key={id} value={id}>
                      {title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Response Status</label>
              <Select value={responseFilter} onValueChange={setResponseFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All responses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Reviews</SelectItem>
                  <SelectItem value="responded">Responded</SelectItem>
                  <SelectItem value="no-response">Awaiting Response</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {companyReviews.length > 0 && (
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="border-card-border">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Rating</CardTitle>
              <Star className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{averageRating}</div>
              <div className="flex gap-1 mt-2">
                {renderStars(Math.round(parseFloat(averageRating)))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-card-border">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Reviews</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{companyReviews.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                From creators who worked with you
              </p>
            </CardContent>
          </Card>

          <Card className="border-card-border">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">5-Star Reviews</CardTitle>
              <Star className="h-4 w-4 text-yellow-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {companyReviews.filter((r: any) => r.overallRating === 5).length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {companyReviews.length > 0
                  ? `${Math.round((companyReviews.filter((r: any) => r.overallRating === 5).length / companyReviews.length) * 100)}%`
                  : '0%'} of total
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {loadingReviews ? (
        <div className="text-center py-12">
          <div className="animate-pulse text-lg text-muted-foreground">
            Loading reviews...
          </div>
        </div>
      ) : companyReviews.length === 0 ? (
        <Card className="border-card-border">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Star className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No reviews yet</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              Reviews from creators will appear here once they complete campaigns
            </p>
          </CardContent>
        </Card>
      ) : filteredReviews.length === 0 ? (
        <Card className="border-card-border">
          <CardContent className="flex flex-col items-center justify-center py-12 space-y-3">
            <Search className="h-10 w-10 text-muted-foreground/40" />
            <h3 className="text-lg font-semibold">No reviews match your filters</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              Adjust your filters or clear them to see more feedback from creators.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredReviews.map((review: any) => (
            <Card key={review.id} className="border-card-border" data-testid={`card-review-${review.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={proxiedSrc(review.creator?.profileImageUrl)} />
                      <AvatarFallback>
                        {review.creator?.firstName?.[0] || 'C'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-base">
                        {review.creator?.firstName || 'Creator'}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(review.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {renderStars(review.overallRating)}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm mb-4">{review.reviewText}</p>

                {/* Rating breakdown */}
                <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                  {review.paymentSpeedRating && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Payment Speed</span>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star key={star} className={`h-3 w-3 ${star <= review.paymentSpeedRating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
                        ))}
                      </div>
                    </div>
                  )}
                  {review.communicationRating && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Communication</span>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star key={star} className={`h-3 w-3 ${star <= review.communicationRating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
                        ))}
                      </div>
                    </div>
                  )}
                  {review.offerQualityRating && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Offer Quality</span>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star key={star} className={`h-3 w-3 ${star <= review.offerQualityRating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
                        ))}
                      </div>
                    </div>
                  )}
                  {review.supportRating && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Support</span>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star key={star} className={`h-3 w-3 ${star <= review.supportRating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {review.companyResponse ? (
                  <div className="mt-4 p-3 bg-muted/50 rounded-md">
                    <div className="text-xs font-semibold text-muted-foreground mb-1">
                      Your Response
                    </div>
                    <p className="text-sm">{review.companyResponse}</p>
                    {review.companyRespondedAt && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Responded {formatDistanceToNow(new Date(review.companyRespondedAt), { addSuffix: true })}
                      </p>
                    )}
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenResponseDialog(review.id)}
                    className="mt-2"
                  >
                    <Reply className="h-4 w-4 mr-2" />
                    Respond to Review
                  </Button>
                )}

                {review.adminResponse && (
                  <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-md border border-blue-200 dark:border-blue-800">
                    <div className="text-xs font-semibold text-blue-900 dark:text-blue-100 mb-1">
                      Platform Response
                    </div>
                    <p className="text-sm text-blue-800 dark:text-blue-200">{review.adminResponse}</p>
                    {review.respondedAt && (
                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                        Responded {formatDistanceToNow(new Date(review.respondedAt), { addSuffix: true })}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Response Dialog */}
      <Dialog open={responseDialog.open} onOpenChange={(open) => setResponseDialog({ ...responseDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Respond to Review</DialogTitle>
            <DialogDescription>
              Write a thoughtful response to this creator's review
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="Thank you for your review..."
              value={responseDialog.response}
              onChange={(e) => setResponseDialog({ ...responseDialog, response: e.target.value })}
              rows={6}
              className="resize-none"
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setResponseDialog({ open: false, reviewId: null, response: "" })}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmitResponse}
                disabled={submitResponseMutation.isPending || !responseDialog.response.trim()}
              >
                {submitResponseMutation.isPending ? "Submitting..." : "Submit Response"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <GenericErrorDialog
        open={errorDialog.open}
        onOpenChange={(open) => setErrorDialog({ ...errorDialog, open })}
        title={errorDialog.title}
        description={errorDialog.description}
      />
    </div>
  );
}
