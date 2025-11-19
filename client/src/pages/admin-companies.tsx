import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/use-toast";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Building2, ExternalLink, Filter, X } from "lucide-react";
import { TopNavBar } from "../components/TopNavBar";
import { useLocation } from "wouter";

type Company = {
  id: string;
  legalName: string;
  tradeName?: string;
  industry?: string;
  websiteUrl?: string;
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  createdAt: string;
  approvedAt?: string;
  isDeletedUser?: boolean;
  user?: {
    email: string;
    username: string;
  };
};

export default function AdminCompanies() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [, navigate] = useLocation();

  // Filter states
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [industryFilter, setIndustryFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/login";
      }, 500);
    }
  }, [isAuthenticated, isLoading, toast]);

  // Fetch all companies with filters
  const buildQueryParams = () => {
    const params = new URLSearchParams();
    if (statusFilter && statusFilter !== "all") {
      params.append("status", statusFilter);
    }
    if (industryFilter && industryFilter !== "all") {
      params.append("industry", industryFilter);
    }
    return params.toString();
  };

  const { data: companies = [], isLoading: loadingCompanies } = useQuery<Company[]>({
    queryKey: ["/api/admin/companies/all", statusFilter, industryFilter],
    queryFn: async () => {
      const queryParams = buildQueryParams();
      const url = `/api/admin/companies/all${queryParams ? `?${queryParams}` : ''}`;
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch companies");
      return response.json();
    },
    enabled: isAuthenticated,
  });

  // Filter companies by search query (client-side)
  const filteredCompanies = companies.filter((company) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      company.legalName?.toLowerCase().includes(query) ||
      company.tradeName?.toLowerCase().includes(query) ||
      company.user?.email?.toLowerCase().includes(query) ||
      company.user?.username?.toLowerCase().includes(query)
    );
  });

  // Get unique industries for filter dropdown
  const uniqueIndustries = Array.from(
    new Set(companies.map((c) => c.industry).filter(Boolean))
  ).sort();

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; className?: string }> = {
      pending: { variant: "secondary" },
      approved: { variant: "default", className: "bg-green-600 hover:bg-green-700" },
      rejected: { variant: "destructive" },
      suspended: { variant: "outline", className: "border-orange-500 text-orange-700 dark:text-orange-400" },
    };
    return variants[status] || { variant: "secondary" };
  };

  const clearFilters = () => {
    setStatusFilter("all");
    setIndustryFilter("all");
    setSearchQuery("");
  };

  const hasActiveFilters = statusFilter !== "all" || industryFilter !== "all" || searchQuery;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <TopNavBar />

      <div>
        <h1 className="text-3xl font-bold">Company Management</h1>
        <p className="text-muted-foreground mt-1">
          Manage all companies on the platform
        </p>
      </div>

      {/* Filters Section */}
      <Card className="border-card-border">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold">Filters</h3>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="ml-auto text-xs"
              >
                <X className="h-3 w-3 mr-1" />
                Clear Filters
              </Button>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {/* Search */}
            <div>
              <label className="text-sm font-medium mb-2 block">Search</label>
              <Input
                placeholder="Search by name, email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Status Filter */}
            <div>
              <label className="text-sm font-medium mb-2 block">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Industry Filter */}
            <div>
              <label className="text-sm font-medium mb-2 block">Industry</label>
              <Select value={industryFilter} onValueChange={setIndustryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All industries" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Industries</SelectItem>
                  {uniqueIndustries.map((industry) => (
                    <SelectItem key={industry} value={industry!}>
                      {industry}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Summary */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {filteredCompanies.length} of {companies.length} companies
        </p>
      </div>

      {/* Companies Table */}
      {loadingCompanies ? (
        <Card className="border-card-border">
          <CardContent className="flex items-center justify-center py-12">
            <div className="animate-pulse text-lg">Loading companies...</div>
          </CardContent>
        </Card>
      ) : filteredCompanies.length === 0 ? (
        <Card className="border-card-border">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No companies found</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              {hasActiveFilters
                ? "Try adjusting your filters to see more results"
                : "No companies have registered yet"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-card-border">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Industry</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCompanies.map((company) => (
                  <TableRow key={company.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 shrink-0">
                          <Building2 className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <div className="font-medium">{company.legalName}</div>
                          {company.tradeName && company.tradeName !== company.legalName && (
                            <div className="text-xs text-muted-foreground">
                              {company.tradeName}
                            </div>
                          )}
                          {company.websiteUrl && (
                            <a
                              href={company.websiteUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              Website
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{company.industry || "—"}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm space-y-1">
                        <div className={company.isDeletedUser ? "line-through text-muted-foreground" : undefined}>
                          {company.user?.email || "—"}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                          <span>@{company.user?.username}</span>
                          {company.isDeletedUser && <Badge variant="outline" className="text-[10px]">Deleted</Badge>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        {...getStatusBadge(company.status)}
                      >
                        {company.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {new Date(company.createdAt).toLocaleDateString()}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/admin/companies/${company.id}`)}
                      >
                        View Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}
