import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Slider } from "../components/ui/slider";
import { Checkbox } from "../components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
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
import { Search, SlidersHorizontal, TrendingUp, DollarSign, Clock, Star, Play, Heart, ArrowRight, Users, Sparkles, Award, Percent } from "lucide-react";
import { Link } from "wouter";
import { apiRequest, queryClient } from "../lib/queryClient";
import { proxiedSrc } from "../lib/image";
import { TopNavBar } from "../components/TopNavBar";
import { OfferCardSkeleton } from "../components/skeletons";

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

export default function Browse() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading, user } = useAuth();
  const [activeTab, setActiveTab] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedNiches, setSelectedNiches] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [commissionType, setCommissionType] = useState<string>("");
  const [commissionRange, setCommissionRange] = useState([0, 10000]);
  const [minimumPayout, setMinimumPayout] = useState([0]);
  const [minRating, setMinRating] = useState(0);
  const [showTrending, setShowTrending] = useState(false);
  const [showPriority, setShowPriority] = useState(false);
  const [sortBy, setSortBy] = useState("newest");

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      window.location.href = "/login";
    }
  }, [isAuthenticated, isLoading]);

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
    enabled: isAuthenticated && activeTab === "all",
  });

  // Trending offers query (most applied in last 7 days)
  const { data: trendingOffersData, isLoading: trendingLoading } = useQuery<any[]>({
    queryKey: ["/api/offers/trending"],
    queryFn: async () => {
      const res = await fetch('/api/offers/trending', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch trending offers');
      return res.json();
    },
    enabled: isAuthenticated && activeTab === "trending",
  });

  // Recommended offers query (based on creator niches)
  const { data: recommendedOffersData, isLoading: recommendedLoading } = useQuery<any[]>({
    queryKey: ["/api/offers/recommended"],
    queryFn: async () => {
      const res = await fetch('/api/offers/recommended', { credentials: 'include' });
      if (!res.ok) {
        if (res.status === 404) {
          return [];
        }
        throw new Error('Failed to fetch recommended offers');
      }
      const data = await res.json();
      // Handle error responses from backend
      if (data.error) {
        return [];
      }
      return data;
    },
    enabled: isAuthenticated && activeTab === "recommended",
  });

  const categoryOptions = useMemo(
    () => [
      { label: "All", value: "all" },
      ...niches.map((niche) => ({ label: niche.name, value: normalizeNicheValue(niche.name) })),
    ],
    [niches],
  );

  useEffect(() => {
    if (selectedCategory !== "all" && !categoryOptions.some((option) => option.value === selectedCategory)) {
      setSelectedCategory("all");
    }
  }, [categoryOptions, selectedCategory]);

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

  // New listings query (recently approved)
  const { data: newListingsData, isLoading: newListingsLoading } = useQuery<any[]>({
    queryKey: ["/api/offers/new"],
    queryFn: async () => {
      const res = await fetch('/api/offers?sortBy=newest', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch new listings');
      return res.json();
    },
    enabled: isAuthenticated && activeTab === "new",
  });

  // Highest commission query
  const { data: highestCommissionData, isLoading: highestCommissionLoading } = useQuery<any[]>({
    queryKey: ["/api/offers/highest-commission"],
    queryFn: async () => {
      const res = await fetch('/api/offers?sortBy=highest_commission', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch highest commission offers');
      return res.json();
    },
    enabled: isAuthenticated && activeTab === "highest-commission",
  });

  // Get current data based on active tab
  const getCurrentOffers = () => {
    switch (activeTab) {
      case "trending":
        return trendingOffersData || [];
      case "recommended":
        return recommendedOffersData || [];
      case "new":
        return newListingsData || [];
      case "highest-commission":
        return highestCommissionData || [];
      default:
        return offers || [];
    }
  };

  // Get loading state based on active tab
  const isCurrentLoading = () => {
    switch (activeTab) {
      case "trending":
        return trendingLoading;
      case "recommended":
        return recommendedLoading;
      case "new":
        return newListingsLoading;
      case "highest-commission":
        return highestCommissionLoading;
      default:
        return offersLoading;
    }
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

    // Category filter (from category pills)
    if (selectedCategory !== "all" && !offerNiches.includes(selectedCategory)) {
      return false;
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

  // Get trending offers for the trending section (only on "all" tab)
  const trendingOffers = activeTab === "all" ? sortedOffers
    ?.filter(offer => isPriorityOffer(offer) || getCommissionValue(offer) > 15)
    ?.slice(0, 4) || [] : [];

  const regularOffers = activeTab === "all" ? sortedOffers || [] : sortedOffers;

  const toggleNiche = (niche: string) => {
    setSelectedNiches(prev =>
      prev.includes(niche) ? prev.filter(n => n !== niche) : [...prev, niche]
    );
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
    setSelectedCategory("all");
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
      toast({
        title: "Error",
        description: "Failed to update favorites",
        variant: "destructive",
      });
    },
  });

  const handleFavoriteToggle = (e: React.MouseEvent, offerId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const isFav = favorites.some(f => f.offerId === offerId);
    favoriteMutation.mutate({ offerId, isFav });
  };

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="animate-pulse text-lg">Loading...</div>
    </div>;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top Navigation Bar */}
      <TopNavBar>
        <div className="relative flex-1 max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search offers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-muted/50"
            data-testid="input-search-header"
          />
        </div>
      </TopNavBar>

      {/* Main Content */}
      <div className="max-w-[1600px] mx-auto px-6 py-8 space-y-8">
        {/* Header - Left Aligned, Black Text */}
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-foreground">Browse Offers</h1>
          <p className="text-muted-foreground text-base">Discover exclusive affiliate opportunities from verified brands</p>
        </div>

        {/* Tabs Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5 h-auto p-1">
            <TabsTrigger value="all" className="flex items-center gap-2 py-3">
              <Star className="h-4 w-4" />
              <span>All Offers</span>
            </TabsTrigger>
            <TabsTrigger value="trending" className="flex items-center gap-2 py-3">
              <TrendingUp className="h-4 w-4" />
              <span>Trending</span>
            </TabsTrigger>
            <TabsTrigger value="highest-commission" className="flex items-center gap-2 py-3">
              <DollarSign className="h-4 w-4" />
              <span>Highest Commission</span>
            </TabsTrigger>
            <TabsTrigger value="new" className="flex items-center gap-2 py-3">
              <Clock className="h-4 w-4" />
              <span>New Listings</span>
            </TabsTrigger>
            <TabsTrigger value="recommended" className="flex items-center gap-2 py-3">
              <Sparkles className="h-4 w-4" />
              <span>For You</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Category Pills - Horizontal Scroll */}
        {/* Category Pills - Horizontal Scroll */}
<ScrollArea orientation="horizontal" className="w-full pb-3">
  <div className="flex gap-2 pb-1 pr-4 overflow-x-auto scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
    {categoryOptions.map(({ label, value }) => (
      <button
        key={value || label}
        onClick={() => setSelectedCategory(value)}
        className={`px-5 py-2.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
          selectedCategory === value
            ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25'
            : 'bg-secondary/50 hover:bg-secondary text-secondary-foreground'
        }`}
        aria-pressed={selectedCategory === value}
      >
        {label}
      </button>
    ))}
  </div>
</ScrollArea>

        {/* Filters Row */}
        <div className="flex items-center gap-4">
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-52" data-testid="select-sort">
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
              <Button variant="outline" data-testid="button-filters" className="gap-2">
                <SlidersHorizontal className="h-4 w-4" />
                Filters
                {(selectedNiches.length > 0 || commissionType || minimumPayout[0] > 0 || minRating > 0 || showTrending || showPriority) && (
                  <Badge variant="secondary" className="ml-1">
                    {selectedNiches.length + (commissionType ? 1 : 0) + (minimumPayout[0] > 0 ? 1 : 0) + (minRating > 0 ? 1 : 0) + (showTrending ? 1 : 0) + (showPriority ? 1 : 0)}
                  </Badge>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Filter Offers</SheetTitle>
                <SheetDescription>Refine your search with advanced filters</SheetDescription>
              </SheetHeader>

              <div className="space-y-6 mt-6">
                {/* Niche Filter */}
                <div className="space-y-3">
                  <Label>Niche/Category</Label>
                  <div className="space-y-2">
                    {nichesLoading ? (
                      <div className="text-sm text-muted-foreground">Loading niches...</div>
                    ) : niches.length === 0 ? (
                      <div className="text-sm text-muted-foreground">No niches available</div>
                    ) : (
                      niches.map((niche) => {
                        const normalizedValue = normalizeNicheValue(niche.name);
                        return (
                          <div key={niche.id} className="flex items-center gap-2">
                            <Checkbox
                              id={`niche-${niche.id}`}
                              checked={selectedNiches.includes(normalizedValue)}
                              onCheckedChange={() => toggleNiche(normalizedValue)}
                              data-testid={`checkbox-niche-${niche.name}`}
                            />
                            <Label
                              htmlFor={`niche-${niche.id}`}
                              className="text-sm font-normal cursor-pointer"
                            >
                              {niche.name}
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

                <div className="pt-4 flex gap-3">
                  <Button onClick={clearFilters} variant="outline" className="flex-1" data-testid="button-clear-filters">
                    Clear All
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
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
            {/* Trending Offers Section - Only on "all" tab */}
            {activeTab === "all" && trendingOffers.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-orange-500" />
                <h2 className="text-2xl font-bold text-foreground">Trending Offers</h2>
              </div>
              <Button variant="ghost" className="gap-1 text-primary hover:gap-2 transition-all">
                See All <ArrowRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {trendingOffers.map((offer) => {
                const isFavorite = favorites.some(f => f.offerId === offer.id);
                const category = getOfferCategory(offer);
                const isRetainer = offer.commissionType === 'monthly_retainer';

                // Check if creator has applied to this offer
                const application = applications.find((app: any) => app.offerId === offer.id);
                const hasApplied = !!application;
                const commissionDisplay = getCommissionDisplay(offer);

                return (
                  <Link key={offer.id} href={`/offers/${offer.id}`}>
                    <Card className={`group hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer overflow-visible h-full ${
                      isRetainer ? 'ring-2 ring-purple-400/50 hover:ring-purple-500 hover:shadow-purple-500/20' : ''
                    }`}>
                      {/* Thumbnail Container with Logo */}
                      <div className="relative">
                        {/* Clean Thumbnail - No Gradient Overlay */}
                        <div className={`aspect-video relative overflow-hidden rounded-t-lg ${
                          isRetainer
                            ? 'bg-gradient-to-br from-purple-100 via-violet-100 to-indigo-100'
                            : 'bg-gradient-to-br from-purple-100 to-pink-100'
                        }`}>
                          {!isRetainer && offer.featuredImageUrl ? (
                            <img
                              src={proxiedSrc(offer.featuredImageUrl)}
                              alt={offer.title}
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          ) : !isRetainer ? (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <Play className="h-12 w-12 text-muted-foreground/30" />
                            </div>
                          ) : null}

                          {/* Favorite button - Top Left */}
                          <button
                            className="absolute top-3 left-3 rounded-full flex items-center justify-center transition-all hover:scale-110 shadow-md backdrop-blur-sm"
                            style={{
                              width: '36px',
                              height: '36px',
                              backgroundColor: 'rgba(255, 255, 255, 0.95)',
                              border: 'none',
                              cursor: 'pointer',
                              zIndex: 10
                            }}
                            onClick={(e) => handleFavoriteToggle(e, offer.id)}
                            data-testid={`button-favorite-${offer.id}`}
                          >
                            <Heart className={`h-5 w-5 transition-all ${isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-600'}`} />
                          </button>

                          {/* Category Badge - Top Right */}
                          {category && (
                            <div className={`absolute top-0 right-0 ${category.color} text-white px-3 py-1.5 rounded-bl-lg shadow-lg font-bold text-xs tracking-wide`}>
                              {category.label}
                            </div>
                          )}
                        </div>

                        {/* Company Logo - Positioned outside thumbnail but inside wrapper */}
                        {!isRetainer && offer.company?.logoUrl && (
                          <div className="absolute -bottom-7 left-4 h-14 w-14 rounded-xl overflow-hidden bg-white shadow-lg border-2 border-background z-20">
                            <img
                              src={offer.company.logoUrl}
                              alt={offer.company.tradeName}
                              className="h-full w-full object-cover"
                            />
                          </div>
                        )}
                      </div>

                      <CardContent className="p-5 pt-8 space-y-3">
                        {/* Title */}
                        <h3 className="font-semibold text-base line-clamp-2 text-foreground leading-snug">
                          {offer.title}
                        </h3>

                        {/* Company Name */}
                        {offer.company?.tradeName && (
                          <p className="text-sm text-muted-foreground">
                            {offer.company.tradeName}
                          </p>
                        )}

                        {/* Hashtag Badges */}
                        <div className="flex flex-wrap gap-1.5">
                          {offer.primaryNiche && (
                            <Badge variant="secondary" className="text-xs font-normal">
                              #{offer.primaryNiche}
                            </Badge>
                          )}
                          {offer.secondaryNiche && (
                            <Badge variant="secondary" className="text-xs font-normal">
                              #{offer.secondaryNiche}
                            </Badge>
                          )}
                        </div>

                        {/* Commission and Stats */}
                        <div className="flex items-end justify-between pt-2">
                          <div>
                            <div className={`text-2xl font-bold ${
                              isRetainer ? 'text-purple-600 group-hover:text-purple-700' : 'text-green-600'
                            } transition-colors`}>
                              {commissionDisplay.isCurrency
                                ? `$${commissionDisplay.value}`
                                : commissionDisplay.value}
                            </div>
                            <div className={`text-xs ${
                              isRetainer ? 'text-purple-600/70 font-medium' : 'text-muted-foreground'
                            }`}>
                              {getCommissionTypeLabel(offer)}
                            </div>
                          </div>

                          {/* Active creators */}
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Users className="h-4 w-4" />
                            <span>{offer.activeCreatorsCount || 0} active</span>
                          </div>
                        </div>

                        {/* Application Status */}
                        {hasApplied && application && (
                          <div className="pt-3 border-t mt-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Badge variant={getApplicationStatusBadge(application.status).variant}>
                                  {getApplicationStatusBadge(application.status).label}
                                </Badge>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Applied: {formatApplicationDate(application.createdAt)}
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
          </div>
        )}

            {/* Main Offers Grid */}
            <div className="space-y-4">
              {/* Tab-specific headers */}
              {activeTab === "all" && regularOffers.length > 0 && trendingOffers.length > 0 && (
                <h2 className="text-2xl font-bold text-foreground">All Offers</h2>
              )}
              {activeTab === "trending" && regularOffers.length > 0 && (
                <h2 className="text-2xl font-bold text-foreground">Trending Offers</h2>
              )}
              {activeTab === "highest-commission" && regularOffers.length > 0 && (
                <h2 className="text-2xl font-bold text-foreground">Highest Commission</h2>
              )}
              {activeTab === "new" && regularOffers.length > 0 && (
                <h2 className="text-2xl font-bold text-foreground">New Listings</h2>
              )}
              {activeTab === "recommended" && regularOffers.length > 0 && (
                <h2 className="text-2xl font-bold text-foreground">Recommended For You</h2>
              )}

              {!regularOffers || regularOffers.length === 0 ? (
            <Card className="border-dashed border-2">
              <CardContent className="p-16 text-center">
                <div className="mx-auto w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mb-6">
                  <TrendingUp className="h-10 w-10 text-muted-foreground/50" />
                </div>
                <h3 className="font-semibold text-xl mb-2">No offers found</h3>
                <p className="text-muted-foreground mb-6">Try adjusting your filters or search terms</p>
                <Button onClick={clearFilters} variant="outline">
                  Clear Filters
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
              {regularOffers.map((offer) => {
                const isFavorite = favorites.some(f => f.offerId === offer.id);
                const category = getOfferCategory(offer);
                const isRetainer = offer.commissionType === 'monthly_retainer';

                const commissionDisplay = getCommissionDisplay(offer);

                // Check if creator has applied to this offer
                const application = applications.find((app: any) => app.offerId === offer.id);
                const hasApplied = !!application;

                return (
                  <Link key={offer.id} href={`/offers/${offer.id}`}>
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
                                console.error(`Image failed to load: ${offer.title}`, offer.featuredImageUrl);
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
                            top: '12px',
                            left: '12px',
                            width: '36px',
                            height: '36px',
                            backgroundColor: 'rgba(255, 255, 255, 0.95)',
                            zIndex: 10,
                            border: 'none',
                            cursor: 'pointer'
                          }}
                          onClick={(e) => handleFavoriteToggle(e, offer.id)}
                          data-testid={`button-favorite-${offer.id}`}
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

                      <CardContent className="p-5 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-semibold text-base line-clamp-1 flex-1">{offer.title}</h3>
                          {!isRetainer && offer.company?.logoUrl && (
                            <img src={offer.company.logoUrl} alt={offer.company.tradeName} className="h-9 w-9 rounded-full object-cover ring-2 ring-border" />
                          )}
                        </div>

                        <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">{offer.shortDescription}</p>

                        <div className="flex flex-wrap gap-1.5">
                          {offer.primaryNiche && (
                            <Badge variant="outline" className={`text-xs border ${NICHE_COLORS[offer.primaryNiche] || 'bg-secondary'}`}>
                              {offer.primaryNiche}
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t">
                          <div className="flex items-center gap-1.5 text-sm">
                            <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                            <span className="font-medium text-foreground">{offer.company?.averageRating?.toFixed(1) || '5.0'}</span>
                          </div>
                          <div className={`flex items-center gap-1 font-mono font-bold ${
                            isRetainer ? 'text-purple-600 group-hover:text-purple-700' : 'text-primary'
                          } transition-colors`}>
                            {commissionDisplay.isCurrency && <DollarSign className="h-4 w-4" />}
                            {commissionDisplay.value}
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-sm text-muted-foreground">
                          <div className="flex items-center gap-1.5">
                            <Users className="h-4 w-4" />
                            <span>{offer.activeCreatorsCount || 0} active</span>
                          </div>
                        </div>

                        {/* Application Status */}
                        {hasApplied && application && (
                          <div className="pt-3 border-t">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Badge variant={getApplicationStatusBadge(application.status).variant}>
                                  {getApplicationStatusBadge(application.status).label}
                                </Badge>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Applied: {formatApplicationDate(application.createdAt)}
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
          )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}