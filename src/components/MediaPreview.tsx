import { useState, useCallback, useEffect, useRef } from "react";
import { Media, getPublicUrl } from "@/hooks/useMedia";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Download, ZoomIn, ZoomOut, RotateCcw, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptics";

interface Props {
  media: Media[];
  currentIndex: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: (index: number) => void;
}

async function downloadFile(url: string, filename: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Could not download this file.");

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(objectUrl);
}

function getTouchDistance(touches: TouchList) {
  if (touches.length < 2) return 0;

  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.hypot(dx, dy);
}

export function MediaPreview({ media, currentIndex, open, onOpenChange, onNavigate }: Props) {
  const item = media[currentIndex] ?? null;
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < media.length - 1;
  const { toast } = useToast();
  const [zoom, setZoom] = useState(1);

  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const [swipeDelta, setSwipeDelta] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [closeDragY, setCloseDragY] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const pinchStartDistance = useRef<number | null>(null);
  const pinchStartZoom = useRef(1);
  const isPinching = useRef(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const lastTapAt = useRef(0);
  const touchMoved = useRef(false);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) onNavigate(currentIndex - 1);
  }, [currentIndex, onNavigate]);

  const goNext = useCallback(() => {
    if (currentIndex < media.length - 1) onNavigate(currentIndex + 1);
  }, [currentIndex, media.length, onNavigate]);

  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(prev + 0.2, 3));
    haptic("light");
  }, []);

  const handleZoomOut = useCallback(() => {
    if (zoom <= 1.2) setPan({ x: 0, y: 0 });
    setZoom((prev) => Math.max(prev - 0.2, 1));
    haptic("light");
  }, [zoom]);

  const handleResetZoom = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const closePreview = useCallback(() => {
    handleResetZoom();
    setCloseDragY(0);
    haptic("light");
    onOpenChange(false);
  }, [handleResetZoom, onOpenChange]);

  const toggleTapZoom = useCallback(() => {
    if (item?.file_type === "video") return;

    if (zoom > 1) {
      setPan({ x: 0, y: 0 });
      setZoom(1);
    } else {
      setZoom(2);
    }
    haptic("medium");
  }, [item?.file_type, zoom]);

  const handleDownload = useCallback(async () => {
    if (!item) return;

    const url = getPublicUrl(item.file_path);
    try {
      await downloadFile(url, item.file_name);
      toast({ title: "Downloaded", description: `${item.file_name} saved to your device.` });
    } catch (error) {
      toast({
        title: "Download failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  }, [item, toast]);

  const handleWheel = useCallback((e: WheelEvent) => {
    if (!open || item?.file_type === "video") return;

    e.preventDefault();
    if (e.deltaY < 0) {
      handleZoomIn();
    } else {
      handleZoomOut();
    }
  }, [open, item?.file_type, handleZoomIn, handleZoomOut]);

  useEffect(() => {
    if (!open) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "Escape") closePreview();
      if (item?.file_type === "video") return;

      if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        handleZoomIn();
      }
      if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        handleZoomOut();
      }
      if (e.key === "0") {
        e.preventDefault();
        handleResetZoom();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, item?.file_type, goPrev, goNext, closePreview, handleZoomIn, handleZoomOut, handleResetZoom]);

  useEffect(() => {
    if (!open) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setCloseDragY(0);
    pinchStartDistance.current = null;
    pinchStartZoom.current = 1;
    isPinching.current = false;
  }, [currentIndex]);

  useEffect(() => {
    if (!open) return;

    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => window.removeEventListener("wheel", handleWheel);
  }, [open, handleWheel]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && item.file_type !== "video") {
      pinchStartDistance.current = getTouchDistance(e.touches);
      pinchStartZoom.current = zoom;
      isPinching.current = true;
      touchMoved.current = true;
      setIsSwiping(false);
      setSwipeDelta(0);
      setCloseDragY(0);
      return;
    }

    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    panStart.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      panX: pan.x,
      panY: pan.y,
    };
    touchMoved.current = false;
    setIsSwiping(zoom <= 1);
    setSwipeDelta(0);
    setCloseDragY(0);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && item.file_type !== "video") {
      const startDistance = pinchStartDistance.current;
      if (!startDistance) return;

      e.preventDefault();
      const nextZoom = pinchStartZoom.current * (getTouchDistance(e.touches) / startDistance);
      setZoom(Math.max(1, Math.min(nextZoom, 3)));
      touchMoved.current = true;
      return;
    }

    if (isPinching.current) return;
    if (touchStartX.current === null || touchStartY.current === null) return;

    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) touchMoved.current = true;

    if (zoom > 1 && item.file_type !== "video") {
      e.preventDefault();
      setPan({
        x: panStart.current.panX + e.touches[0].clientX - panStart.current.x,
        y: panStart.current.panY + e.touches[0].clientY - panStart.current.y,
      });
      return;
    }

    if (Math.abs(dy) > Math.abs(dx)) {
      if (dy > 0) {
        e.preventDefault();
        setCloseDragY(Math.min(dy, 180));
        setIsSwiping(false);
        setSwipeDelta(0);
      }
      return;
    }

    e.preventDefault();
    setSwipeDelta(dx);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (isPinching.current) {
      if (e.touches.length < 2) {
        pinchStartDistance.current = null;
        pinchStartZoom.current = zoom;
        isPinching.current = false;
      }

      if (e.touches.length === 1) {
        touchStartX.current = e.touches[0].clientX;
        touchStartY.current = e.touches[0].clientY;
      }

      setSwipeDelta(0);
      setIsSwiping(false);
      return;
    }

    if (!touchMoved.current && item.file_type !== "video") {
      const now = Date.now();
      if (now - lastTapAt.current < 280) {
        toggleTapZoom();
        lastTapAt.current = 0;
      } else {
        lastTapAt.current = now;
      }
    }

    if (closeDragY > 110) {
      closePreview();
      return;
    }

    const threshold = 60;
    if (zoom <= 1 && swipeDelta < -threshold && hasNext) {
      haptic("light");
      goNext();
    } else if (zoom <= 1 && swipeDelta > threshold && hasPrev) {
      haptic("light");
      goPrev();
    }

    setSwipeDelta(0);
    setCloseDragY(0);
    setIsSwiping(false);
    touchStartX.current = null;
    touchStartY.current = null;
  };

  if (!open || !item) return null;

  const url = getPublicUrl(item.file_path);
  const clampedDelta = Math.max(-120, Math.min(120, swipeDelta));

  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col select-none">
      <div
        className="bg-black/50 backdrop-blur-sm px-3 sm:px-4 pb-3 flex items-center justify-between gap-3 shrink-0"
        style={{
          paddingTop: "calc(0.75rem + env(safe-area-inset-top, 0px))",
          opacity: Math.max(0.35, 1 - closeDragY / 220),
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm sm:text-base font-medium text-gray-200 shrink-0">
            {currentIndex + 1} / {media.length}
          </span>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {item.file_type !== "video" && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white hover:bg-white/20"
                onClick={handleZoomOut}
                title="Zoom out"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="hidden sm:inline text-xs text-gray-300 min-w-12 text-center">
                {Math.round(zoom * 100)}%
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white hover:bg-white/20"
                onClick={handleZoomIn}
                title="Zoom in"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white hover:bg-white/20"
                onClick={handleResetZoom}
                title="Reset zoom"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white hover:bg-white/20"
            onClick={handleDownload}
            title="Download"
          >
            <Download className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white hover:bg-white/20"
            onClick={closePreview}
            title="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div
        className="flex-1 overflow-auto flex items-center justify-center relative group bg-black touch-none"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onDoubleClick={toggleTapZoom}
      >
        <div
          className="transition-transform duration-75 flex items-center justify-center"
          style={{
            transform: `translate3d(${isSwiping ? clampedDelta : 0}px, ${closeDragY}px, 0)`,
            opacity: Math.max(0.55, 1 - closeDragY / 260),
          }}
        >
          <div
            className={cn((zoom > 1 || isPinching.current) ? "transition-none" : "transition-transform duration-200")}
            style={{
              transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
              transformOrigin: "center",
            }}
          >
            {item.file_type === "video" ? (
              <video src={url} controls className="max-w-full max-h-[calc(100dvh-4rem)] object-contain" autoPlay />
            ) : (
              <img
                src={url}
                alt="Media preview"
                className="max-w-full max-h-[calc(100dvh-4rem)] object-contain pointer-events-none"
                draggable={false}
              />
            )}
          </div>
        </div>

        {hasPrev && !isSwiping && zoom <= 1 && (
          <Button
            variant="secondary"
            size="icon"
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full shadow-lg opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
            onClick={goPrev}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
        )}
        {hasNext && !isSwiping && zoom <= 1 && (
          <Button
            variant="secondary"
            size="icon"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full shadow-lg opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
            onClick={goNext}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        )}

        {isSwiping && (
          <>
            {swipeDelta < -20 && hasNext && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/50 backdrop-blur-sm rounded-full p-2 shadow-lg pointer-events-none">
                <ChevronRight className="h-5 w-5 text-white" />
              </div>
            )}
            {swipeDelta > 20 && hasPrev && (
              <div className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/50 backdrop-blur-sm rounded-full p-2 shadow-lg pointer-events-none">
                <ChevronLeft className="h-5 w-5 text-white" />
              </div>
            )}
          </>
        )}

        {media.length > 1 && media.length <= 20 && (
          <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-1 pointer-events-none">
            {media.map((_, i) => (
              <span
                key={i}
                className={cn(
                  "rounded-full transition-all duration-200",
                  i === currentIndex ? "w-4 h-1.5 bg-white shadow" : "w-1.5 h-1.5 bg-white/50"
                )}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
