import { useState, useCallback, useEffect, useMemo, useRef, memo } from "react";
import {
  X, MapPin, Calendar, Trash2, FolderOpen,
  ChevronLeft, ChevronRight, CheckCircle2, ExternalLink,
  ArrowRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { format, parseISO, isValid } from "date-fns";
import { TravelLocation, useDeleteTravelLocation, useUpdateTravelLocation } from "@/hooks/useTravelLocations";
import { useFolders } from "@/hooks/useFolders";
import { useMedia, getPublicUrl } from "@/hooks/useMedia";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// ─── Constants ────────────────────────────────────────────────────────────────

const NAV_HEIGHT_PX = 56;

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  location: TravelLocation | null;
  onClose: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safeFmt(dateStr: string, fmt: string): string {
  try {
    const d = parseISO(dateStr);
    return isValid(d) ? format(d, fmt) : "";
  } catch {
    return "";
  }
}

function normaliseUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`;
  } catch {
    return url;
  }
}

// ─── PhotoCarousel ────────────────────────────────────────────────────────────

interface CarouselProps {
  photos: string[];
  locationName: string;
  visited: boolean;
  placeLine: string;
  dateLine: string;
  onClose: () => void;
}

const PhotoCarousel = memo(function PhotoCarousel({
  photos,
  locationName,
  visited,
  placeLine,
  dateLine,
  onClose,
}: CarouselProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => { setIndex(0); }, [photos]);

  const prev = useCallback(
    () => setIndex(i => (i - 1 + photos.length) % photos.length),
    [photos.length],
  );
  const next = useCallback(
    () => setIndex(i => (i + 1) % photos.length),
    [photos.length],
  );

  return (
    <div className="relative overflow-hidden" style={{ height: "clamp(180px, 42vw, 260px)" }}>
      {/*
        PERF: Plain <img> with CSS opacity transition instead of motion.img + AnimatePresence.
        Avoids per-frame JS, promotes fewer compositing layers, no scale transforms.
      */}
      {photos.map((src, i) => (
        <img
          key={src}
          src={src}
          alt={i === index ? `${locationName} — photo ${index + 1} of ${photos.length}` : ""}
          aria-hidden={i !== index}
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-250"
          style={{ opacity: i === index ? 1 : 0 }}
          loading={i === 0 ? "eager" : "lazy"}
        />
      ))}

      {/*
        PERF: CSS gradient — no JS, no compositing layer.
        Dual-stop gradient: dark top for close button legibility, rich dark bottom for text.
      */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.38) 0%, transparent 32%, transparent 42%, rgba(0,0,0,0.72) 100%)",
        }}
        aria-hidden
      />

      {/* Location metadata overlaid on photo */}
      <div className="absolute bottom-0 left-0 right-0 px-4 pb-4 pointer-events-none select-none">
        {visited && (
          <div className="flex items-center gap-1 mb-1.5">
            <CheckCircle2 className="h-3 w-3 text-green-400" aria-hidden />
            <span className="text-[9px] font-bold text-green-300 uppercase tracking-widest">
              Visited
            </span>
          </div>
        )}
        <h3 className="text-base sm:text-lg font-bold text-white leading-tight line-clamp-2 [text-shadow:0_1px_3px_rgba(0,0,0,0.5)]">
          {locationName}
        </h3>
        {(placeLine || dateLine) && (
          <div className="flex items-center gap-2.5 mt-1 flex-wrap">
            {placeLine && (
              <span className="flex items-center gap-1 text-[11px] text-white/85">
                <MapPin className="h-2.5 w-2.5 shrink-0" aria-hidden />
                {placeLine}
              </span>
            )}
            {dateLine && (
              <span className="flex items-center gap-1 text-[11px] text-white/85">
                <Calendar className="h-2.5 w-2.5 shrink-0" aria-hidden />
                {dateLine}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Close */}
      <button
        onClick={onClose}
        aria-label="Close"
        className="absolute top-3 right-3 z-10 h-8 w-8 rounded-full bg-black/45 flex items-center justify-center text-white active:bg-black/70 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
      >
        <X className="h-3.5 w-3.5" aria-hidden />
      </button>

      {/* Nav arrows */}
      {photos.length > 1 && (
        <>
          <button
            onClick={prev}
            aria-label="Previous photo"
            className="absolute left-2.5 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/40 flex items-center justify-center text-white active:bg-black/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
          <button
            onClick={next}
            aria-label="Next photo"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/40 flex items-center justify-center text-white active:bg-black/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>

          <div className="absolute bottom-3 right-4 flex gap-1" aria-hidden>
            {photos.map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-1 rounded-full transition-all duration-200",
                  i === index ? "w-4 bg-white" : "w-1 bg-white/45",
                )}
              />
            ))}
          </div>
          <span className="sr-only" aria-live="polite" aria-atomic="true">
            Photo {index + 1} of {photos.length}
          </span>
        </>
      )}
    </div>
  );
});

// ─── NoPhotoHeader ────────────────────────────────────────────────────────────

const NoPhotoHeader = memo(function NoPhotoHeader({
  locationName,
  visited,
  placeLine,
  dateLine,
  onClose,
}: Omit<CarouselProps, "photos">) {
  return (
    <div className="relative px-5 pt-5 pb-4 border-b border-border/40 flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        {visited && (
          <div className="flex items-center gap-1 mb-1">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" aria-hidden />
            <span className="text-[9px] font-bold text-green-600 uppercase tracking-widest">
              Visited
            </span>
          </div>
        )}
        <h3 className="text-base sm:text-lg font-bold text-foreground leading-snug">
          {locationName}
        </h3>
        {(placeLine || dateLine) && (
          <div className="flex items-center gap-2.5 mt-1 flex-wrap">
            {placeLine && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3 shrink-0" aria-hidden />
                {placeLine}
              </span>
            )}
            {dateLine && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3 shrink-0" aria-hidden />
                {dateLine}
              </span>
            )}
          </div>
        )}
      </div>
      <button
        onClick={onClose}
        aria-label="Close"
        className="h-8 w-8 rounded-xl bg-muted active:bg-muted/60 flex items-center justify-center text-muted-foreground shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
});

// ─── LocationPopup ────────────────────────────────────────────────────────────

export const LocationPopup = memo(function LocationPopup({ location, onClose }: Props) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const deleteLocation = useDeleteTravelLocation();
  const updateLocation = useUpdateTravelLocation();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: folders = [] } = useFolders();
  const { data: folderMedia = [] } = useMedia(
    location?.folder_id ?? undefined,
    undefined,
  );

  // ── Drag-to-close (manual, no Framer drag — avoids mobile event blocking) ──
  const dragStartY = useRef<number>(0);
  const isDragging = useRef(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
    isDragging.current = false;
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    const dy = e.touches[0].clientY - dragStartY.current;
    if (dy > 8) isDragging.current = true;
    if (dy > 0 && cardRef.current) {
      // PERF: Direct DOM transform — avoids React re-render on every touchmove.
      cardRef.current.style.transform = `translateY(${dy}px)`;
    }
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    const dy = e.changedTouches[0].clientY - dragStartY.current;
    if (cardRef.current) {
      cardRef.current.style.transform = "";
      cardRef.current.style.transition = "transform 0.2s ease";
      setTimeout(() => {
        if (cardRef.current) cardRef.current.style.transition = "";
      }, 200);
    }
    if (dy > 80) {
      onClose();
    }
    isDragging.current = false;
  }, [onClose]);

  // Prevent backdrop click firing when a drag just ended
  const handleBackdropClick = useCallback(() => {
    if (!isDragging.current) onClose();
  }, [onClose]);

  // ── Derived ────────────────────────────────────────────────────────────────

  const { linkedFolder, previewPhotos, placeLine, dateLine, folderPhotoCount } = useMemo(() => {
    if (!location) {
      return { linkedFolder: null, previewPhotos: [], placeLine: "", dateLine: "", folderPhotoCount: 0 };
    }

    const linkedFolder = location.folder_id
      ? (folders.find(f => f.id === location.folder_id) ?? null)
      : null;

    const ownPhotos = (location.photo_urls ?? []).filter(u => typeof u === "string" && u.length > 0);
    const folderImgs = folderMedia.filter(m => m.file_type === "image");
    const folderPhotos = folderImgs
      .map(m => getPublicUrl(m.file_path))
      .filter(u => !ownPhotos.some(photo => normaliseUrl(photo) === normaliseUrl(u)));

    // Keep the pin popup lightweight: show only photos explicitly attached to the
    // location, or fall back to a single folder cover image instead of the whole folder.
    const previewPhotos = ownPhotos.length > 0 ? ownPhotos : folderPhotos.slice(0, 1);

    const placeLine = [location.city, location.country].filter(Boolean).join(", ");
    const dateLine = location.date_visited ? safeFmt(location.date_visited, "MMM yyyy") : "";

    return { linkedFolder, previewPhotos, placeLine, dateLine, folderPhotoCount: folderImgs.length };
  }, [location, folders, folderMedia]);

  // ── Side-effects ───────────────────────────────────────────────────────────

  useEffect(() => { setConfirmDelete(false); }, [location?.id]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (confirmDelete) { setConfirmDelete(false); return; }
      onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [confirmDelete, onClose]);

  useEffect(() => {
    if (!location) return;
    const dialog = document.getElementById("loc-popup-dialog");
    if (!dialog) return;
    const getNodes = () =>
      Array.from(dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]),[href],input,select,textarea,[tabindex]:not([tabindex="-1"])',
      ));
    getNodes()[0]?.focus();
    function trap(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const nodes = getNodes();
      if (!nodes.length) return;
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", trap);
    return () => document.removeEventListener("keydown", trap);
  }, [location]);

  // ── Mutations ──────────────────────────────────────────────────────────────

  const isMutating = deleteLocation.isPending || updateLocation.isPending;

  const handleDelete = useCallback(async () => {
    if (!location) return;
    try {
      await deleteLocation.mutateAsync(location.id);
      toast({ title: "Location removed" });
      onClose();
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
  }, [location, deleteLocation, toast, onClose]);

  const handleToggleVisited = useCallback(async () => {
    if (!location) return;
    try {
      await updateLocation.mutateAsync({ id: location.id, visited: !location.visited });
      toast({ title: location.visited ? "Marked as not visited" : "✅ Marked as visited!" });
    } catch {
      toast({ title: "Failed to update", variant: "destructive" });
    }
  }, [location, updateLocation, toast]);

  // ── Folder navigation ──────────────────────────────────────────────────────

  const handleOpenFolder = useCallback((folderId: string) => {
    onClose();
    // Navigate to the folder page — matches the route pattern:
    // /dashboard/folder/:folderId
    navigate(`/dashboard/folder/${folderId}`);
  }, [navigate, onClose]);

  // ── Guard ──────────────────────────────────────────────────────────────────

  if (!location) return null;

  return (
    <AnimatePresence>
      <motion.div
        key={location.id}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-[9998] flex items-end sm:items-center justify-center"
        style={{
          paddingBottom: `calc(${NAV_HEIGHT_PX}px + env(safe-area-inset-bottom, 0px))`,
        }}
        onClick={handleBackdropClick}
        role="dialog"
        id="loc-popup-dialog"
        aria-modal="true"
        aria-label={location.location_name}
        aria-describedby={location.description ? "loc-popup-desc" : undefined}
      >
        {/*
          PERF: No backdrop-blur — blur is the single biggest GPU lag source on
          mid-range Android. Semi-opaque solid bg gives identical visual effect
          at a fraction of the cost.
        */}
        <div className="absolute inset-0 bg-black/60" aria-hidden />

        {/*
          PERF: Plain div with CSS transition instead of motion.div with spring drag.
          - Removes Framer's pointer capture listeners from the main thread.
          - translateY driven directly via ref in touch handlers — zero React renders
            during drag gesture.
          - `will-change: transform` promotes to its own GPU layer once, stays there.
        */}
        <div
          ref={cardRef}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onClick={e => e.stopPropagation()}
          className={cn(
            "relative w-full bg-card shadow-2xl overflow-hidden",
            // PERF: will-change promotes the card to its own compositor layer.
            // The sheet slides in via CSS animation (gpu-composited transform),
            // not JS-driven spring.
            "will-change-transform",
            "animate-in slide-in-from-bottom duration-300 ease-out",
            "rounded-t-3xl",
            "sm:rounded-2xl sm:max-w-sm sm:mx-4",
            // On desktop — fade+scale in instead of slide
            "sm:animate-in sm:fade-in sm:zoom-in-95 sm:duration-200",
          )}
          style={{ zIndex: 1 }}
        >
          {/* Drag pill (mobile only) */}
          <div
            className="absolute top-2.5 left-1/2 -translate-x-1/2 w-9 h-1 rounded-full bg-border/70 sm:hidden z-10"
            aria-hidden
          />

          {/* ── Header ─────────────────────────────────────────────────── */}
          {previewPhotos.length > 0 ? (
            <PhotoCarousel
              photos={previewPhotos}
              locationName={location.location_name}
              visited={!!location.visited}
              placeLine={placeLine}
              dateLine={dateLine}
              onClose={onClose}
            />
          ) : (
            <NoPhotoHeader
              locationName={location.location_name}
              visited={!!location.visited}
              placeLine={placeLine}
              dateLine={dateLine}
              onClose={onClose}
            />
          )}

          {/* ── Body ───────────────────────────────────────────────────── */}
          <div className="px-4 sm:px-5 pt-4 pb-3 space-y-3">

            {/* Memory note */}
            {location.description && (
              <p
                id="loc-popup-desc"
                className="text-xs sm:text-sm text-muted-foreground leading-relaxed"
              >
                {location.description}
              </p>
            )}

            {/* ── Folder row — navigates to /dashboard/folder/:id ──────── */}
            {linkedFolder && (
              <button
                type="button"
                onClick={() => handleOpenFolder(linkedFolder.id)}
                aria-label={`Open folder: ${linkedFolder.name}`}
                className={cn(
                  "group w-full flex items-center gap-3 rounded-2xl px-3 py-2.5",
                  "bg-primary/8 border border-primary/15",
                  "text-left transition-colors duration-150",
                  "hover:bg-primary/14 hover:border-primary/30",
                  "active:bg-primary/20",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                )}
              >
                <span className="shrink-0 flex items-center justify-center h-9 w-9 rounded-xl bg-primary/12 text-lg leading-none">
                  {linkedFolder.emoji
                    ? linkedFolder.emoji
                    : <FolderOpen className="h-4 w-4 text-primary" aria-hidden />
                  }
                </span>

                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate leading-tight">
                    {linkedFolder.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                    {folderPhotoCount > 0
                      ? `${folderPhotoCount} photo${folderPhotoCount !== 1 ? "s" : ""}`
                      : "No photos yet"
                    }
                    {" · tap to open"}
                  </p>
                </div>

                <ArrowRight
                  className="h-3.5 w-3.5 text-primary/50 shrink-0 transition-transform duration-150 group-hover:translate-x-0.5"
                  aria-hidden
                />
              </button>
            )}

            {/* ── Action strip ─────────────────────────────────────────── */}
            <div className="flex items-center gap-2 pt-0.5">

              <Button
                variant={location.visited ? "outline" : "default"}
                size="sm"
                className={cn(
                  "flex-1 h-9 text-xs gap-1.5 rounded-xl font-semibold",
                  location.visited &&
                  "border-green-500/40 text-green-600 hover:text-green-700 hover:border-green-500/60",
                )}
                onClick={handleToggleVisited}
                disabled={isMutating}
              >
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                {location.visited ? "Visited ✓" : "Mark Visited"}
              </Button>

              <a
                href={`https://maps.google.com/?q=${location.latitude},${location.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Open in Google Maps"
                className={cn(
                  "flex items-center justify-center h-9 w-9 rounded-xl shrink-0",
                  "bg-muted active:bg-muted/50 border border-border",
                  "text-muted-foreground transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                )}
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </a>

              {confirmDelete ? (
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] text-destructive font-bold whitespace-nowrap">
                    Delete?
                  </span>
                  <button
                    onClick={handleDelete}
                    disabled={isMutating}
                    className="h-7 px-2.5 text-[10px] rounded-lg bg-destructive/15 text-destructive font-bold active:bg-destructive/25 transition-colors disabled:opacity-50"
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="h-7 px-2.5 text-[10px] rounded-lg bg-muted text-muted-foreground active:bg-muted/60 transition-colors"
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  disabled={isMutating}
                  aria-label="Delete location"
                  className={cn(
                    "flex items-center justify-center h-9 w-9 rounded-xl shrink-0",
                    "bg-muted active:bg-destructive/15 border border-border",
                    "text-muted-foreground active:text-destructive transition-colors",
                    "disabled:opacity-50",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/50",
                  )}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </button>
              )}
            </div>
          </div>

          <div style={{ height: "env(safe-area-inset-bottom, 0px)" }} />
        </div>
      </motion.div>
    </AnimatePresence>
  );
});

export default LocationPopup;
