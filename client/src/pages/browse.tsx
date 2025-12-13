import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/use-toast";
import { useTutorial } from "../hooks/useTutorial";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Slider } from "../components/ui/slider";
import { Checkbox } from "../components/ui/checkbox";
import { Switch } from "../components/ui/switch";
import { ScrollArea } from "../components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "../components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { Search, SlidersHorizontal, TrendingUp, DollarSign, Clock, Star, Play, Heart, Users, Video, Calendar, Eye, Send, Bookmark, BookmarkPlus, RefreshCcw, Trash2, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { apiRequest, queryClient } from "../lib/queryClient";
import { proxiedSrc } from "../lib/image";
import { OfferCardSkeleton } from "../components/skeletons";
import { GenericErrorDialog } from "../components/GenericErrorDialog";
import { FirstTimeTutorial } from "../components/FirstTimeTutorial";
import { TUTORIAL_IDS, browsePageTutorialConfig } from "../lib/tutorialConfig";
import { useHeaderContent } from "../components/HeaderContentContext";
import { useCreatorPageTour } from "../components/CreatorTour";
import { CREATOR_TOUR_IDS, browseTourSteps } from "../lib/creatorTourConfig";

const COMMISSION_TYPES = [
  { value: "per_sale", label: "Per Sale" },
  { value: "per_lead", label: "Per Lead" },
  { value: "per_click", label: "Per Click" },
  { value: "monthly_retainer", label: "Monthly Retainer" },
  { value: "hybrid", label: "Hybrid" },
];

// Niche color mapping for badges
const NICHE_COLORS: Record<string, string> = {
  "Technology": "bg-blue-500/10 text-blue-600 border-blue-500/20",
  "Fashion": "bg-pink-500/10 text-pink-600 border-pink-500/20",
  "Beauty": "bg-purple-500/10 text-purple-600 border-purple-500/20",
  "Fitness": "bg-green-500/10 text-green-600 border-green-500/20",
  "Gaming": "bg-orange-500/10 text-orange-600 border-orange-500/20",
  "Travel": "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
  "Food": "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  "Lifestyle": "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
  "Business": "bg-gray-500/10 text-gray-600 border-gray-500/20",
  "Education": "bg-teal-500/10 text-teal-600 border-teal-500/20",
};

// Helper function to normalize niche/category strings so comparisons work regardless of
// whether we store the human readable name or a slugified version in the database.
const normalizeNicheValue = (value?: string | null): string => {
  if (!value) return "";
  return value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
};

// Helper function to format niche/category names for display
const formatNicheLabel = (value?: string | null): string => {
  if (!value) return "";

  const cleanedValue = value
    .toString()
    .replace(/_/g, " ")
    .replace(/\s*&\s*/g, " & ")
    .replace(/\s+/g, " ")
    .trim();

  return cleanedValue.replace(/\b\w/g, (char) => char.toUpperCase());
};

const getOfferNicheValues = (offer: any): string[] => {
  const primary = normalizeNicheValue(offer?.primaryNiche);
  const secondary = normalizeNicheValue(offer?.secondaryNiche);
  const additional = Array.isArray(offer?.additionalNiches)
    ? offer.additionalNiches.map((niche: string) => normalizeNicheValue(niche))
    : [];

  return Array.from(
    new Set([
      primary,
      secondary,
      ...additional,
    ].filter(Boolean)),
  );
};

// Helper function to format commission display
const getCommissionDisplay = (offer: any) => {
  if (offer?.commissionPercentage) {
    const numericPercentage = typeof offer.commissionPercentage === "string"
      ? parseFloat(offer.commissionPercentage.replace(/%/g, ""))
      : offer.commissionPercentage;

    const wholePercentage = Number.isFinite(numericPercentage)
      ? Math.round(numericPercentage)
      : offer.commissionPercentage;

    return { value: `${wholePercentage}%`, isCurrency: false };
  }
  if (offer?.commissionAmount) {
    return { value: offer.commissionAmount, isCurrency: true };
  }
  if (offer?.commissionRate) {
    return { value: offer.commissionRate, isCurrency: true };
  }
  return { value: 0, isCurrency: true };
};

// Helper function to get commission type label
const getCommissionTypeLabel = (offer: any) => {
  const type = COMMISSION_TYPES.find(t => t.value === offer.commissionType);
  return type?.label.toLowerCase() || "per sale";
};

// Helper function to get commission value for sorting
const getCommissionValue = (offer: any): number => {
  if (offer.commissionPercentage) return offer.commissionPercentage;
  if (offer.commissionAmount) return offer.commissionAmount;
  if (offer.commissionRate) return offer.commissionRate;
  return 0;
};

// Helper function to check if offer is priority (featured and not expired)
const isPriorityOffer = (offer: any): boolean => {
  if (!offer.featuredOnHomepage || !offer.priorityExpiresAt) {
    return false;
  }
  const now = new Date();
  const expiresAt = new Date(offer.priorityExpiresAt);
  return expiresAt > now;
};

// Helper function to get offer category badge
const getOfferCategory = (offer: any): { label: string; color: string } | null => {
  const commissionValue = getCommissionValue(offer);
  const createdDate = new Date(offer.createdAt);
  const daysSinceCreated = Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24));

  // Priority order for badges
  if (isPriorityOffer(offer)) {
    return { label: "PRIORITY", color: "bg-gradient-to-r from-yellow-500 to-orange-500" };
  }

  if (commissionValue >= 100) {
    return { label: "HIGH COMMISSION", color: "bg-gradient-to-r from-green-600 to-emerald-600" };
  }

  if (daysSinceCreated <= 7) {
    return { label: "NEW", color: "bg-gradient-to-r from-blue-600 to-cyan-600" };
  }

  if (offer.commissionType === 'monthly_retainer') {
    return { label: "RETAINER", color: "bg-gradient-to-r from-purple-600 to-violet-600" };
  }

  return null;
};

// Helper function to get application status badge configuration
const getApplicationStatusBadge = (status: string): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } => {
  switch (status) {
    case 'pending':
      return { label: 'Pending', variant: 'secondary' };
    case 'approved':
    case 'active':
      return { label: 'Approved', variant: 'default' };
    case 'rejected':
      return { label: 'Rejected', variant: 'destructive' };
    case 'completed':
      return { label: 'Completed', variant: 'outline' };
    default:
      return { label: status, variant: 'outline' };
  }
};

// Helper function to format date
const formatApplicationDate = (date: string | Date): string => {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

type SavedSearchFilters = {
  searchTerm?: string;
  selectedNiches?: string[];
  selectedCategories?: string[];
  commissionType?: string;
  commissionRange?: number[];
  minimumPayout?: number[];
  minRating?: number;
  showTrending?: boolean;
  showPriority?: boolean;
  sortBy?: string;
};

type SavedSearch = {
  id: string;
  name: string;
  filters: SavedSearchFilters;
  createdAt?: string;
  updatedAt?: string;
};

const summarizeSavedSearch = (filters: SavedSearchFilters): string => {
  const parts: string[] = [];

  if (filters.searchTerm) parts.push(`"${filters.searchTerm}"`);
  if (filters.selectedNiches?.length) parts.push(`${filters.selectedNiches.length} niche${filters.selectedNiches.length > 1 ? "s" : ""}`);
  if (filters.selectedCategories?.length) parts.push(`${filters.selectedCategories.length} category filter${filters.selectedCategories.length > 1 ? "s" : ""}`);
  if (filters.commissionType) parts.push(`Type: ${filters.commissionType.replace(/_/g, " ")}`);
  if (filters.minimumPayout?.[0]) parts.push(`Min payout: $${filters.minimumPayout[0]}`);
  if (filters.minRating && filters.minRating > 0) parts.push(`${filters.minRating}+ stars`);
  if (filters.showTrending) parts.push("Trending only");
  if (filters.showPriority) parts.push("Priority only");
  if (filters.sortBy && filters.sortBy !== "newest") parts.push(`Sort: ${filters.sortBy.replace(/_/g, " ")}`);

  return parts.length > 0 ? parts.join(" • ") : "No filters applied";
};

export default function Browse() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading, user } = useAuth();
  const { showTutorial, completeTutorial } = useTutorial(TUTORIAL_IDS.BROWSE_PAGE);

  // Quick Guide Tour - only starts after initial tutorial is dismissed
  useCreatorPageTour(CREATOR_TOUR_IDS.BROWSE, browseTourSteps, !showTutorial);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedNiches, setSelectedNiches] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [commissionType, setCommissionType] = useState<string>("");
  const [commissionRange, setCommissionRange] = useState([0, 10000]);
  const [minimumPayout, setMinimumPayout] = useState([0]);
  const [minRating, setMinRating] = useState(0);
  const [showTrending, setShowTrending] = useState(false);
  const [showPriority, setShowPriority] = useState(false);
  const [sortBy, setSortBy] = useState("newest");
  const [saveSearchDialogOpen, setSaveSearchDialogOpen] = useState(false);
  const [savedSearchName, setSavedSearchName] = useState("");
  const { setHeaderContent } = useHeaderContent();
  const [errorDialog, setErrorDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
  }>({
    open: false,
    title: "",
    description: "",
  });

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      window.location.href = "/login";
    }
  }, [isAuthenticated, isLoading]);

  const currentFilters = useMemo<SavedSearchFilters>(() => ({
    searchTerm,
    selectedNiches,
    selectedCategories,
    commissionType,
    commissionRange,
    minimumPayout,
    minRating,
    showTrending,
    showPriority,
    sortBy,
  }), [
    commissionRange,
    commissionType,
    minRating,
    minimumPayout,
    searchTerm,
    selectedCategories,
    selectedNiches,
    showPriority,
    showTrending,
    sortBy,
  ]);

  // Fetch niches from API
  const { data: niches = [], isLoading: nichesLoading } = useQuery<Array<{ id: string; name: string; description: string | null; isActive: boolean }>>({
    queryKey: ["/api/niches"],
  });

  const { data: offers, isLoading: offersLoading } = useQuery<any[]>({
    queryKey: ["/api/offers", { search: searchTerm, niches: selectedNiches, commissionType, sortBy }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (selectedNiches.length > 0) params.append('niches', selectedNiches.join(','));
      if (commissionType) params.append('commissionType', commissionType);
      if (sortBy) params.append('sortBy', sortBy);

      const url = `/api/offers${params.toString() ? '?' + params.toString() : ''}`;
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch offers');
      const data = await res.json();

      return data;
    },
    enabled: isAuthenticated,
  });

  // Fetch monthly retainer contracts
  const { data: retainerContracts = [], isLoading: retainersLoading } = useQuery<any[]>({
    queryKey: ["/api/retainer-contracts"],
    queryFn: async () => {
      const res = await fetch('/api/retainer-contracts', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch retainer contracts');
      const data = await res.json();

      // Transform retainer contracts to match offer structure
      return data.filter((contract: any) => contract.status === 'open').map((contract: any) => ({
        ...contract,
        // Map retainer fields to offer fields for compatibility
        commissionType: 'monthly_retainer',
        commissionAmount: contract.monthlyAmount,
        shortDescription: contract.description?.substring(0, 150) || '',
        fullDescription: contract.description,
        primaryNiche: contract.niches?.[0] || null,
        secondaryNiche: contract.niches?.[1] || null,
        additionalNiches: contract.niches?.slice(2) || [],
        isRetainerContract: true, // Flag to identify retainer contracts
      }));
    },
    enabled: isAuthenticated,
  });


  const categoryOptions = useMemo(
    () => [
      { label: "All", value: "all" },
      { label: "Trending", value: "trending" },
      { label: "Monthly Retainers", value: "monthly_retainers" },
      ...niches.map((niche) => ({ label: formatNicheLabel(niche.name), value: normalizeNicheValue(niche.name) })),
    ],
    [niches],
  );

  useEffect(() => {
    if (selectedCategories.length === 0) {
      return;
    }
    const validCategories = new Set(
      categoryOptions.map((option) => option.value),
    );
    const filteredSelections = selectedCategories.filter((cat) => validCategories.has(cat));
    if (filteredSelections.length !== selectedCategories.length) {
      setSelectedCategories(filteredSelections);
    }
  }, [categoryOptions, selectedCategories]);

  useEffect(() => {
    if (selectedNiches.length === 0) {
      return;
    }

    const validNiches = new Set(
      categoryOptions
        .filter((option) => option.value !== "all")
        .map((option) => option.value),
    );

    const filteredSelections = selectedNiches.filter((niche) => validNiches.has(niche));

    if (filteredSelections.length !== selectedNiches.length) {
      setSelectedNiches(filteredSelections);
    }
  }, [categoryOptions, selectedNiches]);

  // Get current offers based on selected categories
  const getCurrentOffers = () => {
    const currentOffers = offers || [];
    const retainers = retainerContracts || [];

    // If no categories selected, show all offers including retainers
    if (selectedCategories.length === 0) {
      return [...currentOffers, ...retainers];
    }

    // Check for special categories
    const hasMonthlyRetainers = selectedCategories.includes("monthly_retainers");
    const hasTrending = selectedCategories.includes("trending");
    const hasAll = selectedCategories.includes("all");

    // Get niche categories (exclude special ones)
    const nicheCategories = selectedCategories.filter(
      cat => cat !== "all" && cat !== "trending" && cat !== "monthly_retainers"
    );

    // If "All" is selected along with other categories, treat as if no filter
    if (hasAll) {
      return [...currentOffers, ...retainers];
    }

    let result: any[] = [];

    // Add trending offers if trending is selected
    if (hasTrending) {
      const trendingResults = currentOffers.filter(offer =>
        offer.commissionType !== 'monthly_retainer' &&
        (isPriorityOffer(offer) || getCommissionValue(offer) > 15)
      );
      result = [...result, ...trendingResults];
    }

    // Add monthly retainers if selected
    if (hasMonthlyRetainers) {
      result = [...result, ...retainers];
    }

    // For niche categories, include regular offers (filtering happens in filteredOffers)
    if (nicheCategories.length > 0) {
      // Add all regular offers - actual niche filtering happens in filteredOffers
      result = [...result, ...currentOffers];
    }

    // Remove duplicates by id
    const seen = new Set<string>();
    return result.filter(offer => {
      if (seen.has(offer.id)) return false;
      seen.add(offer.id);
      return true;
    });
  };

  // Get loading state
  const isCurrentLoading = () => {
    return offersLoading || retainersLoading;
  };

  // Apply client-side filters
  const filteredOffers = getCurrentOffers()?.filter(offer => {
    // Search filter (apply to all tabs)
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      const matchesSearch =
        offer.title?.toLowerCase().includes(search) ||
        offer.shortDescription?.toLowerCase().includes(search) ||
        offer.longDescription?.toLowerCase().includes(search) ||
        offer.company?.tradeName?.toLowerCase().includes(search);

      if (!matchesSearch) {
        return false;
      }
    }

    const offerNiches = getOfferNicheValues(offer);

    // Category filter (from category pills) - now supports multiple selections
    if (selectedCategories.length > 0 && !selectedCategories.includes("all")) {
      const hasMonthlyRetainers = selectedCategories.includes("monthly_retainers");
      const hasTrending = selectedCategories.includes("trending");
      const nicheCategories = selectedCategories.filter(
        cat => cat !== "all" && cat !== "trending" && cat !== "monthly_retainers"
      );

      let matchesAnyCategory = false;

      // Check if offer matches monthly retainers category
      if (hasMonthlyRetainers && offer.commissionType === "monthly_retainer") {
        matchesAnyCategory = true;
      }

      // Check if offer matches trending category
      if (hasTrending && offer.commissionType !== 'monthly_retainer' &&
          (isPriorityOffer(offer) || getCommissionValue(offer) > 15)) {
        matchesAnyCategory = true;
      }

      // Check if offer matches any niche category
      if (nicheCategories.length > 0) {
        const matchesNiche = nicheCategories.some(cat => offerNiches.includes(cat));
        if (matchesNiche) {
          matchesAnyCategory = true;
        }
      }

      if (!matchesAnyCategory) {
        return false;
      }
    }

    // Niche filter (from filter sheet checkboxes)
    if (selectedNiches.length > 0) {
      const hasMatchingNiche = selectedNiches.some((niche) => offerNiches.includes(niche));

      if (!hasMatchingNiche) {
        return false;
      }
    }

    // Commission type filter (from filter sheet)
    if (commissionType && offer.commissionType !== commissionType) {
      return false;
    }

    // Commission range filter
    const commissionValue = getCommissionValue(offer);
    if (commissionValue < commissionRange[0] || commissionValue > commissionRange[1]) {
      return false;
    }

    // Minimum payout filter
    if (minimumPayout[0] > 0 && commissionValue < minimumPayout[0]) {
      return false;
    }

    // Company rating filter
    if (minRating > 0 && (offer.company?.averageRating || 0) < minRating) {
      return false;
    }

    // Trending toggle filter
    if (showTrending && !isPriorityOffer(offer) && getCommissionValue(offer) <= 15) {
      return false;
    }

    // Priority listings filter
    if (showPriority && !isPriorityOffer(offer)) {
      return false;
    }

    return true;
  }) || [];

  const sortedOffers = useMemo(() => {
    const offersToSort = [...filteredOffers];

    const priorityComparison = (a: any, b: any) => {
      const aIsPriority = isPriorityOffer(a);
      const bIsPriority = isPriorityOffer(b);

      if (aIsPriority && !bIsPriority) return -1;
      if (!aIsPriority && bIsPriority) return 1;
      return 0;
    };

    offersToSort.sort((a, b) => {
      const priorityResult = priorityComparison(a, b);
      if (priorityResult !== 0) return priorityResult;

      switch (sortBy) {
        case "highest_commission":
          return getCommissionValue(b) - getCommissionValue(a);
        case "lowest_commission":
          return getCommissionValue(a) - getCommissionValue(b);
        case "most_popular":
          return (b.applicationCount || 0) - (a.applicationCount || 0);
        case "best_rated": {
          const aRating = typeof a.company?.averageRating === 'number' ? a.company.averageRating : 0;
          const bRating = typeof b.company?.averageRating === 'number' ? b.company.averageRating : 0;

          if (bRating !== aRating) {
            return bRating - aRating;
          }

          const aReviews = typeof a.company?.reviewCount === 'number' ? a.company.reviewCount : 0;
          const bReviews = typeof b.company?.reviewCount === 'number' ? b.company.reviewCount : 0;

          return bReviews - aReviews;
        }
        case "newest":
        default: {
          const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bCreated - aCreated;
        }
      }
    });

    return offersToSort;
  }, [filteredOffers, sortBy]);

  // No separate trending section - all offers shown in main grid

  // Separate regular offers and monthly retainers
  const regularOffers = sortedOffers?.filter(offer => offer.commissionType !== 'monthly_retainer') || [];
  const monthlyRetainerOffers = sortedOffers?.filter(offer => offer.commissionType === 'monthly_retainer') || [];

  const toggleNiche = (niche: string) => {
    setSelectedNiches(prev =>
      prev.includes(niche) ? prev.filter(n => n !== niche) : [...prev, niche]
    );
  };

  const toggleCategory = (category: string) => {
    setSelectedCategories(prev => {
      // If "All" is clicked, clear all selections (show everything)
      if (category === "all") {
        return [];
      }
      const isSelected = prev.includes(category);

      // Toggle category selection while keeping other selections intact
      const nextSelections = isSelected
        ? prev.filter((cat) => cat !== category)
        : [...prev, category];

      // If nothing remains selected, treat as "All"
      return nextSelections;
    });
  };

  const clearFilters = () => {
    setSelectedNiches([]);
    setCommissionType("");
    setCommissionRange([0, 10000]);
    setMinimumPayout([0]);
    setMinRating(0);
    setShowTrending(false);
    setShowPriority(false);
    setSearchTerm("");
    setSelectedCategories([]);
  };

  const { data: favorites = [] } = useQuery<any[]>({
    queryKey: ["/api/favorites"],
    enabled: isAuthenticated,
  });

  // Fetch creator's applications to show status on cards
  const { data: applications = [] } = useQuery<any[]>({
    queryKey: ["/api/applications"],
    enabled: isAuthenticated,
  });

  // Fetch retainer applications for the creator
  const { data: retainerApplications = [] } = useQuery<any[]>({
    queryKey: ["/api/retainer-applications/creator"],
    queryFn: async () => {
      const res = await fetch('/api/retainer-applications/creator', { credentials: 'include' });
      if (!res.ok) {
        if (res.status === 404) return [];
        throw new Error('Failed to fetch retainer applications');
      }
      return res.json();
    },
    enabled: isAuthenticated,
  });

  const { data: savedSearches = [], isLoading: savedSearchesLoading } = useQuery<SavedSearch[]>({
    queryKey: ["/api/saved-searches"],
    enabled: isAuthenticated,
  });

  const favoriteMutation = useMutation({
    mutationFn: async ({ offerId, isFav }: { offerId: string; isFav: boolean }) => {
      if (isFav) {
        await apiRequest("DELETE", `/api/favorites/${offerId}`);
      } else {
        await apiRequest("POST", "/api/favorites", { offerId });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/favorites"] });
    },
    onError: (error: any) => {
      setErrorDialog({
        open: true,
        title: "Error",
        description: "Failed to update favorites",
      });
    },
  });

  const handleFavoriteToggle = (e: React.MouseEvent, offerId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const isFav = favorites.some(f => f.offerId === offerId);
    favoriteMutation.mutate({ offerId, isFav });
  };

  const createSavedSearchMutation = useMutation({
    mutationFn: async (payload: { name: string; filters: SavedSearchFilters }) => {
      const res = await apiRequest("POST", "/api/saved-searches", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saved-searches"] });
      toast({ title: "Saved search created", description: "Your filters were saved for quick access." });
      setSaveSearchDialogOpen(false);
      setSavedSearchName("");
    },
    onError: (error: any) => {
      toast({
        title: "Unable to save search",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateSavedSearchMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<{ name: string; filters: SavedSearchFilters }> }) => {
      const res = await apiRequest("PUT", `/api/saved-searches/${id}`, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saved-searches"] });
      toast({ title: "Saved search updated", description: "Filters have been refreshed." });
    },
    onError: (error: any) => {
      toast({
        title: "Unable to update search",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteSavedSearchMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/saved-searches/${id}`);
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saved-searches"] });
      toast({ title: "Saved search removed" });
    },
    onError: (error: any) => {
      toast({
        title: "Unable to remove search",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSaveSearch = () => {
    const trimmedName = savedSearchName.trim();
    if (!trimmedName) {
      toast({
        title: "Name your search",
        description: "Add a name to quickly recognize this filter set.",
        variant: "destructive",
      });
      return;
    }

    createSavedSearchMutation.mutate({ name: trimmedName, filters: currentFilters });
  };

  const handleApplySavedSearch = (savedSearch: SavedSearch) => {
    const filters = savedSearch.filters || {};
    setSearchTerm(filters.searchTerm ?? "");
    setSelectedNiches(filters.selectedNiches ?? []);
    setSelectedCategories(filters.selectedCategories ?? []);
    setCommissionType(filters.commissionType ?? "");
    setCommissionRange(filters.commissionRange && filters.commissionRange.length === 2 ? filters.commissionRange : [0, 10000]);
    setMinimumPayout(filters.minimumPayout && filters.minimumPayout.length > 0 ? filters.minimumPayout : [0]);
    setMinRating(filters.minRating ?? 0);
    setShowTrending(Boolean(filters.showTrending));
    setShowPriority(Boolean(filters.showPriority));
    setSortBy(filters.sortBy ?? "newest");

    toast({
      title: "Saved search applied",
      description: `Applied "${savedSearch.name}" filters.`,
    });
  };

  const handleUpdateSavedSearch = (id: string) => {
    updateSavedSearchMutation.mutate({ id, payload: { filters: currentFilters } });
  };

  const handleDeleteSavedSearch = (id: string) => {
    deleteSavedSearchMutation.mutate(id);
  };

  useEffect(() => {
    const searchBar = (
      <div className="relative w-full max-w-xl">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search offers..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 bg-muted/50"
          data-testid="input-search-header"
        />
      </div>
    );

    setHeaderContent(searchBar);

    return () => setHeaderContent(null);
  }, [searchTerm, setHeaderContent]);

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="animate-pulse text-lg">Loading...</div>
    </div>;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Main Content */}
      <div className="max-w-[1600px] mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8 space-y-4 sm:space-y-6 md:space-y-8">
        {/* Header - Left Aligned, Black Text */}
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground">Browse Offers</h1>
          <p className="text-muted-foreground text-sm sm:text-base">Discover exclusive affiliate opportunities from verified brands</p>
        </div>

        {/* Category Pills - Horizontal Scroll with Multi-Select */}
        <ScrollArea orientation="horizontal" className="w-full pb-3">
  <div className="flex gap-2 pb-1 pr-4 overflow-x-auto scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
    {categoryOptions.map(({ label, value }) => {
      // "All" is selected when no categories are selected
      const isSelected = value === "all"
        ? selectedCategories.length === 0
        : selectedCategories.includes(value);
      const ariaPressedValue: "true" | "false" = isSelected ? "true" : "false";
      return (
        <button
          key={value || label}
          onClick={() => toggleCategory(value)}
          className={`px-5 py-2.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
            isSelected
              ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25'
              : 'bg-secondary/50 hover:bg-secondary text-secondary-foreground'
          }`}
          aria-pressed={ariaPressedValue}
        >
          {label}
        </button>
      );
    })}
  </div>
</ScrollArea>

        {/* Filters Row */}
        <div className="flex items-center gap-2 sm:gap-4 flex-wrap sm:flex-nowrap">
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-full sm:w-52" data-testid="select-sort">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="highest_commission">Commission: High to Low</SelectItem>
              <SelectItem value="lowest_commission">Commission: Low to High</SelectItem>
              <SelectItem value="newest">Most Recently Posted</SelectItem>
              <SelectItem value="most_popular">Most Popular (by applications)</SelectItem>
              <SelectItem value="best_rated">Best Rated Companies</SelectItem>
            </SelectContent>
          </Select>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" data-testid="button-filters" className="gap-1 sm:gap-2 flex-shrink-0">
                <SlidersHorizontal className="h-4 w-4" />
                <span className="hidden xs:inline">Filters</span>
                {(selectedNiches.length > 0 || commissionType || minimumPayout[0] > 0 || minRating > 0 || showTrending || showPriority) && (
                  <Badge variant="secondary" className="ml-0.5 sm:ml-1 h-5 min-w-[20px] flex items-center justify-center px-1.5">
                    {selectedNiches.length + (commissionType ? 1 : 0) + (minimumPayout[0] > 0 ? 1 : 0) + (minRating > 0 ? 1 : 0) + (showTrending ? 1 : 0) + (showPriority ? 1 : 0)}
                  </Badge>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent className="flex flex-col">
              <SheetHeader>
                <SheetTitle>Filter Offers</SheetTitle>
                <SheetDescription>Refine your search with advanced filters</SheetDescription>
              </SheetHeader>

              <ScrollArea className="flex-1 -mx-6 px-6">
              <div className="space-y-6 mt-6">
                {/* Niche Filter */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Niche/Category</Label>
                    {selectedNiches.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedNiches([])}
                        className="h-auto p-0 text-xs"
                      >
                        Clear ({selectedNiches.length})
                      </Button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {nichesLoading ? (
                      <div className="text-sm text-muted-foreground">Loading niches...</div>
                    ) : niches.length === 0 ? (
                      <div className="text-sm text-muted-foreground">No niches available</div>
                    ) : (
                      niches.map((niche) => {
                        const normalizedValue = normalizeNicheValue(niche.name);
                        const isChecked = selectedNiches.includes(normalizedValue);
                        return (
                          <div
                            key={niche.id}
                            className={`flex items-center gap-2 p-2 rounded-md transition-colors cursor-pointer hover:bg-muted/50 ${isChecked ? 'bg-primary/10' : ''}`}
                            onClick={() => toggleNiche(normalizedValue)}
                          >
                            <Checkbox
                              id={`niche-${niche.id}`}
                              checked={isChecked}
                              onCheckedChange={() => toggleNiche(normalizedValue)}
                              data-testid={`checkbox-niche-${niche.name}`}
                            />
                            <Label
                              htmlFor={`niche-${niche.id}`}
                              className={`text-sm font-normal cursor-pointer flex-1 ${isChecked ? 'font-medium text-primary' : ''}`}
                            >
                              {formatNicheLabel(niche.name)}
                            </Label>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Commission Type */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Commission Type</Label>
                    {commissionType && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCommissionType("")}
                        className="h-auto p-0 text-xs"
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                  <Select value={commissionType || undefined} onValueChange={(value) => setCommissionType(value)}>
                    <SelectTrigger data-testid="select-commission-type">
                      <SelectValue placeholder="All types" />
                    </SelectTrigger>
                    <SelectContent>
                      {COMMISSION_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Commission Range */}
                <div className="space-y-3">
                  <Label>Commission Range</Label>
                  <div className="px-2 py-4">
                    <Slider
                      value={commissionRange}
                      onValueChange={setCommissionRange}
                      max={10000}
                      step={100}
                      data-testid="slider-commission"
                    />
                  </div>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>${commissionRange[0]}</span>
                    <span>${commissionRange[1]}+</span>
                  </div>
                </div>

                {/* Minimum Payout */}
                <div className="space-y-3">
                  <Label>Minimum Payout</Label>
                  <div className="px-2 py-4">
                    <Slider
                      value={minimumPayout}
                      onValueChange={setMinimumPayout}
                      max={5000}
                      step={50}
                      data-testid="slider-minimum-payout"
                    />
                  </div>
                  <div className="text-sm text-muted-foreground">
                    ${minimumPayout[0]}+
                  </div>
                </div>

                {/* Company Rating */}
                <div className="space-y-3">
                  <Label>Minimum Company Rating</Label>
                  <Select value={minRating.toString()} onValueChange={(value) => setMinRating(Number(value))}>
                    <SelectTrigger data-testid="select-min-rating">
                      <SelectValue placeholder="Any rating" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Any rating</SelectItem>
                      <SelectItem value="3">3+ stars</SelectItem>
                      <SelectItem value="4">4+ stars</SelectItem>
                      <SelectItem value="4.5">4.5+ stars</SelectItem>
                      <SelectItem value="5">5 stars only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Trending Toggle */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Trending Only</Label>
                    <p className="text-xs text-muted-foreground">Show only trending offers</p>
                  </div>
                  <Switch
                    checked={showTrending}
                    onCheckedChange={setShowTrending}
                    data-testid="switch-trending"
                  />
                </div>

                {/* Priority Listings Toggle */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Priority Listings</Label>
                    <p className="text-xs text-muted-foreground">Show only priority offers</p>
                  </div>
                  <Switch
                    checked={showPriority}
                    onCheckedChange={setShowPriority}
                    data-testid="switch-priority"
                  />
                </div>

                <div className="pt-4 pb-6 flex gap-3">
                  <Button onClick={clearFilters} variant="outline" className="flex-1" data-testid="button-clear-filters">
                    Clear All
                  </Button>
                </div>
              </div>
              </ScrollArea>
            </SheetContent>
          </Sheet>

          <Button
            variant="outline"
            className="flex-shrink-0 gap-2"
            onClick={() => setSaveSearchDialogOpen(true)}
          >
            <BookmarkPlus className="h-4 w-4" />
            Save search
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex-shrink-0 gap-2">
                <Bookmark className="h-4 w-4" />
                Saved searches
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-80">
              <DropdownMenuLabel>Saved searches</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {savedSearchesLoading ? (
                <DropdownMenuItem className="pointer-events-none text-muted-foreground">
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Loading...
                </DropdownMenuItem>
              ) : savedSearches.length === 0 ? (
                <DropdownMenuItem className="pointer-events-none text-muted-foreground">
                  No saved searches yet
                </DropdownMenuItem>
              ) : (
                savedSearches.map((search) => (
                  <DropdownMenuItem
                    key={search.id}
                    className="whitespace-normal py-3 flex flex-col items-start gap-2"
                    onSelect={(e) => {
                      e.preventDefault();
                      handleApplySavedSearch(search);
                    }}
                  >
                    <div className="flex w-full items-center justify-between gap-2">
                      <div>
                        <p className="font-medium leading-tight">{search.name}</p>
                        <p className="text-xs text-muted-foreground leading-tight">{new Date(search.updatedAt || search.createdAt || new Date()).toLocaleDateString()}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="secondary"
                          size="sm"
                          className="h-8"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleApplySavedSearch(search);
                          }}
                        >
                          Apply
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleUpdateSavedSearch(search.id);
                          }}
                          title="Update with current filters"
                        >
                          {updateSavedSearchMutation.isPending && updateSavedSearchMutation.variables?.id === search.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCcw className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleDeleteSavedSearch(search.id);
                          }}
                          title="Delete saved search"
                        >
                          {deleteSavedSearchMutation.isPending && deleteSavedSearchMutation.variables === search.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground leading-snug line-clamp-2">
                      {summarizeSavedSearch(search.filters || {})}
                    </p>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Loading State */}
        {isCurrentLoading() ? (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-foreground">Loading...</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <OfferCardSkeleton key={i} />
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Main Offers Grid */}
            <div className="space-y-8">
              {/* Main Offers Section */}
              <div className="space-y-4">
                {/* Section header - dynamically changes based on selected filter */}
                {(() => {
                  // Get niche categories for display
                  const nicheCategories = selectedCategories.filter(
                    cat => cat !== "all" && cat !== "trending" && cat !== "monthly_retainers"
                  );
                  const onlyMonthlyRetainers = selectedCategories.length === 1 && selectedCategories.includes("monthly_retainers");
                  const onlyTrending = selectedCategories.length === 1 && selectedCategories.includes("trending");
                  const hasTrending = selectedCategories.includes("trending");
                  const hasMonthlyRetainers = selectedCategories.includes("monthly_retainers");

                  // Don't show header for monthly retainers only (shown in separate section)
                  if (onlyMonthlyRetainers) return null;

                  // Show "Trending Offers" when only trending is selected
                  if (onlyTrending && sortedOffers.length > 0) {
                    return (
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-orange-500" />
                        <h2 className="text-xl sm:text-2xl font-bold text-foreground">Trending Offers</h2>
                      </div>
                    );
                  }

                  // Show "Monthly Retainers Offers" when combined with other categories
                  if (hasMonthlyRetainers && selectedCategories.length > 1 && !hasTrending && nicheCategories.length === 0) {
                    return <h2 className="text-xl sm:text-2xl font-bold text-foreground">Monthly Retainers Offers</h2>;
                  }

                  // Show specific niche name when single niche is selected
                  if (nicheCategories.length === 1 && !hasTrending && !hasMonthlyRetainers && sortedOffers.length > 0) {
                    const categoryName = formatNicheLabel(nicheCategories[0]);
                    return (
                      <h2 className="text-xl sm:text-2xl font-bold text-foreground capitalize">
                        {categoryName} Offers
                      </h2>
                    );
                  }

                  // Show "Filtered Offers" for multiple selections
                  if ((nicheCategories.length > 1 || (nicheCategories.length > 0 && (hasTrending || hasMonthlyRetainers))) && sortedOffers.length > 0) {
                    return <h2 className="text-xl sm:text-2xl font-bold text-foreground">Filtered Offers</h2>;
                  }

                  // Default: "All Offers" when no category is selected
                  if (selectedCategories.length === 0 && sortedOffers.length > 0) {
                    return <h2 className="text-xl sm:text-2xl font-bold text-foreground">All Offers</h2>;
                  }

                  return null;
                })()}

                {/* Use regularOffers for all category, sortedOffers for niche categories, skip for monthly_retainers (shown separately) */}
                {(() => {
                  // Skip this section entirely for monthly_retainers only - they are shown in their own section below
                  const onlyMonthlyRetainers = selectedCategories.length === 1 && selectedCategories.includes("monthly_retainers");
                  if (onlyMonthlyRetainers) {
                    return null;
                  }

                  // When monthly_retainers is selected, exclude them from grid (they show in expanded section)
                  const hasMonthlyRetainersSelected = selectedCategories.includes("monthly_retainers");
                  let displayOffers = selectedCategories.length === 0 ? regularOffers : sortedOffers;
                  if (hasMonthlyRetainersSelected) {
                    displayOffers = displayOffers.filter(offer => offer.commissionType !== 'monthly_retainer');
                  }

                  return !displayOffers || displayOffers.length === 0 ? (
            <Card className="border-dashed border-2">
              <CardContent className="p-8 sm:p-12 md:p-16 text-center">
                <div className="mx-auto w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-muted/50 flex items-center justify-center mb-4 sm:mb-6">
                  <TrendingUp className="h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground/50" />
                </div>
                <h3 className="font-semibold text-lg sm:text-xl mb-2">No offers found</h3>
                <p className="text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6">Try adjusting your filters or search terms</p>
                <Button onClick={clearFilters} variant="outline" className="text-sm sm:text-base">
                  Clear Filters
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 sm:gap-6">
              {displayOffers.map((offer) => {
                const isFavorite = favorites.some(f => f.offerId === offer.id);
                const category = getOfferCategory(offer);
                const isRetainer = offer.commissionType === 'monthly_retainer';

                const commissionDisplay = getCommissionDisplay(offer);

                // Check if creator has applied to this offer or retainer contract
                const application = offer.isRetainerContract
                  ? retainerApplications.find((app: any) => app.contractId === offer.id)
                  : applications.find((app: any) => app.offerId === offer.id);
                const hasApplied = !!application;

                return (
                  <Link key={offer.id} href={offer.isRetainerContract ? `/retainers/${offer.id}` : `/offers/${offer.id}`}>
                    <Card className={`group hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer overflow-hidden h-full ${
                      isRetainer ? 'ring-2 ring-purple-400/50 hover:ring-purple-500 hover:shadow-purple-500/20' : ''
                    }`} data-testid={`card-offer-${offer.id}`}>
                      {/* Thumbnail */}
                      <div className={`aspect-video relative overflow-hidden ${
                        isRetainer ? 'bg-gradient-to-br from-purple-100 via-violet-100 to-indigo-100' : ''
                      }`}>
                        {!isRetainer && offer.featuredImageUrl ? (
                          <>
                            <img
                              src={proxiedSrc(offer.featuredImageUrl)}
                              alt={offer.title}
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                                const fallback = (e.target as HTMLImageElement).nextElementSibling;
                                if (fallback) {
                                  fallback.classList.remove('hidden');
                                  fallback.classList.add('flex');
                                }
                              }}
                            />
                            {/* Fallback if image fails */}
                            <div className="absolute inset-0 hidden items-center justify-center bg-gradient-to-br from-primary/10 to-purple-500/10">
                              <Play className="h-12 w-12 text-muted-foreground/50" />
                            </div>
                          </>
                        ) : !isRetainer ? (
                          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/10 to-purple-500/10">
                            <Play className="h-12 w-12 text-muted-foreground/50" />
                          </div>
                        ) : null}

                        {/* Favorite button - Top Left */}
                        <button
                          className="rounded-full flex items-center justify-center transition-all hover:scale-110 shadow-lg backdrop-blur-md"
                          style={{
                            position: 'absolute',
                            top: '8px',
                            left: '8px',
                            width: '44px',
                            height: '44px',
                            backgroundColor: 'rgba(255, 255, 255, 0.95)',
                            zIndex: 10,
                            border: 'none',
                            cursor: 'pointer'
                          }}
                          onClick={(e) => handleFavoriteToggle(e, offer.id)}
                          data-testid={`button-favorite-${offer.id}`}
                          aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                        >
                          <Heart className={`h-5 w-5 transition-all ${isFavorite ? 'fill-red-500 text-red-500 scale-110' : 'text-gray-600'}`} />
                        </button>

                        {/* Category Badge - Top Right */}
                        {category && (
                          <div className={`absolute top-0 right-0 ${category.color} text-white px-3 py-1.5 rounded-bl-lg shadow-lg font-bold text-xs tracking-wide`}>
                            {category.label}
                          </div>
                        )}
                      </div>

                      <CardContent className="p-4 sm:p-5 space-y-2 sm:space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-semibold text-sm sm:text-base line-clamp-1 flex-1">{offer.title}</h3>
                          {!isRetainer && offer.company?.logoUrl && (
                            <img src={proxiedSrc(offer.company.logoUrl)} alt={offer.company.tradeName} className="h-8 w-8 sm:h-9 sm:w-9 rounded-full object-cover ring-2 ring-border flex-shrink-0" />
                          )}
                        </div>

                        <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2 leading-relaxed">{offer.shortDescription}</p>

                        <div className="flex flex-wrap gap-1 sm:gap-1.5">
                          {offer.primaryNiche && (() => {
                            const formattedNiche = formatNicheLabel(offer.primaryNiche);
                            const badgeClass = NICHE_COLORS[formattedNiche] || 'bg-secondary';

                            return (
                              <Badge variant="outline" className={`text-[10px] sm:text-xs border ${badgeClass}`}>
                                {formattedNiche}
                              </Badge>
                            );
                          })()}
                        </div>

                        <div className="flex items-center justify-between pt-2 sm:pt-3 border-t">
                          <div className="flex items-center gap-1 sm:gap-1.5 text-xs sm:text-sm">
                            <Star className="h-3 w-3 sm:h-4 sm:w-4 fill-amber-400 text-amber-400" />
                            <span className="font-medium text-foreground">{offer.company?.averageRating?.toFixed(1) || '5.0'}</span>
                          </div>
                          <div className={`flex items-center gap-0.5 sm:gap-1 font-mono font-bold text-sm sm:text-base ${
                            isRetainer ? 'text-purple-600 group-hover:text-purple-700' : 'text-primary'
                          } transition-colors`}>
                            {commissionDisplay.isCurrency && <DollarSign className="h-3 w-3 sm:h-4 sm:w-4" />}
                            {commissionDisplay.value}
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-xs sm:text-sm text-muted-foreground">
                          <div className="flex items-center gap-1 sm:gap-1.5">
                            <Users className="h-3 w-3 sm:h-4 sm:w-4" />
                            <span className="hidden xs:inline">{offer.activeCreatorsCount || 0} active</span>
                            <span className="xs:hidden">{offer.activeCreatorsCount || 0}</span>
                          </div>
                        </div>

                        {/* Application Status */}
                        {hasApplied && application && (
                          <div className="pt-2 sm:pt-3 border-t">
                            <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
                              <div className="flex items-center gap-2">
                                <Badge variant={getApplicationStatusBadge(application.status).variant} className="text-xs">
                                  {getApplicationStatusBadge(application.status).label}
                                </Badge>
                              </div>
                              <div className="text-[10px] sm:text-xs text-muted-foreground">
                                <span className="hidden sm:inline">Applied: </span>{formatApplicationDate(application.createdAt)}
                              </div>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          );
        })()}
              </div>

              {/* Show monthly retainers section whenever "monthly_retainers" category is selected */}
              {selectedCategories.includes("monthly_retainers") && (
                <div className="space-y-4">
                  {!monthlyRetainerOffers || monthlyRetainerOffers.length === 0 ? (
                    <Card className="border-dashed border-2">
                      <CardContent className="p-8 sm:p-12 md:p-16 text-center">
                        <div className="mx-auto w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-muted/50 flex items-center justify-center mb-4 sm:mb-6">
                          <Clock className="h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground/50" />
                        </div>
                        <h3 className="font-semibold text-lg sm:text-xl mb-2">No monthly retainer contracts found</h3>
                        <p className="text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6">Try adjusting your filters or search terms</p>
                        <Button onClick={clearFilters} variant="outline" className="text-sm sm:text-base">
                          Clear Filters
                        </Button>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-4">
                      {monthlyRetainerOffers.map((offer) => {
                        // Check if creator has applied to this retainer contract
                        const application = offer.isRetainerContract
                          ? retainerApplications.find((app: any) => app.contractId === offer.id)
                          : applications.find((app: any) => app.offerId === offer.id);
                        const hasApplied = !!application;
                        const monthlyAmount = offer.monthlyAmount || offer.commissionAmount || 0;

                        return (
                          <Card
                            key={offer.id}
                            className="group hover:shadow-lg transition-all duration-300 ring-1 ring-purple-400/30 hover:ring-purple-500/50"
                            data-testid={`card-retainer-${offer.id}`}
                          >
                            <CardHeader className="space-y-3">
                              <div className="flex items-start justify-between gap-4">
                                <div className="space-y-1 flex-1 min-w-0">
                                  <h3 className="text-lg sm:text-xl font-bold">{offer.title}</h3>
                                  <p className="text-muted-foreground line-clamp-2 leading-relaxed">
                                    {offer.description || offer.shortDescription}
                                  </p>
                                  <div className="flex flex-wrap gap-2 pt-2">
                                    {offer.contentApprovalRequired && (
                                      <Badge variant="secondary">Approval required</Badge>
                                    )}
                                    {offer.exclusivityRequired && (
                                      <Badge className="bg-primary/10 text-primary" variant="outline">
                                        Exclusivity
                                      </Badge>
                                    )}
                                    {offer.minimumVideoLengthSeconds && (
                                      <Badge variant="outline">
                                        Min length: {offer.minimumVideoLengthSeconds}s
                                      </Badge>
                                    )}
                                    {offer.postingSchedule && (
                                      <Badge variant="outline">{offer.postingSchedule}</Badge>
                                    )}
                                  </div>
                                </div>
                                <Link href={offer.isRetainerContract ? `/retainers/${offer.id}` : `/offers/${offer.id}`}>
                                  <Button
                                    variant="outline"
                                    className="group/btn hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all duration-200 font-medium shrink-0"
                                    data-testid={`button-view-retainer-${offer.id}`}
                                  >
                                    <Eye className="h-4 w-4 mr-2 group-hover/btn:scale-110 transition-transform duration-200" />
                                    View Details
                                  </Button>
                                </Link>
                              </div>
                            </CardHeader>
                            <CardContent>
                              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-primary/5 transition-colors duration-200">
                                  <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                                    <DollarSign className="h-5 w-5 text-primary" />
                                  </div>
                                  <div>
                                    <p className="text-sm text-muted-foreground">Monthly Payment</p>
                                    <p className="font-semibold">${monthlyAmount.toLocaleString()}</p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-primary/5 transition-colors duration-200">
                                  <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                                    <Video className="h-5 w-5 text-primary" />
                                  </div>
                                  <div>
                                    <p className="text-sm text-muted-foreground">Videos/Month</p>
                                    <p className="font-semibold">{offer.videosPerMonth || 0}</p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-primary/5 transition-colors duration-200">
                                  <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                                    <Calendar className="h-5 w-5 text-primary" />
                                  </div>
                                  <div>
                                    <p className="text-sm text-muted-foreground">Duration</p>
                                    <p className="font-semibold">{offer.durationMonths || 0} months</p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-primary/5 transition-colors duration-200">
                                  <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                                    <Users className="h-5 w-5 text-primary" />
                                  </div>
                                  <div>
                                    <p className="text-sm text-muted-foreground">Platform</p>
                                    <p className="font-semibold">{offer.requiredPlatform || 'Any'}</p>
                                  </div>
                                </div>
                              </div>

                              {Array.isArray(offer.retainerTiers) && offer.retainerTiers.length > 0 && (
                                <div className="mt-4 pt-4 border-t space-y-3">
                                  <p className="text-sm font-semibold">Tiered packages</p>
                                  <div className="grid md:grid-cols-3 gap-3">
                                    {offer.retainerTiers.map((tier: any, tierIndex: number) => (
                                      <div
                                        key={`${offer.id}-tier-${tierIndex}`}
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

                              {!hasApplied && (
                                <div className="mt-4 pt-4 border-t">
                                  <Link href={offer.isRetainerContract ? `/retainers/${offer.id}` : `/offers/${offer.id}`}>
                                    <Button
                                      className="w-full sm:w-auto"
                                      variant="default"
                                      data-testid={`button-apply-${offer.id}`}
                                    >
                                      <Send className="h-4 w-4 mr-2" />
                                      Apply Now
                                    </Button>
                                  </Link>
                                </div>
                              )}

                              {hasApplied && application && (
                                <div className="mt-4 pt-4 border-t">
                                  <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
                                    <div className="flex items-center gap-2">
                                      <Badge variant={getApplicationStatusBadge(application.status).variant} className="text-xs">
                                        {getApplicationStatusBadge(application.status).label}
                                      </Badge>
                                    </div>
                                    <div className="text-[10px] sm:text-xs text-muted-foreground">
                                      <span className="hidden sm:inline">Applied: </span>{formatApplicationDate(application.createdAt)}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Error Dialog */}
      <GenericErrorDialog
        open={errorDialog.open}
        onOpenChange={(open) => setErrorDialog({ ...errorDialog, open })}
        title={errorDialog.title}
        description={errorDialog.description}
        variant="error"
      />

      <Dialog
        open={saveSearchDialogOpen}
        onOpenChange={(open) => {
          setSaveSearchDialogOpen(open);
          if (!open) {
            setSavedSearchName("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save this search</DialogTitle>
            <DialogDescription>Store your current keywords and filters for quick reuse.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="saved-search-name">Search name</Label>
              <Input
                id="saved-search-name"
                value={savedSearchName}
                onChange={(e) => setSavedSearchName(e.target.value)}
                placeholder="e.g. High commission SaaS"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Current search term, selected niches, and filters will be saved.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setSaveSearchDialogOpen(false);
                setSavedSearchName("");
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveSearch} disabled={createSavedSearchMutation.isPending}>
              {createSavedSearchMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save search
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FirstTimeTutorial
        open={showTutorial}
        onComplete={completeTutorial}
        config={browsePageTutorialConfig}
      />
    </div>
  );
}