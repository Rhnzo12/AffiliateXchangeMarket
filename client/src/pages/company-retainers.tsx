import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "../hooks/use-toast";
import { apiRequest, queryClient } from "../lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { GenericErrorDialog } from "../components/GenericErrorDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "../components/ui/form";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Switch } from "../components/ui/switch";
import { Checkbox } from "../components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Plus, DollarSign, Video, Calendar, Users, Eye, Filter, X, ChevronDown, ChevronUp } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "wouter";
import { TopNavBar } from "../components/TopNavBar";
import { ListSkeleton } from "../components/skeletons";
import { RadioGroup, RadioGroupItem } from "../components/ui/radio-group";

const retainerTierSchema = z.object({
  name: z.string().min(1, "Tier name is required"),
  monthlyAmount: z.string().min(1, "Monthly amount is required"),
  videosPerMonth: z.string().min(1, "Videos per month is required"),
  durationMonths: z.string().min(1, "Duration is required"),
});

const createRetainerSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters"),
  description: z.string().min(20, "Description must be at least 20 characters"),
  monthlyAmount: z.string().min(1, "Monthly amount is required"),
  videosPerMonth: z.string().min(1, "Videos per month is required"),
  durationMonths: z.string().min(1, "Duration is required"),
  requiredPlatform: z.string().min(1, "Platform is required"),
  platformAccountDetails: z.string().optional(),
  contentGuidelines: z.string().optional(),
  brandSafetyRequirements: z.string().optional(),
  minimumFollowers: z.string().optional(),
  niches: z.string().optional(),
  contentApprovalRequired: z.boolean().default(false),
  exclusivityRequired: z.boolean().default(false),
  minimumVideoLengthSeconds: z.string().optional(),
  postingSchedule: z.string().optional(),
  retainerTiers: z.array(retainerTierSchema).max(5).default([]),
});

type CreateRetainerForm = z.infer<typeof createRetainerSchema>;

export default function CompanyRetainers() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [isFilterCollapsed, setIsFilterCollapsed] = useState(false);
  const [errorDialog, setErrorDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    errorDetails?: string;
  }>({
    open: false,
    title: "",
    description: "",
    errorDetails: "",
  });

  const { data: contracts, isLoading } = useQuery<any[]>({
    queryKey: ["/api/company/retainer-contracts"],
  });

  const contractsList = contracts ?? [];

  const uniqueStatuses = useMemo(
    () => Array.from(new Set(contractsList.map((contract) => contract.status).filter(Boolean))),
    [contractsList]
  );

  const uniquePlatforms = useMemo(
    () => Array.from(new Set(contractsList.map((contract) => contract.requiredPlatform).filter(Boolean))),
    [contractsList]
  );

  const filteredContracts = useMemo(() => {
    return contractsList.filter((contract) => {
      const matchesSearch = searchTerm
        ? [contract.title, contract.description, contract.requiredPlatform, contract.niches?.join(", ")]
            .filter(Boolean)
            .some((value) => value.toLowerCase().includes(searchTerm.toLowerCase()))
        : true;
      const matchesStatus = statusFilter === "all" || contract.status === statusFilter;
      const matchesPlatform = platformFilter === "all" || contract.requiredPlatform === platformFilter;

      return matchesSearch && matchesStatus && matchesPlatform;
    });
  }, [contractsList, platformFilter, searchTerm, statusFilter]);

  const hasActiveFilters =
    searchTerm.trim().length > 0 || statusFilter !== "all" || platformFilter !== "all";

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setPlatformFilter("all");
  };

  const form = useForm<CreateRetainerForm>({
    resolver: zodResolver(createRetainerSchema),
    defaultValues: {
      title: "",
      description: "",
      monthlyAmount: "",
      videosPerMonth: "",
      durationMonths: "3",
      requiredPlatform: "",
      platformAccountDetails: "",
      contentGuidelines: "",
      brandSafetyRequirements: "",
      minimumFollowers: "",
      niches: "",
      contentApprovalRequired: false,
      exclusivityRequired: false,
      minimumVideoLengthSeconds: "",
      postingSchedule: "",
      retainerTiers: [
        { name: "Bronze", monthlyAmount: "500", videosPerMonth: "12", durationMonths: "3" },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "retainerTiers",
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateRetainerForm) => {
      const payload = {
        ...data,
        monthlyAmount: parseFloat(data.monthlyAmount),
        videosPerMonth: parseInt(data.videosPerMonth),
        durationMonths: parseInt(data.durationMonths),
        minimumFollowers: data.minimumFollowers ? parseInt(data.minimumFollowers) : undefined,
        niches: data.niches ? data.niches.split(",").map((n) => n.trim()).filter(Boolean) : [],
        minimumVideoLengthSeconds: data.minimumVideoLengthSeconds
          ? parseInt(data.minimumVideoLengthSeconds)
          : undefined,
        retainerTiers: (data.retainerTiers || []).map((tier) => ({
          name: tier.name,
          monthlyAmount: parseFloat(tier.monthlyAmount),
          videosPerMonth: parseInt(tier.videosPerMonth),
          durationMonths: parseInt(tier.durationMonths),
        })),
      };
      return await apiRequest("POST", "/api/company/retainer-contracts", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company/retainer-contracts"] });
      toast({
        title: "Retainer Contract Created",
        description: "Your monthly retainer contract has been posted successfully.",
      });
      setOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data || error?.message || "Failed to create retainer contract";
      setErrorDialog({
        open: true,
        title: "Error Creating Contract",
        description: "We encountered an issue while creating your retainer contract. Please try again.",
        errorDetails: String(errorMessage),
      });
    },
  });

  const onSubmit = (data: CreateRetainerForm) => {
    createMutation.mutate(data);
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "open":
        return "default";
      case "in_progress":
        return "secondary";
      case "completed":
        return "outline";
      case "cancelled":
        return "destructive";
      default:
        return "secondary";
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <TopNavBar />
        <div>
          <h1 className="text-3xl font-bold">Monthly Retainers</h1>
          <p className="text-muted-foreground">Hire creators for ongoing monthly video production</p>
        </div>
        <ListSkeleton count={3} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <TopNavBar />
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold" data-testid="heading-company-retainers">
            Monthly Retainers
          </h1>
          <p className="text-muted-foreground">
            Hire creators for ongoing monthly video production
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-retainer">
              <Plus className="h-4 w-4 mr-2" />
              Create Retainer
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Monthly Retainer Contract</DialogTitle>
              <DialogDescription>
                Post a monthly retainer for creators to produce a fixed number of videos
                on brand new accounts for your brand
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contract Title</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., TikTok Lifestyle Content - 30 Videos/Month"
                          data-testid="input-retainer-title"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe the type of content, brand voice, target audience, etc."
                          rows={4}
                          data-testid="input-retainer-description"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="monthlyAmount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Monthly Payment ($)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="5000.00"
                            data-testid="input-retainer-amount"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="videosPerMonth"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Videos Per Month</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="30-50"
                            data-testid="input-retainer-videos"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription className="text-xs">
                          Typically 30-50 videos per month
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="durationMonths"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contract Duration (Months)</FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            value={field.value || "3"}
                            className="grid grid-cols-2 gap-2"
                          >
                            {["1", "3", "6", "12"].map((value) => (
                              <label
                                key={value}
                                className={`flex items-center gap-2 rounded-md border p-3 cursor-pointer transition-all ${
                                  field.value === value
                                    ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                                    : "hover:border-primary hover:bg-accent"
                                }`}
                              >
                                <RadioGroupItem value={value} />
                                <span className={`font-medium ${field.value === value ? "text-primary" : ""}`}>
                                  {value} month{value === "1" ? "" : "s"}
                                </span>
                              </label>
                            ))}
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="requiredPlatform"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Required Platform</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-retainer-platform">
                              <SelectValue placeholder="Select platform" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="TikTok">TikTok</SelectItem>
                            <SelectItem value="Instagram">Instagram Reels</SelectItem>
                            <SelectItem value="YouTube Shorts">YouTube Shorts</SelectItem>
                            <SelectItem value="Facebook Reels">Facebook Reels</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="platformAccountDetails"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Platform Account Details (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="e.g., Creator will be given access to @brandname account, or creator should create brand new account"
                          rows={2}
                          data-testid="input-platform-details"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="contentGuidelines"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Content Guidelines (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Specific content requirements, posting schedule, editing style, etc."
                          rows={3}
                          data-testid="input-content-guidelines"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                    )}
                  />

                <FormField
                  control={form.control}
                  name="brandSafetyRequirements"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Brand Safety Requirements (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Topics to avoid, brand safety guidelines, compliance requirements, etc."
                          rows={2}
                          data-testid="input-brand-safety"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                    )}
                  />

                <div className="grid sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="minimumVideoLengthSeconds"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Minimum Video Length (seconds)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="45"
                            data-testid="input-minimum-video-length"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription className="text-xs">
                          Set expectations like 45-60 seconds per video
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="postingSchedule"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Posting Schedule</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., 1 video every weekday"
                            data-testid="input-posting-schedule"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription className="text-xs">
                          Outline cadence expectations for creators
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="contentApprovalRequired"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-1">
                          <FormLabel className="text-base">Content approval required</FormLabel>
                          <FormDescription>Review videos before they go live</FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="switch-content-approval"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="exclusivityRequired"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-1">
                          <FormLabel className="text-base">Exclusivity</FormLabel>
                          <FormDescription>Prevent creators from working with competitors</FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="switch-exclusivity"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="minimumFollowers"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Minimum Followers (Optional)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="10000"
                            data-testid="input-min-followers"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="niches"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Niches (Optional)</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Fashion, Lifestyle, Beauty"
                            data-testid="input-niches"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription className="text-xs">
                          Comma-separated
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-3 rounded-lg border p-4 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <div>
                      <FormLabel className="text-base">Tiered Retainer Packages (up to 5)</FormLabel>
                      <p className="text-sm text-muted-foreground">
                        Offer creators predictable options like Bronze/Silver/Gold with clear deliverables.
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        append({
                          name: `Tier ${fields.length + 1}`,
                          monthlyAmount: "1000",
                          videosPerMonth: "20",
                          durationMonths: form.getValues("durationMonths") || "3",
                        })
                      }
                      disabled={fields.length >= 5}
                      data-testid="button-add-tier"
                    >
                      <Plus className="h-4 w-4 mr-1" /> Add tier
                    </Button>
                  </div>

                  <div className="grid gap-3">
                    <div className="grid md:grid-cols-5 gap-3 text-xs font-semibold text-muted-foreground px-1 uppercase tracking-wide">
                      <span>Tier name</span>
                      <span>Monthly amount</span>
                      <span>Videos per month</span>
                      <span>Duration</span>
                      <span className="text-right">$ / video</span>
                    </div>
                    {fields.map((field, index) => {
                      const monthly = Number(form.watch(`retainerTiers.${index}.monthlyAmount`) || 0);
                      const videos = Math.max(1, Number(form.watch(`retainerTiers.${index}.videosPerMonth`) || 1));
                      const perVideo = (monthly / videos).toFixed(2);

                      return (
                        <div
                          key={field.id}
                          className="grid md:grid-cols-5 gap-3 items-center rounded-md border bg-background p-3"
                        >
                          <Input
                            placeholder="Tier name"
                            {...form.register(`retainerTiers.${index}.name` as const)}
                          />
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="Monthly $"
                            {...form.register(`retainerTiers.${index}.monthlyAmount` as const)}
                          />
                          <Input
                            type="number"
                            min="1"
                            placeholder="Videos/mo"
                            {...form.register(`retainerTiers.${index}.videosPerMonth` as const)}
                          />
                          <Input
                            type="number"
                            min="1"
                            placeholder="Months"
                            {...form.register(`retainerTiers.${index}.durationMonths` as const)}
                          />
                          <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
                            <div className="rounded-md bg-primary/5 px-3 py-2 text-primary font-semibold">
                              ${perVideo}/video
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => remove(index)}
                              disabled={fields.length === 1}
                              data-testid={`button-remove-tier-${index}`}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending}
                    data-testid="button-submit-retainer"
                  >
                    {createMutation.isPending ? "Creating..." : "Create Retainer"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-card-border">
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Filter className="h-4 w-4" />
              <span className="text-sm font-semibold uppercase tracking-widest">Search & Filter</span>
            </div>
            <div className="sm:ml-auto text-sm text-muted-foreground">
              Showing <span className="font-semibold text-foreground">{filteredContracts.length}</span> of {contractsList.length}
              {` contract${contractsList.length === 1 ? "" : "s"}`}
            </div>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" className="text-xs sm:ml-4" onClick={clearFilters}>
                <X className="h-3 w-3 mr-1" />
                Reset
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsFilterCollapsed(!isFilterCollapsed)}
              aria-label="Toggle filter visibility"
              data-testid="button-toggle-filter"
              className="sm:ml-2"
            >
              {isFilterCollapsed ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />}
            </Button>
          </div>

          {!isFilterCollapsed && (
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Search</label>
              <Input
                placeholder="Search contracts or niches"
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
                  <SelectItem value="all">All Statuses</SelectItem>
                  {uniqueStatuses.map((status) => (
                    <SelectItem key={status} value={status} className="capitalize">
                      {status.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Platform</label>
              <Select value={platformFilter} onValueChange={setPlatformFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All platforms" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Platforms</SelectItem>
                  {uniquePlatforms.map((platform) => (
                    <SelectItem key={platform} value={platform}>
                      {platform}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          )}
        </CardContent>
      </Card>

      {contractsList.length === 0 ? (
        <Card className="border-card-border">
          <CardContent className="p-12 text-center">
            <DollarSign className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="font-semibold mb-2">No Retainer Contracts</h3>
            <p className="text-muted-foreground mb-4">
              Create your first monthly retainer contract to hire creators for ongoing video production
            </p>
            <Button onClick={() => setOpen(true)} data-testid="button-create-first-retainer">
              <Plus className="h-4 w-4 mr-2" />
              Create Retainer
            </Button>
          </CardContent>
        </Card>
      ) : filteredContracts.length === 0 ? (
        <Card className="border-card-border">
          <CardContent className="p-10 text-center space-y-2">
            <Calendar className="h-10 w-10 mx-auto text-muted-foreground/40" />
            <h3 className="text-lg font-semibold">No contracts match your filters</h3>
            <p className="text-sm text-muted-foreground">Try refining your search or clearing the filters.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {filteredContracts.map((contract: any) => (
            <Card
              key={contract.id}
              className="group hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border-card-border cursor-pointer ring-2 ring-primary/30 hover:ring-primary/50 hover:shadow-primary/20"
              data-testid={`retainer-card-${contract.id}`}
            >
              <CardHeader className="pb-4">
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <CardTitle className="text-xl" data-testid={`text-retainer-title-${contract.id}`}>
                          {contract.title}
                        </CardTitle>
                        <Badge variant={getStatusBadgeVariant(contract.status)}>
                          {contract.status.replace("_", " ")}
                        </Badge>
                      </div>
                    </div>
                    <Link href={`/company/retainers/${contract.id}`}>
                      <Button
                        variant="outline"
                        className="group/btn hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all duration-200 font-medium shrink-0"
                        data-testid={`button-view-retainer-${contract.id}`}
                      >
                        <Eye className="h-4 w-4 mr-2 group-hover/btn:scale-110 transition-transform duration-200" />
                        View Details
                      </Button>
                    </Link>
                  </div>
                  <p className="text-muted-foreground line-clamp-2 leading-relaxed">
                    {contract.description}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {contract.contentApprovalRequired && (
                      <Badge variant="secondary">Approval required</Badge>
                    )}
                    {contract.exclusivityRequired && (
                      <Badge className="bg-primary/10 text-primary" variant="outline">
                        Exclusivity
                      </Badge>
                    )}
                    {contract.minimumVideoLengthSeconds && (
                      <Badge variant="outline">
                        Min length: {contract.minimumVideoLengthSeconds}s
                      </Badge>
                    )}
                    {contract.postingSchedule && (
                      <Badge variant="outline">{contract.postingSchedule}</Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-primary/5 transition-colors duration-200">
                    <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300">
                      <DollarSign className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Monthly Payment</p>
                      <p className="font-semibold">${parseFloat(contract.monthlyAmount).toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-primary/5 transition-colors duration-200">
                    <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300">
                      <Video className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Videos/Month</p>
                      <p className="font-semibold">{contract.videosPerMonth}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-primary/5 transition-colors duration-200">
                    <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300">
                      <Calendar className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Duration</p>
                      <p className="font-semibold">{contract.durationMonths} months</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-primary/5 transition-colors duration-200">
                    <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Platform</p>
                      <p className="font-semibold">{contract.requiredPlatform}</p>
                    </div>
                  </div>
                </div>

                {Array.isArray(contract.retainerTiers) && contract.retainerTiers.length > 0 && (
                  <div className="mt-4 pt-4 border-t space-y-3">
                    <p className="text-sm font-semibold">Tiered packages</p>
                    <div className="grid md:grid-cols-3 gap-3">
                      {contract.retainerTiers.map((tier: any, tierIndex: number) => (
                        <div
                          key={`${contract.id}-tier-${tierIndex}`}
                          className="rounded-lg border p-3 bg-muted/30"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold">{tier.name}</span>
                            <Badge variant="outline">${tier.monthlyAmount?.toLocaleString?.() || tier.monthlyAmount}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {tier.videosPerMonth} videos / {tier.durationMonths} month{tier.durationMonths === 1 ? "" : "s"}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {contract.applicationCount > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-sm text-muted-foreground">
                      <strong>{contract.applicationCount}</strong> creator{contract.applicationCount === 1 ? "" : "s"} applied
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

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
