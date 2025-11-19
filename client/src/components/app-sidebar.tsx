import { useAuth } from "../hooks/useAuth";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "./ui/sidebar";
import { Badge } from "./ui/badge";
import {
  Home,
  TrendingUp,
  FileText,
  MessageSquare,
  Heart,
  DollarSign,
  Star,
  Building2,
  Users,
  Video,
  CalendarClock,
  ScrollText,
  Sliders,
  AlertCircle,
  Tags,
} from "lucide-react";

export function AppSidebar() {
  const { user } = useAuth();
  const [location] = useLocation();
  const { isMobile, setOpenMobile } = useSidebar();
  const currentYear = new Date().getFullYear();

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

  // Close sidebar on mobile when navigation link is clicked
  const handleNavClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const creatorItems = [
    {
      title: "Dashboard",
      url: "/",
      icon: Home,
    },
    {
      title: "Browse Offers",
      url: "/browse",
      icon: TrendingUp,
    },
    {
      title: "Monthly Retainers",
      url: "/retainers",
      icon: CalendarClock,
    },
    {
      title: "My Applications",
      url: "/applications",
      icon: FileText,
    },
    {
      title: "Analytics",
      url: "/analytics",
      icon: TrendingUp,
    },
    {
      title: "Messages",
      url: "/messages",
      icon: MessageSquare,
    },
    {
      title: "Favorites",
      url: "/favorites",
      icon: Heart,
    },
    {
      title: "Payment Management",
      url: "/creator/payment-settings",
      icon: DollarSign,
    },
  ];

  const companyItems = [
    {
      title: "Dashboard",
      url: "/company",
      icon: Home,
    },
    {
      title: "My Offers",
      url: "/company/offers",
      icon: TrendingUp,
    },
    {
      title: "Videos",
      url: "/company/videos",
      icon: Video,
    },
    {
      title: "Monthly Retainers",
      url: "/company/retainers",
      icon: CalendarClock,
    },
    {
      title: "Applications",
      url: "/company/applications",
      icon: FileText,
    },
    {
      title: "Creators",
      url: "/company/creators",
      icon: Users,
    },
    {
      title: "Analytics",
      url: "/company/analytics",
      icon: TrendingUp,
    },
    {
      title: "Messages",
      url: "/company/messages",
      icon: MessageSquare,
    },
    {
      title: "Reviews",
      url: "/company/reviews",
      icon: Star,
    },
    {
      title: "Payment Management",
      url: "/company/payment-settings",
      icon: DollarSign,
    },
  ];

  const adminItems = [
    {
      title: "Dashboard",
      url: "/admin",
      icon: Home,
    },
    {
      title: "Company Management",
      url: "/admin/companies",
      icon: Building2,
    },
    {
      title: "Offer Management",
      url: "/admin/offers",
      icon: TrendingUp,
    },
    {
      title: "Creator Management",
      url: "/admin/creators",
      icon: Users,
    },
    {
      title: "Review Management",
      url: "/admin/reviews",
      icon: Star,
    },
    {
      title: "Message Monitoring",
      url: "/admin/messages",
      icon: MessageSquare,
    },
    {
      title: "Payment Management",
      url: "/admin/payment-settings",
      icon: DollarSign,
    },
    {
      title: "Payment Disputes",
      url: "/admin/payment-disputes",
      icon: AlertCircle,
    },
    {
      title: "Niche Categories",
      url: "/admin/niches",
      icon: Tags,
    },
    {
      title: "Audit Trail",
      url: "/admin/audit-logs",
      icon: ScrollText,
    },
    {
      title: "Platform Settings",
      url: "/admin/platform-settings",
      icon: Sliders,
    },
  ];

  const getMenuItems = () => {
    if (user?.role === 'company') return companyItems;
    if (user?.role === 'admin') return adminItems;
    return creatorItems;
  };

  const menuItems = getMenuItems();

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-4 py-4">
        <Link href="/" onClick={handleNavClick}>
          <div className="flex items-center gap-2 cursor-pointer">
            <img src="/logo.png" alt="AffiliateXchange Logo" className="h-8 w-8 rounded-md object-cover" />
            <span className="font-bold text-lg">AffiliateXchange</span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>
            {user?.role === 'company' ? 'Company Portal' : user?.role === 'admin' ? 'Admin Panel' : 'Creator Portal'}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton 
                        asChild 
                        isActive={location === item.url} 
                        className="hover:bg-primary/15 hover:text-primary hover:font-bold hover:scale-105 transition-all duration-200"
                        data-testid={`nav-${item.title.toLowerCase().replace(/\s/g, '-')}`}
                      >
                    <Link href={item.url} onClick={handleNavClick}>
                      {item.title === "Messages" ? (
                        <div className="relative inline-flex">
                          <item.icon className="h-4 w-4" />
                          {unreadCount > 0 && (
                            <Badge
                              variant="destructive"
                              className="absolute -top-2 -right-2 h-3.5 min-w-3.5 px-0 flex items-center justify-center text-[9px] font-bold leading-none rounded-full border border-background"
                            >
                              {unreadCount > 9 ? '9+' : unreadCount}
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <item.icon className="h-4 w-4" />
                      )}
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        <div className="rounded-lg bg-gradient-to-br from-primary/5 to-primary/10 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-primary" />
            <p className="text-xs font-semibold tracking-wide text-primary">AFFILIATEXCHANGE</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Professional affiliate marketing platform
            </p>
            <p className="text-[10px] text-muted-foreground/80">
              © {currentYear} AffiliateXchange. All rights reserved.
            </p>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}