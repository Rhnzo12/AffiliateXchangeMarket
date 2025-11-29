import { Switch, Route, useLocation, Link } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "./components/ui/toaster";
import { TooltipProvider } from "./components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "./components/ui/sidebar";
import { AppSidebar } from "./components/app-sidebar";
import { CookieConsent } from "./components/CookieConsent";
import { useAuth } from "./hooks/useAuth";
import { NotificationCenter } from "./components/NotificationCenter";
import { Avatar, AvatarFallback, AvatarImage } from "./components/ui/avatar";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "./components/ui/dropdown-menu";
import { Settings as SettingsIcon, ChevronDown, LogOut, MessageSquare } from "lucide-react";
import { proxiedSrc } from "./lib/image";
import NotFound from "./pages/not-found";
import Landing from "./pages/landing";
import CreatorDashboard from "./pages/creator-dashboard";
import Browse from "./pages/browse";
import OfferDetail from "./pages/offer-detail";
import Applications from "./pages/applications";
import ApplicationDetail from "./pages/application-detail";
import Analytics from "./pages/analytics";
import Messages from "./pages/messages";
import Favorites from "./pages/favorites";
import CreatorRetainers from "./pages/creator-retainers";
import CreatorRetainerDetail from "./pages/creator-retainer-detail";
import Settings from "./pages/settings";
import PaymentSettings from "./pages/payment-settings";
import PaymentDetail from "./pages/payment-details";
import Notifications from "./pages/notifications";
import NotificationDetail from "./pages/notification-detail";
import CompanyDashboard from "./pages/company-dashboard";
import CompanyOffers from "./pages/company-offers";
import CompanyOfferCreate from "./pages/company-offer-create";
import CompanyOfferDetail from "./pages/company-offer-detail";
import CompanyApplications from "./pages/company-applications";
import CompanyCreators from "./pages/company-creators";
import CompanyReviews from "./pages/company-reviews";
import CompanyVideos from "./pages/company-videos";
import CompanyRetainers from "./pages/company-retainers";
import CompanyRetainerDetail from "./pages/company-retainer-detail";
import AdminDashboard from "./pages/admin-dashboard";
import AdminReviews from "./pages/admin-reviews";
import AdminCompanies from "./pages/admin-companies";
import AdminCompanyDetail from "./pages/admin-company-detail";
import AdminOffers from "./pages/admin-offers";
import AdminOfferDetail from "./pages/admin-offer-detail";
import AdminCreators from "./pages/admin-creators";
import AdminAuditLogs from "./pages/admin-audit-logs";
import AdminPlatformSettings from "./pages/admin-platform-settings";
import AdminMessages from "./pages/admin-messages";
import AdminPaymentDisputes from "./pages/admin-payment-disputes";
import AdminNiches from "./pages/admin-niches";
import AdminKeywordManagement from "./pages/admin-keyword-management";
import AdminModerationDashboard from "./pages/admin-moderation-dashboard";
import AdminEmailTemplates from "./pages/admin-email-templates";
import AdminAnalytics from "./pages/admin-analytics";
import Onboarding from "./pages/onboarding";
import CreatorOnboarding from "./pages/creator-onboarding";
import CompanyOnboarding from "./pages/company-onboarding";
import CompanyProfile from "./pages/company-profile";
import CompanyWebsiteVerification from "./pages/company-website-verification";
import Login from "./pages/login";
import Register from "./pages/register";
import SelectRole from "./pages/select-role";
import PrivacyPolicy from "./pages/privacy-policy";
import TermsOfService from "./pages/terms-of-service";

// Public routes that don't require authentication
function PublicRouter() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/select-role" component={SelectRole} />
      <Route path="/privacy-policy" component={PrivacyPolicy} />
      <Route path="/terms-of-service" component={TermsOfService} />
      <Route component={Landing} />
    </Switch>
  );
}

// Protected routes that require authentication
function ProtectedRouter() {
  const { isAuthenticated, isLoading, user } = useAuth();

  // Fetch conversations to get unread count
  const { data: conversations } = useQuery<any[]>({
    queryKey: ["/api/conversations"],
    enabled: !!user,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Calculate total unread messages
  const unreadCount = conversations?.reduce((total, conv) => {
    if (user?.role === 'company') {
      return total + (conv.companyUnreadCount || 0);
    } else {
      return total + (conv.creatorUnreadCount || 0);
    }
  }, 0) || 0;

  // Get user initials for avatar
  const getUserInitials = () => {
    if (!user) return "U";
    const firstName = user.firstName || user.email || "User";
    return firstName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });
      window.location.href = '/';
    } catch (error) {
      console.error('Logout error:', error);
      window.location.href = '/';
    }
  };

  // Redirect to login if not authenticated
  if (!isLoading && !isAuthenticated) {
    window.location.href = "/login";
    return null;
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-lg">Loading...</div>
      </div>
    );
  }

  // Custom sidebar width for the application
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between gap-4 px-4 sm:px-6 py-3 sm:py-4 border-b shrink-0 bg-background sticky top-0 z-50">
            <SidebarTrigger data-testid="button-sidebar-toggle" />

            {/* Right Side Navigation Icons */}
            <div className="flex items-center gap-2 sm:gap-3 ml-auto">
              {/* Messages Icon */}
              <Link href={user?.role === 'company' ? '/company/messages' : '/messages'}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative h-8 w-8 sm:h-9 sm:w-9 hover:bg-primary/10"
                >
                  <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5" />
                  {unreadCount > 0 && (
                    <Badge
                      variant="destructive"
                      className="absolute -top-1 -right-1 h-4 min-w-4 px-1 flex items-center justify-center text-[9px] font-bold leading-none rounded-full border border-background"
                    >
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </Badge>
                  )}
                </Button>
              </Link>

              {/* Notification Center with Dropdown */}
              <NotificationCenter />

              {/* Profile Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-1.5 sm:gap-2 md:gap-3 hover:opacity-80 transition-opacity focus:outline-none">
                    <Avatar className="h-8 w-8 sm:h-9 sm:w-9 border-2 border-primary/20 flex-shrink-0">
                      <AvatarImage
                        src={proxiedSrc(user?.profileImageUrl) || ''}
                        alt={user?.firstName || user?.email || 'User'}
                        referrerPolicy="no-referrer"
                      />
                      <AvatarFallback className="bg-primary text-primary-foreground font-semibold text-xs sm:text-sm">
                        {getUserInitials()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="text-left max-w-[100px] sm:max-w-[120px] md:max-w-[160px] min-w-0 hidden sm:block">
                      <p className="text-xs sm:text-sm font-medium leading-none text-foreground truncate">
                        {user?.firstName && user?.lastName
                          ? `${user.firstName} ${user.lastName}`
                          : user?.firstName || user?.email || 'User'}
                      </p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground leading-none capitalize truncate mt-0.5">
                        {user?.role || 'creator'}
                      </p>
                    </div>
                    <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-3 py-2 border-b">
                    <p className="text-sm font-medium">{user?.firstName || user?.email || 'User'}</p>
                    <p className="text-xs text-muted-foreground capitalize">{user?.role || 'creator'}</p>
                  </div>
                  <DropdownMenuItem asChild className="hover:bg-primary/20 hover:text-primary hover:font-bold hover:scale-105 transition-all duration-200 cursor-pointer">
                    <Link href="/settings">
                      <SettingsIcon className="mr-2 h-4 w-4" />
                      <span>Settings</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="hover:font-bold hover:scale-105 transition-all duration-200 cursor-pointer text-red-600 hover:text-red-700 hover:bg-red-50 focus:bg-red-50 focus:text-red-700"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log Out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            <div className="container max-w-screen-2xl mx-auto p-4 sm:p-6">
              <Switch>
                {/* Creator Routes */}
                {user?.role === 'creator' && (
                  <>
                    <Route path="/" component={CreatorDashboard} />
                    <Route path="/creator/dashboard" component={CreatorDashboard} />
                    <Route path="/browse" component={Browse} />
                    <Route path="/offers/:id" component={OfferDetail} />
                    <Route path="/retainers" component={CreatorRetainers} />
                    <Route path="/retainers/:id" component={CreatorRetainerDetail} />
                    <Route path="/applications" component={Applications} />
                    <Route path="/applications/:id" component={ApplicationDetail} />
                    <Route path="/analytics" component={Analytics} />
                    <Route path="/analytics/:id" component={Analytics} />
                    <Route path="/messages" component={Messages} />
                    <Route path="/favorites" component={Favorites} />
                    <Route path="/creator/payment-settings" component={PaymentSettings} />
                    <Route path="/payments/:id" component={PaymentDetail} />
                  </>
                )}

                {/* Company Routes */}
                {user?.role === 'company' && (
                  <>
                    <Route path="/" component={CompanyDashboard} />
                    <Route path="/company" component={CompanyDashboard} />
                    <Route path="/company/dashboard" component={CompanyDashboard} />
                    <Route path="/company/offers" component={CompanyOffers} />
                    <Route path="/company/offers/create" component={CompanyOfferCreate} />
                    <Route path="/company/offers/:id" component={CompanyOfferDetail} />
                    <Route path="/company/videos" component={CompanyVideos} />
                    <Route path="/company/retainers" component={CompanyRetainers} />
                    <Route path="/company/retainers/:id" component={CompanyRetainerDetail} />
                    <Route path="/company/applications" component={CompanyApplications} />
                    <Route path="/company/creators" component={CompanyCreators} />
                    <Route path="/company/analytics" component={Analytics} />
                    <Route path="/company/messages" component={Messages} />
                    <Route path="/company/reviews" component={CompanyReviews} />
                    <Route path="/company/website-verification" component={CompanyWebsiteVerification} />
                    <Route path="/company/payment-settings" component={PaymentSettings} />
                    <Route path="/payments/:id" component={PaymentDetail} />
                  </>
                )}

                {/* Admin Routes */}
                {user?.role === 'admin' && (
                  <>
                    <Route path="/" component={AdminDashboard} />
                    <Route path="/admin" component={AdminDashboard} />
                    <Route path="/admin/dashboard" component={AdminDashboard} />
                    <Route path="/admin/companies" component={AdminCompanies} />
                    <Route path="/admin/companies/:id" component={AdminCompanyDetail} />
                    <Route path="/admin/offers" component={AdminOffers} />
                    <Route path="/admin-offer-detail/:id" component={AdminOfferDetail} />
                    <Route path="/admin/creators" component={AdminCreators} />
                    <Route path="/admin/reviews" component={AdminReviews} />
                    <Route path="/admin/messages" component={AdminMessages} />
                    <Route path="/admin/payment-disputes" component={AdminPaymentDisputes} />
                    <Route path="/admin/niches" component={AdminNiches} />
                    <Route path="/admin/audit-logs" component={AdminAuditLogs} />
                    <Route path="/admin/platform-settings" component={AdminPlatformSettings} />
                    <Route path="/admin/moderation" component={AdminModerationDashboard} />
                    <Route path="/admin/moderation/dashboard" component={AdminModerationDashboard} />
                    <Route path="/admin/moderation/keywords" component={AdminKeywordManagement} />
                    <Route path="/admin/keyword-management" component={AdminKeywordManagement} />
                    <Route path="/admin/email-templates" component={AdminEmailTemplates} />
                    <Route path="/admin/analytics" component={AdminAnalytics} />
                    <Route path="/admin/platform-health">{() => { window.location.href = "/admin/analytics"; return null; }}</Route>
                    <Route path="/admin/users" component={AdminDashboard} />
                    <Route path="/admin/payment-settings" component={PaymentSettings} />
                    <Route path="/payments/:id" component={PaymentDetail} />
                  </>
                )}

                {/* Shared Routes */}
                <Route path="/settings" component={Settings} />
                <Route path="/notifications" component={Notifications} />
                <Route path="/notifications/:id" component={NotificationDetail} />
                <Route path="/payment-settings" component={PaymentSettings} />
                <Route path="/payments/:id" component={PaymentDetail} />
                <Route path="/company-profile/:id" component={CompanyProfile} />
                <Route path="/privacy-policy" component={PrivacyPolicy} />
                <Route path="/terms-of-service" component={TermsOfService} />

                {/* Fallback */}
                <Route component={NotFound} />
              </Switch>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function Router() {
  const [location] = useLocation();
  const { isAuthenticated, isLoading, user } = useAuth();

  // Define public routes
  const publicRoutes = ['/login', '/register', '/select-role', '/privacy-policy', '/terms-of-service'];
  const isPublicRoute = publicRoutes.includes(location);

  // While loading, show a loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-lg">Loading...</div>
      </div>
    );
  }

  // Special handling for onboarding pages (no sidebar)
  if (isAuthenticated && location === '/creator-onboarding' && user?.role === 'creator') {
    return <CreatorOnboarding />;
  }

  if (isAuthenticated && location === '/company-onboarding' && user?.role === 'company') {
    return <CompanyOnboarding />;
  }

  // ✅ FIX: Check authentication first before routing
  // If authenticated, always show protected router (even for "/" route)
  if (isAuthenticated) {
    return <ProtectedRouter />;
  }

  // If not authenticated and on public route, show public router
  if (isPublicRoute) {
    return <PublicRouter />;
  }

  // If not authenticated and on "/" show landing
  if (location === '/') {
    return <PublicRouter />;
  }

  // Otherwise redirect to login
  window.location.href = "/login";
  return null;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
        <CookieConsent />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;