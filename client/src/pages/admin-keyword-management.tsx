import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "../lib/queryClient";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Badge } from "../components/ui/badge";
import { Switch } from "../components/ui/switch";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Plus, Pencil, Trash2, ShieldAlert, Filter, X, AlertTriangle } from "lucide-react";
import { TopNavBar } from "../components/TopNavBar";
import { GenericErrorDialog } from "../components/GenericErrorDialog";

type BannedKeyword = {
  id: string;
  keyword: string;
  category: 'profanity' | 'spam' | 'legal' | 'harassment' | 'custom';
  isActive: boolean;
  severity: number;
  description: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export default function AdminKeywordManagement() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const [editingKeyword, setEditingKeyword] = useState<BannedKeyword | null>(null);
  const [keyword, setKeyword] = useState("");
  const [category, setCategory] = useState<BannedKeyword['category']>("custom");
  const [severity, setSeverity] = useState(1);
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
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

  const { data: keywords = [], isLoading: keywordsLoading } = useQuery<BannedKeyword[]>({
    queryKey: ["/api/admin/moderation/keywords"],
    enabled: isAuthenticated && user?.role === 'admin',
  });

  const filteredKeywords = useMemo(() => {
    return keywords.filter((kw) => {
      const matchesSearch = searchTerm
        ? kw.keyword.toLowerCase().includes(searchTerm.toLowerCase()) ||
          kw.description?.toLowerCase().includes(searchTerm.toLowerCase())
        : true;

      const matchesCategory = categoryFilter === "all" || kw.category === categoryFilter;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && kw.isActive) ||
        (statusFilter === "inactive" && !kw.isActive);

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [keywords, searchTerm, categoryFilter, statusFilter]);

  const hasActiveFilters =
    searchTerm.trim().length > 0 || categoryFilter !== "all" || statusFilter !== "all";

  const clearFilters = () => {
    setSearchTerm("");
    setCategoryFilter("all");
    setStatusFilter("all");
  };

  const createKeywordMutation = useMutation({
    mutationFn: async (data: {
      keyword: string;
      category: string;
      severity: number;
      description?: string;
      isActive: boolean;
    }) => {
      const response = await apiRequest("POST", "/api/admin/moderation/keywords", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/moderation/keywords"] });
      toast({
        title: "Keyword Added",
        description: "The banned keyword has been successfully added.",
      });
      handleCloseDialog();
    },
    onError: (error: Error) => {
      setErrorDialog({
        open: true,
        title: "Error",
        description: "Failed to add banned keyword",
        errorDetails: error.message,
      });
    },
  });

  const updateKeywordMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: {
        keyword: string;
        category: string;
        severity: number;
        description?: string;
        isActive: boolean;
      };
    }) => {
      const response = await apiRequest("PUT", `/api/admin/moderation/keywords/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/moderation/keywords"] });
      toast({
        title: "Keyword Updated",
        description: "The banned keyword has been successfully updated.",
      });
      handleCloseDialog();
    },
    onError: (error: Error) => {
      setErrorDialog({
        open: true,
        title: "Error",
        description: "Failed to update banned keyword",
        errorDetails: error.message,
      });
    },
  });

  const deleteKeywordMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/admin/moderation/keywords/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/moderation/keywords"] });
      toast({
        title: "Keyword Deleted",
        description: "The banned keyword has been successfully deleted.",
      });
    },
    onError: (error: Error) => {
      setErrorDialog({
        open: true,
        title: "Error",
        description: "Failed to delete banned keyword",
        errorDetails: error.message,
      });
    },
  });

  const toggleKeywordMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("PATCH", `/api/admin/moderation/keywords/${id}/toggle`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/moderation/keywords"] });
      toast({
        title: "Keyword Status Updated",
        description: "The keyword status has been toggled.",
      });
    },
    onError: (error: Error) => {
      setErrorDialog({
        open: true,
        title: "Error",
        description: "Failed to toggle keyword status",
        errorDetails: error.message,
      });
    },
  });

  const handleCreate = () => {
    setEditingKeyword(null);
    setKeyword("");
    setCategory("custom");
    setSeverity(1);
    setDescription("");
    setIsActive(true);
    setShowDialog(true);
  };

  const handleEdit = (kw: BannedKeyword) => {
    setEditingKeyword(kw);
    setKeyword(kw.keyword);
    setCategory(kw.category);
    setSeverity(kw.severity);
    setDescription(kw.description || "");
    setIsActive(kw.isActive);
    setShowDialog(true);
  };

  const handleDelete = (id: string) => {
    if (
      confirm(
        "Are you sure you want to delete this banned keyword? This action cannot be undone."
      )
    ) {
      deleteKeywordMutation.mutate(id);
    }
  };

  const handleSubmit = () => {
    if (!keyword.trim()) {
      setErrorDialog({
        open: true,
        title: "Error",
        description: "Keyword is required",
      });
      return;
    }

    const data = {
      keyword: keyword.trim(),
      category,
      severity,
      description: description.trim() || undefined,
      isActive,
    };

    if (editingKeyword) {
      updateKeywordMutation.mutate({
        id: editingKeyword.id,
        data,
      });
    } else {
      createKeywordMutation.mutate(data);
    }
  };

  const handleCloseDialog = () => {
    setShowDialog(false);
    setEditingKeyword(null);
    setKeyword("");
    setCategory("custom");
    setSeverity(1);
    setDescription("");
    setIsActive(true);
  };

  const getCategoryBadgeColor = (cat: string) => {
    switch (cat) {
      case "profanity":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      case "spam":
        return "bg-orange-500/10 text-orange-500 border-orange-500/20";
      case "legal":
        return "bg-purple-500/10 text-purple-500 border-purple-500/20";
      case "harassment":
        return "bg-pink-500/10 text-pink-500 border-pink-500/20";
      default:
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
    }
  };

  const getSeverityColor = (sev: number) => {
    if (sev >= 4) return "text-red-600 font-bold";
    if (sev >= 3) return "text-orange-600 font-semibold";
    return "text-muted-foreground";
  };

  if (isLoading || keywordsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-lg">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== 'admin') {
    return null;
  }

  const activeCount = keywords.filter((k) => k.isActive).length;
  const categoryCounts = keywords.reduce(
    (acc, kw) => {
      acc[kw.category] = (acc[kw.category] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="space-y-6">
      <TopNavBar />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Banned Keywords Management</h1>
          <p className="text-muted-foreground mt-2">
            Manage banned keywords for automatic content moderation
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Add Keyword
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Keywords</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{keywords.length}</div>
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
              {keywords.length - activeCount}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">High Severity (4-5)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">
              {keywords.filter((k) => k.severity >= 4).length}
            </div>
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
              Showing <span className="font-semibold text-foreground">{filteredKeywords.length}</span>{" "}
              of {keywords.length} {keywords.length === 1 ? "keyword" : "keywords"}
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
                placeholder="Search keywords or descriptions"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Category</label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="profanity">Profanity</SelectItem>
                  <SelectItem value="spam">Spam</SelectItem>
                  <SelectItem value="legal">Legal</SelectItem>
                  <SelectItem value="harassment">Harassment</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Keywords</SelectItem>
                  <SelectItem value="active">Active Only</SelectItem>
                  <SelectItem value="inactive">Inactive Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {filteredKeywords.length === 0 ? (
            <div className="text-center py-12">
              <ShieldAlert className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">
                {keywords.length === 0 ? "No banned keywords yet" : "No keywords match your filters"}
              </h3>
              <p className="text-muted-foreground">
                {keywords.length === 0
                  ? "Add keywords to automatically flag inappropriate content"
                  : "Try adjusting your search terms or resetting the selected filters"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Keyword</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-center">Severity</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredKeywords.map((kw) => (
                  <TableRow key={kw.id}>
                    <TableCell className="font-mono font-semibold">{kw.keyword}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getCategoryBadgeColor(kw.category)}>
                        {kw.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <span className={getSeverityColor(kw.severity)}>{kw.severity}</span>
                        {kw.severity >= 4 && <AlertTriangle className="h-3 w-3 text-red-600" />}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground text-sm">
                      {kw.description || "-"}
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={kw.isActive}
                        onCheckedChange={() => toggleKeywordMutation.mutate(kw.id)}
                        disabled={toggleKeywordMutation.isPending}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" variant="outline" onClick={() => handleEdit(kw)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDelete(kw.id)}
                          disabled={deleteKeywordMutation.isPending}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingKeyword ? "Edit Keyword" : "Add Banned Keyword"}</DialogTitle>
            <DialogDescription>
              {editingKeyword
                ? "Update the banned keyword settings"
                : "Add a new keyword to automatically flag inappropriate content"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="keyword">Keyword *</Label>
              <Input
                id="keyword"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="e.g., spam, scam, etc."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <Select value={category} onValueChange={(val) => setCategory(val as any)}>
                <SelectTrigger id="category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="profanity">Profanity</SelectItem>
                  <SelectItem value="spam">Spam</SelectItem>
                  <SelectItem value="legal">Legal</SelectItem>
                  <SelectItem value="harassment">Harassment</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="severity">
                Severity: <span className={getSeverityColor(severity)}>{severity}</span>
              </Label>
              <input
                type="range"
                id="severity"
                min="1"
                max="5"
                value={severity}
                onChange={(e) => setSeverity(parseInt(e.target.value))}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                1 = Low severity, 5 = Critical severity
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Why is this keyword banned?"
                rows={3}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="isActive"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
              <Label htmlFor="isActive">Active (keyword will be used in moderation)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createKeywordMutation.isPending || updateKeywordMutation.isPending}
            >
              {editingKeyword ? "Update" : "Add"} Keyword
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
