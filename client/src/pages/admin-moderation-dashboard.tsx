import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "../lib/queryClient";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  ShieldAlert,
  MessageSquare,
  Star,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Filter,
  X,
  Eye,
  Clock,
} from "lucide-react";
import { TopNavBar } from "../components/TopNavBar";
import { GenericErrorDialog } from "../components/GenericErrorDialog";
import { Input } from "../components/ui/input";

type ContentFlag = {
  id: string;
  contentType: "message" | "review";
  contentId: string;
  userId: string;
  flagReason: string;
  matchedKeywords: string[];
  status: "pending" | "reviewed" | "dismissed" | "action_taken";
  reviewedBy: string | null;
  reviewedAt: string | null;
  adminNotes: string | null;
  actionTaken: string | null;
  createdAt: string;
  user?: {
    id: string;
    username: string;
    email: string;
    role: string;
  };
};

type ModerationStats = {
  pending: number;
  reviewed: number;
  dismissed: number;
  actionTaken: number;
  total: number;
};

export default function AdminModerationDashboard() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { toast } = useToast();
  const [selectedFlag, setSelectedFlag] = useState<ContentFlag | null>(null);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [reviewStatus, setReviewStatus] = useState<"reviewed" | "dismissed" | "action_taken">("reviewed");
  const [adminNotes, setAdminNotes] = useState("");
  const [actionTaken, setActionTaken] = useState("");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [contentTypeFilter, setContentTypeFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [errorDialog, setErrorDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    errorDetails?: string;
  }>({
    open: false,
    title: "",
    description: "",
  });

  const { data: flags = [], isLoading: flagsLoading } = useQuery<ContentFlag[]>({
    queryKey: ["/api/admin/moderation/flags"],
    enabled: isAuthenticated && user?.role === 'admin',
  });

  const { data: stats, isLoading: statsLoading } = useQuery<ModerationStats>({
    queryKey: ["/api/admin/moderation/statistics"],
    enabled: isAuthenticated && user?.role === 'admin',
  });

  const filteredFlags = useMemo(() => {
    return flags.filter((flag) => {
      const matchesSearch = searchTerm
        ? flag.flagReason.toLowerCase().includes(searchTerm.toLowerCase()) ||
          flag.contentId.toLowerCase().includes(searchTerm.toLowerCase()) ||
          flag.matchedKeywords.some((kw) => kw.toLowerCase().includes(searchTerm.toLowerCase()))
        : true;

      const matchesStatus = statusFilter === "all" || flag.status === statusFilter;
      const matchesContentType =
        contentTypeFilter === "all" || flag.contentType === contentTypeFilter;

      return matchesSearch && matchesStatus && matchesContentType;
    });
  }, [flags, searchTerm, statusFilter, contentTypeFilter]);

  const hasActiveFilters =
    searchTerm.trim().length > 0 || statusFilter !== "pending" || contentTypeFilter !== "all";

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("pending");
    setContentTypeFilter("all");
  };

  const reviewFlagMutation = useMutation({
    mutationFn: async ({
      id,
      status,
      adminNotes,
      actionTaken,
    }: {
      id: string;
      status: string;
      adminNotes?: string;
      actionTaken?: string;
    }) => {
      const response = await apiRequest("PATCH", `/api/admin/moderation/flags/${id}/review`, {
        status,
        adminNotes,
        actionTaken,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/moderation/flags"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/moderation/statistics"] });
      toast({
        title: "Flag Reviewed",
        description: "The content flag has been successfully reviewed.",
      });
      handleCloseDialog();
    },
    onError: (error: Error) => {
      setErrorDialog({
        open: true,
        title: "Error",
        description: "Failed to review content flag",
        errorDetails: error.message,
      });
    },
  });

  const handleReview = (flag: ContentFlag) => {
    setSelectedFlag(flag);
    setReviewStatus("reviewed");
    setAdminNotes(flag.adminNotes || "");
    setActionTaken(flag.actionTaken || "");
    setShowReviewDialog(true);
  };

  const handleQuickAction = (flag: ContentFlag, status: "reviewed" | "dismissed" | "action_taken") => {
    reviewFlagMutation.mutate({
      id: flag.id,
      status,
      adminNotes: status === "dismissed" ? "Quick dismissed by admin" : undefined,
    });
  };

  const handleSubmitReview = () => {
    if (!selectedFlag) return;

    reviewFlagMutation.mutate({
      id: selectedFlag.id,
      status: reviewStatus,
      adminNotes: adminNotes.trim() || undefined,
      actionTaken:
        reviewStatus === "action_taken" && actionTaken.trim() ? actionTaken.trim() : undefined,
    });
  };

  const handleCloseDialog = () => {
    setShowReviewDialog(false);
    setSelectedFlag(null);
    setReviewStatus("reviewed");
    setAdminNotes("");
    setActionTaken("");
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case "reviewed":
        return (
          <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20">
            <Eye className="h-3 w-3 mr-1" />
            Reviewed
          </Badge>
        );
      case "dismissed":
        return (
          <Badge variant="outline" className="bg-gray-500/10 text-gray-600 border-gray-500/20">
            <XCircle className="h-3 w-3 mr-1" />
            Dismissed
          </Badge>
        );
      case "action_taken":
        return (
          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Action Taken
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getContentTypeBadge = (type: string) => {
    return type === "message" ? (
      <Badge variant="secondary">
        <MessageSquare className="h-3 w-3 mr-1" />
        Message
      </Badge>
    ) : (
      <Badge variant="secondary">
        <Star className="h-3 w-3 mr-1" />
        Review
      </Badge>
    );
  };

  if (isLoading || flagsLoading || statsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-lg">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== 'admin') {
    return null;
  }

  return (
    <div className="space-y-6">
      <TopNavBar />

      <div>
        <h1 className="text-3xl font-bold">Content Moderation Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Review and manage flagged content across the platform
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Flags</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.total || 0}</div>
          </CardContent>
        </Card>
        <Card className="border-yellow-500/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-yellow-600">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-600">{stats?.pending || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-blue-600">Reviewed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{stats?.reviewed || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-green-600">Action Taken</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{stats?.actionTaken || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Dismissed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-muted-foreground">{stats?.dismissed || 0}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-card-border">
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Filter className="h-4 w-4" />
              <span className="text-sm font-semibold uppercase tracking-wider">
                Search & Filter
              </span>
            </div>
            <div className="sm:ml-auto text-sm text-muted-foreground">
              Showing <span className="font-semibold text-foreground">{filteredFlags.length}</span> of{" "}
              {flags.length} {flags.length === 1 ? "flag" : "flags"}
            </div>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" className="text-xs sm:ml-4" onClick={clearFilters}>
                <X className="h-3 w-3 mr-1" />
                Clear Filters
              </Button>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Search</label>
              <Input
                placeholder="Search reasons, keywords, or IDs"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="reviewed">Reviewed</SelectItem>
                  <SelectItem value="dismissed">Dismissed</SelectItem>
                  <SelectItem value="action_taken">Action Taken</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Content Type</label>
              <Select value={contentTypeFilter} onValueChange={setContentTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="message">Messages</SelectItem>
                  <SelectItem value="review">Reviews</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {filteredFlags.length === 0 ? (
        <Card className="border-card-border">
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <ShieldAlert className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">
                {flags.length === 0 ? "No flagged content" : "No flags match your filters"}
              </h3>
              <p className="text-muted-foreground">
                {flags.length === 0
                  ? "Flagged content will appear here when the moderation system detects issues"
                  : "Try adjusting your search terms or resetting the selected filters"}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredFlags.map((flag) => (
            <Card key={flag.id} className="border-card-border">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {getContentTypeBadge(flag.contentType)}
                      {getStatusBadge(flag.status)}
                      <span className="text-sm text-muted-foreground">
                        {new Date(flag.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <CardTitle className="text-base">
                      User: {flag.user?.username || flag.userId}
                    </CardTitle>
                    <CardDescription>Content ID: {flag.contentId}</CardDescription>
                  </div>
                  {flag.status === "pending" && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleReview(flag)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Review
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleQuickAction(flag, "dismissed")}
                        disabled={reviewFlagMutation.isPending}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Dismiss
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium mb-2">Flag Reason:</h4>
                    <p className="text-sm text-muted-foreground">{flag.flagReason}</p>
                  </div>
                  {flag.matchedKeywords && flag.matchedKeywords.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-2">Matched Keywords:</h4>
                      <div className="flex flex-wrap gap-2">
                        {flag.matchedKeywords.map((keyword, idx) => (
                          <Badge
                            key={idx}
                            variant="destructive"
                            className="bg-red-500/10 text-red-600 border-red-500/20"
                          >
                            {keyword}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {flag.adminNotes && (
                    <div className="bg-primary/5 p-3 rounded-md border border-primary/20">
                      <h4 className="text-sm font-medium mb-1">Admin Notes:</h4>
                      <p className="text-sm">{flag.adminNotes}</p>
                    </div>
                  )}
                  {flag.actionTaken && (
                    <div className="bg-green-500/5 p-3 rounded-md border border-green-500/20">
                      <h4 className="text-sm font-medium mb-1">Action Taken:</h4>
                      <p className="text-sm">{flag.actionTaken}</p>
                    </div>
                  )}
                  {flag.reviewedBy && flag.reviewedAt && (
                    <div className="text-xs text-muted-foreground">
                      Reviewed by {flag.reviewedBy} on {new Date(flag.reviewedAt).toLocaleString()}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review Flagged Content</DialogTitle>
            <DialogDescription>
              Review the flagged content and take appropriate action
            </DialogDescription>
          </DialogHeader>
          {selectedFlag && (
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-md space-y-2">
                <div className="flex items-center gap-2">
                  {getContentTypeBadge(selectedFlag.contentType)}
                  <span className="text-sm">Content ID: {selectedFlag.contentId}</span>
                </div>
                <div className="text-sm">
                  <strong>User:</strong> {selectedFlag.user?.username || selectedFlag.userId}
                </div>
                <div className="text-sm">
                  <strong>Reason:</strong> {selectedFlag.flagReason}
                </div>
                {selectedFlag.matchedKeywords.length > 0 && (
                  <div className="text-sm">
                    <strong>Keywords:</strong> {selectedFlag.matchedKeywords.join(", ")}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="reviewStatus">Review Decision *</Label>
                <Select
                  value={reviewStatus}
                  onValueChange={(val) => setReviewStatus(val as any)}
                >
                  <SelectTrigger id="reviewStatus">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="reviewed">Reviewed (No Action Needed)</SelectItem>
                    <SelectItem value="dismissed">Dismissed (False Positive)</SelectItem>
                    <SelectItem value="action_taken">Action Taken (Content Removed/User Warned)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="adminNotes">Admin Notes (Optional)</Label>
                <Textarea
                  id="adminNotes"
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Add internal notes about this review..."
                  rows={3}
                />
              </div>

              {reviewStatus === "action_taken" && (
                <div className="space-y-2">
                  <Label htmlFor="actionTaken">Action Taken (Optional)</Label>
                  <Textarea
                    id="actionTaken"
                    value={actionTaken}
                    onChange={(e) => setActionTaken(e.target.value)}
                    placeholder="Describe what action was taken (e.g., content removed, user warned, etc.)..."
                    rows={3}
                  />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancel
            </Button>
            <Button onClick={handleSubmitReview} disabled={reviewFlagMutation.isPending}>
              Submit Review
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
