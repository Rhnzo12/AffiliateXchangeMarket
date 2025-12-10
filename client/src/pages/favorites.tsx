import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useCreatorPageTour } from "../components/CreatorTour";
import { CREATOR_TOUR_IDS, favoritesTourSteps } from "../lib/creatorTourConfig";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Heart, Star, Play, X, Filter, Search } from "lucide-react";
import { Link } from "wouter";
import { proxiedSrc } from "../lib/image";
import { apiRequest, queryClient } from "../lib/queryClient";
import { TopNavBar } from "../components/TopNavBar";
import { CardGridSkeleton } from "../components/skeletons";
import { Input } from "../components/ui/input";
import { GenericErrorDialog } from "../components/GenericErrorDialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";

// Helper function to format commission display
const formatCommission = (offer: any) => {
  if (!offer) return "$0";
  
  if (offer.commissionAmount) {
    return `$${offer.commissionAmount}`;
  } else if (offer.commissionPercentage) {
    return `${offer.commissionPercentage}%`;
  } else if (offer.commissionRate) {
    return `$${offer.commissionRate}`;
  }
  return "$0";
};

export default function Favorites() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();

  // Quick Guide Tour
  useCreatorPageTour(CREATOR_TOUR_IDS.FAVORITES, favoritesTourSteps);

  const [searchTerm, setSearchTerm] = useState("");
  const [nicheFilter, setNicheFilter] = useState("all");
  const [commissionFilter, setCommissionFilter] = useState("all");
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

  const { data: favorites, isLoading: favoritesLoading } = useQuery<any[]>({
    queryKey: ["/api/favorites"],
    enabled: isAuthenticated,
  });

  const uniqueNiches = useMemo(() => {
    const set = new Set<string>();
    (favorites || []).forEach((favorite: any) => {
      const offer = favorite.offer;
      if (offer?.primaryNiche) set.add(offer.primaryNiche);
      if (offer?.secondaryNiche) set.add(offer.secondaryNiche);
    });
    return Array.from(set);
  }, [favorites]);

  const uniqueCommissionTypes = useMemo(() => {
    return Array.from(
      new Set(
        (favorites || [])
          .map((favorite: any) => favorite.offer?.commissionType)
          .filter(Boolean)
      )
    );
  }, [favorites]);

  const filteredFavorites = useMemo(() => {
    return (favorites || []).filter((favorite: any) => {
      const offer = favorite.offer;
      if (!offer) return false;
      const matchesSearch = searchTerm
        ? [offer.title, offer.company?.tradeName, offer.shortDescription, offer.description]
            .filter(Boolean)
            .some((value) => value.toLowerCase().includes(searchTerm.toLowerCase()))
        : true;
      const matchesNiche =
        nicheFilter === "all" || offer.primaryNiche === nicheFilter || offer.secondaryNiche === nicheFilter;
      const matchesCommission = commissionFilter === "all" || offer.commissionType === commissionFilter;
      return matchesSearch && matchesNiche && matchesCommission;
    });
  }, [commissionFilter, favorites, nicheFilter, searchTerm]);

  const hasActiveFilters =
    searchTerm.trim().length > 0 || nicheFilter !== "all" || commissionFilter !== "all";

  const clearFilters = () => {
    setSearchTerm("");
    setNicheFilter("all");
    setCommissionFilter("all");
  };

  const removeFavoriteMutation = useMutation({
    mutationFn: async (offerId: string) => {
      await apiRequest("DELETE", `/api/favorites/${offerId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/favorites"] });
      toast({
        title: "Removed from favorites",
        description: "Offer removed from your favorites list",
      });
    },
    onError: (error: any) => {
      setErrorDialog({
        open: true,
        title: "Error",
        description: "Failed to remove favorite",
      });
    },
  });

  const handleRemoveFavorite = (e: React.MouseEvent, offerId: string) => {
    e.preventDefault();
    e.stopPropagation();
    removeFavoriteMutation.mutate(offerId);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="animate-pulse text-lg">Loading...</div>
    </div>;
  }

  return (
    <div className="space-y-6">
      <TopNavBar />
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Favorite Offers</h1>
        <p className="text-muted-foreground mt-1">
          {favorites && favorites.length > 0 
            ? `${favorites.length} saved ${favorites.length === 1 ? 'offer' : 'offers'}`
            : 'Your saved offers for later'
          }
        </p>
      </div>

      <Card className="border-card-border">
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Filter className="h-4 w-4" />
              <span className="text-sm font-semibold uppercase tracking-wider">Search & Filter</span>
            </div>
            <div className="sm:ml-auto text-sm text-muted-foreground">
              Showing <span className="font-semibold text-foreground">{filteredFavorites.length}</span> of {favorites?.length || 0}
              {` favorite${(favorites?.length || 0) === 1 ? "" : "s"}`}
            </div>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" className="text-xs sm:ml-4" onClick={clearFilters}>
                <X className="h-3 w-3 mr-1" />
                Clear Filters
              </Button>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2 md:col-span-1">
              <label className="text-sm font-medium">Search</label>
              <Input
                placeholder="Search saved offers"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Niche</label>
              <Select value={nicheFilter} onValueChange={setNicheFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All niches" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Niches</SelectItem>
                  {uniqueNiches.map((niche) => (
                    <SelectItem key={niche} value={niche}>
                      {niche}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Commission Type</label>
              <Select value={commissionFilter} onValueChange={setCommissionFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All commission types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {uniqueCommissionTypes.map((type) => (
                    <SelectItem key={type} value={type} className="capitalize">
                      {type.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Favorites Grid */}
      {favoritesLoading ? (
        <CardGridSkeleton count={8} />
      ) : !favorites || favorites.length === 0 ? (
        <Card className="border-card-border">
          <CardContent className="p-12 text-center">
            <Heart className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-2">No favorites yet</h3>
            <p className="text-muted-foreground mb-4">Save offers by clicking the heart icon</p>
            <Link href="/browse">
              <Button>Browse Offers</Button>
            </Link>
          </CardContent>
        </Card>
      ) : filteredFavorites.length === 0 ? (
        <Card className="border-card-border">
          <CardContent className="p-12 text-center space-y-2">
            <Search className="h-10 w-10 text-muted-foreground/40 mx-auto" />
            <h3 className="font-semibold text-lg">No favorites match your filters</h3>
            <p className="text-sm text-muted-foreground">Try adjusting your search or clearing the filters.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredFavorites.map((favorite: any) => {
            const offer = favorite.offer;
            if (!offer) return null; // Skip if offer data is missing
            
            return (
              <Link key={favorite.id} href={`/offers/${offer.id}`}>
                <Card className="hover-elevate cursor-pointer border-card-border h-full" data-testid={`favorite-${offer.id}`}>
                  <div className="aspect-video relative bg-muted rounded-t-lg overflow-hidden">
                    {offer.featuredImageUrl ? (
                      <img src={proxiedSrc(offer.featuredImageUrl)} alt={offer.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Play className="h-12 w-12 text-muted-foreground/50" />
                      </div>
                    )}
                    {offer.isPriority && (
                      <Badge className="absolute top-2 right-2 bg-primary">
                        Featured
                      </Badge>
                    )}
                    <button
                      className="absolute top-2 left-2 h-8 w-8 rounded-full bg-red-500/90 backdrop-blur flex items-center justify-center hover:bg-red-600 transition-colors"
                      onClick={(e) => handleRemoveFavorite(e, offer.id)}
                      title="Remove from favorites"
                    >
                      <X className="h-4 w-4 text-white" />
                    </button>
                  </div>

                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold line-clamp-1 flex-1">{offer.title}</h3>
                      {offer.company?.logoUrl && (
                        <img
                          src={proxiedSrc(offer.company.logoUrl)}
                          alt={offer.company.tradeName}
                          className="h-8 w-8 rounded-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      )}
                    </div>
                    
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {offer.shortDescription || offer.description || "No description available"}
                    </p>

                    <div className="flex flex-wrap gap-1">
                      {offer.primaryNiche && (
                        <Badge variant="secondary" className="text-xs">{offer.primaryNiche}</Badge>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Star className="h-3 w-3 fill-primary text-primary" />
                        <span>{offer.company?.averageRating?.toFixed(1) || '5.0'}</span>
                      </div>
                      <div className="font-mono font-semibold text-primary">
                        {formatCommission(offer)}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {/* Error Dialog */}
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