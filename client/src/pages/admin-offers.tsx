import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/use-toast";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  TrendingUp,
  DollarSign,
  Eye,
  Filter,
  X
} from "lucide-react";
import { TopNavBar } from "../components/TopNavBar";
import { useLocation, useRoute } from "wouter";
import { GenericErrorDialog } from "../components/GenericErrorDialog";

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  draft: { label: "Draft", variant: "outline" },
  pending_review: { label: "Pending", variant: "secondary" },
  approved: { label: "Live", variant: "default" },
  paused: { label: "Paused", variant: "outline" },
  archived: { label: "Archived", variant: "destructive" },
};

const COMMISSION_TYPES = [
  { value: "per_sale", label: "Per Sale" },
  { value: "per_lead", label: "Per Lead" },
  { value: "per_click", label: "Per Click" },
  { value: "monthly_retainer", label: "Monthly Retainer" },
  { value: "hybrid", label: "Hybrid" },
];

export default function AdminOffers() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [, navigate] = useLocation();

  const [filters, setFilters] = useState({
    status: "",
    niche: "",
    commissionType: "",
    search: "",
  });
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

  const queryParams = new URLSearchParams();
  if (filters.status && filters.status !== "all") queryParams.append("status", filters.status);
  if (filters.niche && filters.niche !== "all") queryParams.append("niche", filters.niche);
  if (filters.commissionType && filters.commissionType !== "all") queryParams.append("commissionType", filters.commissionType);

  const { data: offers = [], isLoading: loadingOffers } = useQuery<any[]>({
    queryKey: ["/api/admin/offers", filters.status, filters.niche, filters.commissionType],
    queryFn: async () => {
      const response = await fetch(`/api/admin/offers?${queryParams.toString()}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error("Failed to fetch offers");
      return response.json();
    },
    enabled: isAuthenticated,
  });

  // Fetch niches from API
  const { data: niches = [], isLoading: nichesLoading } = useQuery<Array<{ id: string; name: string; description: string | null; isActive: boolean }>>({
    queryKey: ["/api/niches"],
  });

  const filteredOffers = offers.filter((offer) => {
    if (!filters.search) return true;
    const searchLower = filters.search.toLowerCase();
    return (
      offer.title?.toLowerCase().includes(searchLower) ||
      offer.productName?.toLowerCase().includes(searchLower) ||
      offer.shortDescription?.toLowerCase().includes(searchLower)
    );
  });

  const clearFilters = () => {
    setFilters({
      status: "",
      niche: "",
      commissionType: "",
      search: "",
    });
  };

  const hasActiveFilters = filters.status || filters.niche || filters.commissionType || filters.search;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <TopNavBar />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Offer Management</h1>
          <p className="text-muted-foreground mt-1">
            Manage all affiliate offers across the platform
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <TrendingUp className="h-4 w-4" />
          <span>{filteredOffers.length} offers</span>
        </div>
      </div>

      {/* Filters */}
      <Card className="border-card-border">
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filters</span>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="ml-auto h-8 px-2 lg:px-3"
                >
                  Clear filters
                  <X className="ml-2 h-4 w-4" />
                </Button>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <Input
                  placeholder="Search offers..."
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  className="h-9"
                />
              </div>

              <Select
                value={filters.status}
                onValueChange={(value) => setFilters({ ...filters, status: value })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="pending_review">Pending</SelectItem>
                  <SelectItem value="approved">Live</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={filters.niche}
                onValueChange={(value) => setFilters({ ...filters, niche: value })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All Niches" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Niches</SelectItem>
                  {nichesLoading ? (
                    <SelectItem value="loading" disabled>Loading...</SelectItem>
                  ) : (
                    niches.map((niche) => (
                      <SelectItem key={niche.id} value={niche.name}>
                        {niche.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>

              <Select
                value={filters.commissionType}
                onValueChange={(value) => setFilters({ ...filters, commissionType: value })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All Commission Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {COMMISSION_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-card-border">
        <CardContent className="p-0">
          {loadingOffers ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-pulse text-sm text-muted-foreground">Loading offers...</div>
            </div>
          ) : filteredOffers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <TrendingUp className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No offers found</h3>
              <p className="text-sm text-muted-foreground text-center max-w-md">
                {hasActiveFilters
                  ? "Try adjusting your filters to see more results"
                  : "No offers have been created yet"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Offer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Niche</TableHead>
                  <TableHead>Commission</TableHead>
                  <TableHead className="text-center">Applications</TableHead>
                  <TableHead className="text-center">Views</TableHead>
                  <TableHead className="text-center">Active</TableHead>
                  <TableHead className="text-center">Clicks</TableHead>
                  <TableHead className="text-center">Featured</TableHead>
                  <TableHead className="text-right sticky right-0 bg-background shadow-[-8px_0_12px_-6px_rgba(0,0,0,0.1)]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOffers.map((offer: any) => (
                  <TableRow key={offer.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 shrink-0">
                          <TrendingUp className="h-5 w-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium line-clamp-1">{offer.title}</div>
                          <div className="text-xs text-muted-foreground line-clamp-1">
                            {offer.productName}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_MAP[offer.status]?.variant || "secondary"}>
                        {STATUS_MAP[offer.status]?.label || offer.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {offer.primaryNiche}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <DollarSign className="h-3 w-3" />
                        {offer.commissionPercentage
                          ? `${offer.commissionPercentage}%`
                          : offer.commissionAmount
                          ? `$${offer.commissionAmount}`
                          : offer.retainerAmount
                          ? `$${offer.retainerAmount}`
                          : 'N/A'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {offer.commissionType?.replace(/_/g, ' ') || 'N/A'}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {offer.applicationCount || 0}
                    </TableCell>
                    <TableCell className="text-center">
                      {offer.viewCount || 0}
                    </TableCell>
                    <TableCell className="text-center">
                      {offer.activeCreatorsCount || 0}
                    </TableCell>
                    <TableCell className="text-center">
                      {offer.totalClicks || 0}
                    </TableCell>
                    <TableCell className="text-center">
                      {offer.featuredOnHomepage ? (
                        <Badge variant="default" className="text-xs">Featured</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right sticky right-0 bg-background shadow-[-8px_0_12px_-6px_rgba(0,0,0,0.1)]">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/admin-offer-detail/${offer.id}`)}
                        className="gap-2"
                      >
                        <Eye className="h-4 w-4" />
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

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
