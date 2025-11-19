import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "./components/ui/toaster";
import { TooltipProvider } from "./components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "./components/ui/sidebar";
import { AppSidebar } from "./components/app-sidebar";
import { CookieConsent } from "./components/CookieConsent";
import { useAuth } from "./hooks/useAuth";
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
import Onboarding from "./pages/onboarding";
import CreatorOnboarding from "./pages/creator-onboarding";
import CompanyOnboarding from "./pages/company-onboarding";
import CompanyProfile from "./pages/company-profile";
import Login from "./pages/login";
import Register from "./pages/register";
import SelectRole from "./pages/select-role";

// Public routes that don't require authentication
function PublicRouter() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/select-role" component={SelectRole} />
      <Route component={Landing} />
    </Switch>
  );
}

// Protected routes that require authentication
function ProtectedRouter() {
  const { isAuthenticated, isLoading, user } = useAuth();

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
          <header className="flex items-center gap-4 px-6 py-4 border-b shrink-0">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
          </header>
          <main className="flex-1 overflow-auto">
            <div className="container max-w-screen-2xl mx-auto p-6">
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
  const publicRoutes = ['/login', '/register', '/select-role'];
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