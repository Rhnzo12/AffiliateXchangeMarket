interface TopNavBarProps {
  children?: React.ReactNode;
}

// TopNavBar now only renders children content (e.g., search bars)
// Navigation icons (message, notification, profile) are in App.tsx header
export function TopNavBar({ children }: TopNavBarProps) {
  if (!children) {
    return null;
  }

  return (
    <div className="bg-background border-b">
      <div className="max-w-[1600px] mx-auto px-3 sm:px-4 md:px-6 py-3 sm:py-4">
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="flex-1 min-w-0">{children}</div>
        </div>
      </div>
    </div>
  );
}
