import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/use-toast";
import { useRoute, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
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
  CheckCircle2,
  XCircle,
  Edit3,
  Star,
  Trash2,
  DollarSign,
  TrendingUp,
  Users,
  Eye,
  FileText,
  Clock,
  MapPin,
  Link as LinkIcon,
  Play,
  BarChart3,
} from "lucide-react";
import { TopNavBar } from "../components/TopNavBar";
import { apiRequest, queryClient } from "../lib/queryClient";
import { GenericErrorDialog } from "../components/GenericErrorDialog";
import { proxiedSrc } from "../lib/image";

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  draft: { label: "Draft", variant: "outline" },
  pending_review: { label: "Pending", variant: "secondary" },
  approved: { label: "Live", variant: "default" },
  paused: { label: "Paused", variant: "outline" },
  archived: { label: "Archived", variant: "destructive" },
};

export default function AdminOfferDetail() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [, params] = useRoute("/admin-offer-detail/:id");
  const [, navigate] = useLocation();
  const offerId = params?.id;

  const [rejectDialog, setRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [editDialog, setEditDialog] = useState(false);
  const [editNotes, setEditNotes] = useState("");
  const [feeDialog, setFeeDialog] = useState(false);
  const [listingFee, setListingFee] = useState("");
  const [errorDialog, setErrorDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
  }>({ open: false, title: "", description: "" });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setErrorDialog({
        open: true,
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
      });
      setTimeout(() => {
        window.location.href = "/login";
      }, 500);
    }
  }, [isAuthenticated, authLoading]);

  const { data: offerData, isLoading } = useQuery({
    queryKey: [`/api/admin/offers/${offerId}`],
    queryFn: async () => {
      const response = await fetch(`/api/admin/offers/${offerId}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error("Failed to fetch offer");
      return response.json();
    },
    enabled: isAuthenticated && !!offerId,
  });

  const { data: videos = [] } = useQuery({
    queryKey: [`/api/offers/${offerId}/videos`],
    queryFn: async () => {
      const response = await fetch(`/api/offers/${offerId}/videos`, {
        credentials: 'include',
      });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: isAuthenticated && !!offerId,
  });

  const approveMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/admin/offers/${offerId}/approve`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/offers/${offerId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/offers"] });
      toast({
        title: "Success",
        description: "Offer approved successfully",
      });
    },
    onError: (error: any) => {
      setErrorDialog({
        open: true,
        title: "Error",
        description: error.message || "Failed to approve offer",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (reason: string) => {
      const response = await apiRequest("POST", `/api/admin/offers/${offerId}/reject`, { reason });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/offers/${offerId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/offers"] });
      setRejectDialog(false);
      setRejectReason("");
      toast({
        title: "Success",
        description: "Offer rejected",
      });
    },
    onError: (error: any) => {
      setErrorDialog({
        open: true,
        title: "Error",
        description: error.message || "Failed to reject offer",
      });
    },
  });

  const requestEditsMutation = useMutation({
    mutationFn: async (notes: string) => {
      const response = await apiRequest("POST", `/api/admin/offers/${offerId}/request-edits`, { notes });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/offers/${offerId}`] });
      setEditDialog(false);
      setEditNotes("");
      toast({
        title: "Success",
        description: "Edit request sent to company",
      });
    },
    onError: (error: any) => {
      setErrorDialog({
        open: true,
        title: "Error",
        description: error.message || "Failed to request edits",
      });
    },
  });

  const featureMutation = useMutation({
    mutationFn: async (featured: boolean) => {
      const response = await apiRequest("POST", `/api/admin/offers/${offerId}/feature`, { featured });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/offers/${offerId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/offers"] });
      toast({
        title: "Success",
        description: "Feature status updated",
      });
    },
    onError: (error: any) => {
      setErrorDialog({
        open: true,
        title: "Error",
        description: error.message || "Failed to update feature status",
      });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("DELETE", `/api/admin/offers/${offerId}/remove`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/offers"] });
      toast({
        title: "Success",
        description: "Offer removed from platform",
      });
      navigate("/admin/offers");
    },
    onError: (error: any) => {
      setErrorDialog({
        open: true,
        title: "Error",
        description: error.message || "Failed to remove offer",
      });
    },
  });

  const adjustFeeMutation = useMutation({
    mutationFn: async (fee: string) => {
      const response = await apiRequest("PUT", `/api/admin/offers/${offerId}/listing-fee`, { fee });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/offers/${offerId}`] });
      setFeeDialog(false);
      setListingFee("");
      toast({
        title: "Success",
        description: "Listing fee updated",
      });
    },
    onError: (error: any) => {
      setErrorDialog({
        open: true,
        title: "Error",
        description: error.message || "Failed to update listing fee",
      });
    },
  });

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-lg">Loading...</div>
      </div>
    );
  }

  if (!offerData?.offer) {
    return (
      <div className="space-y-6">
        <TopNavBar />
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <XCircle className="h-12 w-12 text-destructive mb-4" />
            <h3 className="text-lg font-semibold mb-2">Offer not found</h3>
            <Button onClick={() => navigate("/admin/offers")}>Back to Offers</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { offer, applicationStats, activeCreators, performanceMetrics } = offerData;

  return (
    <div className="space-y-6">
      <TopNavBar />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/admin/offers")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{offer.title}</h1>
            <p className="text-muted-foreground mt-1">{offer.productName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={STATUS_MAP[offer.status]?.variant || "secondary"} className="text-sm">
            {STATUS_MAP[offer.status]?.label || offer.status}
          </Badge>
          {offer.featuredOnHomepage && (
            <Badge variant="default" className="gap-1">
              <Star className="h-3 w-3" />
              Featured
            </Badge>
          )}
        </div>
      </div>

      {/* Actions */}
      <Card className="border-card-border">
        <CardHeader>
          <CardTitle className="text-lg">Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={() => approveMutation.mutate()}
              disabled={approveMutation.isPending || offer.status === 'approved'}
              className="gap-2"
            >
              <CheckCircle2 className="h-4 w-4" />
              Approve Offer
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRejectDialog(true)}
              disabled={rejectMutation.isPending}
              className="gap-2"
            >
              <XCircle className="h-4 w-4" />
              Reject Offer
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditDialog(true)}
              disabled={requestEditsMutation.isPending}
              className="gap-2"
            >
              <Edit3 className="h-4 w-4" />
              Request Edits
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => featureMutation.mutate(!offer.featuredOnHomepage)}
              disabled={featureMutation.isPending}
              className="gap-2"
            >
              <Star className="h-4 w-4" />
              {offer.featuredOnHomepage ? "Unfeature" : "Feature on Homepage"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFeeDialog(true)}
              className="gap-2"
            >
              <DollarSign className="h-4 w-4" />
              Adjust Listing Fee
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (confirm("Are you sure you want to remove this offer from the platform?")) {
                  removeMutation.mutate();
                }
              }}
              disabled={removeMutation.isPending}
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Remove from Platform
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold">{applicationStats.total}</div>
                <div className="text-xs text-muted-foreground">Total Applications</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-green-500/10">
                <Users className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{activeCreators}</div>
                <div className="text-xs text-muted-foreground">Active Creators</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-500/10">
                <Eye className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{performanceMetrics.totalViews}</div>
                <div className="text-xs text-muted-foreground">Total Views</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-purple-500/10">
                <BarChart3 className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{performanceMetrics.approvalRate}%</div>
                <div className="text-xs text-muted-foreground">Approval Rate</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Application Stats Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Application Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <span className="text-sm text-muted-foreground">Pending</span>
              <span className="text-2xl font-bold">{applicationStats.pending}</span>
            </div>
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <span className="text-sm text-muted-foreground">Approved</span>
              <span className="text-2xl font-bold text-green-500">{applicationStats.approved}</span>
            </div>
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <span className="text-sm text-muted-foreground">Rejected</span>
              <span className="text-2xl font-bold text-red-500">{applicationStats.rejected}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Offer Details */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Offer Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-1">Short Description</div>
              <p className="text-sm">{offer.shortDescription}</p>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-1">Full Description</div>
              <p className="text-sm whitespace-pre-wrap">{offer.fullDescription}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm font-medium text-muted-foreground mb-1">Primary Niche</div>
                <Badge variant="outline">{offer.primaryNiche}</Badge>
              </div>
              {offer.additionalNiches && offer.additionalNiches.length > 0 && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground mb-1">Additional Niches</div>
                  <div className="flex flex-wrap gap-1">
                    {offer.additionalNiches.map((niche: string, idx: number) => (
                      <Badge key={idx} variant="outline" className="text-xs">{niche}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {offer.productUrl && (
              <div>
                <div className="text-sm font-medium text-muted-foreground mb-1">Product URL</div>
                <a
                  href={offer.productUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                >
                  <LinkIcon className="h-3 w-3" />
                  {offer.productUrl}
                </a>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Commission & Requirements</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-1">Commission Type</div>
              <Badge>{offer.commissionType?.replace(/_/g, ' ')}</Badge>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {offer.commissionPercentage && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground mb-1">Commission %</div>
                  <div className="text-lg font-semibold">{offer.commissionPercentage}%</div>
                </div>
              )}
              {offer.commissionAmount && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground mb-1">Commission Amount</div>
                  <div className="text-lg font-semibold">${offer.commissionAmount}</div>
                </div>
              )}
              {offer.cookieDuration && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground mb-1">Cookie Duration</div>
                  <div className="text-sm flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {offer.cookieDuration} days
                  </div>
                </div>
              )}
              {offer.minimumFollowers && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground mb-1">Min. Followers</div>
                  <div className="text-sm">{offer.minimumFollowers.toLocaleString()}</div>
                </div>
              )}
            </div>
            {offer.listingFee && (
              <div>
                <div className="text-sm font-medium text-muted-foreground mb-1">Listing Fee</div>
                <div className="text-lg font-semibold">${offer.listingFee}</div>
              </div>
            )}
            {offer.creatorRequirements && (
              <div>
                <div className="text-sm font-medium text-muted-foreground mb-1">Creator Requirements</div>
                <p className="text-sm whitespace-pre-wrap">{offer.creatorRequirements}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Example Videos */}
      {videos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Example Videos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              {videos.map((video: any) => (
                <div key={video.id} className="border rounded-lg overflow-hidden">
                  {video.videoUrl ? (
                    <div className="aspect-video bg-muted flex items-center justify-center relative group">
                      <video
                        src={proxiedSrc(video.videoUrl)}
                        controls
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="aspect-video bg-muted flex items-center justify-center">
                      <Play className="h-12 w-12 text-muted-foreground/50" />
                    </div>
                  )}
                  {video.title && (
                    <div className="p-3">
                      <p className="text-sm font-medium line-clamp-1">{video.title}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Requests History */}
      {offer.editRequests && Array.isArray(offer.editRequests) && offer.editRequests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Edit Request History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {offer.editRequests.map((request: any, idx: number) => (
                <div key={idx} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Edit Request #{idx + 1}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(request.requestedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{request.notes}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialogs */}
      <Dialog open={rejectDialog} onOpenChange={setRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Offer</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this offer. The company will be notified.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Enter rejection reason..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => rejectMutation.mutate(rejectReason)}
              disabled={!rejectReason || rejectMutation.isPending}
            >
              Reject Offer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Edits</DialogTitle>
            <DialogDescription>
              Specify what changes need to be made to this offer. The company will be notified.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Enter edit notes..."
            value={editNotes}
            onChange={(e) => setEditNotes(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => requestEditsMutation.mutate(editNotes)}
              disabled={!editNotes || requestEditsMutation.isPending}
            >
              Send Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={feeDialog} onOpenChange={setFeeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Listing Fee</DialogTitle>
            <DialogDescription>
              Set a listing fee for this offer. Enter 0 for no fee.
            </DialogDescription>
          </DialogHeader>
          <Input
            type="number"
            placeholder="Enter fee amount..."
            value={listingFee}
            onChange={(e) => setListingFee(e.target.value)}
            min="0"
            step="0.01"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setFeeDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => adjustFeeMutation.mutate(listingFee)}
              disabled={!listingFee || adjustFeeMutation.isPending}
            >
              Update Fee
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
