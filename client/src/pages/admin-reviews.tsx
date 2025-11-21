import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
import { Star, Eye, EyeOff, Trash2, FileText, CheckCircle2, AlertCircle, Filter, Search, X } from "lucide-react";
import { apiRequest, queryClient } from "../lib/queryClient";
import { TopNavBar } from "../components/TopNavBar";
import { ListSkeleton } from "../components/skeletons";
import { Input } from "../components/ui/input";
import { GenericErrorDialog } from "../components/GenericErrorDialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";

export default function AdminReviews() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [selectedReview, setSelectedReview] = useState<any>(null);
  const [isNoteDialogOpen, setIsNoteDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [adminNote, setAdminNote] = useState("");
  const [editedReview, setEditedReview] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [visibilityFilter, setVisibilityFilter] = useState("all");
  const [ratingFilter, setRatingFilter] = useState("all");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [errorDialog, setErrorDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
  }>({ open: false, title: "", description: "" });

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

  const { data: reviews = [], isLoading: loadingReviews } = useQuery<any[]>({
    queryKey: ["/api/admin/reviews"],
    enabled: isAuthenticated,
  });

  const uniqueCompanyOptions = useMemo(() => {
    const map = new Map<string, string>();
    reviews.forEach((review: any) => {
      if (review.companyId) {
        map.set(review.companyId, review.companyName || review.companyId);
      }
    });
    return Array.from(map.entries());
  }, [reviews]);

  const filteredReviews = useMemo(() => {
    return reviews.filter((review: any) => {
      const matchesSearch = searchTerm
        ? [review.reviewText, review.companyId, review.creatorId]
            .filter(Boolean)
            .some((value) => value.toLowerCase().includes(searchTerm.toLowerCase()))
        : true;

      const matchesStatus = (() => {
        if (statusFilter === "all") return true;
        if (statusFilter === "approved") return review.isApproved;
        if (statusFilter === "pending") return !review.isApproved;
        return true;
      })();

      const matchesVisibility = (() => {
        if (visibilityFilter === "all") return true;
        if (visibilityFilter === "hidden") return review.isHidden;
        if (visibilityFilter === "visible") return !review.isHidden;
        return true;
      })();

      const matchesRating = (() => {
        if (ratingFilter === "all") return true;
        if (ratingFilter === "5") return review.overallRating === 5;
        if (ratingFilter === "4plus") return review.overallRating >= 4;
        if (ratingFilter === "3orless") return review.overallRating <= 3;
        return true;
      })();

      const matchesCompany = companyFilter === "all" || review.companyId === companyFilter;

      return matchesSearch && matchesStatus && matchesVisibility && matchesRating && matchesCompany;
    });
  }, [companyFilter, ratingFilter, reviews, searchTerm, statusFilter, visibilityFilter]);

  const hasActiveFilters =
    searchTerm.trim().length > 0 ||
    statusFilter !== "all" ||
    visibilityFilter !== "all" ||
    ratingFilter !== "all" ||
    companyFilter !== "all";

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setVisibilityFilter("all");
    setRatingFilter("all");
    setCompanyFilter("all");
  };

  const hideReviewMutation = useMutation({
    mutationFn: async (reviewId: string) => {
      const response = await apiRequest("POST", `/api/admin/reviews/${reviewId}/hide`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/reviews"] });
      toast({
        title: "Success",
        description: "Review hidden successfully",
      });
    },
    onError: (error: any) => {
      setErrorDialog({
        open: true,
        title: "Error",
        description: error.message || "Failed to hide review",
      });
    },
  });

  const deleteReviewMutation = useMutation({
    mutationFn: async (reviewId: string) => {
      const response = await apiRequest("DELETE", `/api/admin/reviews/${reviewId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/reviews"] });
      toast({
        title: "Success",
        description: "Review deleted successfully",
      });
    },
    onError: (error: any) => {
      setErrorDialog({
        open: true,
        title: "Error",
        description: error.message || "Failed to delete review",
      });
    },
  });

  const saveNoteMutation = useMutation({
    mutationFn: async ({ reviewId, note }: { reviewId: string; note: string }) => {
      const response = await apiRequest("POST", `/api/admin/reviews/${reviewId}/note`, { note });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/reviews"] });
      toast({
        title: "Success",
        description: "Admin note saved successfully",
      });
      setIsNoteDialogOpen(false);
      setAdminNote("");
    },
    onError: (error: any) => {
      setErrorDialog({
        open: true,
        title: "Error",
        description: error.message || "Failed to save note",
      });
    },
  });

  const updateReviewMutation = useMutation({
    mutationFn: async ({ reviewId, updates }: { reviewId: string; updates: any }) => {
      const response = await apiRequest("PATCH", `/api/admin/reviews/${reviewId}`, updates);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/reviews"] });
      toast({
        title: "Success",
        description: "Review updated successfully",
      });
      setIsEditDialogOpen(false);
      setEditedReview(null);
    },
    onError: (error: any) => {
      setErrorDialog({
        open: true,
        title: "Error",
        description: error.message || "Failed to update review",
      });
    },
  });

  const approveReviewMutation = useMutation({
    mutationFn: async (reviewId: string) => {
      const response = await apiRequest("POST", `/api/admin/reviews/${reviewId}/approve`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/reviews"] });
      toast({
        title: "Success",
        description: "Review approved successfully",
      });
    },
    onError: (error: any) => {
      setErrorDialog({
        open: true,
        title: "Error",
        description: error.message || "Failed to approve review",
      });
    },
  });

  const handleAddNote = (review: any) => {
    setSelectedReview(review);
    setAdminNote(review.adminNote || "");
    setIsNoteDialogOpen(true);
  };

  const handleEdit = (review: any) => {
    setSelectedReview(review);
    setEditedReview({
      reviewText: review.reviewText || "",
      overallRating: review.overallRating,
      paymentSpeedRating: review.paymentSpeedRating,
      communicationRating: review.communicationRating,
      offerQualityRating: review.offerQualityRating,
      supportRating: review.supportRating,
    });
    setIsEditDialogOpen(true);
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

  return (
    <div className="space-y-8">
      <TopNavBar />
      <div>
        <h1 className="text-3xl font-bold">Review Management</h1>
        <p className="text-muted-foreground mt-1">
          View, approve, edit, or delete reviews across the platform
        </p>
      </div>

      <Card className="border-card-border">
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Filter className="h-4 w-4" />
              <span className="text-sm font-semibold uppercase tracking-wider">Search & Filter</span>
            </div>
            <div className="sm:ml-auto text-sm text-muted-foreground">
              Showing <span className="font-semibold text-foreground">{filteredReviews.length}</span> of {reviews.length}
              {` review${reviews.length === 1 ? "" : "s"}`}
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
                placeholder="Search review text or IDs"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Reviews</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="pending">Pending Approval</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Visibility</label>
              <Select value={visibilityFilter} onValueChange={setVisibilityFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All visibility" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Reviews</SelectItem>
                  <SelectItem value="visible">Visible</SelectItem>
                  <SelectItem value="hidden">Hidden</SelectItem>
                </SelectContent>
              </Select>
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
                  <SelectItem value="4plus">4+ stars</SelectItem>
                  <SelectItem value="3orless">3 stars & below</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium">Company</label>
              <Select value={companyFilter} onValueChange={setCompanyFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All companies" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Companies</SelectItem>
                  {uniqueCompanyOptions.map(([id, name]) => (
                    <SelectItem key={id} value={id}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="border-card-border" data-testid="card-total-reviews">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Reviews</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-reviews">{reviews.length}</div>
          </CardContent>
        </Card>

        <Card className="border-card-border" data-testid="card-hidden-reviews">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hidden</CardTitle>
            <EyeOff className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-hidden-reviews">
              {reviews.filter((r: any) => r.isHidden).length}
            </div>
          </CardContent>
        </Card>

        <Card className="border-card-border" data-testid="card-pending-approval">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Approval</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary" data-testid="text-pending-approval">
              {reviews.filter((r: any) => !r.isApproved).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {isLoading || loadingReviews ? (
        <ListSkeleton count={5} />
      ) : reviews.length === 0 ? (
        <Card className="border-card-border">
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No reviews yet</h3>
              <p className="text-muted-foreground">
                Reviews will appear here once creators start submitting them
              </p>
            </div>
          </CardContent>
        </Card>
      ) : filteredReviews.length === 0 ? (
        <Card className="border-card-border">
          <CardContent className="pt-10 pb-12 flex flex-col items-center gap-2 text-center text-muted-foreground">
            <Search className="h-10 w-10" />
            <h3 className="text-lg font-semibold text-foreground">No reviews match your filters</h3>
            <p className="text-sm">Try adjusting your search terms or resetting the selected filters.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredReviews.map((review: any) => (
            <Card
              key={review.id}
              className={`border-card-border ${review.isHidden ? 'opacity-50' : ''}`}
              data-testid={`card-review-${review.id}`}
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {renderStars(review.overallRating)}
                      <span className="text-sm text-muted-foreground">
                        {new Date(review.createdAt).toLocaleDateString()}
                      </span>
                      {review.isHidden && (
                        <Badge variant="secondary" data-testid={`badge-hidden-${review.id}`}>
                          <EyeOff className="h-3 w-3 mr-1" />
                          Hidden
                        </Badge>
                      )}
                      {!review.isApproved && (
                        <Badge variant="outline" data-testid={`badge-pending-${review.id}`}>
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Pending Approval
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="text-base">Creator ID: {review.creatorId}</CardTitle>
                    <CardDescription>Company ID: {review.companyId}</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    {!review.isApproved && (
                      <Button
                        size="sm"
                        onClick={() => approveReviewMutation.mutate(review.id)}
                        disabled={approveReviewMutation.isPending}
                        data-testid={`button-approve-${review.id}`}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(review)}
                      data-testid={`button-edit-${review.id}`}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAddNote(review)}
                      data-testid={`button-note-${review.id}`}
                    >
                      <FileText className="h-4 w-4 mr-1" />
                      Note
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => hideReviewMutation.mutate(review.id)}
                      disabled={hideReviewMutation.isPending}
                      data-testid={`button-hide-${review.id}`}
                    >
                      <EyeOff className="h-4 w-4 mr-1" />
                      {review.isHidden ? 'Hidden' : 'Hide'}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        if (confirm('Are you sure you want to permanently delete this review?')) {
                          deleteReviewMutation.mutate(review.id);
                        }
                      }}
                      disabled={deleteReviewMutation.isPending}
                      data-testid={`button-delete-${review.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium mb-2">Review Text:</h4>
                    <p className="text-sm text-muted-foreground">{review.reviewText || 'No review text'}</p>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Payment Speed</p>
                      {renderStars(review.paymentSpeedRating)}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Communication</p>
                      {renderStars(review.communicationRating)}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Offer Quality</p>
                      {renderStars(review.offerQualityRating)}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Support</p>
                      {renderStars(review.supportRating)}
                    </div>
                  </div>
                  {review.companyResponse && (
                    <div className="bg-muted p-3 rounded-md">
                      <h4 className="text-sm font-medium mb-1">Company Response:</h4>
                      <p className="text-sm">{review.companyResponse}</p>
                    </div>
                  )}
                  {review.adminNote && (
                    <div className="bg-primary/5 p-3 rounded-md border border-primary/20">
                      <h4 className="text-sm font-medium mb-1">Admin Note:</h4>
                      <p className="text-sm">{review.adminNote}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Admin Note Dialog */}
      <Dialog open={isNoteDialogOpen} onOpenChange={setIsNoteDialogOpen}>
        <DialogContent data-testid="dialog-admin-note">
          <DialogHeader>
            <DialogTitle>Admin Note</DialogTitle>
            <DialogDescription>
              Add an internal note about this review (not visible to users)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="adminNote">Note</Label>
              <Textarea
                id="adminNote"
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                placeholder="Add your internal note here..."
                rows={4}
                data-testid="textarea-admin-note"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsNoteDialogOpen(false)}
              data-testid="button-cancel-note"
            >
              Cancel
            </Button>
            <Button
              onClick={() => selectedReview && saveNoteMutation.mutate({ 
                reviewId: selectedReview.id, 
                note: adminNote 
              })}
              disabled={saveNoteMutation.isPending}
              data-testid="button-save-note"
            >
              Save Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Review Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl" data-testid="dialog-edit-review">
          <DialogHeader>
            <DialogTitle>Edit Review</DialogTitle>
            <DialogDescription>
              Modify the review content and ratings
            </DialogDescription>
          </DialogHeader>
          {editedReview && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="reviewText">Review Text</Label>
                <Textarea
                  id="reviewText"
                  value={editedReview.reviewText}
                  onChange={(e) => setEditedReview({ ...editedReview, reviewText: e.target.value })}
                  placeholder="Review text..."
                  rows={4}
                  data-testid="textarea-review-text"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Overall Rating: {editedReview.overallRating}</Label>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={editedReview.overallRating}
                    onChange={(e) => setEditedReview({ ...editedReview, overallRating: parseInt(e.target.value) })}
                    className="w-full"
                    data-testid="input-overall-rating"
                  />
                </div>
                <div>
                  <Label>Payment Speed: {editedReview.paymentSpeedRating}</Label>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={editedReview.paymentSpeedRating}
                    onChange={(e) => setEditedReview({ ...editedReview, paymentSpeedRating: parseInt(e.target.value) })}
                    className="w-full"
                    data-testid="input-payment-speed-rating"
                  />
                </div>
                <div>
                  <Label>Communication: {editedReview.communicationRating}</Label>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={editedReview.communicationRating}
                    onChange={(e) => setEditedReview({ ...editedReview, communicationRating: parseInt(e.target.value) })}
                    className="w-full"
                    data-testid="input-communication-rating"
                  />
                </div>
                <div>
                  <Label>Offer Quality: {editedReview.offerQualityRating}</Label>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={editedReview.offerQualityRating}
                    onChange={(e) => setEditedReview({ ...editedReview, offerQualityRating: parseInt(e.target.value) })}
                    className="w-full"
                    data-testid="input-offer-quality-rating"
                  />
                </div>
                <div>
                  <Label>Support: {editedReview.supportRating}</Label>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={editedReview.supportRating}
                    onChange={(e) => setEditedReview({ ...editedReview, supportRating: parseInt(e.target.value) })}
                    className="w-full"
                    data-testid="input-support-rating"
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
              data-testid="button-cancel-edit"
            >
              Cancel
            </Button>
            <Button
              onClick={() => selectedReview && editedReview && updateReviewMutation.mutate({
                reviewId: selectedReview.id,
                updates: { ...editedReview, isEdited: true }
              })}
              disabled={updateReviewMutation.isPending}
              data-testid="button-save-edit"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <GenericErrorDialog
        open={errorDialog.open}
        onOpenChange={(open) => setErrorDialog({ ...errorDialog, open })}
        title={errorDialog.title}
        description={errorDialog.description}
        variant="error"
      />
    </div>
  );
}
