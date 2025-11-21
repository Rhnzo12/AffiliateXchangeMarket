import { Settings, ChevronDown, LogOut, MessageSquare } from "lucide-react";
import { Button } from "./ui/button";
import { useAuth } from "../hooks/useAuth";
import { Link } from "wouter";
import { NotificationCenter } from "./NotificationCenter";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Badge } from "./ui/badge";
import { useQuery } from "@tanstack/react-query";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "./ui/dropdown-menu";

interface TopNavBarProps {
  children?: React.ReactNode;
}

export function TopNavBar({ children }: TopNavBarProps) {
  const { user } = useAuth();

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

  return (
    <div className="sticky top-0 z-50 bg-background border-b">
      <div className="max-w-[1600px] mx-auto px-3 sm:px-4 md:px-6 py-3 sm:py-4">
        <div className="flex items-center justify-between gap-2 sm:gap-4">
          {/* Left side content (can be search bar or other content) */}
          {children && <div className="flex-1 min-w-0">{children}</div>}

          {/* Right Side Icons */}
          <div className="flex items-center gap-2 sm:gap-3 ml-auto flex-shrink-0">
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
                      src={user?.profileImageUrl || ''}
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
                    <Settings className="mr-2 h-4 w-4" />
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
        </div>
      </div>
    </div>
  );
}