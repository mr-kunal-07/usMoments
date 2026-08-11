import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  FolderIcon,
  FolderPlus,
  ChevronRight,
  Pencil,
  Trash2,
  Home,
  Star,
  Hash,
  Heart,
  CalendarHeart,
  Trophy,
  ShieldCheck,
  Settings,
  Activity,
  Sparkles,
  Globe,
  Shield,
  MessagesSquare,
  UserPlus,
  MessageSquareMore,
  MapPinned,
} from "lucide-react";
import { usePlan, getStorageLimit, formatStorageLimit } from "@/hooks/useSubscription";
import { useIsAdmin } from "@/hooks/useAdmin";
import { DaysTogether } from "@/components/DaysTogether";
import { useFolders, useCreateFolder, useRenameFolder, useDeleteFolder, Folder } from "@/hooks/useFolders";
import { useMedia, useRecentlyDeletedMedia } from "@/hooks/useMedia";
import { useStorageUsage, useAllProfiles, useProfile } from "@/hooks/useProfile";
import { useOnThisDay } from "@/hooks/useMemories";
import { useMyCouple } from "@/hooks/useCouple";
import { useMessages } from "@/hooks/useMessages";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
} from "@/components/ui/sidebar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn, formatSize } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export type ViewType =
  | "all"
  | "starred"
  | "recently-deleted"
  | "timeline"
  | "on-this-day"
  | "anniversaries"
  | "chat"
  | "activity"
  | "billing"
  | "settings"
  | "love-story"
  | "travel-map";

export type FolderViewType = ViewType | string;

interface Props {
  selectedView: FolderViewType;
  onSelectView: (view: FolderViewType) => void;
}

interface NavItem {
  id: ViewType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  count?: number;
  badge?: number;
  hiddenOnMobile?: boolean;
}

const MAX_BADGE_COUNT = 99;
const STORAGE_WARNING_THRESHOLD = 0.9;

export function AppSidebar({ selectedView, onSelectView }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { setOpenMobile } = useSidebar();
  const { data: isAdmin } = useIsAdmin();
  const { data: folders = [] } = useFolders();
  const { data: allMedia = [] } = useMedia();
  const { data: storageBytes = 0 } = useStorageUsage();
  const { data: onThisDayMedia = [] } = useOnThisDay();
  const { data: couple } = useMyCouple();
  const { data: profiles = [] } = useAllProfiles();
  const { data: myProfile } = useProfile();
  const { data: messages = [] } = useMessages();
  const { data: deletedMedia = [] } = useRecentlyDeletedMedia();

  const createFolder = useCreateFolder();
  const renameFolder = useRenameFolder();
  const deleteFolder = useDeleteFolder();

  const [creatingFolder, setCreatingFolder] = useState(false);
  const [creatingInParent, setCreatingInParent] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [deletingFolder, setDeletingFolder] = useState<Folder | null>(null);

  const plan = usePlan();

  // Computed values
  const isConnected = couple?.status === "active";
  const partnerId = isConnected
    ? couple.user1_id === user?.id
      ? couple.user2_id
      : couple.user1_id
    : null;
  const partnerProfile = useMemo(
    () => (partnerId ? profiles.find((p) => p.user_id === partnerId) : null),
    [partnerId, profiles]
  );

  const unreadCount = useMemo(
    () => messages.filter((m) => m.sender_id !== user?.id && !m.read_at).length,
    [messages, user?.id]
  );

  const starredCount = useMemo(() => allMedia.filter((m) => m.is_starred).length, [allMedia]);

  const myInitials = useMemo(() => {
    const name = myProfile?.display_name ?? user?.email ?? "Me";
    return name.slice(0, 2).toUpperCase();
  }, [myProfile?.display_name, user?.email]);

  const partnerInitials = useMemo(() => {
    const name = partnerProfile?.display_name ?? "?";
    return name.slice(0, 2).toUpperCase();
  }, [partnerProfile?.display_name]);

  const rootFolders = useMemo(() => folders.filter((f) => !f.parent_id), [folders]);

  // Build a map of direct counts first (folder_id → count)
  const directCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    allMedia.forEach((m) => {
      if (!m.folder_id) return;
      counts[m.folder_id] = (counts[m.folder_id] ?? 0) + 1;
    });
    return counts;
  }, [allMedia]);

  // Recursively sum counts for a folder + all its descendants
  const getRecursiveCount = useCallback(
    (folderId: string): number => {
      const direct = directCounts[folderId] ?? 0;
      const children = folders.filter((f) => f.parent_id === folderId);
      const childSum = children.reduce((sum, c) => sum + getRecursiveCount(c.id), 0);
      return direct + childSum;
    },
    [directCounts, folders]
  );

  // folderCounts now includes all descendant media — used by sidebar badges
  const folderCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    folders.forEach((f) => {
      counts[f.id] = getRecursiveCount(f.id);
    });
    return counts;
  }, [folders, getRecursiveCount]);

  const storageLimit = useMemo(() => getStorageLimit(plan), [plan]);
  const storageLabel = useMemo(() => formatStorageLimit(plan), [plan]);
  const storagePercentage = useMemo(() => {
    if (storageLimit <= 0) return 0;
    return Math.min((storageBytes / storageLimit) * 100, 100);
  }, [storageBytes, storageLimit]);

  const isStorageWarning = storagePercentage > STORAGE_WARNING_THRESHOLD * 100;

  // Handlers
  const selectView = useCallback(
    (view: FolderViewType) => {
      setOpenMobile(false);
      onSelectView(view);
    },
    [setOpenMobile, onSelectView]
  );

  const handleCreate = useCallback(
    async (parentId?: string | null) => {
      const trimmedName = newFolderName.trim();
      if (!trimmedName) return;
      try {
        await createFolder.mutateAsync({ name: trimmedName, parentId: parentId ?? null });
        setNewFolderName("");
        setCreatingFolder(false);
        setCreatingInParent(null);
      } catch (error) {
        console.error("Failed to create folder:", error);
      }
    },
    [newFolderName, createFolder]
  );

  const handleRename = useCallback(
    async (id: string) => {
      const trimmedName = editName.trim();
      if (!trimmedName) return;
      try {
        await renameFolder.mutateAsync({ id, name: trimmedName });
        setEditingId(null);
      } catch (error) {
        console.error("Failed to rename folder:", error);
      }
    },
    [editName, renameFolder]
  );

  const handleDelete = useCallback(async () => {
    if (!deletingFolder) return;
    try {
      await deleteFolder.mutateAsync(deletingFolder.id);
      if (selectedView === deletingFolder.id) onSelectView("all");
      setDeletingFolder(null);
    } catch (error) {
      console.error("Failed to delete folder:", error);
    }
  }, [deletingFolder, deleteFolder, selectedView, onSelectView]);

  const openCreateDialog = useCallback((parentId: string | null = null) => {
    setCreatingInParent(parentId);
    setCreatingFolder(true);
    setNewFolderName("");
  }, []);

  const closeCreateDialog = useCallback(() => {
    setCreatingFolder(false);
    setCreatingInParent(null);
    setNewFolderName("");
  }, []);

  const formatBadgeCount = useCallback((count: number) => {
    return count > MAX_BADGE_COUNT ? `${MAX_BADGE_COUNT}+` : count;
  }, []);

  const specialItems: NavItem[] = useMemo(
    () => [
      { id: "all", label: "All Files", icon: Home, count: allMedia.length, hiddenOnMobile: true },
      { id: "starred", label: "Starred", icon: Star, count: starredCount },
      { id: "chat", label: "Chat with Partner", icon: MessageSquareMore, badge: unreadCount, hiddenOnMobile: true },
      { id: "travel-map", label: "Travel Map", icon: MapPinned, hiddenOnMobile: true },
      { id: "activity", label: "Activity", icon: Activity },
      { id: "timeline", label: "Memories Timeline", icon: CalendarHeart, hiddenOnMobile: true },
      { id: "anniversaries", label: "Anniversaries", icon: Trophy },
      { id: "love-story", label: "Love Story Card", icon: Sparkles },
      { id: "settings", label: "Settings", icon: Settings },
      { id: "billing", label: "Plan", icon: Shield },
      { id: "recently-deleted", label: "Recently Deleted", icon: Trash2, badge: deletedMedia.length },
    ],
    [unreadCount, allMedia.length, starredCount, deletedMedia.length]
  );

  const renderNavItem = useCallback(
    (item: NavItem) => (
      <SidebarMenuItem key={item.id} className={cn(item.hiddenOnMobile && "hidden sm:flex")}>
        <SidebarMenuButton
          onClick={() => selectView(item.id)}
          className={cn("justify-between", selectedView === item.id && "bg-accent text-accent-foreground")}
        >
          <span className="flex items-center">
            <item.icon className="h-4 w-4 mr-2" />
            <span>{item.label}</span>
          </span>
          {typeof item.count === "number" && item.count > 0 && (
            <Badge variant="secondary" className="text-xs h-5 px-1.5 font-normal">
              {formatBadgeCount(item.count)}
            </Badge>
          )}
          {typeof item.badge === "number" && item.badge > 0 && (
            <Badge className="text-xs h-5 px-1.5 font-semibold bg-primary text-primary-foreground border-0">
              {formatBadgeCount(item.badge)}
            </Badge>
          )}
        </SidebarMenuButton>
      </SidebarMenuItem>
    ),
    [selectedView, selectView, formatBadgeCount]
  );

  return (
    <Sidebar className="border-r">
      <SidebarHeader className="p-3 border-b border-sidebar-border">
        {/* App branding */}
        <div className="flex items-center gap-2">
          <div className="relative h-7 w-7 rounded-lg overflow-hidden shrink-0 ring-1 ring-black/5 dark:ring-white/10">
            <img src="/pwa-icon-192.png" alt="usMomentss" className="h-full w-full object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold font-heading tracking-tight gradient-text leading-none">
              usMoments
            </h2>
            <p className="text-[9px] text-muted-foreground/70 mt-0.5">Shared memories</p>
          </div>
        </div>

        {/* Connection status card */}
        <div className="mt-1">
          {isConnected ? (
            <div className="group relative rounded-lg bg-gradient-to-br from-primary/8 to-primary/4 border border-primary/20 p-2 transition-all hover:border-primary/30 hover:shadow-sm">
              <div className="flex items-center gap-2">
                <div className="flex items-center -space-x-2 shrink-0">
                  <Avatar className="h-7 w-7 ring-2 ring-sidebar border border-primary/20 transition-transform group-hover:scale-105">
                    <AvatarImage src={myProfile?.avatar_url ?? undefined} />
                    <AvatarFallback className="text-[10px] bg-primary text-primary-foreground font-semibold">
                      {myInitials}
                    </AvatarFallback>
                  </Avatar>
                  <Avatar className="h-7 w-7 ring-2 ring-sidebar border border-primary/20 transition-transform group-hover:scale-105">
                    <AvatarImage src={partnerProfile?.avatar_url ?? undefined} />
                    <AvatarFallback className="text-[10px] bg-gradient-to-br from-primary/80 to-primary/60 text-primary-foreground font-semibold">
                      {partnerInitials}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-[10px] font-semibold text-foreground truncate leading-none">
                      {myProfile?.display_name ?? "You"}
                      <span className="text-muted-foreground font-normal"> & </span>
                      {partnerProfile?.display_name ?? "Partner"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <div className="h-1 w-1 rounded-full bg-primary animate-pulse" />
                    <p className="text-[9px] text-primary font-medium">Connected</p>
                  </div>
                </div>
              </div>
              <div className="absolute inset-0 rounded-lg bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            </div>
          ) : (
            <div className="group relative rounded-lg bg-muted/30 border border-dashed border-border hover:border-muted-foreground/30 p-2 transition-all">
              <div className="flex items-center gap-2">
                <Avatar className="h-7 w-7 ring-2 ring-sidebar shrink-0">
                  <AvatarImage src={myProfile?.avatar_url ?? undefined} />
                  <AvatarFallback className="text-[10px] bg-primary text-primary-foreground font-semibold">
                    {myInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold text-foreground truncate leading-none">
                    {myProfile?.display_name ?? user?.email?.split("@")[0] ?? "You"}
                  </p>
                  <div className="flex items-center gap-1 mt-1">
                    <UserPlus className="h-2.5 w-2.5 text-muted-foreground/60" />
                    <p className="text-[9px] text-muted-foreground/80">Link your partner</p>
                  </div>
                </div>
                <ChevronRight className="h-3 w-3 text-muted-foreground/40 shrink-0 transition-transform group-hover:translate-x-0.5" />
              </div>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* Folders Section */}
        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center justify-between">
            <span>Folders</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={() => openCreateDialog(null)}
              aria-label="Create new folder"
            >
              <FolderPlus className="h-3.5 w-3.5" />
            </Button>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {rootFolders.map((folder) => (
                <FolderItem
                  key={folder.id}
                  folder={folder}
                  allFolders={folders}
                  folderCounts={folderCounts}
                  selectedView={selectedView}
                  onSelectView={selectView}
                  editingId={editingId}
                  editName={editName}
                  setEditingId={setEditingId}
                  setEditName={setEditName}
                  onRename={handleRename}
                  onDelete={setDeletingFolder}
                  onCreateSubfolder={openCreateDialog}
                  formatBadgeCount={formatBadgeCount}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* For Us Section */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {specialItems.map(renderNavItem)}

              {onThisDayMedia.length > 0 && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => selectView("on-this-day")}
                    className={cn(
                      "justify-between",
                      selectedView === "on-this-day" && "bg-accent text-accent-foreground"
                    )}
                  >
                    <span className="flex items-center">
                      <span className="text-base mr-2">🗓️</span>
                      <span>On This Day</span>
                    </span>
                    <Badge
                      variant="secondary"
                      className="text-xs h-5 px-1.5 font-normal animate-pulse bg-primary/15 text-primary border-0"
                    >
                      {formatBadgeCount(onThisDayMedia.length)}
                    </Badge>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="p-3 border-t space-y-2">
        <DaysTogether />

        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Hash className="h-3 w-3" />
              {isConnected ? "Shared storage" : "Storage used"}
            </span>
            <span className="font-medium text-foreground">{formatSize(storageBytes)}</span>
          </div>
          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                isStorageWarning ? "bg-destructive" : "bg-primary"
              )}
              style={{ width: `${storagePercentage}%` }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground/60">
            of {storageLabel}
            {isConnected ? " shared between you two" : ""}
          </p>
        </div>

        <div className="flex items-center gap-1">
          {isAdmin && (
            <SidebarMenuButton
              onClick={() => {
                setOpenMobile(false);
                navigate("/admin");
              }}
              className="flex-1 justify-start gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-primary" />
              Admin
            </SidebarMenuButton>
          )}
        </div>
      </SidebarFooter>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingFolder} onOpenChange={(open) => !open && setDeletingFolder(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete folder?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{deletingFolder?.name}" and remove files from this folder (files won't be
              deleted).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Folder Dialog */}
      <Dialog open={creatingFolder} onOpenChange={(open) => !open && closeCreateDialog()}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <FolderPlus className="h-4 w-4 text-primary" />
              {creatingInParent ? "New Subfolder" : "New Folder"}
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleCreate(creatingInParent);
            }}
            className="space-y-3"
          >
            <Input
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder={creatingInParent ? "Subfolder name" : "Folder name"}
              className="h-10 text-sm"
              autoFocus
              maxLength={50}
            />
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" size="sm" onClick={closeCreateDialog}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={!newFolderName.trim() || createFolder.isPending}>
                Create
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Sidebar>
  );
}

/* ── FolderItem ──────────────────────────────────────────────────── */
interface FolderItemProps {
  folder: Folder;
  allFolders: Folder[];
  folderCounts: Record<string, number>;
  selectedView: string;
  onSelectView: (id: string) => void;
  editingId: string | null;
  editName: string;
  setEditingId: (id: string | null) => void;
  setEditName: (name: string) => void;
  onRename: (id: string) => void;
  onDelete: (f: Folder) => void;
  onCreateSubfolder: (parentId: string) => void;
  formatBadgeCount: (count: number) => string | number;
}

function FolderItem({
  folder,
  allFolders,
  folderCounts,
  selectedView,
  onSelectView,
  editingId,
  editName,
  setEditingId,
  setEditName,
  onRename,
  onDelete,
  onCreateSubfolder,
  formatBadgeCount,
}: FolderItemProps) {
  const [expanded, setExpanded] = useState(false);

  const children = useMemo(
    () => allFolders.filter((f) => f.parent_id === folder.id),
    [allFolders, folder.id]
  );

  // Use recursive count from folderCounts (includes all descendants)
  const count = folderCounts[folder.id] ?? 0;
  const isSelected = selectedView === folder.id;
  const hasChildren = children.length > 0;

  const handleEdit = useCallback(() => {
    setEditingId(folder.id);
    setEditName(folder.name);
  }, [folder.id, folder.name, setEditingId, setEditName]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        onRename(folder.id);
      } else if (e.key === "Escape") {
        setEditingId(null);
      }
    },
    [folder.id, onRename, setEditingId]
  );

  const handleBlur = useCallback(() => {
    if (!editName.trim()) setEditingId(null);
    else onRename(folder.id);
  }, [editName, folder.id, onRename, setEditingId]);

  return (
    <SidebarMenuItem>
      {editingId === folder.id ? (
        <div className="px-2 pb-1">
          <Input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="h-7 text-sm"
            autoFocus
            maxLength={50}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
          />
        </div>
      ) : (
        <div className={cn("flex items-center gap-1 rounded-md group", isSelected && "bg-accent")}>
          {hasChildren && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="p-1 rounded hover:bg-muted/50 transition-colors"
              aria-label={expanded ? "Collapse folder" : "Expand folder"}
            >
              <ChevronRight
                className={cn(
                  "h-3 w-3 text-muted-foreground transition-transform",
                  expanded && "rotate-90"
                )}
              />
            </button>
          )}
          <SidebarMenuButton
            onClick={() => onSelectView(folder.id)}
            className={cn(
              "flex-1 justify-between min-w-0",
              isSelected && "bg-accent text-accent-foreground"
            )}
          >
            <span className="flex items-center min-w-0">
              {folder.emoji && <span className="mr-1.5 text-sm">{folder.emoji}</span>}
              <FolderIcon className="h-3.5 w-3.5 mr-1.5 shrink-0 text-muted-foreground" />
              <span className="truncate text-sm">{folder.name}</span>
            </span>
            {count > 0 && (
              <Badge variant="secondary" className="text-xs h-4 px-1 font-normal shrink-0">
                {formatBadgeCount(count)}
              </Badge>
            )}
          </SidebarMenuButton>
          <div className="flex items-center gap-0.5 pr-1">
            <button
              onClick={handleEdit}
              className="p-1 rounded hover:bg-muted/50 transition-colors"
              aria-label="Rename folder"
            >
              <Pencil className="h-2.5 w-2.5 text-muted-foreground" />
            </button>
            <button
              onClick={() => onDelete(folder)}
              className="p-1 rounded hover:bg-destructive/10 transition-colors"
              aria-label="Delete folder"
            >
              <Trash2 className="h-2.5 w-2.5 text-destructive/70" />
            </button>
            <button
              onClick={() => onCreateSubfolder(folder.id)}
              className="p-1 rounded hover:bg-muted/50 transition-colors"
              aria-label="Create subfolder"
            >
              <FolderPlus className="h-2.5 w-2.5 text-muted-foreground" />
            </button>
          </div>
        </div>
      )}

      {expanded && hasChildren && (
        <div className="pl-4 mt-1">
          {children.map((child) => (
            <FolderItem
              key={child.id}
              folder={child}
              allFolders={allFolders}
              folderCounts={folderCounts}
              selectedView={selectedView}
              onSelectView={onSelectView}
              editingId={editingId}
              editName={editName}
              setEditingId={setEditingId}
              setEditName={setEditName}
              onRename={onRename}
              onDelete={onDelete}
              onCreateSubfolder={onCreateSubfolder}
              formatBadgeCount={formatBadgeCount}
            />
          ))}
        </div>
      )}
    </SidebarMenuItem>
  );
}
