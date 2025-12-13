import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { CompanyTourButtonSafe } from "./CompanyTourButton";
import { CreatorTourButtonSafe } from "./CreatorTourButton";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "./ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
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
  Briefcase,
  CalendarClock,
  ScrollText,
  Sliders,
  AlertCircle,
  Tags,
  ShieldAlert,
  ShieldCheck,
  Ban,
  Mail,
  BarChart3,
} from "lucide-react";

export function AppSidebar() {
  const { user } = useAuth();
  const [location] = useLocation();
  const { isMobile, setOpenMobile, state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const currentYear = new Date().getFullYear();
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});

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
      title: "Work Management",
      icon: Briefcase,
      children: [
        {
          title: "Offers",
          url: "/company/offers",
          icon: TrendingUp,
        },
        {
          title: "Monthly Retainers",
          url: "/company/retainers",
          icon: CalendarClock,
        },
      ],
    },
    {
      title: "Creator Workflow",
      url: "/company/creator-workflow",
      icon: Users,
    },
    {
      title: "Analytics",
      url: "/company/analytics",
      icon: TrendingUp,
    },
    {
      title: "Reviews",
      url: "/company/reviews",
      icon: Star,
    },
    {
      title: "Website Verification",
      url: "/company/website-verification",
      icon: ShieldCheck,
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
      title: "Analytics & Reports",
      url: "/admin/analytics",
      icon: BarChart3,
    },
    {
      title: "Administration Management",
      icon: Sliders,
      children: [
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
          title: "Keyword Management",
          url: "/admin/keyword-management",
          icon: Ban,
        },
        {
          title: "Niches Management",
          url: "/admin/niches",
          icon: Tags,
        },
      ],
    },
    {
      title: "Content Moderation",
      url: "/admin/moderation",
      icon: ShieldAlert,
    },
    {
      title: "Message Monitoring",
      url: "/admin/messages",
      icon: MessageSquare,
    },
    {
      title: "Payment Administration",
      icon: DollarSign,
      children: [
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
      ],
    },
    {
      title: "Email Templates",
      url: "/admin/email-templates",
      icon: Mail,
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

  const toggleSubmenu = (title: string) => {
    setOpenMenus((prev) => ({
      ...prev,
      [title]: !(prev[title] ?? false),
    }));
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b px-4 py-4 group-data-[collapsible=icon]:p-2">
        <Link href="/" onClick={handleNavClick}>
          <div className="flex items-center gap-2 cursor-pointer">
            <img src="/logo.png" alt="AffiliateXchange Logo" className="h-8 w-8 rounded-md object-cover shrink-0" />
            <span className="font-bold text-lg group-data-[collapsible=icon]:hidden">AffiliateXchange</span>
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
              {menuItems.map((item) => {
                const hasChildren = "children" in item && Array.isArray(item.children)
                const isActive = hasChildren
                  ? item.children?.some((child) => child.url === location)
                  : location === item.url
                const isOpen = hasChildren ? openMenus[item.title] ?? isActive : false

                if (hasChildren) {
                  // When collapsed, use dropdown menu for items with children
                  if (isCollapsed) {
                    return (
                      <SidebarMenuItem key={item.title}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              className={`flex w-8 h-8 items-center justify-center rounded-md p-2 transition-all duration-200 hover:text-primary hover:font-bold ${isActive ? "text-primary font-bold" : ""}`}
                              data-testid={`nav-${item.title.toLowerCase().replace(/\s/g, '-')}`}
                            >
                              <item.icon className="h-4 w-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent side="right" align="start" sideOffset={8} className="min-w-[200px] z-[100]">
                            {item.children?.map((child) => (
                              <DropdownMenuItem
                                key={child.url}
                                asChild
                                className="hover:bg-transparent focus:bg-transparent cursor-pointer"
                              >
                                <Link
                                  href={child.url}
                                  onClick={handleNavClick}
                                  className={`hover:text-primary hover:font-bold transition-all duration-200 ${location === child.url ? "text-primary font-bold" : ""}`}
                                >
                                  <child.icon className="h-4 w-4 mr-2" />
                                  <span>{child.title}</span>
                                </Link>
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </SidebarMenuItem>
                    )
                  }

                  // When expanded, use inline submenu
                  return (
                    <SidebarMenuItem key={item.title} className="group/item">
                      <SidebarMenuButton
                        tooltip={item.title}
                        isActive={isActive}
                        className="hover:bg-transparent hover:text-primary hover:font-bold data-[active=true]:bg-transparent data-[active=true]:text-primary transition-all duration-200"
                        data-testid={`nav-${item.title.toLowerCase().replace(/\s/g, '-')}`}
                        onClick={() => toggleSubmenu(item.title)}
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                      <SidebarMenuSub className={isOpen ? "" : "hidden"}>
                        {item.children?.map((child) => (
                          <SidebarMenuSubItem key={child.url}>
                            <SidebarMenuSubButton
                              asChild
                              isActive={location === child.url}
                              className="hover:bg-transparent data-[active=true]:bg-transparent hover:text-primary data-[active=true]:text-primary hover:font-bold"
                            >
                              <Link href={child.url} onClick={handleNavClick}>
                                <child.icon className="h-4 w-4" />
                                <span>{child.title}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </SidebarMenuItem>
                  )
                }

                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.title}
                      className="hover:bg-transparent hover:text-primary hover:font-bold data-[active=true]:bg-transparent data-[active=true]:text-primary transition-all duration-200"
                      data-testid={`nav-${item.title.toLowerCase().replace(/\s/g, '-')}`}
                    >
                      <Link href={item.url!} onClick={handleNavClick}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 group-data-[collapsible=icon]:hidden">
        {/* Tour button for company users */}
        {user?.role === 'company' && (
          <div className="mb-3">
            <CompanyTourButtonSafe />
          </div>
        )}

        {/* Tour button for creator users */}
        {user?.role === 'creator' && (
          <div className="mb-3">
            <CreatorTourButtonSafe />
          </div>
        )}

        <div className="rounded-lg bg-gradient-to-br from-primary/5 to-primary/10 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-primary" />
            <p className="text-xs font-semibold tracking-wide text-primary">AFFILIATEXCHANGE</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Professional affiliate marketing platform
            </p>
            <p className="text-xs text-muted-foreground/80">
              © {currentYear} AffiliateXchange. All rights reserved.
            </p>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}