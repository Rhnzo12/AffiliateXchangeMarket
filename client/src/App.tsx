import { Switch, Route, useLocation, Link } from "wouter";
import type { ReactNode } from "react";
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
import { Settings as SettingsIcon, ChevronDown, LogOut, MessageSquare, User } from "lucide-react";
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
import ProfileManagement from "./pages/profile-management";
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
import CompanyCreatorWorkflow from "./pages/company-creator-workflow";
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
import OAuthCallback from "./pages/oauth-callback";
import { HeaderContentProvider, useHeaderContent } from "./components/HeaderContentContext";
import { CompanyTourProvider } from "./contexts/CompanyTourContext";
import { CompanyTour } from "./components/CompanyTour";
import { CreatorTourProvider } from "./contexts/CreatorTourContext";
import { CreatorTour } from "./components/CreatorTour";

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
      <Route path="/oauth-callback" component={OAuthCallback} />
      <Route component={Landing} />
    </Switch>
  );
}

// Helper function to get company status info
function getCompanyStatusInfo(companyProfile: any) {
  if (!companyProfile) return null;

  // Priority: Verified > Owner (Approved) > Pending > Other statuses
  if (companyProfile.websiteVerified) {
    return {
      label: 'Verified',
      className: 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800',
    };
  }

  if (companyProfile.status === 'approved') {
    return {
      label: 'Owner',
      className: 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800',
    };
  }

  if (companyProfile.status === 'pending') {
    return {
      label: 'Pending',
      className: 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800',
    };
  }

  return null;
}

function AuthenticatedLayout({ user, unreadCount, companyProfile, onLogout, children, hideHeader = false }: { user: any; unreadCount: number; companyProfile?: any; onLogout: () => void; children: ReactNode; hideHeader?: boolean }) {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  const { headerContent } = useHeaderContent();

 return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">

          {!hideHeader && (
            <header className="relative flex items-center justify-between gap-4 px-4 sm:px-6 py-3 sm:py-4 border-b shrink-0 bg-background sticky top-0 z-50">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <SidebarTrigger data-testid="button-sidebar-toggle" />

                {headerContent && (
                  <div className="w-full max-w-xl ml-auto">
                    {headerContent}
                  </div>
                )}
              </div>

              {/* Right Side Navigation Icons */}
              <div className="flex items-center gap-2 sm:gap-3">
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
                          src={proxiedSrc(user?.role === 'company' ? companyProfile?.logoUrl : user?.profileImageUrl) || ''}
                          alt={user?.role === 'company' ? (companyProfile?.tradeName || 'Company') : (user?.firstName || user?.email || 'User')}
                          referrerPolicy="no-referrer"
                        />
                        <AvatarFallback className="bg-primary text-primary-foreground font-semibold text-xs sm:text-sm">
                          {user?.role === 'company'
                            ? (companyProfile?.tradeName?.[0] || 'C')
                            : (user?.firstName || user?.email || 'User').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
                          }
                        </AvatarFallback>
                      </Avatar>
                      <div className="text-left max-w-[100px] sm:max-w-[120px] md:max-w-[160px] min-w-0 hidden sm:block">
                        <p className="text-xs sm:text-sm font-medium leading-none text-foreground truncate">
                          {user?.role === 'company' ? (companyProfile?.tradeName || 'Company') : (user?.firstName || user?.email || 'User')}
                        </p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{user?.role === 'company' ? 'Brand' : 'Creator'}</p>
                      </div>
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem className="flex items-center gap-2 font-medium">
                      <Avatar className="h-8 w-8 border border-primary/20">
                        <AvatarImage
                          src={proxiedSrc(user?.role === 'company' ? companyProfile?.logoUrl : user?.profileImageUrl) || ''}
                          alt={user?.role === 'company' ? (companyProfile?.tradeName || 'Company') : (user?.firstName || user?.email || 'User')}
                          referrerPolicy="no-referrer"
                        />
                        <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                          {user?.role === 'company'
                            ? (companyProfile?.tradeName?.[0] || 'C')
                            : (user?.firstName || user?.email || 'User').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
                          }
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-sm font-semibold text-foreground truncate">
                          {user?.role === 'company' ? (companyProfile?.tradeName || 'Company') : (user?.firstName || user?.email || 'User')}
                        </span>
                        <span className="text-xs text-muted-foreground truncate">{user?.email || 'No email'}</span>
                      </div>
                    </DropdownMenuItem>
                    {/* Company Status Badge */}
                    {user?.role === 'company' && (() => {
                      const statusInfo = getCompanyStatusInfo(companyProfile);
                      if (!statusInfo) return null;
                      return (
                        <div className="px-2 py-1.5">
                          <Badge variant="outline" className={`w-full justify-center text-xs font-medium ${statusInfo.className}`}>
                            {statusInfo.label}
                          </Badge>
                        </div>
                      );
                    })()}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/profile-management" className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Profile Management
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/settings" className="flex items-center gap-2">
                        <SettingsIcon className="h-4 w-4" />
                        Settings
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive hover:!text-destructive" onClick={onLogout}>
                      <LogOut className="h-4 w-4" />
                      Log out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </header>
          )}

          <main className="flex-1 overflow-y-auto">
            <div className="container max-w-screen-2xl mx-auto p-4 sm:p-6">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

// Protected routes that require authentication
function ProtectedRouter() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [location] = useLocation();

  // Handle OAuth callback page separately (no sidebar/layout needed)
  if (location.startsWith('/oauth-callback')) {
    return <OAuthCallback />;
  }

  // Fetch conversations to get unread count
  const { data: conversations } = useQuery<any[]>({
    queryKey: ["/api/conversations"],
    enabled: !!user,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Fetch company stats (for company users only) to get company profile status
  const { data: companyStats } = useQuery<any>({
    queryKey: ["/api/company/stats"],
    enabled: !!user && user.role === 'company',
    refetchInterval: 60000, // Refetch every 60 seconds
  });

  // Calculate total unread messages
  const unreadCount = conversations?.reduce((total, conv) => {
    if (user?.role === 'company') {
      return total + (conv.companyUnreadCount || 0);
    } else {
      return total + (conv.creatorUnreadCount || 0);
    }
  }, 0) || 0;

  const hideHeader =
    (user?.role === 'creator' &&
      (/^\/payments\/[^/]+$/.test(location) || /^\/retainers\/[^/]+$/.test(location))) ||
    (user?.role === 'company' && /^\/company\/offers\/create$/.test(location));

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

  // Wrap company users with tour provider
  const content = (
    <HeaderContentProvider>
      <AuthenticatedLayout user={user} unreadCount={unreadCount} companyProfile={companyStats?.companyProfile} onLogout={handleLogout} hideHeader={hideHeader}>
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
              <Route path="/company/offers/:id/edit" component={CompanyOfferCreate} />
              <Route path="/company/offers/:id" component={CompanyOfferDetail} />
              <Route path="/company/creator-workflow" component={CompanyCreatorWorkflow} />
              <Route path="/company/videos" component={() => <CompanyCreatorWorkflow defaultTab="videos" />} />
              <Route path="/company/retainers" component={CompanyRetainers} />
              <Route path="/company/retainers/:id" component={CompanyRetainerDetail} />
              <Route path="/company/applications" component={() => <CompanyCreatorWorkflow defaultTab="applications" />} />
              <Route path="/company/creators" component={() => <CompanyCreatorWorkflow defaultTab="creators" />} />
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
          <Route path="/profile-management" component={ProfileManagement} />
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
      </AuthenticatedLayout>
    </HeaderContentProvider>
  );

  // Wrap company users with tour provider
  if (user?.role === 'company') {
    return (
      <CompanyTourProvider>
        {content}
        <CompanyTour />
      </CompanyTourProvider>
    );
  }

  // Wrap creator users with tour provider
  if (user?.role === 'creator') {
    return (
      <CreatorTourProvider>
        {content}
        <CreatorTour />
      </CreatorTourProvider>
    );
  }

  return content;
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

  // \u2705 FIX: Check authentication first before routing
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