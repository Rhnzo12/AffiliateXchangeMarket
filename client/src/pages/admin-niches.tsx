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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { Plus, Pencil, Trash2, Tags } from "lucide-react";
import { TopNavBar } from "../components/TopNavBar";
import { GenericErrorDialog } from "../components/GenericErrorDialog";

export default function AdminNiches() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const [editingNiche, setEditingNiche] = useState<any | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [errorDialog, setErrorDialog] = useState<{ open: boolean; title: string; description: string; errorDetails?: string }>({
    open: false,
    title: "",
    description: ""
  });

  const { data: niches = [], isLoading: nichesLoading } = useQuery<any[]>({
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

  const handleCreate = () => {
    setEditingNiche(null);
    setName("");
    setDescription("");
    setIsActive(true);
    setShowDialog(true);
  };

  const handleEdit = (niche: any) => {
    setEditingNiche(niche);
    setName(niche.name);
    setDescription(niche.description || "");
    setIsActive(niche.isActive !== false);
    setShowDialog(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this niche category? This action cannot be undone.")) {
      deleteNicheMutation.mutate(id);
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
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Add Niche
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
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
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tags className="h-5 w-5" />
            All Niches
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {niches.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    No niches found. Click "Add Niche" to create one.
                  </TableCell>
                </TableRow>
              ) : (
                niches.map((niche) => (
                  <TableRow key={niche.id}>
                    <TableCell className="font-medium">{niche.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {niche.description || "No description"}
                    </TableCell>
                    <TableCell>
                      {niche.isActive !== false ? (
                        <Badge variant="default" className="bg-green-500">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
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
                          disabled={deleteNicheMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
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
