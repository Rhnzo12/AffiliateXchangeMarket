import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { useToast } from "../hooks/use-toast";
import { queryClient, apiRequest } from "../lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Badge } from "../components/ui/badge";
import { Switch } from "../components/ui/switch";
import { TopNavBar } from "../components/TopNavBar";
import { GenericErrorDialog } from "../components/GenericErrorDialog";
import { SettingsNavigation, SettingsSection } from "../components/SettingsNavigation";
import { Settings, DollarSign, Gauge, Tag, ToggleRight, Check, X, Plus, Trash2 } from "lucide-react";

interface NicheItem {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
}

// Helper to check if a value is JSON
const isJsonValue = (value: string): boolean => {
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null;
  } catch {
    return false;
  }
};

// Helper to render JSON values in a user-friendly way
const renderJsonValue = (key: string, value: string): React.ReactNode => {
  try {
    const parsed = JSON.parse(value);

    // Special handling for niches
    if (key === "niches" && Array.isArray(parsed)) {
      const niches = parsed as NicheItem[];
      return (
        <div className="mt-2 space-y-2">
          <div className="text-sm text-muted-foreground mb-2">
            {niches.length} niches configured
          </div>
          <div className="flex flex-wrap gap-2">
            {niches.map((niche) => (
              <div
                key={niche.id}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border ${
                  niche.isActive
                    ? "bg-green-50 border-green-200 text-green-700"
                    : "bg-gray-50 border-gray-200 text-gray-500"
                }`}
                title={niche.description}
              >
                {niche.isActive ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <X className="h-3 w-3" />
                )}
                {niche.name}
              </div>
            ))}
          </div>
        </div>
      );
    }

    // Generic array handling
    if (Array.isArray(parsed)) {
      return (
        <div className="mt-2 flex flex-wrap gap-1">
          {parsed.map((item, index) => (
            <Badge key={index} variant="secondary" className="text-xs">
              {typeof item === "object" ? item.name || JSON.stringify(item) : String(item)}
            </Badge>
          ))}
        </div>
      );
    }

    // Generic object handling
    if (typeof parsed === "object") {
      return (
        <div className="mt-2 space-y-1 text-sm">
          {Object.entries(parsed).map(([k, v]) => (
            <div key={k} className="flex items-center gap-2">
              <span className="font-medium text-muted-foreground">{k}:</span>
              <span className="font-mono bg-gray-100 px-1 rounded">{String(v)}</span>
            </div>
          ))}
        </div>
      );
    }

    return null;
  } catch {
    return null;
  }
};

interface PlatformSetting {
  id: string;
  key: string;
  value: string;
  description: string | null;
  category: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function AdminPlatformSettings() {
  const { toast } = useToast();
  const [editingSetting, setEditingSetting] = useState<PlatformSetting | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editReason, setEditReason] = useState("");
  const [editingNiches, setEditingNiches] = useState<NicheItem[]>([]);
  const [errorDialog, setErrorDialog] = useState<{
    open: boolean;
    title?: string;
    description?: string;
    errorDetails?: string;
  }>({ open: false });

  const { data: settings, isLoading } = useQuery<PlatformSetting[]>({
    queryKey: ["/api/admin/settings"],
    queryFn: async () => {
      const response = await fetch("/api/admin/settings", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch platform settings");
      return response.json();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ key, value, reason }: { key: string; value: string; reason: string }) => {
      return await apiRequest("PUT", `/api/admin/settings/${key}`, { value, reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      toast({
        title: "Success",
        description: "Setting updated successfully",
      });
      setEditingSetting(null);
      setEditValue("");
      setEditReason("");
    },
    onError: (error: Error) => {
      setErrorDialog({
        open: true,
        title: "Error",
        description: error.message || "Failed to update setting",
      });
    },
  });

  const handleEdit = (setting: PlatformSetting) => {
    setEditingSetting(setting);
    setEditValue(setting.value);
    setEditReason("");

    // Parse niches for user-friendly editing
    if (setting.key === "niches") {
      try {
        const parsed = JSON.parse(setting.value);
        if (Array.isArray(parsed)) {
          setEditingNiches(parsed as NicheItem[]);
        }
      } catch {
        setEditingNiches([]);
      }
    } else {
      setEditingNiches([]);
    }
  };

  // Niches editing helpers
  const updateNiche = (id: string, field: keyof NicheItem, value: string | boolean) => {
    setEditingNiches(prev =>
      prev.map(niche =>
        niche.id === id ? { ...niche, [field]: value } : niche
      )
    );
  };

  const addNiche = () => {
    const newId = String(Math.max(...editingNiches.map(n => parseInt(n.id) || 0), 0) + 1);
    setEditingNiches(prev => [
      ...prev,
      { id: newId, name: "", description: "", isActive: true }
    ]);
  };

  const removeNiche = (id: string) => {
    setEditingNiches(prev => prev.filter(niche => niche.id !== id));
  };

  const handleSave = () => {
    if (!editingSetting) return;
    if (!editReason.trim()) {
      setErrorDialog({
        open: true,
        title: "Error",
        description: "Please provide a reason for this change",
      });
      return;
    }

    // For niches, convert the editingNiches array back to JSON
    let valueToSave = editValue;
    if (editingSetting.key === "niches") {
      // Validate niches have required fields
      const invalidNiches = editingNiches.filter(n => !n.name.trim());
      if (invalidNiches.length > 0) {
        setErrorDialog({
          open: true,
          title: "Error",
          description: "All niches must have a name",
        });
        return;
      }
      valueToSave = JSON.stringify(editingNiches);
    }

    updateMutation.mutate({
      key: editingSetting.key,
      value: valueToSave,
      reason: editReason,
    });
  };

  const handleToggle = (setting: PlatformSetting, checked: boolean) => {
    setEditingSetting(setting);
    setEditValue(checked ? "true" : "false");
    // For toggles, we'll use a default reason
    updateMutation.mutate({
      key: setting.key,
      value: checked ? "true" : "false",
      reason: `Toggled ${setting.key} to ${checked ? "enabled" : "disabled"}`,
    });
  };

  // Filter out "fees" category - those settings are managed in Payment Settings
  const groupedSettings = settings?.reduce((acc, setting) => {
    const category = setting.category || "general";
    // Skip fees category - managed in Payment Management > Payment Settings
    if (category === "fees") return acc;
    if (!acc[category]) acc[category] = [];
    acc[category].push(setting);
    return acc;
  }, {} as Record<string, PlatformSetting[]>);

  const getCategoryTitle = (category: string) => {
    const titles: Record<string, string> = {
      general: "General Settings",
      fees: "Fee Configuration",
      limits: "Platform Limits",
      pricing: "Pricing",
      features: "Features",
    };
    return titles[category] || category.charAt(0).toUpperCase() + category.slice(1);
  };

  const getCategoryDescription = (category: string) => {
    const descriptions: Record<string, string> = {
      general: "General platform configuration and operational settings",
      fees: "Transaction fees, commission rates, and payout thresholds",
      limits: "Platform-wide limits and restrictions",
      pricing: "Pricing configuration for premium features and services",
      features: "Feature toggles and configuration options",
    };
    return descriptions[category] || "";
  };

  const isBooleanSetting = (key: string) => {
    return key.includes("mode") || key.includes("enabled") || key.includes("disabled");
  };

  // Define navigation sections based on grouped settings
  const adminSettingsSections: SettingsSection[] = useMemo(() => {
    if (!groupedSettings) return [];

    const categoryIcons: Record<string, React.ReactNode> = {
      general: <Settings className="h-4 w-4" />,
      fees: <DollarSign className="h-4 w-4" />,
      limits: <Gauge className="h-4 w-4" />,
      pricing: <Tag className="h-4 w-4" />,
      features: <ToggleRight className="h-4 w-4" />,
    };

    return Object.keys(groupedSettings).map((category) => ({
      id: `admin-${category}`,
      label: getCategoryTitle(category),
      icon: categoryIcons[category] || <Settings className="h-4 w-4" />,
    }));
  }, [groupedSettings]);

  return (
    <div className="min-h-screen bg-background">
      <TopNavBar />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:pl-2 lg:pr-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Platform Settings</h1>
          <p className="text-muted-foreground mt-1">
            Configure platform-wide settings and policies
          </p>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            Loading settings...
          </div>
        ) : !groupedSettings || Object.keys(groupedSettings).length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No settings found
          </div>
        ) : (
          <div className="flex gap-6">
            <SettingsNavigation sections={adminSettingsSections} />

            <div className="flex-1 space-y-6 min-w-0 max-w-4xl">
              {Object.entries(groupedSettings).map(([category, categorySettings]) => (
                <Card key={category} id={`admin-${category}`} className="scroll-mt-24">
                  <CardHeader>
                    <CardTitle>{getCategoryTitle(category)}</CardTitle>
                    <CardDescription>{getCategoryDescription(category)}</CardDescription>
                  </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {categorySettings.map((setting) => (
                    <div
                      key={setting.key}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{setting.key}</h3>
                          <Badge variant="outline" className="text-xs">
                            {setting.category || "general"}
                          </Badge>
                        </div>
                        {setting.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {setting.description}
                          </p>
                        )}
                        <div className="mt-2">
                          {isBooleanSetting(setting.key) ? (
                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">
                                  Current: {setting.value === "true" ? "Enabled" : "Disabled"}
                                </span>
                                <Switch
                                  checked={setting.value === "true"}
                                  onCheckedChange={(checked) => handleToggle(setting, checked)}
                                  disabled={updateMutation.isPending}
                                />
                              </div>
                              <span className="text-xs text-muted-foreground">
                                Updated: {new Date(setting.updatedAt).toLocaleString()}
                              </span>
                            </div>
                          ) : isJsonValue(setting.value) ? (
                            <div>
                              {renderJsonValue(setting.key, setting.value)}
                              <span className="text-xs text-muted-foreground block mt-2">
                                Updated: {new Date(setting.updatedAt).toLocaleString()}
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-4">
                              <span className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                                {setting.value}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                Updated: {new Date(setting.updatedAt).toLocaleString()}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      {!isBooleanSetting(setting.key) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(setting)}
                          disabled={updateMutation.isPending}
                        >
                          Edit
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Edit Dialog */}
      <Dialog open={!!editingSetting && !isBooleanSetting(editingSetting?.key || "")} onOpenChange={(open) => !open && setEditingSetting(null)}>
        <DialogContent className={editingSetting?.key === "niches" ? "max-w-3xl max-h-[90vh] overflow-y-auto" : ""}>
          <DialogHeader>
            <DialogTitle>Edit Setting: {editingSetting?.key}</DialogTitle>
            <DialogDescription>
              {editingSetting?.description || "Update this platform setting"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Niches Editor */}
            {editingSetting?.key === "niches" ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Niches ({editingNiches.length})</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addNiche}
                    className="gap-1"
                  >
                    <Plus className="h-4 w-4" />
                    Add Niche
                  </Button>
                </div>
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                  {editingNiches.map((niche) => (
                    <div
                      key={niche.id}
                      className="flex items-start gap-3 p-3 border rounded-lg bg-gray-50"
                    >
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <Input
                            value={niche.name}
                            onChange={(e) => updateNiche(niche.id, "name", e.target.value)}
                            placeholder="Niche name..."
                            className="font-medium"
                          />
                          <div className="flex items-center gap-2 shrink-0">
                            <Switch
                              checked={niche.isActive}
                              onCheckedChange={(checked) => updateNiche(niche.id, "isActive", checked)}
                            />
                            <span className={`text-xs ${niche.isActive ? "text-green-600" : "text-gray-400"}`}>
                              {niche.isActive ? "Active" : "Inactive"}
                            </span>
                          </div>
                        </div>
                        <Input
                          value={niche.description}
                          onChange={(e) => updateNiche(niche.id, "description", e.target.value)}
                          placeholder="Description..."
                          className="text-sm"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeNiche(niche.id)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {editingNiches.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground border rounded-lg border-dashed">
                      No niches configured. Click "Add Niche" to create one.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="value">Value</Label>
                {editingSetting && isJsonValue(editingSetting.value) ? (
                  <Textarea
                    id="value"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    placeholder="Enter JSON value..."
                    className="min-h-[200px] font-mono text-sm"
                  />
                ) : (
                  <Input
                    id="value"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    placeholder="Enter new value..."
                  />
                )}
                {editingSetting && isJsonValue(editingSetting.value) && (
                  <p className="text-xs text-muted-foreground">
                    Editing JSON value. Make sure to maintain valid JSON format.
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="reason">
                Reason for Change <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="reason"
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                placeholder="Why are you making this change? (Required for audit trail)"
                className="min-h-[80px]"
              />
              <p className="text-xs text-muted-foreground">
                This will be logged in the audit trail
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditingSetting(null)}
              disabled={updateMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={updateMutation.isPending || !editReason.trim()}
            >
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

        <GenericErrorDialog
          open={errorDialog.open}
          onOpenChange={(open) => setErrorDialog({ open })}
          title={errorDialog.title}
          description={errorDialog.description}
          errorDetails={errorDialog.errorDetails}
          variant="error"
        />
      </div>
    </div>
  );
}
