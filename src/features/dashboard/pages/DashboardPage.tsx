import { lazy, Suspense, useState, useEffect, useCallback, useDeferredValue, useRef, useMemo } from "react";
import { useSwipeNav } from "@/hooks/useSwipeNav";
import { Search, Upload, Moon, Sun, Monitor, LayoutGrid, List, ArrowUpDown, Check, FolderPlus, SlidersHorizontal } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { usePlan } from "@/hooks/useSubscription";
import { useAuth } from "@/hooks/useAuth";
import { useMedia, useStarredMedia, useMoveMedia, getPublicUrl } from "@/hooks/useMedia";
import { useDeleteFolder, useFolders, useRenameFolder } from "@/hooks/useFolders";
import { useIsMobile } from "@/hooks/useMobile";
import { useTheme } from "@/hooks/useTheme";
import { useProfile, useAllProfiles } from "@/hooks/useProfile";
import { useOnThisDay } from "@/hooks/useMemories";
import { useMyCouple } from "@/hooks/useCouple";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar, ViewType, FolderViewType } from "@/components/dashboard/AppSidebar";
import { MediaGrid, ViewMode } from "@/components/media/MediaGrid";
import { FolderBreadcrumb } from "@/components/media/FolderBreadcrumb";
import { NotificationsPanel } from "@/components/notifications/NotificationsPanel";
import { PartnerBanner } from "@/components/couples/PartnerBanner";
import { UpgradeBanner } from "@/components/billing/UpgradeBanner";
import { MobileBottomNav } from "@/components/dashboard/MobileBottomNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreateFolder } from "@/hooks/useFolders";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/useToast";
import { usePresence } from "@/hooks/usePresence";
import { useWebRTC } from "@/hooks/useWebRTC";
import { usePushSubscription } from "@/hooks/usePushNotifications";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { FolderGridWithSelection } from "@/components/media/FolderGridWithSelection";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { haptic } from "@/lib/haptics";
import { createFolderContentIndex } from "@/lib/folderContentIndex";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useMessages } from "@/hooks/useMessages";
import { APP_PATHS, DASHBOARD_VIEWS, dashboardPath, folderPath, isDashboardView } from "@/app/router/paths";

type FileTypeFilter = "all" | "image" | "video";
type SortKey = "created_at" | "title" | "file_size";
type SortDir = "asc" | "desc";

interface GateModalState {
  feature: string;
  plan: "dating" | "soulmate";
}

const MemoriesTimeline = lazy(() =>
  import("@/components/media/MemoriesView").then((module) => ({ default: module.MemoriesTimeline }))
);
const AnniversariesView = lazy(() =>
  import("@/components/anniversaries/AnniversariesView").then((module) => ({ default: module.AnniversariesView }))
);
const ActivityFeed = lazy(() =>
  import("@/components/activity/ActivityFeed").then((module) => ({ default: module.ActivityFeed }))
);
const BillingView = lazy(() =>
  import("@/components/billing/BillingView").then((module) => ({ default: module.BillingView }))
);
const SettingsView = lazy(() =>
  import("@/components/settings/SettingsView").then((module) => ({ default: module.SettingsView }))
);
const RecentlyDeletedView = lazy(() =>
  import("@/components/media/RecentlyDeletedView").then((module) => ({ default: module.RecentlyDeletedView }))
);
const LoveStoryView = lazy(() =>
  import("@/components/love-story/LoveStoryView").then((module) => ({ default: module.LoveStoryView }))
);
const TravelMapView = lazy(() =>
  import("@/components/travel-map/TravelMapView").then((module) => ({ default: module.TravelMapView }))
);
const ChatView = lazy(() =>
  import("@/components/chat/ChatView").then((module) => ({ default: module.ChatView }))
);
const CallModal = lazy(() =>
  import("@/components/chat/CallModal").then((module) => ({ default: module.CallModal }))
);
const UploadDialog = lazy(() =>
  import("@/components/media/UploadDialog").then((module) => ({ default: module.UploadDialog }))
);
const MediaPreview = lazy(() =>
  import("@/components/media/MediaPreview").then((module) => ({ default: module.MediaPreview }))
);
const UpgradeGateModal = lazy(() =>
  import("@/components/billing/UpgradeGateModal").then((module) => ({ default: module.UpgradeGateModal }))
);

// Constants
const STORAGE_KEYS = {
  SORT_KEY: "usmoment_sort_key",
  SORT_DIR: "usmoment_sort_dir",
  VIEW_MODE: "usmoment_view",
} as const;

const SPECIAL_VIEWS: readonly ViewType[] = DASHBOARD_VIEWS;

const NON_GRID_VIEWS: readonly ViewType[] = [
  "timeline",
  "anniversaries",
  "chat",
  "activity",
  "billing",
  "settings",
  "recently-deleted",
  "love-story",
  "travel-map",
] as const;

const SWIPE_ORDER: ViewType[] = ["all", "chat"];
const FILE_TYPE_FILTERS: readonly FileTypeFilter[] = ["all", "image", "video"] as const;

const PAID_VIEWS: Record<string, GateModalState> = {
  "travel-map": { feature: "Travel Map", plan: "dating" },
};

// Utility functions
function loadPreference<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function savePreference<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Failed to save preference ${key}:`, error);
  }
}

function tabToView(tab?: string): ViewType {
  return isDashboardView(tab) ? tab : "all";
}

function viewToTab(view: ViewType): ViewType {
  return view;
}

function isSpecialView(view: string): view is ViewType {
  return (SPECIAL_VIEWS as readonly string[]).includes(view);
}

function DeferredView({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-[220px] rounded-2xl border border-border/60 bg-card/60 p-4 animate-in fade-in-0 duration-300">
          <div className="space-y-3">
            <div className="h-5 w-32 rounded-full bg-muted animate-pulse" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-28 rounded-2xl bg-muted/70 animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

function DeferredChat({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="h-full w-full bg-muted/20 animate-pulse" />}>
      {children}
    </Suspense>
  );
}

export default function Dashboard() {
  usePushSubscription();
  useMessages({ subscribeToRealtime: true });

  const { user } = useAuth();
  const navigate = useNavigate();
  const { tab, folderId: folderParam } = useParams<{ tab?: string; folderId?: string }>();
  const { toast } = useToast();
  const { theme, cycleTheme } = useTheme();
  const isMobile = useIsMobile();

  // Hooks
  const plan = usePlan();
  const moveMedia = useMoveMedia();
  const { data: profile } = useProfile();
  const { data: onThisDayMedia = [] } = useOnThisDay();
  const { data: couple } = useMyCouple();
  const { data: profiles = [] } = useAllProfiles();
  const { data: folders = [] } = useFolders();

  // State
  const [search, setSearch] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState<number>(-1);
  const [dragOverMain, setDragOverMain] = useState(false);
  const [fileTypeFilter, setFileTypeFilter] = useState<FileTypeFilter>("all");
  const [gateModal, setGateModal] = useState<GateModalState | null>(null);
  const [openAddFolder, setOpenAddFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [callMinimized, setCallMinimized] = useState(false);
  const createFolder = useCreateFolder();
  const renameFolder = useRenameFolder();
  const deleteFolder = useDeleteFolder();
  const handleCreateFolder = useCallback(async () => {
    const name = newFolderName.trim();
    if (!name) return;
    const parentId = folderParam ?? null;

    try {
      await createFolder.mutateAsync({
        name,
        parentId,
      });

      setNewFolderName("");
      setOpenAddFolder(false);
      haptic("success");
    } catch (err) {
      console.error("Create folder failed:", err);
      haptic("warning");
    }
  }, [createFolder, folderParam, newFolderName]);
  const [viewMode, setViewMode] = useState<ViewMode>(() =>
    loadPreference<ViewMode>(STORAGE_KEYS.VIEW_MODE, "grid")
  );
  const [sortKey, setSortKey] = useState<SortKey>(() =>
    loadPreference<SortKey>(STORAGE_KEYS.SORT_KEY, "created_at")
  );
  const [sortDir, setSortDir] = useState<SortDir>(() =>
    loadPreference<SortDir>(STORAGE_KEYS.SORT_DIR, "desc")
  );
  const deferredSearch = useDeferredValue(search.trim());
  const debouncedSearch = useDebouncedValue(search.trim(), 250);

  const seenMediaRef = useRef<Set<string>>(new Set());

  // Computed values
  const selectedView = useMemo<FolderViewType>(() => {
    if (folderParam) return folderParam as FolderViewType;
    return tabToView(tab);
  }, [folderParam, tab]);

  const isSpecial = useMemo(() => isSpecialView(selectedView), [selectedView]);
  const isChat = selectedView === "chat";
  const isGridView = useMemo(() => !NON_GRID_VIEWS.includes(selectedView as ViewType), [selectedView]);

  const folderId = useMemo(() => {
    if (selectedView === "all") return undefined;
    if (isSpecial) return undefined;
    return selectedView;
  }, [selectedView, isSpecial]);

  const profileInitials = useMemo(() => {
    const name = profile?.display_name ?? user?.email ?? "U";
    return name.slice(0, 2).toUpperCase();
  }, [profile?.display_name, user?.email]);

  const coupleId = couple?.status === "active" ? couple.id : null;
  const partnerId =
    couple?.status === "active"
      ? (couple.user1_id === user?.id ? couple.user2_id : couple.user1_id)
      : null;
  const partnerProfile = partnerId ? profiles.find((item) => item.user_id === partnerId) : null;
  const partnerName = partnerProfile?.display_name ?? "Partner";
  const partnerInitials = (partnerProfile?.display_name ?? "?").slice(0, 2).toUpperCase();
  const { partnerOnline } = usePresence(coupleId, user?.id, partnerId);
  const callSession = useWebRTC({
    coupleId,
    myUserId: user?.id ?? null,
    partnerUserId: partnerId ?? null,
    partnerOnline,
  });
  const { callState, callError, clearCallError } = callSession;

  // Data fetching
  // allMedia: all media with no filters — used for folder previews, counts, rootMedia
  const { data: allMedia = [], isLoading: allMediaLoading } = useMedia(undefined, undefined);
  // regularMedia: respects current folder + search filter
  const { data: regularMedia = [], isLoading: regularLoading } = useMedia(
    folderId,
    debouncedSearch || undefined,
    { enabled: !isSpecial },
  );
  const { data: starredMedia = [], isLoading: starredLoading } = useStarredMedia(selectedView === "starred");
  // Combined loading state
  const isLoading = selectedView === "all"
    ? allMediaLoading
    : selectedView === "starred"
      ? starredLoading
      : !isSpecial && regularLoading;

  const folderContentIndex = useMemo(
    () => createFolderContentIndex(folders, allMedia),
    [folders, allMedia],
  );

  // Helper: enrich a folder list with preview URLs + counts (recursive — includes sub-folders)
  const enrichFolders = useCallback(
    (folderList: typeof folders) =>
      folderList.map((folder) => {
        const subtreeMedia = folderContentIndex.getSubtreeMedia(folder.id);

        // For previews prefer direct images first, then fall back to descendant images
        const directImages = folderContentIndex
          .getDirectMedia(folder.id)
          .filter((item) => item.file_type === "image");
        const previewMedia = directImages.length > 0
          ? directImages
          : subtreeMedia.filter((m) => m.file_type === "image");

        return {
          ...folder,
          count: subtreeMedia.length,
          previewUrls: previewMedia.slice(0, 4).map((m) => getPublicUrl(m.file_path)),
        };
      }),
    [folderContentIndex]
  );

  // Root-level folders only (no parent_id) — shown in "all" view
  const foldersWithPreviews = useMemo(
    () => enrichFolders([...folderContentIndex.getChildren(null)]),
    [enrichFolders, folderContentIndex]
  );

  // Sub-folders of the currently open folder
  const subFoldersWithPreviews = useMemo(() => {
    if (isSpecial) return [];
    return enrichFolders([...folderContentIndex.getChildren(selectedView)]);
  }, [enrichFolders, folderContentIndex, isSpecial, selectedView]);

  // Media processing
  const rawMedia = useMemo(() => {
    if (selectedView === "starred") return starredMedia;
    if (selectedView === "on-this-day") return onThisDayMedia;
    // "all" view: use allMedia so we get everything regardless of folder
    if (selectedView === "all") return allMedia;
    return regularMedia;
  }, [selectedView, starredMedia, onThisDayMedia, allMedia, regularMedia]);

  const typeFiltered = useMemo(() => {
    if (fileTypeFilter === "all") return rawMedia;
    return rawMedia.filter((m) => m.file_type === fileTypeFilter);
  }, [rawMedia, fileTypeFilter]);

  // Apply search client-side for "all" view (allMedia has no server-side search)
  const searchFiltered = useMemo(() => {
    if (selectedView !== "all" || !deferredSearch) return typeFiltered;
    const q = deferredSearch.toLowerCase();
    return typeFiltered.filter(
      (m) =>
        m.title?.toLowerCase().includes(q) ||
        m.description?.toLowerCase().includes(q)
    );
  }, [deferredSearch, typeFiltered, selectedView]);

  const media = useMemo(() => {
    return [...searchFiltered].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "created_at") {
        cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      } else if (sortKey === "title") {
        cmp = a.title.localeCompare(b.title);
      } else if (sortKey === "file_size") {
        cmp = a.file_size - b.file_size;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [searchFiltered, sortKey, sortDir]);

  // Unfiled media — no folder_id, shown below folder grid in "all" view
  const rootMedia = useMemo(
    () => media.filter((m) => !m.folder_id),
    [media]
  );

  const currentFolder = useMemo(() => {
    if (isSpecial) return null;
    return folders.find((f) => f.id === selectedView) ?? null;
  }, [isSpecial, folders, selectedView]);

  const pageTitle = useMemo(() => {
    const titleMap: Record<ViewType, string> = {
      all: "All Files",
      starred: "Starred",
      "recently-deleted": "Recently Deleted",
      timeline: "Memories Timeline",
      "on-this-day": `On This Day · ${format(new Date(), "MMMM d")}`,
      anniversaries: "Anniversaries & Milestones",
      chat: "Chat with Partner 💬",
      activity: "Activity Feed",
      billing: "Billing & Plan",
      settings: "Settings",
      "love-story": "Love Story",
      "travel-map": "Travel Map",
    };

    return titleMap[selectedView as ViewType] ?? currentFolder?.name ?? "Folder";
  }, [selectedView, currentFolder?.name]);

  // Navigation handlers
  const setSelectedView = useCallback(
    (view: FolderViewType) => {
      const isFolder = !SPECIAL_VIEWS.includes(view as ViewType);
      if (isFolder) {
        navigate(folderPath(view), { replace: false });
      } else {
        const t = viewToTab(view as ViewType);
        navigate(dashboardPath(t), { replace: false });
      }
    },
    [navigate]
  );

  const gatedNavigate = useCallback(
    (view: FolderViewType) => {
      if (plan === "single" && PAID_VIEWS[view]) {
        setGateModal(PAID_VIEWS[view]);
        return;
      }
      setSelectedView(view);
    },
    [plan, setSelectedView]
  );

  // Swipe navigation
  const swipeIndex = useMemo(
    () => SWIPE_ORDER.indexOf(selectedView as ViewType),
    [selectedView]
  );

  const canSwipe = swipeIndex !== -1;
  const handleSwipeLeft = useCallback(() => {
    if (!canSwipe) return;
    if (swipeIndex < SWIPE_ORDER.length - 1) {
      gatedNavigate(SWIPE_ORDER[swipeIndex + 1]);
    }
  }, [swipeIndex, canSwipe, gatedNavigate]);

  const handleSwipeRight = useCallback(() => {
    if (swipeIndex > 0) {
      gatedNavigate(SWIPE_ORDER[swipeIndex - 1]);
    }
  }, [swipeIndex, gatedNavigate]);

  const swipeHandlers = useSwipeNav({
    threshold: 55,
    maxVerticalDrift: 60,
    onSwipeLeft: handleSwipeLeft,
    onSwipeRight: handleSwipeRight,
  });

  // Sort handlers
  const toggleSort = useCallback((key: SortKey) => {
    setSortKey((prevKey) => {
      if (prevKey === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return key;
      } else {
        setSortDir("desc");
        return key;
      }
    });
  }, []);

  // Drag and drop handlers
  const handleMainDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes("Files")) {
      setDragOverMain(true);
    }
  }, []);

  const handleMainDragLeave = useCallback(() => {
    setDragOverMain(false);
  }, []);

  const handleMainDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOverMain(false);
    if (e.dataTransfer.files.length > 0) {
      setUploadOpen(true);
    }
  }, []);

  // Preview handlers
  const handlePreview = useCallback(
    (item: { id: string }) => {
      const idx = media.findIndex((m) => m.id === item.id);
      if (idx >= 0) setPreviewIndex(idx);
    },
    [media]
  );

  const handlePreviewClose = useCallback((open: boolean) => {
    if (!open) setPreviewIndex(-1);
  }, []);

  const handleTimelinePreview = useCallback(
    (mediaId: string) => {
      const idx = media.findIndex((m) => m.id === mediaId);
      setSelectedView("all");
      setTimeout(() => {
        setPreviewIndex(idx >= 0 ? idx : 0);
      }, 100);
    },
    [media, setSelectedView]
  );

  // Upload handler
  const handleUpload = useCallback(() => {
    if (selectedView === "all" || !isSpecial) {
      setUploadOpen(true);
    }
  }, [selectedView, isSpecial]);

  // Effects
  useEffect(() => { savePreference(STORAGE_KEYS.VIEW_MODE, viewMode); }, [viewMode]);
  useEffect(() => { savePreference(STORAGE_KEYS.SORT_KEY, sortKey); }, [sortKey]);
  useEffect(() => { savePreference(STORAGE_KEYS.SORT_DIR, sortDir); }, [sortDir]);

  // Realtime partner uploads
  useEffect(() => {
    if (!user || couple?.status !== "active") return;

    const partnerId = couple.user1_id === user.id ? couple.user2_id : couple.user1_id;
    if (!partnerId) return;

    const partnerProfile = profiles.find((p) => p.user_id === partnerId);
    const partnerName = partnerProfile?.display_name ?? "Your partner";

    const channel = supabase
      .channel("partner-media-activity")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "media" },
        (payload) => {
          const row = payload.new as { uploaded_by: string; id: string; title?: string };
          if (row.uploaded_by !== partnerId) return;
          if (seenMediaRef.current.has(row.id)) return;
          seenMediaRef.current.add(row.id);
          toast({
            title: `${partnerName} added a new photo 💕`,
            description: row.title || undefined,
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, couple, profiles, toast]);

  // Move media handler
  useEffect(() => {
    const handler = (e: Event) => {
      const { mediaId, folderId: targetFolderId } = (e as CustomEvent).detail;
      moveMedia
        .mutateAsync({ id: mediaId, folderId: targetFolderId })
        .then(() => { toast({ title: "Moved to folder" }); })
        .catch((error) => {
          console.error("Failed to move media:", error);
          toast({ title: "Failed to move", variant: "destructive" });
        });
    };
    window.addEventListener("move-media", handler);
    return () => window.removeEventListener("move-media", handler);
  }, [moveMedia, toast]);

  useEffect(() => {
    if (callState === "idle") {
      setCallMinimized(false);
    }
  }, [callState]);

  useEffect(() => {
    if (!callError) return;
    toast({
      title: "Call error",
      description: callError,
      variant: "destructive",
    });
    clearCallError();
  }, [callError, clearCallError, toast]);

  // Render helpers
  const renderFileTypeFilter = useCallback(() => {
    if (!isGridView) return null;
    return (
      <div className="hidden md:flex items-center gap-0.5 rounded-lg bg-muted/70 p-0.5 shrink-0">
        {FILE_TYPE_FILTERS.map((filter) => (
          <button
            key={filter}
            onClick={() => setFileTypeFilter(filter)}
            aria-pressed={fileTypeFilter === filter}
            className={cn(
              "h-7 rounded-md px-2.5 text-xs font-medium transition-colors",
              fileTypeFilter === filter
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {filter === "all" ? "All" : filter === "image" ? "Images" : "Videos"}
          </button>
        ))}
      </div>
    );
  }, [isGridView, fileTypeFilter]);

  const renderSortMenu = useCallback(() => {
    if (!isGridView) return null;
    const sortItems: Array<{ key: SortKey; label: string }> = [
      { key: "created_at", label: "Date" },
      { key: "title", label: "Name" },
      { key: "file_size", label: "Size" },
    ];
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="hidden h-9 w-9 rounded-lg md:inline-flex"
            aria-label="Sort files"
            title="Sort files"
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel className="text-xs text-muted-foreground">Sort by</DropdownMenuLabel>
          {sortItems.map(({ key, label }) => (
            <DropdownMenuItem
              key={key}
              onClick={() => toggleSort(key)}
              className={cn("justify-between gap-2", sortKey === key && "font-semibold")}
            >
              <span>{label}</span>
              {sortKey === key && (
                <span className="text-xs font-normal text-muted-foreground">
                  {sortDir === "asc" ? "Asc" : "Desc"}
                </span>
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }, [isGridView, sortKey, sortDir, toggleSort]);

  const renderMobileMediaMenu = useCallback(() => {
    if (!isGridView) return null;
    const sortItems: Array<{ key: SortKey; label: string }> = [
      { key: "created_at", label: "Date" },
      { key: "title", label: "Name" },
      { key: "file_size", label: "Size" },
    ];

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 rounded-lg md:hidden"
            aria-label="Media options"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel className="text-xs text-muted-foreground">File type</DropdownMenuLabel>
          {FILE_TYPE_FILTERS.map((filter) => (
            <DropdownMenuItem key={filter} onClick={() => setFileTypeFilter(filter)} className="gap-2">
              <span className="flex-1">
                {filter === "all" ? "All files" : filter === "image" ? "Images" : "Videos"}
              </span>
              {fileTypeFilter === filter && <Check className="h-3.5 w-3.5" />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs text-muted-foreground">Sort by</DropdownMenuLabel>
          {sortItems.map(({ key, label }) => (
            <DropdownMenuItem key={key} onClick={() => toggleSort(key)} className="gap-2">
              <span className="flex-1">{label}</span>
              {sortKey === key && (
                <span className="text-xs text-muted-foreground">
                  {sortDir === "asc" ? "Asc" : "Desc"}
                </span>
              )}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setViewMode((value) => value === "grid" ? "list" : "grid")}>
            {viewMode === "grid" ? <List className="mr-2 h-4 w-4" /> : <LayoutGrid className="mr-2 h-4 w-4" />}
            {viewMode === "grid" ? "List view" : "Grid view"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }, [fileTypeFilter, isGridView, sortDir, sortKey, toggleSort, viewMode]);

  const renderPageHeader = useCallback(() => {
    if (!isGridView) return null;
    return (
      <div
        className={cn(
          "flex flex-col gap-2",
          selectedView === "billing" ? "mb-0" : "mb-3 sm:mb-5"
        )}
      >
        {/* Top Row → Breadcrumb + Actions */}
        {(selectedView === "all" || !isSpecial) && (
        <div className="flex items-center justify-between gap-2 min-h-[32px]">
          {/* Breadcrumb — only inside real folders */}
          <div className="flex-1">
            {!isSpecial && (
              <FolderBreadcrumb
                folderId={selectedView}
                folders={folders}
                onNavigate={setSelectedView}
              />
            )}
          </div>

          {/* Add Folder Button */}
          {selectedView !== "billing" && (selectedView === "all" || !isSpecial) && (
            isMobile ? (
              <Sheet open={openAddFolder} onOpenChange={setOpenAddFolder}>
                <SheetTrigger asChild>
                  <Button
                    variant="default"
                    size="sm"
                    className="h-8 px-2 gap-1.5 active:scale-[0.98]"
                    aria-label="Create folder"
                    onClick={() => haptic("light")}
                  >
                    <FolderPlus className="h-4 w-4" />
                    <span className="text-xs">Add folder</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="rounded-t-[28px] p-0 pb-[env(safe-area-inset-bottom,0px)]">
                  <div className="flex justify-center pt-3">
                    <div className="h-1 w-11 rounded-full bg-muted-foreground/30" />
                  </div>
                  <SheetHeader className="px-5 pt-4 text-left">
                    <SheetTitle className="text-base flex items-center gap-2">
                      <FolderPlus className="h-4 w-4 text-primary" />
                      {selectedView === "all" ? "New Folder" : "New Subfolder"}
                    </SheetTitle>
                  </SheetHeader>
                  <form
                    onSubmit={(e) => { e.preventDefault(); handleCreateFolder(); }}
                    className="space-y-3 px-5 py-4"
                  >
                    <Input
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      placeholder="Folder name"
                      className="h-11 text-base"
                      autoFocus
                      maxLength={50}
                    />
                    <div className="flex gap-2 justify-end">
                      <Button type="button" variant="outline" onClick={() => setOpenAddFolder(false)} className="flex-1 active:scale-[0.98]">
                        Cancel
                      </Button>
                      <Button type="submit" disabled={!newFolderName.trim() || createFolder.isPending} className="flex-1 active:scale-[0.98]">
                        Create
                      </Button>
                    </div>
                  </form>
                </SheetContent>
              </Sheet>
            ) : (
              <Dialog open={openAddFolder} onOpenChange={setOpenAddFolder}>
                <DialogTrigger asChild>
                  <Button
                    variant="default"
                    size="sm"
                    className="h-8 px-2 gap-1.5"
                    aria-label="Create folder"
                  >
                    <FolderPlus className="h-4 w-4" />
                    <span className="text-xs">Add folder</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-xs">
                  <DialogHeader>
                    <DialogTitle className="text-sm flex items-center gap-2">
                      <FolderPlus className="h-4 w-4 text-primary" />
                      {selectedView === "all" ? "New Folder" : "New Subfolder"}
                    </DialogTitle>
                  </DialogHeader>
                  <form
                    onSubmit={(e) => { e.preventDefault(); handleCreateFolder(); }}
                    className="space-y-3"
                  >
                    <Input
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      placeholder="Folder name"
                      className="h-10 text-sm"
                      autoFocus
                      maxLength={50}
                    />
                    <div className="flex gap-2 justify-end">
                      <Button type="button" variant="outline" size="sm" onClick={() => setOpenAddFolder(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" size="sm" disabled={!newFolderName.trim() || createFolder.isPending}>
                        Create
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            )
          )}
        </div>
        )}

        {/* On This Day */}
        {selectedView === "on-this-day" && onThisDayMedia.length > 0 && (
          <p className="text-xs sm:text-sm text-muted-foreground">
            On this day: {onThisDayMedia.length}{" "}
            {onThisDayMedia.length === 1 ? "memory" : "memories"} from previous years
            on this date
          </p>
        )}

        {/* File Count */}
        {isGridView &&
          !isLoading &&
          selectedView !== "on-this-day" &&
          selectedView !== "all" && (
            <p className="text-xs sm:text-sm text-muted-foreground">
              {media.length} file{media.length !== 1 ? "s" : ""}
            </p>
          )}
      </div>
    );
  }, [
    selectedView,
    isSpecial,
    folders,
    setSelectedView,
    onThisDayMedia.length,
    isGridView,
    isLoading,
    media.length,
    isMobile,
    openAddFolder,
    newFolderName,
    handleCreateFolder,
    createFolder.isPending,
  ]);

  const renderMainContent = useCallback(() => {
    switch (selectedView) {
      case "timeline":
        return (
          <DeferredView>
            <MemoriesTimeline onPreview={handleTimelinePreview} />
          </DeferredView>
        );
      case "anniversaries":
        return (
          <DeferredView>
            <AnniversariesView />
          </DeferredView>
        );
      case "love-story":
        return (
          <DeferredView>
            <LoveStoryView />
          </DeferredView>
        );
      case "travel-map":
        return (
          <DeferredView>
            <TravelMapView />
          </DeferredView>
        );
      case "activity":
        return (
          <DeferredView>
            <ActivityFeed />
          </DeferredView>
        );
      case "billing":
        return (
          <DeferredView>
            <BillingView />
          </DeferredView>
        );
      case "settings":
        return (
          <DeferredView>
            <SettingsView onNavigateBilling={() => setSelectedView("billing")} />
          </DeferredView>
        );
      case "recently-deleted":
        return (
          <DeferredView>
            <RecentlyDeletedView />
          </DeferredView>
        );

      case "all":
        return (
          <>
            {/* ── Folders section ── */}
            {foldersWithPreviews.length > 0 && (
              <div className="mb-6 sm:mb-8">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Folders
                </h2>
                <FolderGridWithSelection
                  folders={foldersWithPreviews}
                  onOpen={(id) => setSelectedView(id)}
                  onRename={(id, name) => renameFolder.mutate({ id, name })}
                  onDelete={(id) => deleteFolder.mutate(id)}
                />
              </div>
            )}

            {/* ── Root-level files (not inside any folder) ── */}
            {(rootMedia.length > 0 || isLoading) && (
              <div>
                {foldersWithPreviews.length > 0 && (
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                    Files
                  </h2>
                )}
                {rootMedia.length > 0 && (
                  <p className="text-xs sm:text-sm text-muted-foreground mb-3">
                    {rootMedia.length} file{rootMedia.length !== 1 ? "s" : ""}
                  </p>
                )}
                <MediaGrid
                  media={rootMedia}
                  loading={isLoading}
                  onPreview={handlePreview}
                  viewMode={viewMode}
                />
              </div>
            )}

            {/* ── Truly empty state ── */}
            {foldersWithPreviews.length === 0 && rootMedia.length === 0 && !isLoading && (
              <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
                <p className="text-base font-medium text-foreground">No files yet</p>
                <p className="text-sm mt-1 text-muted-foreground/70">
                  Upload photos and videos to get started
                </p>
              </div>
            )}
          </>
        );

      default:
        // Inside a specific folder — show sub-folders then media
        return (
          <>
            {subFoldersWithPreviews.length > 0 && (
              <div className="mb-6 sm:mb-8">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Folders
                </h2>
                <FolderGridWithSelection
                  folders={subFoldersWithPreviews}
                  onOpen={(id) => setSelectedView(id)}
                  onRename={(id, name) => renameFolder.mutate({ id, name })}
                  onDelete={(id) => deleteFolder.mutate(id)}
                />
              </div>
            )}

            {(media.length > 0 || isLoading) && (
              <div>
                {subFoldersWithPreviews.length > 0 && media.length > 0 && (
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                    Files
                  </h2>
                )}
                <MediaGrid
                  media={media}
                  loading={isLoading}
                  onPreview={handlePreview}
                  viewMode={viewMode}
                />
              </div>
            )}

            {subFoldersWithPreviews.length === 0 && media.length === 0 && !isLoading && (
              <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
                <p className="text-base font-medium text-foreground">This folder is empty</p>
                <p className="text-sm mt-1 text-muted-foreground/70">
                  Upload files or create sub-folders to get started
                </p>
              </div>
            )}
          </>
        );
    }
  }, [
    selectedView,
    handleTimelinePreview,
    foldersWithPreviews,
    subFoldersWithPreviews,
    rootMedia,
    media,
    isLoading,
    handlePreview,
    viewMode,
    setSelectedView,
    renameFolder,
    deleteFolder,
  ]);

  return (
    <SidebarProvider defaultOpen={typeof window !== "undefined" && window.innerWidth >= 1024}>
      <div className="flex h-dvh w-full overflow-hidden">
        <AppSidebar selectedView={selectedView} onSelectView={gatedNavigate} />

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <>
              {/* Header */}
              {!isChat && (
                <header className={cn(
                  "sticky top-0 z-10 shrink-0 border-b border-border/60",
                  selectedView === "billing" ? "bg-background" : "bg-background/95 backdrop-blur-xl",
                )}>
                  <div className="flex h-[52px] items-center gap-2 px-2 sm:px-4">
                    <SidebarTrigger className="h-9 w-9 shrink-0 rounded-lg" />
                    <h1 className="min-w-0 flex-1 truncate text-[15px] font-semibold text-foreground sm:text-base">
                      {pageTitle}
                    </h1>

                    <div className="flex shrink-0 items-center gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-lg"
                        onClick={cycleTheme}
                        aria-label={`Switch theme, current mode ${theme}`}
                        title={`Theme: ${theme}`}
                      >
                        {theme === "light" ? (
                          <Sun className="h-4 w-4" />
                        ) : theme === "dim" ? (
                          <Monitor className="h-4 w-4" />
                        ) : (
                          <Moon className="h-4 w-4" />
                        )}
                      </Button>
                      <NotificationsPanel />
                      <button
                        onClick={() => navigate(APP_PATHS.profile)}
                        className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-accent"
                        aria-label="Open profile"
                        title="Profile"
                      >
                        <Avatar className="h-7 w-7 ring-1 ring-border">
                          {profile?.avatar_url && (
                            <AvatarImage src={profile.avatar_url} alt="Profile" />
                          )}
                          <AvatarFallback className="text-[10px] font-semibold">
                            {profileInitials}
                          </AvatarFallback>
                        </Avatar>
                      </button>
                    </div>
                  </div>

                  {isGridView && (
                    <div className="flex h-12 items-center gap-1.5 border-t border-border/40 px-3 sm:gap-2 sm:px-4">
                      <div className="relative min-w-0 flex-1 md:max-w-lg">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          placeholder="Search memories"
                          aria-label="Search memories"
                          className="h-9 rounded-lg border-transparent bg-muted/60 pl-9 text-[13px] focus:border-border"
                          value={search}
                          onChange={(event) => setSearch(event.target.value)}
                        />
                      </div>

                      {renderFileTypeFilter()}
                      {renderSortMenu()}

                      <Button
                        variant="ghost"
                        size="icon"
                        className="hidden h-9 w-9 rounded-lg md:inline-flex"
                        onClick={() => setViewMode((value) => value === "grid" ? "list" : "grid")}
                        aria-label={`Switch to ${viewMode === "grid" ? "list" : "grid"} view`}
                        title={`${viewMode === "grid" ? "List" : "Grid"} view`}
                      >
                        {viewMode === "grid" ? <List className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
                      </Button>

                      {renderMobileMediaMenu()}

                      {(selectedView === "all" || !isSpecial) && (
                        <Button
                          onClick={() => setUploadOpen(true)}
                          size="sm"
                          className="hidden h-9 gap-1.5 rounded-lg px-3 text-xs sm:inline-flex"
                        >
                          <Upload className="h-3.5 w-3.5" />
                          Upload
                        </Button>
                      )}
                    </div>
                  )}
                </header>
              )}

              {/* Banners */}
              {!isChat && selectedView !== "billing" && <PartnerBanner />}
              {!isChat && (
                <UpgradeBanner
                  onUpgrade={() => setSelectedView("billing")}
                  selectedView={selectedView}
                />
              )}

              {/* Content */}
              {isChat ? (
                <div className="flex-1 min-h-0 overflow-hidden animate-in fade-in-0 slide-in-from-right-2 duration-200 motion-reduce:animate-none">
                  <DeferredChat>
                    <ChatView
                      onBack={() => setSelectedView("all")}
                      onUpgrade={() => setSelectedView("billing")}
                      callSession={callSession}
                    />
                  </DeferredChat>
                </div>
              ) : (
                <main
                  className={cn(
                    "flex-1 overflow-auto pb-[calc(5rem+env(safe-area-inset-bottom,0px))] sm:pb-6",
                    selectedView !== "billing" && "animate-in fade-in-0 duration-150 motion-reduce:animate-none",
                    selectedView !== "settings" &&
                    selectedView !== "travel-map" &&
                    "px-3 sm:px-4 md:px-6 pt-3 sm:pt-4 md:pt-6",
                    dragOverMain && "ring-2 ring-primary ring-inset"
                  )}
                  onDragOver={handleMainDragOver}
                  onDragLeave={handleMainDragLeave}
                  onDrop={handleMainDrop}
                  {...swipeHandlers}
                >
                  {renderPageHeader()}
                  {renderMainContent()}
                </main>
              )}
          </>
        </div>

        {/* Dialogs & Modals */}
        {uploadOpen && (
          <Suspense fallback={null}>
            <UploadDialog
              open
              onOpenChange={setUploadOpen}
              folderId={!isSpecial ? selectedView : null}
            />
          </Suspense>
        )}

        {previewIndex >= 0 && (
          <Suspense fallback={null}>
            <MediaPreview
              media={media}
              currentIndex={previewIndex}
              open
              onOpenChange={handlePreviewClose}
              onNavigate={setPreviewIndex}
            />
          </Suspense>
        )}

        {!isChat && previewIndex < 0 && (
          <MobileBottomNav
            selectedView={selectedView}
            onSelectView={gatedNavigate}
            onUpload={handleUpload}
          />
        )}

        {callSession.callState !== "idle" && (
          <Suspense fallback={null}>
            <CallModal
              callState={callSession.callState}
              callType={callSession.callType}
              incomingCallType={callSession.incomingCallType}
              partnerName={partnerName}
              partnerAvatarUrl={partnerProfile?.avatar_url ?? undefined}
              partnerInitials={partnerInitials}
              localStream={callSession.localStream}
              remoteStream={callSession.remoteStream}
              onAccept={() => void callSession.acceptCall()}
              onReject={() => callSession.rejectCall()}
              onHangUp={callSession.hangUp}
              isMuted={callSession.isMuted}
              isSpeaker={callSession.isSpeaker}
              onToggleMute={callSession.toggleMute}
              onToggleSpeaker={callSession.toggleSpeaker}
              connectedAt={callSession.connectedAt}
              partnerOnline={partnerOnline}
              onBackCamera={() => void callSession.flipCamera()}
              isFrontCamera={callSession.isFrontCamera}
              minimized={callMinimized}
              onMinimize={() => setCallMinimized(true)}
              onRestore={() => setCallMinimized(false)}
            />
          </Suspense>
        )}


        {gateModal && (
          <Suspense fallback={null}>
            <UpgradeGateModal
              open
              onClose={() => setGateModal(null)}
              onUpgrade={() => {
                setGateModal(null);
                setSelectedView("billing");
              }}
              featureName={gateModal.feature}
              requiredPlan={gateModal.plan}
            />
          </Suspense>
        )}
      </div>
    </SidebarProvider>
  );
}


