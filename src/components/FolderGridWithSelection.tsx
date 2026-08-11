import { useState, useCallback, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { CheckSquare, Download, Loader2, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { haptic } from "@/lib/haptics";
import { downloadFoldersAsZip } from "@/lib/downloadUtils";
import { useMediaFromFolders } from "@/hooks/useMediaFromFolders";
import { useIsMobile } from "@/hooks/use-mobile";
import { FolderGrid as BaseFolderGrid } from "@/components/FolderGrid";

interface FolderItem {
    id: string;
    name: string;
    count?: number;
    previewUrls?: string[];
}

interface Props {
    folders: FolderItem[];
    onOpen: (id: string) => void;
    onRename: (id: string, newName: string) => void;
    onDelete: (id: string) => void;
}

export function FolderGridWithSelection({ folders, onOpen, onRename, onDelete }: Props) {
    const [selectedFolders, setSelectedFolders] = useState<Set<string>>(new Set());
    const [isDownloading, setIsDownloading] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState(0);
    const isMobile = useIsMobile();
    const { toast } = useToast();
    const { fetchMediaFromFolders } = useMediaFromFolders();

    const isSelecting = selectedFolders.size > 0;

    const toggleSelectFolder = useCallback((folderId: string) => {
        setSelectedFolders(prev => {
            const next = new Set(prev);
            if (next.has(folderId)) next.delete(folderId);
            else next.add(folderId);
            return next;
        });
        haptic("light");
    }, []);

    const selectAllFolders = useCallback(() => {
        setSelectedFolders(new Set(folders.map(f => f.id)));
        haptic("medium");
    }, [folders]);

    const clearSelection = useCallback(() => {
        setSelectedFolders(new Set());
    }, []);

    const handleDownloadFolders = async () => {
        const selectedIds = Array.from(selectedFolders);
        if (selectedIds.length === 0) return;

        setIsDownloading(true);
        setDownloadProgress(0);

        try {
            // Get the folder name for each selected folder
            const folderNameMap = new Map<string, string>();
            selectedIds.forEach(folderId => {
                const folder = folders.find(f => f.id === folderId);
                folderNameMap.set(folderId, folder?.name || `Folder-${folderId.slice(0, 8)}`);
            });

            // Fetch all media from selected folders
            const mediaByFolder = await fetchMediaFromFolders(selectedIds);

            // Prepare download function that gets media by folder name
            const downloadFunc = async (folderName: string) => {
                // Find the folder ID by name
                const folderId = Array.from(folderNameMap.entries()).find(
                    ([_, name]) => name === folderName
                )?.[0];

                if (!folderId || !mediaByFolder.has(folderId)) {
                    return [];
                }

                return (mediaByFolder.get(folderId) || []).map(m => ({
                    id: m.id,
                    file_name: m.file_name,
                    file_path: m.file_path,
                    file_type: m.file_type as "image" | "video",
                    title: m.title,
                    created_at: m.created_at,
                }));
            };

            const folderNames = Array.from(folderNameMap.values());

            await downloadFoldersAsZip(folderNames, downloadFunc, (current, total) => {
                setDownloadProgress(Math.round((current / total) * 100));
            });

            clearSelection();
            toast({
                title: `Downloaded ${selectedIds.length} folder${selectedIds.length !== 1 ? "s" : ""} as ZIP`,
            });
            haptic("success");
        } catch (error) {
            console.error("Download error:", error);
            toast({
                title: "Download failed",
                description: error instanceof Error ? error.message : "Unable to download folders",
                variant: "destructive",
            });
            haptic("warning");
        } finally {
            setIsDownloading(false);
            setDownloadProgress(0);
        }
    };

    // Keyboard shortcuts
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            const tag = (e.target as HTMLElement).tagName;
            if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).closest("[role=dialog]")) return;

            if (e.key === "Escape") {
                clearSelection();
            } else if ((e.ctrlKey || e.metaKey) && e.key === "a") {
                e.preventDefault();
                selectAllFolders();
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [clearSelection, selectAllFolders]);

    return (
        <>
            {/* Selection toolbar */}
            {isSelecting && (
                <div className="flex flex-wrap items-center gap-2 mb-4 px-3 sm:px-4 py-2.5 rounded-xl bg-primary/8 border border-primary/20 backdrop-blur-sm shadow-sm animate-in slide-in-from-top-1 duration-150">
                    <CheckSquare className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-sm font-semibold text-primary">{selectedFolders.size} folder{selectedFolders.size !== 1 ? "s" : ""} selected</span>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-7 px-2 text-muted-foreground hover:text-foreground"
                        onClick={selectAllFolders}
                    >
                        All {folders.length}
                    </Button>
                    <div className="flex items-center gap-1.5 ml-auto">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs gap-1"
                                    onClick={handleDownloadFolders}
                                    disabled={isDownloading}
                                >
                                    {isDownloading ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                        <Download className="h-3.5 w-3.5" />
                                    )}
                                    <span className="hidden sm:inline">{isDownloading ? "Downloading..." : "Download"}</span>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Download all media from selected folders</TooltipContent>
                        </Tooltip>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={clearSelection}
                        >
                            <X className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </div>
            )}

            {/* Mobile instructions - show when NOT selecting */}
            {!isSelecting && isMobile && (
                <div className="flex flex-col gap-2 mb-4">
                    <div className="p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200/50 dark:border-blue-800/50">
                        <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">
                            💡 <strong>Tip:</strong> Long-press any folder to start selecting multiple folders
                        </p>
                    </div>
                    <Button
                        onClick={() => {
                            // Enter selection mode by selecting first folder hint
                            if (folders.length > 0) {
                                setSelectedFolders(new Set([folders[0].id]));
                                haptic("medium");
                            }
                        }}
                        variant="outline"
                        size="sm"
                        className="w-full text-xs"
                    >
                        🎯 Tap to Enter Select Mode
                    </Button>
                </div>
            )}

            {/* Folder grid with selection checkboxes */}
            <div className="relative">
                <BaseFolderGrid
                    folders={folders}
                    onOpen={(id) => {
                        if (isSelecting) {
                            toggleSelectFolder(id);
                        } else {
                            onOpen(id);
                        }
                    }}
                    onRename={onRename}
                    onDelete={onDelete}
                />

                {/* Selection checkboxes overlay */}
                {isSelecting && (
                    <div className="absolute inset-0 pointer-events-none">
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-1 sm:gap-2 md:gap-3">
                            {folders.map((folder) => (
                                <div
                                    key={folder.id}
                                    className="relative"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        toggleSelectFolder(folder.id);
                                    }}
                                >
                                    {/* Larger checkbox for mobile - easier to tap */}
                                    <div className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 pointer-events-auto z-10">
                                        <Checkbox
                                            checked={selectedFolders.has(folder.id)}
                                            className={cn(
                                                "bg-background/80 backdrop-blur-sm border-white/60 shadow-sm",
                                                "data-[state=checked]:bg-primary data-[state=checked]:border-primary",
                                                isMobile ? "h-6 w-6" : "h-5 w-5"
                                            )}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Download progress dialog */}
            <Dialog open={isDownloading} onOpenChange={setIsDownloading}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle>
                            Downloading {selectedFolders.size} folder{selectedFolders.size !== 1 ? "s" : ""}...
                        </DialogTitle>
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
                            Gathering media from folders and packaging as ZIP...
                        </p>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
