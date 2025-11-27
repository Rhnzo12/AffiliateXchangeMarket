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
import { Settings, DollarSign, Gauge } from "lucide-react";

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

    updateMutation.mutate({
      key: editingSetting.key,
      value: editValue,
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

  const groupedSettings = settings?.reduce((acc, setting) => {
    const category = setting.category || "general";
    if (!acc[category]) acc[category] = [];
    acc[category].push(setting);
    return acc;
  }, {} as Record<string, PlatformSetting[]>);

  const getCategoryTitle = (category: string) => {
    const titles: Record<string, string> = {
      general: "General Settings",
      fees: "Fee Configuration",
      limits: "Platform Limits",
    };
    return titles[category] || category.charAt(0).toUpperCase() + category.slice(1);
  };

  const getCategoryDescription = (category: string) => {
    const descriptions: Record<string, string> = {
      general: "General platform configuration and operational settings",
      fees: "Transaction fees, commission rates, and payout thresholds",
      limits: "Platform-wide limits and restrictions",
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
                        <div className="flex items-center gap-4 mt-2">
                          {isBooleanSetting(setting.key) ? (
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
                          ) : (
                            <span className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                              {setting.value}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">
                            Updated: {new Date(setting.updatedAt).toLocaleString()}
                          </span>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Setting: {editingSetting?.key}</DialogTitle>
            <DialogDescription>
              {editingSetting?.description || "Update this platform setting"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="value">Value</Label>
              <Input
                id="value"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                placeholder="Enter new value..."
              />
              <p className="text-xs text-muted-foreground">
                Current value: <span className="font-mono">{editingSetting?.value}</span>
              </p>
            </div>

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
