import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Users, Search, Ban, ShieldOff, ShieldCheck } from "lucide-react";
import { apiRequest, queryClient } from "../lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { TopNavBar } from "../components/TopNavBar";
import { ListSkeleton } from "../components/skeletons";
import { GenericErrorDialog } from "../components/GenericErrorDialog";

export default function AdminCreators() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCreator, setSelectedCreator] = useState<any>(null);
  const [actionDialog, setActionDialog] = useState<{ open: boolean; action: 'suspend' | 'ban' | 'unsuspend' | null }>({ open: false, action: null });
  const [errorDialog, setErrorDialog] = useState<{ open: boolean; title: string; description: string; errorDetails?: string }>({
    open: false,
    title: "",
    description: ""
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

  const { data: creators = [], isLoading: loadingCreators } = useQuery<any[]>({
    queryKey: ["/api/admin/creators"],
    enabled: isAuthenticated,
  });

  const suspendMutation = useMutation({
    mutationFn: async (creatorId: string) => {
      return await apiRequest("POST", `/api/admin/creators/${creatorId}/suspend`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/creators"] });
      toast({
        title: "Success",
        description: "Creator account suspended",
      });
      setActionDialog({ open: false, action: null });
      setSelectedCreator(null);
    },
    onError: (error: any) => {
      setErrorDialog({
        open: true,
        title: "Error",
        description: "Failed to suspend creator",
        errorDetails: error.message,
      });
    },
  });

  const unsuspendMutation = useMutation({
    mutationFn: async (creatorId: string) => {
      return await apiRequest("POST", `/api/admin/creators/${creatorId}/unsuspend`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/creators"] });
      toast({
        title: "Success",
        description: "Creator account reactivated",
      });
      setActionDialog({ open: false, action: null });
      setSelectedCreator(null);
    },
    onError: (error: any) => {
      setErrorDialog({
        open: true,
        title: "Error",
        description: "Failed to unsuspend creator",
        errorDetails: error.message,
      });
    },
  });

  const banMutation = useMutation({
    mutationFn: async (creatorId: string) => {
      return await apiRequest("POST", `/api/admin/creators/${creatorId}/ban`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/creators"] });
      toast({
        title: "Success",
        description: "Creator account banned",
      });
      setActionDialog({ open: false, action: null });
      setSelectedCreator(null);
    },
    onError: (error: any) => {
      setErrorDialog({
        open: true,
        title: "Error",
        description: "Failed to ban creator",
        errorDetails: error.message,
      });
    },
  });

  const handleAction = (creator: any, action: 'suspend' | 'ban' | 'unsuspend') => {
    setSelectedCreator(creator);
    setActionDialog({ open: true, action });
  };

  const confirmAction = () => {
    if (!selectedCreator || !actionDialog.action) return;

    if (actionDialog.action === 'suspend') {
      suspendMutation.mutate(selectedCreator.id);
    } else if (actionDialog.action === 'ban') {
      banMutation.mutate(selectedCreator.id);
    } else if (actionDialog.action === 'unsuspend') {
      unsuspendMutation.mutate(selectedCreator.id);
    }
  };

  const filteredCreators = creators.filter(creator => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      creator.username?.toLowerCase().includes(search) ||
      creator.email?.toLowerCase().includes(search) ||
      creator.firstName?.toLowerCase().includes(search) ||
      creator.lastName?.toLowerCase().includes(search)
    );
  });

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
        <h1 className="text-3xl font-bold">Creator Management</h1>
        <p className="text-muted-foreground mt-1">
          View and manage creator accounts on the platform
        </p>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search creators by name, username, or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-testid="input-search-creators"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="border-card-border">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Creators</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{creators.length}</div>
          </CardContent>
        </Card>

        <Card className="border-card-border">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {creators.filter(c => c.accountStatus === 'active').length}
            </div>
          </CardContent>
        </Card>

        <Card className="border-card-border">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Suspended/Banned</CardTitle>
            <ShieldOff className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {creators.filter(c => c.accountStatus === 'suspended' || c.accountStatus === 'banned').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Creators List */}
      {loadingCreators ? (
        <ListSkeleton count={5} />
      ) : filteredCreators.length === 0 ? (
        <Card className="border-card-border">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No creators found</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              {searchTerm ? 'Try adjusting your search terms' : 'No creators have registered yet'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredCreators.map((creator: any) => (
            <Card key={creator.id} className="border-card-border" data-testid={`card-creator-${creator.id}`}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={creator.profileImageUrl} alt={creator.username} />
                      <AvatarFallback>
                        {creator.firstName?.[0] || creator.username?.[0] || 'C'}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="font-semibold" data-testid={`text-name-${creator.id}`}>
                          {creator.firstName && creator.lastName 
                            ? `${creator.firstName} ${creator.lastName}` 
                            : creator.username}
                        </h3>
                        <Badge
                          variant={
                            creator.isDeleted
                              ? 'outline'
                              : creator.accountStatus === 'active'
                                ? 'default'
                                : creator.accountStatus === 'suspended'
                                  ? 'secondary'
                                  : 'destructive'
                          }
                          data-testid={`badge-status-${creator.id}`}
                        >
                          {creator.isDeleted ? 'deleted' : creator.accountStatus}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">@{creator.username}</p>
                      <p className={`text-sm ${creator.isDeleted ? 'text-muted-foreground line-through' : 'text-tertiary-foreground'}`}>
                        {creator.email}
                      </p>
                      
                      {creator.profile && (
                        <div className="flex gap-4 mt-3 text-sm">
                          {creator.profile.youtubeFollowers && (
                            <div>
                              <span className="text-muted-foreground">YouTube:</span>{' '}
                              <span className="font-medium">{creator.profile.youtubeFollowers.toLocaleString()}</span>
                            </div>
                          )}
                          {creator.profile.tiktokFollowers && (
                            <div>
                              <span className="text-muted-foreground">TikTok:</span>{' '}
                              <span className="font-medium">{creator.profile.tiktokFollowers.toLocaleString()}</span>
                            </div>
                          )}
                          {creator.profile.instagramFollowers && (
                            <div>
                              <span className="text-muted-foreground">Instagram:</span>{' '}
                              <span className="font-medium">{creator.profile.instagramFollowers.toLocaleString()}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {creator.accountStatus === 'active' && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={() => handleAction(creator, 'suspend')}
                          data-testid={`button-suspend-${creator.id}`}
                        >
                          <ShieldOff className="h-4 w-4" />
                          Suspend
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="gap-2"
                          onClick={() => handleAction(creator, 'ban')}
                          data-testid={`button-ban-${creator.id}`}
                        >
                          <Ban className="h-4 w-4" />
                          Ban
                        </Button>
                      </>
                    )}
                    {(creator.accountStatus === 'suspended' || creator.accountStatus === 'banned') && (
                      <Button
                        variant="default"
                        size="sm"
                        className="gap-2"
                        onClick={() => handleAction(creator, 'unsuspend')}
                        data-testid={`button-unsuspend-${creator.id}`}
                      >
                        <ShieldCheck className="h-4 w-4" />
                        Reactivate
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Confirmation Dialog */}
      <Dialog open={actionDialog.open} onOpenChange={(open) => setActionDialog({ open, action: null })}>
        <DialogContent data-testid="dialog-confirm-action">
          <DialogHeader>
            <DialogTitle>
              {actionDialog.action === 'suspend' && 'Suspend Creator Account'}
              {actionDialog.action === 'ban' && 'Ban Creator Account'}
              {actionDialog.action === 'unsuspend' && 'Reactivate Creator Account'}
            </DialogTitle>
            <DialogDescription>
              {actionDialog.action === 'suspend' && 
                `Are you sure you want to suspend ${selectedCreator?.username}? They won't be able to access their account until unsuspended.`
              }
              {actionDialog.action === 'ban' && 
                `Are you sure you want to ban ${selectedCreator?.username}? This is a serious action that will permanently restrict their access.`
              }
              {actionDialog.action === 'unsuspend' && 
                `Are you sure you want to reactivate ${selectedCreator?.username}? They will regain full access to their account.`
              }
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setActionDialog({ open: false, action: null });
                setSelectedCreator(null);
              }}
              data-testid="button-cancel-action"
            >
              Cancel
            </Button>
            <Button
              variant={actionDialog.action === 'ban' ? 'destructive' : 'default'}
              onClick={confirmAction}
              disabled={suspendMutation.isPending || banMutation.isPending || unsuspendMutation.isPending}
              data-testid="button-confirm-action"
            >
              {suspendMutation.isPending || banMutation.isPending || unsuspendMutation.isPending
                ? "Processing..." 
                : actionDialog.action === 'suspend' 
                  ? 'Suspend Account'
                  : actionDialog.action === 'ban'
                    ? 'Ban Account'
                    : 'Reactivate Account'
              }
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
    </div>
  );
}
