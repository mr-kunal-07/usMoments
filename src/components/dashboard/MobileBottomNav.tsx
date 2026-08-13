import { useCallback, memo, useMemo } from "react";
import { Home, CalendarHeart, Upload, MessageSquareMore, MapPinned } from "lucide-react";
import { cn } from "@/lib/utils";
import { ViewType, FolderViewType } from "@/components/dashboard/AppSidebar";
import { useUnreadMessageCount } from "@/hooks/useMessages";
import { haptic } from "@/lib/haptics";

interface MobileBottomNavProps {
  selectedView: FolderViewType;
  onSelectView: (view: FolderViewType) => void;
  onUpload: () => void;
}

interface NavBtnProps {
  id: ViewType;
  label: string;
  icon: React.ElementType;
  selectedView: FolderViewType;
  onSelectView: (v: FolderViewType) => void;
  badge?: number;
}

interface UploadFABProps {
  enabled: boolean;
  onUpload: () => void;
}

interface NavItem {
  id: ViewType;
  label: string;
  icon: React.ElementType;
}

const SPECIAL_VIEWS = new Set<ViewType>([
  "all",
  "starred",
  "recently-deleted",
  "timeline",
  "on-this-day",
  "anniversaries",
  "chat",
  "activity",
  "billing",
  "settings",
  "love-story",
  "travel-map",
]);

const MAX_BADGE_COUNT = 99;
const ICON_SIZE = 22;

const NAV_ITEMS: readonly NavItem[] = [
  { id: "all", label: "Files", icon: Home },
  { id: "timeline", label: "Memories", icon: CalendarHeart },
] as const;

const NAV_ITEMS_AFTER_FAB: readonly NavItem[] = [
  { id: "chat", label: "Chat", icon: MessageSquareMore },
  { id: "travel-map", label: "Map", icon: MapPinned },
] as const;

function formatBadgeCount(count: number): string | number {
  return count > MAX_BADGE_COUNT ? `${MAX_BADGE_COUNT}+` : count;
}

function isAllFilesView(view: FolderViewType): boolean {
  return view === "all" || !SPECIAL_VIEWS.has(view as ViewType);
}

const NavBtn = memo(function NavBtn({
  id,
  label,
  icon: Icon,
  selectedView,
  onSelectView,
  badge,
}: NavBtnProps) {
  const isActive = selectedView === id;
  const hasBadge = useMemo(() => !!badge && badge > 0, [badge]);
  const badgeLabel = useMemo(() => formatBadgeCount(badge ?? 0), [badge]);

  const handlePress = useCallback(() => {
    if (selectedView !== id) haptic("light");
    onSelectView(id);
  }, [id, onSelectView, selectedView]);

  return (
    <button
      onClick={handlePress}
      aria-label={hasBadge ? `${label} (${badge} unread)` : label}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "relative flex flex-col items-center justify-center gap-[3px]",
        "flex-1 h-full min-w-0",
        "touch-manipulation select-none",
        "transition-colors duration-150 active:scale-95",
        isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground/70"
      )}
    >
      {isActive && (
        <span
          aria-hidden="true"
          className="absolute top-0 left-1/2 -translate-x-1/2 h-[2px] w-6 rounded-full bg-primary"
        />
      )}

      <span className="relative">
        <Icon
          className={cn(
            "transition-transform duration-150",
            isActive && "scale-110"
          )}
          style={{
            height: `${ICON_SIZE}px`,
            width: `${ICON_SIZE}px`,
            ...(isActive && { filter: "drop-shadow(0 0 4px hsl(var(--primary)/0.4))" }),
          }}
          strokeWidth={isActive ? 2 : 1.75}
          aria-hidden="true"
        />

        {hasBadge && (
          <span
            aria-hidden="true"
            className={cn(
              "absolute -top-1 -right-1.5",
              "min-w-[15px] h-[15px] px-[3px]",
              "rounded-full border border-background",
              "bg-primary text-primary-foreground",
              "text-[8px] font-bold leading-none",
              "flex items-center justify-center"
            )}
          >
            {badgeLabel}
          </span>
        )}
      </span>

      <span
        className={cn(
          "text-[10px] font-medium leading-none truncate max-w-full px-1",
          isActive ? "text-foreground" : "text-muted-foreground"
        )}
      >
        {label}
      </span>
    </button>
  );
});

const UploadFAB = memo(function UploadFAB({ enabled, onUpload }: UploadFABProps) {
  const handleClick = useCallback(() => {
    if (enabled) {
      haptic("medium");
      onUpload();
    }
  }, [enabled, onUpload]);

  return (
    <div className="flex flex-col items-center justify-center flex-1" aria-hidden={!enabled}>
      <button
        onClick={handleClick}
        aria-label="Upload files"
        aria-disabled={!enabled}
        disabled={!enabled}
        className={cn(
        "flex items-center justify-center",
        "h-11 w-11 rounded-2xl bg-primary",
        enabled && "shadow-[0_4px_16px_hsl(var(--primary)/0.45)]",
          "transition-all duration-150 active:scale-90",
          "disabled:opacity-30 disabled:cursor-not-allowed",
          !enabled && "pointer-events-none"
        )}
      >
        <Upload
          className="h-[18px] w-[18px] text-primary-foreground"
          strokeWidth={2.5}
          aria-hidden="true"
        />
      </button>
    </div>
  );
});

export const MobileBottomNav = memo(function MobileBottomNav({
  selectedView,
  onSelectView,
  onUpload,
}: MobileBottomNavProps) {
  const unreadCount = useUnreadMessageCount();

  const uploadEnabled = useMemo(
    () => isAllFilesView(selectedView),
    [selectedView]
  );

  const chatBadge = useMemo(
    () => (selectedView === "chat" ? 0 : unreadCount),
    [selectedView, unreadCount]
  );

  const renderNavButton = useCallback(
    (item: NavItem, badge?: number) => (
      <NavBtn
        key={item.id}
        id={item.id}
        label={item.label}
        icon={item.icon}
        selectedView={selectedView}
        onSelectView={onSelectView}
        badge={badge}
      />
    ),
    [selectedView, onSelectView]
  );

  return (
    <nav
      aria-label="Main navigation"
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 bg-background",
        "sm:hidden"
      )}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className={cn(
        "border-t border-border/70 bg-background",
        selectedView !== "billing" && "shadow-[0_-8px_24px_hsl(0_0%_0%/0.12)]",
      )}>
        <div className="flex items-center h-14 px-1">
          {NAV_ITEMS.map((item) => renderNavButton(item))}
          <UploadFAB enabled={uploadEnabled} onUpload={onUpload} />
          {NAV_ITEMS_AFTER_FAB.map((item) =>
            renderNavButton(item, item.id === "chat" ? chatBadge : undefined)
          )}
        </div>
      </div>
    </nav>
  );
});

MobileBottomNav.displayName = "MobileBottomNav";
NavBtn.displayName = "NavBtn";
UploadFAB.displayName = "UploadFAB";

export default MobileBottomNav;
