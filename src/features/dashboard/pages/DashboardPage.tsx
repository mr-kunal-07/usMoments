import { lazy, Suspense, useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useSwipeNav } from "@/hooks/useSwipeNav";
import { Search, Upload, Moon, Sun, Monitor, LayoutGrid, List, ArrowUpDown, FolderPlus } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
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
import { UploadDialog } from "@/components/media/UploadDialog";
import { MediaPreview } from "@/components/media/MediaPreview";
import { FolderBreadcrumb } from "@/components/media/FolderBreadcrumb";
import { NotificationsPanel } from "@/components/notifications/NotificationsPanel";
import { PartnerBanner } from "@/components/couples/PartnerBanner";
import { UpgradeBanner } from "@/components/billing/UpgradeBanner";
import { ChatView } from "@/components/chat/ChatView";
import { CallModal } from "@/components/chat/CallModal";
import { UpgradeGateModal } from "@/components/billing/UpgradeGateModal";
import { MobileBottomNav } from "@/components/dashboard/MobileBottomNav";
import { PWAInstallPrompt } from "@/components/settings/PWAInstallPrompt";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreateFolder } from "@/hooks/useFolders";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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

export default function Dashboard() {
  usePushSubscription();

  const { user } = useAuth();
  const navigate = useNavigate();
  const { tab, folderId: folderParam } = useParams<{ tab?: string; folderId?: string }>();
  const { toast } = useToast();
  const { theme, cycleTheme } = useTheme();
  const isMobile = useIsMobile();
  const reduceMotion = useReducedMotion();

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
  const renameFolder = useRenameFolder(); // add
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

  const seenMediaRef = useRef<Set<string>>(new Set());

  // Computed values
  const selectedView = useMemo<FolderViewType>(() => {
    if (folderParam) return folderParam as FolderViewType;
    return tabToView(tab);
  }, [folderParam, tab]);

  const isSpecial = useMemo(() => isSpecialView(selectedView), [selectedView]);
  const isChat = selectedView === "chat";
  const isGridView = useMemo(() => !NON_GRID_VIEWS.includes(selectedView as ViewType), [selectedView]);
  const animateChatNav = isMobile && !reduceMotion;

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
    isSpecial && selectedView !== "starred" ? undefined : folderId,
    search || undefined
  );
  const { data: starredMedia = [] } = useStarredMedia();
  // Combined loading state
  const isLoading = selectedView === "all" ? allMediaLoading : regularLoading;

  // Recursively collect all descendant folder IDs for a given folder
  const getDescendantIds = useCallback(
    (folderId: string): string[] => {
      const children = folders.filter((f) => f.parent_id === folderId);
      return [
        folderId,
        ...children.flatMap((c) => getDescendantIds(c.id)),
      ];
    },
    [folders]
  );

  // Helper: enrich a folder list with preview URLs + counts (recursive — includes sub-folders)
  const enrichFolders = useCallback(
    (folderList: typeof folders) =>
      folderList.map((folder) => {
        // All folder IDs in this subtree (folder + all descendants)
        const subtreeIds = getDescendantIds(folder.id);

        // All media anywhere in the subtree
        const subtreeMedia = allMedia.filter((m) => subtreeIds.includes(m.folder_id ?? ""));

        // For previews prefer direct images first, then fall back to descendant images
        const directImages = allMedia.filter(
          (m) => m.folder_id === folder.id && m.file_type === "image"
        );
        const previewMedia = directImages.length > 0
          ? directImages
          : subtreeMedia.filter((m) => m.file_type === "image");

        return {
          ...folder,
          count: subtreeMedia.length,
          previewUrls: previewMedia.slice(0, 4).map((m) => getPublicUrl(m.file_path)),
        };
      }),
    [allMedia, getDescendantIds]
  );

  // Root-level folders only (no parent_id) — shown in "all" view
  const foldersWithPreviews = useMemo(
    () => enrichFolders(folders.filter((f) => !f.parent_id)),
    [folders, enrichFolders]
  );

  // Sub-folders of the currently open folder
  const subFoldersWithPreviews = useMemo(() => {
    if (isSpecial) return [];
    return enrichFolders(folders.filter((f) => f.parent_id === selectedView));
  }, [folders, enrichFolders, isSpecial, selectedView]);

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
    if (selectedView !== "all" || !search.trim()) return typeFiltered;
    const q = search.trim().toLowerCase();
    return typeFiltered.filter(
      (m) =>
        m.title?.toLowerCase().includes(q) ||
        m.description?.toLowerCase().includes(q)
    );
  }, [typeFiltered, selectedView, search]);

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
      <div className="hidden md:flex items-center gap-0.5 p-0.5 rounded-lg bg-muted shrink-0">
        {FILE_TYPE_FILTERS.map((filter) => (
          <button
            key={filter}
            onClick={() => setFileTypeFilter(filter)}
            className={cn(
              "px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors",
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
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hidden sm:flex">
            <ArrowUpDown className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          {sortItems.map(({ key, label }) => (
            <DropdownMenuItem
              key={key}
              onClick={() => toggleSort(key)}
              className={cn(sortKey === key && "font-semibold")}
            >
              {label} {sortKey === key ? (sortDir === "asc" ? "↑" : "↓") : ""}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }, [isGridView, sortKey, sortDir, toggleSort]);

  const renderPageHeader = useCallback(() => {
    if (selectedView === "settings" || selectedView === "travel-map") return null;
    return (
      <div
        className={cn(
          "flex flex-col gap-2",
          selectedView === "billing" ? "mb-0" : "mb-3 sm:mb-5"
        )}
      >
        {/* Top Row → Breadcrumb + Actions */}
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

        {/* Title */}
        {selectedView !== "billing" && (
          <h1 className="hidden sm:block text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
            {pageTitle}
          </h1>
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
    pageTitle,
    onThisDayMedia.length,
    isGridView,
    isLoading,
    media.length,
    isMobile,
    openAddFolder,        // ← add
    newFolderName,        // ← add
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
          {animateChatNav ? (
            <div className="flex-1 min-h-0 relative overflow-hidden">
              <AnimatePresence initial={false} mode="wait">
                {isChat ? (
                  <motion.div
                    key="chat"
                    className="absolute inset-0 flex flex-col min-w-0 min-h-0 overflow-hidden bg-background"
                    initial={{ x: "100%" }}
                    animate={{ x: 0 }}
                    exit={{ x: "100%" }}
                    transition={{ type: "tween", ease: [0.22, 1, 0.36, 1], duration: 0.28 }}
                  >
                    <div className="flex-1 min-h-0 overflow-hidden">
                      <ChatView
                        onBack={() => setSelectedView("all")}
                        onUpgrade={() => setSelectedView("billing")}
                        callSession={callSession}
                      />
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="main"
                    className="absolute inset-0 flex flex-col min-w-0 min-h-0 overflow-hidden bg-background"
                    initial={{ x: "-100%" }}
                    animate={{ x: 0 }}
                    exit={{ x: "-100%" }}
                    transition={{ type: "tween", ease: [0.22, 1, 0.36, 1], duration: 0.28 }}
                  >
                    <header
                      className="sticky top-0 z-10 bg-background/95 backdrop-blur-xl border-b border-border/60 shrink-0"
                      style={{ height: "52px" }}
                    >
                      <div className="flex items-center h-full px-2 sm:px-4 gap-1.5">
                        <SidebarTrigger className="shrink-0 h-9 w-9" />

                        {isGridView ? (
                          <div className="relative flex-1 min-w-0 max-w-[200px] sm:max-w-md">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                            <Input
                              placeholder="Search..."
                              className="pl-8 h-8 text-[13px] bg-muted/60 border-transparent focus:border-border rounded-xl"
                              value={search}
                              onChange={(e) => setSearch(e.target.value)}
                            />
                          </div>
                        ) : (
                          <h1 className="text-[15px] font-semibold text-foreground truncate flex-1 sm:hidden">
                            {pageTitle}
                          </h1>
                        )}

                        {renderFileTypeFilter()}

                        <div className="flex items-center gap-0.5 ml-auto shrink-0">
                          {renderSortMenu()}

                          {isGridView && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 hidden sm:flex"
                              onClick={() => setViewMode((v) => (v === "grid" ? "list" : "grid"))}
                              aria-label={`Switch to ${viewMode === "grid" ? "list" : "grid"} view`}
                            >
                              {viewMode === "grid" ? (
                                <List className="h-4 w-4" />
                              ) : (
                                <LayoutGrid className="h-4 w-4" />
                              )}
                            </Button>
                          )}

                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={cycleTheme}
                            aria-label={`Switch theme, current mode ${theme}`}
                          >
                            {theme === "light" ? (
                              <Sun className="h-[15px] w-[15px]" />
                            ) : theme === "dim" ? (
                              <Monitor className="h-[15px] w-[15px]" />
                            ) : (
                              <Moon className="h-[15px] w-[15px]" />
                            )}
                          </Button>

                          <NotificationsPanel />

                          {(selectedView === "all" || !isSpecial) && (
                            <Button
                              onClick={() => setUploadOpen(true)}
                              size="sm"
                              className="gap-1.5 h-8 px-3 hidden sm:flex text-xs rounded-xl"
                            >
                              <Upload className="h-3.5 w-3.5" />
                              Upload
                            </Button>
                          )}

                          <button
                            onClick={() => navigate(APP_PATHS.profile)}
                            className="flex items-center gap-1.5 h-8 pl-1 pr-2 rounded-xl hover:bg-accent transition-colors shrink-0"
                            aria-label="Go to profile"
                          >
                            <Avatar className="h-7 w-7 ring-2 ring-border">
                              {profile?.avatar_url && (
                                <AvatarImage src={profile.avatar_url} alt="Profile" />
                              )}
                              <AvatarFallback className="text-[10px] font-semibold">
                                {profileInitials}
                              </AvatarFallback>
                            </Avatar>
                            <div className="hidden lg:flex flex-col items-start leading-none">
                              <span className="text-[11px] font-medium text-foreground truncate max-w-[80px]">
                                {profile?.display_name ?? user?.email?.split("@")[0] ?? "You"}
                              </span>
                              <span className="text-[10px] text-muted-foreground capitalize">
                                {plan}
                              </span>
                            </div>
                          </button>
                        </div>
                      </div>
                    </header>

                    <PartnerBanner />
                    <UpgradeBanner
                      onUpgrade={() => setSelectedView("billing")}
                      selectedView={selectedView}
                    />

                    <main
                      className={cn(
                        "flex-1 overflow-auto pb-[72px] sm:pb-6",
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
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <>
              {/* Header */}
              {!isChat && (
                <header
                  className="sticky top-0 z-10 bg-background/95 backdrop-blur-xl border-b border-border/60 shrink-0"
                  style={{ height: "52px" }}
                >
                  <div className="flex items-center h-full px-2 sm:px-4 gap-1.5">
                    <SidebarTrigger className="shrink-0 h-9 w-9" />

                    {isGridView ? (
                      <div className="relative flex-1 min-w-0 max-w-[200px] sm:max-w-md">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                        <Input
                          placeholder="Search..."
                          className="pl-8 h-8 text-[13px] bg-muted/60 border-transparent focus:border-border rounded-xl"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                        />
                      </div>
                    ) : (
                      <h1 className="text-[15px] font-semibold text-foreground truncate flex-1 sm:hidden">
                        {pageTitle}
                      </h1>
                    )}

                    {renderFileTypeFilter()}

                    <div className="flex items-center gap-0.5 ml-auto shrink-0">
                      {renderSortMenu()}

                      {isGridView && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 hidden sm:flex"
                          onClick={() => setViewMode((v) => (v === "grid" ? "list" : "grid"))}
                          aria-label={`Switch to ${viewMode === "grid" ? "list" : "grid"} view`}
                        >
                          {viewMode === "grid" ? (
                            <List className="h-4 w-4" />
                          ) : (
                            <LayoutGrid className="h-4 w-4" />
                          )}
                        </Button>
                      )}

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={cycleTheme}
                        aria-label={`Switch theme, current mode ${theme}`}
                      >
                        {theme === "light" ? (
                          <Sun className="h-[15px] w-[15px]" />
                        ) : theme === "dim" ? (
                          <Monitor className="h-[15px] w-[15px]" />
                        ) : (
                          <Moon className="h-[15px] w-[15px]" />
                        )}
                      </Button>

                      <NotificationsPanel />

                      {(selectedView === "all" || !isSpecial) && (
                        <Button
                          onClick={() => setUploadOpen(true)}
                          size="sm"
                          className="gap-1.5 h-8 px-3 hidden sm:flex text-xs rounded-xl"
                        >
                          <Upload className="h-3.5 w-3.5" />
                          Upload
                        </Button>
                      )}

                      <button
                        onClick={() => navigate(APP_PATHS.profile)}
                        className="flex items-center gap-1.5 h-8 pl-1 pr-2 rounded-xl hover:bg-accent transition-colors shrink-0"
                        aria-label="Go to profile"
                      >
                        <Avatar className="h-7 w-7 ring-2 ring-border">
                          {profile?.avatar_url && (
                            <AvatarImage src={profile.avatar_url} alt="Profile" />
                          )}
                          <AvatarFallback className="text-[10px] font-semibold">
                            {profileInitials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="hidden lg:flex flex-col items-start leading-none">
                          <span className="text-[11px] font-medium text-foreground truncate max-w-[80px]">
                            {profile?.display_name ?? user?.email?.split("@")[0] ?? "You"}
                          </span>
                          <span className="text-[10px] text-muted-foreground capitalize">{plan}</span>
                        </div>
                      </button>
                    </div>
                  </div>
                </header>
              )}

              {/* Banners */}
              {!isChat && <PartnerBanner />}
              {!isChat && (
                <UpgradeBanner
                  onUpgrade={() => setSelectedView("billing")}
                  selectedView={selectedView}
                />
              )}

              {/* Content */}
              {isChat ? (
                <div className="flex-1 min-h-0 overflow-hidden">
                  <ChatView
                    onBack={() => setSelectedView("all")}
                    onUpgrade={() => setSelectedView("billing")}
                    callSession={callSession}
                  />
                </div>
              ) : (
                <main
                  className={cn(
                    "flex-1 overflow-auto pb-[72px] sm:pb-6",
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
          )}
        </div>

        {/* Dialogs & Modals */}
        <UploadDialog
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          folderId={!isSpecial ? selectedView : null}
        />

        {previewIndex >= 0 && (
          <MediaPreview
            media={media}
            currentIndex={previewIndex}
            open={previewIndex >= 0}
            onOpenChange={handlePreviewClose}
            onNavigate={setPreviewIndex}
          />
        )}

        {!isChat && previewIndex < 0 && (
          <MobileBottomNav
            selectedView={selectedView}
            onSelectView={gatedNavigate}
            onUpload={handleUpload}
          />
        )}

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

        <PWAInstallPrompt />

        <UpgradeGateModal
          open={!!gateModal}
          onClose={() => setGateModal(null)}
          onUpgrade={() => {
            setGateModal(null);
            setSelectedView("billing");
          }}
          featureName={gateModal?.feature ?? ""}
          requiredPlan={gateModal?.plan ?? "dating"}
        />
      </div>
    </SidebarProvider>
  );
}


