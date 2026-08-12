import { useState, useCallback, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { ImageIcon, Pencil, Trash2, X, Check, AlertTriangle } from "lucide-react";
import { haptic } from "@/lib/haptics";

// ─── Types ────────────────────────────────────────────────────────────────────

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

interface MenuState {
    folder: FolderItem;
    // desktop anchor position
    x?: number;
    y?: number;
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState() {
    return (
        <div className="flex flex-col items-center justify-center py-20 select-none">
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none" className="mb-5 opacity-50" aria-hidden="true">
                <rect x="2" y="14" width="60" height="44" rx="8" className="fill-primary/20" stroke="currentColor" strokeOpacity="0.06" strokeWidth="0.5" />
                <path d="M2 22 Q2 14 10 14 L24 14 Q28 14 30 18 L32 22 L62 22 L62 58 Q62 58 54 58 L10 58 Q2 58 2 50 Z" className="fill-primary/30" />
                <rect x="2" y="22" width="60" height="36" rx="7" className="fill-primary/20" />
            </svg>
            <p className="text-[15px] font-semibold text-foreground tracking-tight">No folders yet</p>
            <p className="text-[13px] text-muted-foreground mt-1">Create a folder to get started</p>
        </div>
    );
}

// ─── Folder Icon ──────────────────────────────────────────────────────────────

function FolderIcon({ previewUrls }: { previewUrls?: string[] }) {
    const preview = previewUrls?.[0];
    return (
        <div className="relative w-full aspect-square select-none px-2 pt-2">
            <div className="relative w-full h-full">
                <div className="absolute inset-0 bg-card border border-border rounded-xl shadow-sm rotate-[-10deg] -translate-x-2 -translate-y-1" />
                <div className="absolute inset-0 bg-card border border-border rounded-xl shadow-sm rotate-[6deg] translate-x-2 translate-y-1" />
                <div className="relative w-full h-full bg-card border border-border rounded-xl shadow-md rotate-[-2deg] p-1 pb-5">
                    <div className="relative w-full h-full bg-muted rounded-lg overflow-hidden border border-border/40">
                        {preview ? (
                            <img src={preview} alt="Collection preview" className="w-full h-full object-cover" draggable="false" loading="lazy" decoding="async" />
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/40">
                                <ImageIcon className="w-5 h-5 sm:w-6 sm:h-6 mb-1 stroke-[1.5]" />
                                <span className="text-[7px] sm:text-[8px] font-bold uppercase tracking-widest text-center px-1">Empty</span>
                            </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-background/5 to-background/10 pointer-events-none" />
                    </div>
                    <div className="absolute bottom-1.5 left-2 right-2 h-1.5 bg-muted-foreground/10 rounded-full" />
                </div>
            </div>
        </div>
    );
}

// ─── Action Panel (shared content) ───────────────────────────────────────────

interface ActionPanelContentProps {
    folder: FolderItem;
    onRename: (id: string, newName: string) => void;
    onDelete: (id: string) => void;
    onClose: () => void;
}

function ActionPanelContent({ folder, onRename, onDelete, onClose }: ActionPanelContentProps) {
    const [view, setView] = useState<"menu" | "rename" | "confirm">("menu");
    const [nameValue, setNameValue] = useState(folder.name);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (view === "rename") setTimeout(() => inputRef.current?.focus(), 50);
    }, [view]);

    const handleRename = useCallback(() => {
        const trimmed = nameValue.trim();
        if (!trimmed || trimmed === folder.name) { onClose(); return; }
        onRename(folder.id, trimmed);
        haptic("success");
        onClose();
    }, [nameValue, folder, onRename, onClose]);

    const handleDelete = useCallback(() => {
        onDelete(folder.id);
        haptic("warning");
        onClose();
    }, [folder.id, onDelete, onClose]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === "Enter") handleRename();
        if (e.key === "Escape") onClose();
    }, [handleRename, onClose]);

    if (view === "rename") {
        return (
            <div className="p-4 space-y-3">
                <p className="text-xs font-medium text-muted-foreground">Rename folder</p>
                <input
                    ref={inputRef}
                    value={nameValue}
                    onChange={e => setNameValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    maxLength={40}
                    className={cn(
                        "w-full h-10 px-3 rounded-lg text-sm bg-background border border-border",
                        "focus:outline-none focus:ring-2 focus:ring-ring",
                        "text-foreground placeholder:text-muted-foreground",
                    )}
                />
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={() => setView("menu")}
                        className={cn(
                            "flex-1 h-9 rounded-lg text-xs font-medium border border-border",
                            "text-muted-foreground hover:bg-accent transition-colors",
                        )}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleRename}
                        disabled={!nameValue.trim()}
                        className={cn(
                            "flex-1 h-9 rounded-lg text-xs font-medium",
                            "bg-primary text-primary-foreground hover:bg-primary/90 transition-colors",
                            "disabled:opacity-50 disabled:cursor-not-allowed",
                        )}
                    >
                        <Check className="h-3.5 w-3.5 inline mr-1" />
                        Save
                    </button>
                </div>
            </div>
        );
    }

    if (view === "confirm") {
        return (
            <div className="p-4 space-y-3">
                <div className="flex items-start gap-2.5">
                    <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-semibold text-foreground">Delete folder?</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            "{folder.name}" and all its contents will be permanently deleted.
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={() => setView("menu")}
                        className={cn(
                            "flex-1 h-9 rounded-lg text-xs font-medium border border-border",
                            "text-muted-foreground hover:bg-accent transition-colors",
                        )}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleDelete}
                        className={cn(
                            "flex-1 h-9 rounded-lg text-xs font-medium",
                            "bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors",
                        )}
                    >
                        <Trash2 className="h-3.5 w-3.5 inline mr-1" />
                        Delete
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="p-2">
            <p className="text-xs font-medium text-muted-foreground px-2 pt-1 pb-2 truncate">
                {folder.name}
            </p>
            <button
                type="button"
                onClick={() => setView("rename")}
                className={cn(
                    "w-full flex items-center gap-3 px-3 h-10 rounded-lg text-sm",
                    "text-foreground hover:bg-accent transition-colors text-left",
                )}
            >
                <Pencil className="h-4 w-4 text-muted-foreground shrink-0" />
                Rename
            </button>
            <button
                type="button"
                onClick={() => setView("confirm")}
                className={cn(
                    "w-full flex items-center gap-3 px-3 h-10 rounded-lg text-sm",
                    "text-destructive hover:bg-destructive/10 transition-colors text-left",
                )}
            >
                <Trash2 className="h-4 w-4 shrink-0" />
                Delete
            </button>
        </div>
    );
}

// ─── Desktop Context Menu (floating popover) ──────────────────────────────────

interface ContextMenuProps {
    menu: MenuState;
    onRename: (id: string, newName: string) => void;
    onDelete: (id: string) => void;
    onClose: () => void;
}

function ContextMenu({ menu, onRename, onDelete, onClose }: ContextMenuProps) {
    const ref = useRef<HTMLDivElement>(null);

    // Position clamped to viewport
    const [pos, setPos] = useState({ x: menu.x ?? 0, y: menu.y ?? 0 });

    useEffect(() => {
        if (!ref.current) return;
        const { width, height } = ref.current.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        setPos({
            x: Math.min(menu.x ?? 0, vw - width - 8),
            y: Math.min(menu.y ?? 0, vh - height - 8),
        });
    }, [menu.x, menu.y]);

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, [onClose]);

    return (
        <>
            {/* Invisible backdrop */}
            <div className="fixed inset-0 z-40" onMouseDown={onClose} />
            <div
                ref={ref}
                role="menu"
                className={cn(
                    "fixed z-50 w-52 rounded-xl border border-border bg-card shadow-lg",
                    "animate-in fade-in-0 zoom-in-95 duration-100",
                )}
                style={{ left: pos.x, top: pos.y }}
            >
                <ActionPanelContent
                    folder={menu.folder}
                    onRename={onRename}
                    onDelete={onDelete}
                    onClose={onClose}
                />
            </div>
        </>
    );
}

// ─── Mobile Bottom Sheet ──────────────────────────────────────────────────────

interface BottomSheetProps {
    menu: MenuState;
    onRename: (id: string, newName: string) => void;
    onDelete: (id: string) => void;
    onClose: () => void;
}

function BottomSheet({ menu, onRename, onDelete, onClose }: BottomSheetProps) {
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, [onClose]);

    return (
        <div className="fixed inset-0 z-[60] flex items-end sm:hidden">
            {/* Backdrop — full screen, covers bottom nav too */}
            <div
                className="absolute inset-0 bg-background/60 backdrop-blur-sm animate-in fade-in-0 duration-200"
                onPointerDown={onClose}
            />
            {/* Sheet floats above bottom nav — mb-[76px] matches nav height */}
            <div className={cn(
                "relative w-full bg-card border border-border rounded-2xl shadow-xl z-10",
                "animate-in slide-in-from-bottom duration-300",
                "mx-2 mb-[76px]",
            )}>
                {/* Handle */}
                <div className="flex justify-center pt-3 pb-1">
                    <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
                </div>
                {/* Close button */}
                <button
                    type="button"
                    onClick={onClose}
                    className="absolute top-3 right-3 h-7 w-7 flex items-center justify-center rounded-full hover:bg-accent transition-colors"
                    aria-label="Close"
                >
                    <X className="h-4 w-4 text-muted-foreground" />
                </button>
                <ActionPanelContent
                    folder={menu.folder}
                    onRename={onRename}
                    onDelete={onDelete}
                    onClose={onClose}
                />
                <div className="pb-2" />
            </div>
        </div>
    );
}

// ─── Folder Card ──────────────────────────────────────────────────────────────

interface FolderCardProps {
    folder: FolderItem;
    onOpen: (id: string) => void;
    onContextMenu: (folder: FolderItem, x: number, y: number) => void;
    onLongPress: (folder: FolderItem) => void;
}

function FolderCard({ folder, onOpen, onContextMenu, onLongPress }: FolderCardProps) {
    const [hovered, setHovered] = useState(false);
    const [pressed, setPressed] = useState(false);
    const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const didLongPress = useRef(false);

    const handleOpen = useCallback(() => onOpen(folder.id), [folder.id, onOpen]);

    const handleContextMenu = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        onContextMenu(folder, e.clientX, e.clientY);
    }, [folder, onContextMenu]);

    const handleTouchStart = useCallback(() => {
        setPressed(true);
        didLongPress.current = false;
        longPressTimer.current = setTimeout(() => {
            didLongPress.current = true;
            onLongPress(folder);
            haptic("medium");
        }, 500);
    }, [folder, onLongPress]);

    const handleTouchEnd = useCallback(() => {
        setPressed(false);
        if (longPressTimer.current) clearTimeout(longPressTimer.current);
    }, []);

    const handleTouchMove = useCallback(() => {
        // Cancel long press if finger moves
        if (longPressTimer.current) clearTimeout(longPressTimer.current);
    }, []);

    const handleClick = useCallback(() => {
        if (didLongPress.current) return; // swallow click after long press
        handleOpen();
    }, [handleOpen]);

    const handleKeyUp = useCallback(
        (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") handleOpen(); },
        [handleOpen],
    );

    return (
        <button
            type="button"
            aria-label={`Open folder: ${folder.name}`}
            onClick={handleClick}
            onContextMenu={handleContextMenu}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => { setHovered(false); setPressed(false); }}
            onMouseDown={() => setPressed(true)}
            onMouseUp={() => setPressed(false)}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onTouchMove={handleTouchMove}
            onKeyUp={handleKeyUp}
            className={cn(
                "flex flex-col items-center gap-1.5 w-full rounded-xl px-1 py-2",
                "transition-colors duration-150 ease-out",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                hovered && !pressed && "bg-accent/50",
                pressed && "bg-accent",
            )}
            style={{ WebkitTapHighlightColor: "transparent" }}
        >
            <div
                className="w-full"
                style={{
                    transform: pressed
                        ? "translateY(0px) scale(0.97)"
                        : hovered
                            ? "translateY(-3px) scale(1.02)"
                            : "translateY(0px) scale(1)",
                    transition: "transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1)",
                }}
            >
                <FolderIcon previewUrls={folder.previewUrls} />
            </div>

            <div className="w-full text-center px-1 min-w-0">
                <p
                    className={cn(
                        "text-[11px] sm:text-[12px] md:text-[13px] font-medium leading-tight tracking-tight truncate transition-colors duration-150",
                        hovered ? "text-primary" : "text-foreground",
                    )}
                    title={folder.name}
                >
                    {folder.name}
                </p>
                {typeof folder.count === "number" && (
                    <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5 tabular-nums">
                        {folder.count} {folder.count === 1 ? "item" : "items"}
                    </p>
                )}
            </div>
        </button>
    );
}

// ─── Grid ─────────────────────────────────────────────────────────────────────

export function FolderGrid({ folders, onOpen, onRename, onDelete }: Props) {
    const [menu, setMenu] = useState<MenuState | null>(null);
    const isMobile = typeof window !== "undefined" && window.matchMedia("(hover: none)").matches;

    const openContextMenu = useCallback((folder: FolderItem, x: number, y: number) => {
        setMenu({ folder, x, y });
    }, []);

    const openLongPress = useCallback((folder: FolderItem) => {
        setMenu({ folder });
    }, []);

    const closeMenu = useCallback(() => setMenu(null), []);

    if (!folders?.length) return <EmptyState />;

    return (
        <>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-1 sm:gap-2 md:gap-3">
                {folders.map((folder) => (
                    <FolderCard
                        key={folder.id}
                        folder={folder}
                        onOpen={onOpen}
                        onContextMenu={openContextMenu}
                        onLongPress={openLongPress}
                    />
                ))}
            </div>

            {/* Desktop context menu — shown on right-click */}
            {menu && menu.x !== undefined && (
                <ContextMenu
                    menu={menu}
                    onRename={onRename}
                    onDelete={onDelete}
                    onClose={closeMenu}
                />
            )}

            {/* Mobile bottom sheet — shown on long press */}
            {menu && menu.x === undefined && (
                <BottomSheet
                    menu={menu}
                    onRename={onRename}
                    onDelete={onDelete}
                    onClose={closeMenu}
                />
            )}
        </>
    );
}
