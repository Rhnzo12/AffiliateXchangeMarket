import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "../lib/queryClient";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Badge } from "../components/ui/badge";
import { Switch } from "../components/ui/switch";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Tags, GripVertical, Star, Merge, ArrowRight } from "lucide-react";
import { TopNavBar } from "../components/TopNavBar";
import { GenericErrorDialog } from "../components/GenericErrorDialog";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";

interface Niche {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  isPrimary: boolean;
  displayOrder: number | null;
  createdAt: string;
  updatedAt: string;
}

export default function AdminNiches() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const [editingNiche, setEditingNiche] = useState<Niche | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [sourceNiche, setSourceNiche] = useState<string>("");
  const [targetNiche, setTargetNiche] = useState<string>("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [nicheToDelete, setNicheToDelete] = useState<string | null>(null);
  const [errorDialog, setErrorDialog] = useState<{ open: boolean; title: string; description: string; errorDetails?: string }>({
    open: false,
    title: "",
    description: ""
  });

  const { data: niches = [], isLoading: nichesLoading } = useQuery<Niche[]>({
    queryKey: ["/api/admin/niches"],
    queryFn: async () => {
      const response = await fetch("/api/admin/niches", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch niches");
      return response.json();
    },
    enabled: isAuthenticated && user?.role === 'admin',
  });

  const createNicheMutation = useMutation({
    mutationFn: async (data: { name: string; description: string; isActive: boolean }) => {
      const response = await fetch("/api/admin/niches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || "Failed to create niche");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/niches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/niches"] });
      toast({
        title: "Niche Created",
        description: "The niche category has been successfully created.",
      });
      handleCloseDialog();
    },
    onError: (error: Error) => {
      setErrorDialog({
        open: true,
        title: "Error",
        description: "Failed to create niche",
        errorDetails: error.message,
      });
    },
  });

  const updateNicheMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name?: string; description?: string; isActive?: boolean } }) => {
      const response = await fetch(`/api/admin/niches/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || "Failed to update niche");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/niches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/niches"] });
      toast({
        title: "Niche Updated",
        description: "The niche category has been successfully updated.",
      });
      handleCloseDialog();
    },
    onError: (error: Error) => {
      setErrorDialog({
        open: true,
        title: "Error",
        description: "Failed to update niche",
        errorDetails: error.message,
      });
    },
  });

  const deleteNicheMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/admin/niches/${id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || "Failed to delete niche");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/niches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/niches"] });
      toast({
        title: "Niche Deleted",
        description: "The niche category has been successfully deleted.",
      });
      setShowDeleteConfirm(false);
      setNicheToDelete(null);
    },
    onError: (error: Error) => {
      setErrorDialog({
        open: true,
        title: "Error",
        description: "Failed to delete niche",
        errorDetails: error.message,
      });
    },
  });

  const reorderNichesMutation = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const response = await fetch("/api/admin/niches/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ orderedIds }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || "Failed to reorder niches");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/niches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/niches"] });
      toast({
        title: "Order Updated",
        description: "Niche display order has been updated.",
      });
    },
    onError: (error: Error) => {
      setErrorDialog({
        open: true,
        title: "Error",
        description: "Failed to reorder niches",
        errorDetails: error.message,
      });
    },
  });

  const setPrimaryMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/admin/niches/${id}/set-primary`, {
        method: "PUT",
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || "Failed to set primary niche");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/niches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/niches"] });
      toast({
        title: "Primary Niche Updated",
        description: "The primary niche has been set successfully.",
      });
    },
    onError: (error: Error) => {
      setErrorDialog({
        open: true,
        title: "Error",
        description: "Failed to set primary niche",
        errorDetails: error.message,
      });
    },
  });

  const mergeNichesMutation = useMutation({
    mutationFn: async ({ sourceId, targetId }: { sourceId: string; targetId: string }) => {
      const response = await fetch("/api/admin/niches/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sourceId, targetId }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || "Failed to merge niches");
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/niches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/niches"] });
      toast({
        title: "Niches Merged",
        description: `Successfully merged niches. Updated ${data.updatedOffers} offers and ${data.updatedCreators} creator profiles.`,
      });
      handleCloseMergeDialog();
    },
    onError: (error: Error) => {
      setErrorDialog({
        open: true,
        title: "Error",
        description: "Failed to merge niches",
        errorDetails: error.message,
      });
    },
  });

  const handleCreate = () => {
    setEditingNiche(null);
    setName("");
    setDescription("");
    setIsActive(true);
    setShowDialog(true);
  };

  const handleEdit = (niche: Niche) => {
    setEditingNiche(niche);
    setName(niche.name);
    setDescription(niche.description || "");
    setIsActive(niche.isActive !== false);
    setShowDialog(true);
  };

  const handleDelete = (id: string) => {
    setNicheToDelete(id);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    if (nicheToDelete) {
      deleteNicheMutation.mutate(nicheToDelete);
    }
  };

  const handleSubmit = () => {
    if (!name.trim()) {
      setErrorDialog({
        open: true,
        title: "Error",
        description: "Niche name is required",
      });
      return;
    }

    if (editingNiche) {
      updateNicheMutation.mutate({
        id: editingNiche.id,
        data: { name, description, isActive },
      });
    } else {
      createNicheMutation.mutate({ name, description, isActive });
    }
  };

  const handleCloseDialog = () => {
    setShowDialog(false);
    setEditingNiche(null);
    setName("");
    setDescription("");
    setIsActive(true);
  };

  const handleCloseMergeDialog = () => {
    setShowMergeDialog(false);
    setSourceNiche("");
    setTargetNiche("");
  };

  const handleMerge = () => {
    if (!sourceNiche || !targetNiche) {
      setErrorDialog({
        open: true,
        title: "Error",
        description: "Please select both source and target niches",
      });
      return;
    }

    if (sourceNiche === targetNiche) {
      setErrorDialog({
        open: true,
        title: "Error",
        description: "Cannot merge a niche with itself",
      });
      return;
    }

    mergeNichesMutation.mutate({ sourceId: sourceNiche, targetId: targetNiche });
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const items = Array.from(niches);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Get the new order of IDs
    const orderedIds = items.map(item => item.id);
    reorderNichesMutation.mutate(orderedIds);
  };

  const handleSetPrimary = (id: string) => {
    setPrimaryMutation.mutate(id);
  };

  if (isLoading || nichesLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-lg">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== 'admin') {
    return null;
  }

  const activeCount = niches.filter(n => n.isActive !== false).length;
  const primaryNiche = niches.find(n => n.isPrimary);
  const sourceNicheData = niches.find(n => n.id === sourceNiche);
  const targetNicheData = niches.find(n => n.id === targetNiche);

  return (
    <div className="space-y-6">
      <TopNavBar />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Niche Categories</h1>
          <p className="text-muted-foreground mt-2">
            Manage niche categories for offers and creator profiles
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowMergeDialog(true)}>
            <Merge className="h-4 w-4 mr-2" />
            Merge Niches
          </Button>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Add Niche
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Niches</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{niches.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{activeCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Inactive</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-muted-foreground">
              {niches.length - activeCount}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Primary Niche</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold text-primary truncate">
              {primaryNiche?.name || "Not set"}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tags className="h-5 w-5" />
            All Niches
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Drag and drop rows to reorder niches. The order affects how niches appear in dropdowns.
          </p>
        </CardHeader>
        <CardContent>
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="niches">
              {(provided) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className="border rounded-md"
                >
                  {/* Table Header */}
                  <div className="grid grid-cols-[40px_1fr_2fr_100px_100px_150px] gap-4 p-4 border-b bg-muted/50 font-medium text-sm">
                    <div></div>
                    <div>Name</div>
                    <div>Description</div>
                    <div>Status</div>
                    <div>Primary</div>
                    <div className="text-right">Actions</div>
                  </div>

                  {niches.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      No niches found. Click "Add Niche" to create one.
                    </div>
                  ) : (
                    niches.map((niche, index) => (
                      <Draggable key={niche.id} draggableId={niche.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={`grid grid-cols-[40px_1fr_2fr_100px_100px_150px] gap-4 p-4 items-center border-b last:border-b-0 ${
                              snapshot.isDragging ? "bg-muted shadow-lg" : "hover:bg-muted/30"
                            }`}
                          >
                            <div
                              {...provided.dragHandleProps}
                              className="cursor-grab active:cursor-grabbing"
                            >
                              <GripVertical className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <div className="font-medium flex items-center gap-2">
                              {niche.name}
                              {niche.isPrimary && (
                                <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                              )}
                            </div>
                            <div className="text-muted-foreground truncate">
                              {niche.description || "No description"}
                            </div>
                            <div>
                              {niche.isActive !== false ? (
                                <Badge variant="default" className="bg-green-500">Active</Badge>
                              ) : (
                                <Badge variant="secondary">Inactive</Badge>
                              )}
                            </div>
                            <div>
                              {!niche.isPrimary ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleSetPrimary(niche.id)}
                                  disabled={setPrimaryMutation.isPending}
                                  className="text-xs"
                                >
                                  <Star className="h-3 w-3 mr-1" />
                                  Set
                                </Button>
                              ) : (
                                <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                                  <Star className="h-3 w-3 mr-1 fill-yellow-500" />
                                  Primary
                                </Badge>
                              )}
                            </div>
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEdit(niche)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(niche.id)}
                                disabled={deleteNicheMutation.isPending || niche.isPrimary}
                                title={niche.isPrimary ? "Cannot delete primary niche" : "Delete niche"}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))
                  )}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingNiche ? "Edit Niche Category" : "Create Niche Category"}
            </DialogTitle>
            <DialogDescription>
              {editingNiche
                ? "Update the details of this niche category."
                : "Add a new niche category for creators and offers."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Name *</label>
              <Input
                placeholder="e.g., Tech & Gadgets"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea
                placeholder="Brief description of this niche category..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="flex items-center justify-between space-x-2 pt-2">
              <div>
                <label className="text-sm font-medium">Active</label>
                <p className="text-xs text-muted-foreground">
                  Inactive niches won't appear in dropdowns
                </p>
              </div>
              <Switch
                checked={isActive}
                onCheckedChange={setIsActive}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createNicheMutation.isPending || updateNicheMutation.isPending}
            >
              {editingNiche ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Merge Niches Dialog */}
      <Dialog open={showMergeDialog} onOpenChange={setShowMergeDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Merge Niches</DialogTitle>
            <DialogDescription>
              Merge one niche into another. All offers and creator profiles using the source niche
              will be updated to use the target niche. The source niche will be deleted.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Source Niche (will be deleted)</label>
              <Select value={sourceNiche} onValueChange={setSourceNiche}>
                <SelectTrigger>
                  <SelectValue placeholder="Select niche to merge from" />
                </SelectTrigger>
                <SelectContent>
                  {niches
                    .filter(n => n.id !== targetNiche && !n.isPrimary)
                    .map((niche) => (
                      <SelectItem key={niche.id} value={niche.id}>
                        {niche.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {sourceNiche && (
                <p className="text-xs text-muted-foreground">
                  This niche will be deleted after merge
                </p>
              )}
            </div>

            {sourceNiche && targetNiche && (
              <div className="flex items-center justify-center gap-4 py-4">
                <div className="text-center">
                  <Badge variant="outline" className="mb-2">{sourceNicheData?.name}</Badge>
                  <p className="text-xs text-muted-foreground">Source</p>
                </div>
                <ArrowRight className="h-6 w-6 text-muted-foreground" />
                <div className="text-center">
                  <Badge variant="default" className="mb-2">{targetNicheData?.name}</Badge>
                  <p className="text-xs text-muted-foreground">Target</p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Target Niche (will remain)</label>
              <Select value={targetNiche} onValueChange={setTargetNiche}>
                <SelectTrigger>
                  <SelectValue placeholder="Select niche to merge into" />
                </SelectTrigger>
                <SelectContent>
                  {niches
                    .filter(n => n.id !== sourceNiche)
                    .map((niche) => (
                      <SelectItem key={niche.id} value={niche.id}>
                        {niche.name}
                        {niche.isPrimary && " (Primary)"}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {targetNiche && (
                <p className="text-xs text-muted-foreground">
                  All references will be updated to this niche
                </p>
              )}
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-900 rounded-md p-3">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>Warning:</strong> This action cannot be undone. All offers and creator profiles
                using the source niche will be permanently updated.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseMergeDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleMerge}
              disabled={mergeNichesMutation.isPending || !sourceNiche || !targetNiche}
              variant="destructive"
            >
              {mergeNichesMutation.isPending ? "Merging..." : "Merge Niches"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Niche Category</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this niche category? This action cannot be undone.
              Consider merging niches instead if there are existing offers or creator profiles using this niche.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setNicheToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
