import { useState, useCallback, useRef, useEffect } from "react";
import { Play, MoreVertical, Trash2, Star, Image as ImageIcon, FolderInput, X, CheckSquare, FolderOpen, Keyboard, Download, User, Loader2 } from "lucide-react";
import { Media, getPublicUrl, useDeleteMedia, useToggleStar, useBulkDeleteMedia, useBulkMoveMedia } from "@/hooks/useMedia";
import { useFolders } from "@/hooks/useFolders";
import { useAllProfiles } from "@/hooks/useProfile";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatSize } from "@/lib/utils";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { useIsMobile } from "@/hooks/use-mobile";
import { haptic } from "@/lib/haptics";
import { downloadMediaAsZip } from "@/lib/downloadUtils";

export type ViewMode = "grid" | "list";

interface Props {
  media: Media[];
  loading: boolean;
  onPreview: (m: Media) => void;
  viewMode: ViewMode;
  hasMore?: boolean;
  onLoadMore?: () => void;
}

function downloadFile(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export function MediaGrid({ media, loading, onPreview, viewMode, hasMore, onLoadMore }: Props) {
  const deleteMedia = useDeleteMedia();
  const toggleStar = useToggleStar();
  const bulkDelete = useBulkDeleteMedia();
  const bulkMove = useBulkMoveMedia();
  const { data: folders = [] } = useFolders();
  const { data: profiles = [] } = useAllProfiles();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  // Build uploader map: userId -> display_name
  const uploaderMap = Object.fromEntries(profiles.map(p => [p.user_id, p.display_name ?? p.user_id.slice(0, 8)]));

  const [deleteItem, setDeleteItem] = useState<Media | null>(null);

  const [moveItem, setMoveItem] = useState<Media | null>(null);
  const [singleMoveFolderId, setSingleMoveFolderId] = useState<string>("__none__");
  const moveMedia = useBulkMoveMedia();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkMoveOpen, setBulkMoveOpen] = useState(false);
  const [moveFolderId, setMoveFolderId] = useState<string>("__none__");
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  const isSelecting = selected.size > 0;

  const toggleSelect = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    haptic("light");
  }, []);

  const selectAll = useCallback(() => {
    setSelected(new Set(media.map(m => m.id)));
    haptic("medium");
  }, [media]);
  const clearSelection = useCallback(() => setSelected(new Set()), []);

  // ── Keyboard shortcuts ──────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).closest("[role=dialog]")) return;

      if (e.key === "Escape") {
        clearSelection();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "a") {
        e.preventDefault();
        selectAll();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (selected.size > 0 && !bulkDeleteOpen && !deleteItem) {
          setBulkDeleteOpen(true);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selected, bulkDeleteOpen, deleteItem, clearSelection, selectAll]);

  // ── Infinite scroll ─────────────────────────────────────────────────
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!hasMore || !onLoadMore) return;
    const observer = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting) onLoadMore(); },
      { threshold: 0.1 }
    );
    if (sentinelRef.current) observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, onLoadMore]);

  const handleDelete = async () => {
    if (!deleteItem) return;
    try {
      await deleteMedia.mutateAsync({ id: deleteItem.id, filePath: deleteItem.file_path });
      setDeleteItem(null);
      toast({ title: "Deleted" });
      haptic("warning");
    } catch {
      toast({ title: "Error deleting", variant: "destructive" });
    }
  };

  const handleToggleStar = async (item: Media) => {
    try {
      await toggleStar.mutateAsync({ id: item.id, starred: !item.is_starred });
      haptic("light");
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  };

  const handleBulkDelete = async () => {
    const items = media.filter(m => selected.has(m.id)).map(m => ({ id: m.id, filePath: m.file_path }));
    try {
      await bulkDelete.mutateAsync(items);
      clearSelection();
      setBulkDeleteOpen(false);
      toast({ title: `Deleted ${items.length} file${items.length !== 1 ? "s" : ""}` });
      haptic("warning");
    } catch {
      toast({ title: "Error deleting files", variant: "destructive" });
    }
  };

  const handleBulkMove = async () => {
    const ids = Array.from(selected);
    const folderId = moveFolderId === "__none__" ? null : moveFolderId;
    try {
      await bulkMove.mutateAsync({ ids, folderId });
      clearSelection();
      setBulkMoveOpen(false);
      toast({ title: `Moved ${ids.length} file${ids.length !== 1 ? "s" : ""}` });
      haptic("success");
    } catch {
      toast({ title: "Error moving files", variant: "destructive" });
    }
  };

  const handleSingleMove = async () => {
    if (!moveItem) return;
    const folderId = singleMoveFolderId === "__none__" ? null : singleMoveFolderId;
    try {
      await moveMedia.mutateAsync({ ids: [moveItem.id], folderId });
      setMoveItem(null);
      toast({ title: "Moved to folder" });
      haptic("success");
    } catch {
      toast({ title: "Error moving file", variant: "destructive" });
    }
  };

  const handleBulkDownload = async () => {
    const selectedMedia = media.filter(m => selected.has(m.id));
    if (selectedMedia.length === 0) return;

    setIsDownloading(true);
    setDownloadProgress(0);

    try {
      const mediaToDownload = selectedMedia.map(m => ({
        id: m.id,
        file_name: m.file_name,
        file_path: m.file_path,
        file_type: m.file_type as "image" | "video",
        title: m.title,
        created_at: m.created_at,
      }));

      await downloadMediaAsZip(mediaToDownload, (current, total) => {
        setDownloadProgress(Math.round((current / total) * 100));
      });

      clearSelection();
      toast({ title: `Downloaded ${selectedMedia.length} file${selectedMedia.length !== 1 ? "s" : ""} as ZIP` });
      haptic("success");
    } catch (error) {
      console.error("Download error:", error);
      toast({
        title: "Download failed",
        description: error instanceof Error ? error.message : "Unable to download files",
        variant: "destructive"
      });
      haptic("warning");
    } finally {
      setIsDownloading(false);
      setDownloadProgress(0);
    }
  };

  const handleDragStart = (e: React.DragEvent, item: Media) => {
    e.dataTransfer.setData("media-id", item.id);
    e.dataTransfer.effectAllowed = "move";
  };

  const singleMoveContent = (
    <>
      <div className="space-y-2 py-2">
        <Label>Destination</Label>
        <Select value={singleMoveFolderId} onValueChange={setSingleMoveFolderId}>
          <SelectTrigger><SelectValue placeholder="Choose folder..." /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">No folder (root)</SelectItem>
            {folders.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => setMoveItem(null)} className="active:scale-[0.98]">Cancel</Button>
        <Button size="sm" onClick={handleSingleMove} disabled={moveMedia.isPending} className="active:scale-[0.98]">Move</Button>
      </div>
    </>
  );

  const bulkMoveContent = (
    <>
      <div className="space-y-2 py-2">
        <Label>Destination</Label>
        <Select value={moveFolderId} onValueChange={setMoveFolderId}>
          <SelectTrigger><SelectValue placeholder="Choose folder..." /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">No folder (root)</SelectItem>
            {folders.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => setBulkMoveOpen(false)} className="active:scale-[0.98]">Cancel</Button>
        <Button onClick={handleBulkMove} disabled={bulkMove.isPending} className="active:scale-[0.98]">Move</Button>
      </div>
    </>
  );

  if (loading) {
    return (
      <div className={cn(
        viewMode === "grid"
          ? "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3"
          : "space-y-2"
      )}>
        {Array.from({ length: 8 }).map((_, i) => (
          viewMode === "grid" ? (
            <Card key={i} className="overflow-hidden border-border/50 animate-in fade-in-0 duration-300">
              <Skeleton className="w-full h-36 sm:h-44" />
              <div className="p-3 space-y-2">
                <Skeleton className="h-3.5 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </Card>
          ) : (
            <Skeleton key={i} className="h-14 sm:h-16 w-full rounded-lg" />
          )
        ))}
      </div>
    );
  }
  if (media.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
        <div className="rounded-full bg-muted p-6 mb-4">
          <ImageIcon className="h-10 w-10 opacity-40" />
        </div>
        <p className="text-base font-medium text-foreground">No files here yet</p>
        <p className="text-sm mt-1">Upload files to get started</p>
      </div>
    );
  }

  // Context menu items — reused in both grid and list
  const renderContextMenuItems = (item: Media) => (
    <>
      <ContextMenuItem onClick={() => handleToggleStar(item)}>
        <Star className={cn("h-4 w-4 mr-2", item.is_starred && "fill-yellow-400 text-yellow-400")} />
        {item.is_starred ? "Unstar" : "Star"}
      </ContextMenuItem>
      <ContextMenuItem onClick={() => { setSingleMoveFolderId(item.folder_id ?? "__none__"); setMoveItem(item); }}>
        <FolderOpen className="h-4 w-4 mr-2" /> Move to folder
      </ContextMenuItem>
      <ContextMenuItem onClick={() => downloadFile(getPublicUrl(item.file_path), item.file_name)}>
        <Download className="h-4 w-4 mr-2" /> Download
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem onClick={() => setDeleteItem(item)} className="text-destructive focus:text-destructive">
        <Trash2 className="h-4 w-4 mr-2" /> Delete
      </ContextMenuItem>
    </>
  );

  // Dropdown menu items — reused in both grid and list
  const renderDropdownItems = (item: Media, stopPropagation = false) => {
    const wrap = (fn: () => void) => (e: React.MouseEvent) => { if (stopPropagation) e.stopPropagation(); fn(); };
    return (
      <>
        <DropdownMenuItem onClick={wrap(() => handleToggleStar(item))}>
          <Star className={cn("h-4 w-4 mr-2", item.is_starred && "fill-yellow-400 text-yellow-400")} />
          {item.is_starred ? "Unstar" : "Star"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={wrap(() => { setSingleMoveFolderId(item.folder_id ?? "__none__"); setMoveItem(item); })}>
          <FolderOpen className="h-4 w-4 mr-2" /> Move to folder
        </DropdownMenuItem>
        <DropdownMenuItem onClick={wrap(() => downloadFile(getPublicUrl(item.file_path), item.file_name))}>
          <Download className="h-4 w-4 mr-2" /> Download
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={wrap(() => setDeleteItem(item))} className="text-destructive focus:text-destructive">
          <Trash2 className="h-4 w-4 mr-2" /> Delete
        </DropdownMenuItem>
      </>
    );
  };

  return (
    <>
      {/* ── Selection toolbar ─────────────────────────────────────── */}
      {isSelecting && (
        <div className="flex flex-wrap items-center gap-2 mb-4 px-3 sm:px-4 py-2.5 rounded-xl bg-primary/8 border border-primary/20 backdrop-blur-sm shadow-sm animate-in slide-in-from-top-1 duration-150">
          <CheckSquare className="h-4 w-4 text-primary shrink-0" />
          <span className="text-sm font-semibold text-primary">{selected.size} selected</span>
          <Button variant="ghost" size="sm" className="text-xs h-7 px-2 text-muted-foreground hover:text-foreground" onClick={selectAll}>
            All {media.length}
          </Button>
          <div className="flex items-center gap-1.5 ml-auto">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                  onClick={() => { setMoveFolderId("__none__"); setBulkMoveOpen(true); }}>
                  <FolderInput className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Move</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Move selected files</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                  onClick={handleBulkDownload} disabled={isDownloading}>
                  {isDownloading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                  <span className="hidden sm:inline">{isDownloading ? "Downloading..." : "Download"}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Download as ZIP</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="destructive" className="h-7 text-xs gap-1"
                  onClick={() => setBulkDeleteOpen(true)}>
                  <Trash2 className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Delete</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Delete</TooltipContent>
            </Tooltip>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={clearSelection}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Keyboard hint — desktop only ───────────────────────────── */}
      {!isSelecting && media.length > 0 && (
        <div className="hidden sm:flex items-center gap-1.5 mb-4 text-xs text-muted-foreground/60 select-none">
          <Keyboard className="h-3 w-3" />
          <span><kbd className="font-mono">Ctrl+A</kbd> select all · <kbd className="font-mono">Del</kbd> delete · <kbd className="font-mono">Esc</kbd> clear</span>
        </div>
      )}

      {/* ── Grid view ─────────────────────────────────────────────── */}
      {viewMode === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3">
          {media.map(item => {
            const isSelected = selected.has(item.id);
            const uploaderName = uploaderMap[item.uploaded_by];
            return (
              <ContextMenu key={item.id}>
                <ContextMenuTrigger asChild>
                  <Card
                    className={cn(
                      "overflow-hidden group cursor-pointer transition-all duration-200 break-inside-avoid border-border",
                      "hover:shadow-lg hover:-translate-y-0.5 hover:border-border active:scale-[0.985]",
                      isSelected && "ring-1 ring-primary shadow-md -translate-y-0.5"
                    )}
                    draggable={!isSelecting}
                    onDragStart={e => handleDragStart(e, item)}
                  >
                    <div
                      className="relative bg-muted overflow-hidden h-36 sm:h-40 md:h-44"
                      onClick={() => {
                        if (isSelecting) {
                          toggleSelect(item.id);
                        } else {
                          haptic("light");
                          onPreview(item);
                        }
                      }}
                    >
                      {item.file_type === "video" ? (
                        <>
                          <video src={getPublicUrl(item.file_path)} className="w-full object-cover" preload="metadata" />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/20 transition-colors">
                            <div className="rounded-full bg-white/20 backdrop-blur-sm p-3">
                              <Play className="h-8 w-8 text-white fill-white" />
                            </div>
                          </div>
                        </>
                      ) : (
                        <img src={getPublicUrl(item.file_path)} alt={item.title} className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300" loading="lazy" />
                      )}

                      {/* Gradient overlay on hover */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none" />

                      {/* Checkbox */}
                      <div
                        className={cn(
                          "absolute top-2 left-2 transition-all duration-150",
                          isSelecting ? "opacity-100 scale-100" : "opacity-0 group-hover:opacity-100 scale-95 group-hover:scale-100"
                        )}
                        onClick={e => { e.stopPropagation(); toggleSelect(item.id); }}
                      >
                        <Checkbox
                          checked={isSelected}
                          className="h-5 w-5 bg-background/80 backdrop-blur-sm border-white/60 shadow-sm data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                        />
                      </div>

                      {/* Star */}
                      {!isSelecting && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute top-1.5 right-1.5 h-7 w-7 p transition-all duration-150 bg-black/30 hover:bg-black/50 backdrop-blur-sm rounded-full"
                          onClick={e => { e.stopPropagation(); handleToggleStar(item); }}
                        >
                          <Star className={cn("h-3.5 w-3.5", item.is_starred ? "fill-yellow-400 text-yellow-400" : "text-white")} />
                        </Button>
                      )}

                      {/* Selected overlay */}
                      {isSelected && (
                        <div className="absolute inset-0 bg-primary/10 pointer-events-none" />
                      )}
                    </div>

                    <div className="p-3 flex items-start justify-between gap-1">
                      <div className="min-w-0 flex-1">
                        <div className=" items-center gap-2 whitespace-nowrap">
                          {uploaderName && (
                            <p className="text-sm text-muted-foreground">
                              By {uploaderName}
                            </p>
                          )}

                          <p className="text-xs text-muted-foreground/70">
                            {format(new Date(item.created_at), "MMM d")}
                          </p>
                        </div>
                      </div>
                      {!isSelecting && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0  -mr-1">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            {renderDropdownItems(item)}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </Card>
                </ContextMenuTrigger>
                <ContextMenuContent className="w-48">
                  {renderContextMenuItems(item)}
                </ContextMenuContent>
              </ContextMenu>
            );
          })}
        </div>
      ) : (
        /* ── List view ──────────────────────────────────────────── */
        <div className="space-y-1">
          {media.map(item => {
            const isSelected = selected.has(item.id);
            const uploaderName = uploaderMap[item.uploaded_by];
            return (
              <ContextMenu key={item.id}>
                <ContextMenuTrigger asChild>
                  <div
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer group transition-all duration-150",
                      "hover:bg-muted/70 border border-transparent hover:border-border/50 active:scale-[0.99]",
                      isSelected && "bg-primary/8 border-primary/20 hover:bg-primary/10 hover:border-primary/25"
                    )}
                    draggable={!isSelecting}
                    onDragStart={e => handleDragStart(e, item)}
                    onClick={() => {
                      if (isSelecting) {
                        toggleSelect(item.id);
                      } else {
                        haptic("light");
                        onPreview(item);
                      }
                    }}
                  >
                    {/* Checkbox */}
                    <div
                      className={cn(
                        "shrink-0 transition-all duration-150",
                        isSelecting ? "opacity-100 w-5" : "opacity-0 w-0 group-hover:opacity-100 group-hover:w-5"
                      )}
                      onClick={e => { e.stopPropagation(); toggleSelect(item.id); }}
                    >
                      <Checkbox checked={isSelected} className="data-[state=checked]:bg-primary" />
                    </div>

                    {/* Thumbnail */}
                    <div className="h-11 w-11 rounded-lg overflow-hidden bg-muted shrink-0 relative shadow-sm">
                      {item.file_type === "video" ? (
                        <>
                          <video src={getPublicUrl(item.file_path)} className="w-full h-full object-cover" preload="metadata" />
                          <Play className="absolute inset-0 m-auto h-4 w-4 text-white drop-shadow" />
                        </>
                      ) : (
                        <img src={getPublicUrl(item.file_path)} alt={item.title} className="w-full h-full object-cover" loading="lazy" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatSize(item.file_size)} · {format(new Date(item.created_at), "MMM d, yyyy")}
                        {uploaderName && <span className="ml-1.5">· <User className="h-2.5 w-2.5 inline mb-0.5" /> {uploaderName}</span>}
                      </p>
                    </div>

                    {item.is_starred && (
                      <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400 shrink-0" />
                    )}

                    {!isSelecting && (
                      <>
                        <Button
                          variant="ghost" size="icon"
                          className={cn("h-7 w-7 shrink-0 transition-opacity", item.is_starred ? "opacity-100" : "opacity-0 group-hover:opacity-60 hover:!opacity-100")}
                          onClick={e => { e.stopPropagation(); handleToggleStar(item); }}
                        >
                          <Star className={cn("h-4 w-4", item.is_starred ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground")} />
                        </Button>
                        <Button
                          variant="ghost" size="icon"
                          className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={e => { e.stopPropagation(); downloadFile(getPublicUrl(item.file_path), item.file_name); }}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            {renderDropdownItems(item, true)}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </>
                    )}
                  </div>
                </ContextMenuTrigger>
                <ContextMenuContent className="w-48">
                  {renderContextMenuItems(item)}
                </ContextMenuContent>
              </ContextMenu>
            );
          })}
        </div>
      )}

      {hasMore && <div ref={sentinelRef} className="h-10" />}

      {/* ── Single Delete Dialog ────────────────────────────────────── */}
      <AlertDialog open={!!deleteItem} onOpenChange={open => !open && setDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete file?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete <strong>"{deleteItem?.title}"</strong>. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Bulk Delete ───────────────────────────────────────────── */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selected.size} file{selected.size !== 1 ? "s" : ""}?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete the selected files. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} disabled={bulkDelete.isPending} className="bg-destructive hover:bg-destructive/90">
              Delete {selected.size} file{selected.size !== 1 ? "s" : ""}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Single Move Dialog ────────────────────────────────────── */}
      {isMobile ? (
        <Sheet open={!!moveItem} onOpenChange={open => !open && setMoveItem(null)}>
          <SheetContent side="bottom" className="rounded-t-[28px] p-0 pb-[env(safe-area-inset-bottom,0px)]">
            <div className="flex justify-center pt-3">
              <div className="h-1 w-11 rounded-full bg-muted-foreground/30" />
            </div>
            <SheetHeader className="px-5 pt-4 text-left">
              <SheetTitle>Move to folder</SheetTitle>
            </SheetHeader>
            <div className="px-5 py-4">{singleMoveContent}</div>
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog open={!!moveItem} onOpenChange={open => !open && setMoveItem(null)}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader><DialogTitle>Move to folder</DialogTitle></DialogHeader>
            {singleMoveContent}
          </DialogContent>
        </Dialog>
      )}

      {/* ── Bulk Move Dialog ──────────────────────────────────────── */}
      {isMobile ? (
        <Sheet open={bulkMoveOpen} onOpenChange={setBulkMoveOpen}>
          <SheetContent side="bottom" className="rounded-t-[28px] p-0 pb-[env(safe-area-inset-bottom,0px)]">
            <div className="flex justify-center pt-3">
              <div className="h-1 w-11 rounded-full bg-muted-foreground/30" />
            </div>
            <SheetHeader className="px-5 pt-4 text-left">
              <SheetTitle>Move {selected.size} file{selected.size !== 1 ? "s" : ""}</SheetTitle>
            </SheetHeader>
            <div className="px-5 py-4">{bulkMoveContent}</div>
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog open={bulkMoveOpen} onOpenChange={setBulkMoveOpen}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader><DialogTitle>Move {selected.size} file{selected.size !== 1 ? "s" : ""}</DialogTitle></DialogHeader>
            {bulkMoveContent}
          </DialogContent>
        </Dialog>
      )}

      {/* ── Download Progress Dialog ─────────────────────────── */}
      <Dialog open={isDownloading} onOpenChange={setIsDownloading}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Downloading {selected.size} file{selected.size !== 1 ? "s" : ""}...</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-semibold">{downloadProgress}%</span>
              </div>
              <Progress value={downloadProgress} className="h-2" />
            </div>
            <p className="text-sm text-muted-foreground">
              Your files will be packaged as a ZIP and downloaded to your device. This may take a moment...
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
