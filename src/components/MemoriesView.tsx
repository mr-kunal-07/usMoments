import { useMemo, useEffect, useRef, useState } from "react";
import { useMemoriesTimeline } from "@/hooks/useMemories";
import { useRelationshipStats } from "@/hooks/useMemories";
import { getPublicUrl, useBackfillExifDates } from "@/hooks/useMedia";
import { format, formatDistanceToNow } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Heart, Image as ImageIcon, Video, Star, HardDrive, CalendarHeart, Clock, Camera, ScanLine } from "lucide-react";
import { cn, formatSize } from "@/lib/utils";
import type { Media } from "@/hooks/useMedia";

type TimelineMedia = Media & { taken_at?: string | null };

interface TimelineProps {
  onPreview: (mediaId: string) => void;
}

export function MemoriesTimeline({ onPreview }: TimelineProps) {
  const { data: groups, isLoading } = useMemoriesTimeline();
  const backfill = useBackfillExifDates();
  const hasBackfilled = useRef(false);
  const [scanning, setScanning] = useState(false);

  // Auto-backfill EXIF dates for photos that don't have taken_at yet
  useEffect(() => {
    if (!groups || hasBackfilled.current || backfill.isPending) return;
    const allMedia = Object.values(groups).flat() as TimelineMedia[];
    const needsBackfill = allMedia.filter(
      (m) => !m.taken_at && m.file_type === "image"
    );
    if (needsBackfill.length === 0) return;
    hasBackfilled.current = true;
    setScanning(true);
    backfill
      .mutateAsync(needsBackfill.map(m => ({ id: m.id, file_path: m.file_path })))
      .finally(() => setScanning(false));
  }, [groups]); // eslint-disable-line

  // Sort day keys descending (newest day first)
  const sortedKeys = useMemo(() => {
    if (!groups) return [];
    return Object.keys(groups).sort((a, b) => b.localeCompare(a));
  }, [groups]);

  if (isLoading) return (
    <div className="space-y-8">
      {[1, 2, 3].map(i => (
        <div key={i} className="space-y-3">
          <Skeleton className="h-5 w-48" />
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {Array.from({ length: 6 }).map((_, j) => <Skeleton key={j} className="aspect-square rounded-xl" />)}
          </div>
        </div>
      ))}
    </div>
  );

  if (!groups || sortedKeys.length === 0) return (
    <div className="flex flex-col items-center py-20 text-muted-foreground">
      <CalendarHeart className="h-12 w-12 mb-4 opacity-30" />
      <p className="font-medium text-foreground">No memories yet</p>
      <p className="text-sm mt-1">Upload your first photo to start the timeline ❤️</p>
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Scanning indicator */}
      {scanning && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted text-muted-foreground text-xs w-fit">
          <ScanLine className="h-3.5 w-3.5 animate-pulse text-primary" />
          Reading photo dates from your images…
        </div>
      )}

      {sortedKeys.map((key, idx) => {
        const dayDate = new Date(key + "T12:00:00"); // noon to avoid tz shift
        const media = groups[key];

        // Show month/year banner when the month changes vs previous entry
        const prevKey = sortedKeys[idx - 1];
        const prevMonth = prevKey ? prevKey.slice(0, 7) : null;
        const thisMonth = key.slice(0, 7);
        const showMonthBanner = idx === 0 || prevMonth !== thisMonth;

        return (
          <div key={key}>
            {/* Month / Year separator — shown once per month */}
            {showMonthBanner && (
              <div className="flex items-center gap-3 mb-5 mt-2">
                <div className="h-px flex-1 bg-border/40" />
                <div className="flex items-center gap-2 px-4 py-1.5 rounded-full border border-border/60 bg-card shadow-sm">
                  <Heart className="h-3 w-3 text-primary fill-primary" />
                  <span className="text-sm font-bold font-heading tracking-wide">
                    {format(dayDate, "MMMM yyyy")}
                  </span>
                </div>
                <div className="h-px flex-1 bg-border/40" />
              </div>
            )}

            {/* Day header — "Sunday, March 8" */}
            <div className="flex items-baseline gap-3 mb-3 sticky top-0 z-10 bg-background/90 backdrop-blur-sm py-1.5 px-1">
              <span className="text-base font-semibold font-heading text-foreground">
                {format(dayDate, "EEEE, MMMM d")}
              </span>
              <span className="text-xs text-muted-foreground">
                {media.length} {media.length === 1 ? "memory" : "memories"}
              </span>
            </div>

            {/* Photo grid */}
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1 sm:gap-1.5">
              {media.map((item, itemIdx) => {
                const timelineItem = item as TimelineMedia;
                const photoDate = new Date(timelineItem.taken_at ?? timelineItem.created_at);
                const hasTakenAt = !!timelineItem.taken_at;
                return (
                  <div
                    key={item.id}
                    className={cn(
                      "relative aspect-square rounded-lg overflow-hidden cursor-pointer group",
                      "hover:ring-2 hover:ring-primary/60 transition-all duration-200",
                      itemIdx === 0 && media.length > 3 ? "col-span-2 row-span-2" : ""
                    )}
                    onClick={() => onPreview(item.id)}
                  >
                    {item.file_type === "video" ? (
                      <>
                        <video src={getPublicUrl(item.file_path)} className="w-full h-full object-cover" preload="metadata" />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                          <Video className="h-6 w-6 text-white drop-shadow" />
                        </div>
                      </>
                    ) : (
                      <img
                        src={getPublicUrl(item.file_path)}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="absolute bottom-0 left-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <p className="text-white text-xs font-medium truncate drop-shadow">{item.title}</p>
                      <p className="text-white/80 text-[10px] flex items-center gap-1 mt-0.5">
                        {hasTakenAt
                          ? <><Camera className="h-2.5 w-2.5" />{format(photoDate, "h:mm a")}</>
                          : <><Clock className="h-2.5 w-2.5" />{format(photoDate, "h:mm a")}</>
                        }
                      </p>
                    </div>
                    {item.is_starred && (
                      <Star className="absolute top-1.5 right-1.5 h-3.5 w-3.5 fill-yellow-400 text-yellow-400 drop-shadow" />
                    )}
                    {hasTakenAt && (
                      <div className="absolute top-1.5 left-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="bg-black/50 rounded px-1 py-0.5 text-[9px] text-white/90 flex items-center gap-0.5">
                          <Camera className="h-2 w-2" /> EXIF
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function RelationshipStats() {
  const { data: stats, isLoading } = useRelationshipStats();

  if (isLoading) return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
    </div>
  );

  if (!stats) return null;

  const items = [
    { icon: <ImageIcon className="h-5 w-5" />, label: "Photos", value: stats.images, color: "text-sky-400" },
    { icon: <Video className="h-5 w-5" />, label: "Videos", value: stats.videos, color: "text-violet-400" },
    { icon: <Star className="h-5 w-5" />, label: "Starred", value: stats.starred, color: "text-yellow-400" },
    { icon: <HardDrive className="h-5 w-5" />, label: "Used", value: formatSize(stats.totalSize), color: "text-emerald-400" },
  ];

  return (
    <div className="space-y-4">
      {stats.firstDate && (
        <div className="glass-card p-5 flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0">
            <CalendarHeart className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold font-heading gradient-text">{stats.daysTogether.toLocaleString()} days</p>
            <p className="text-sm text-muted-foreground">
              Since your first memory · {format(stats.firstDate, "MMMM d, yyyy")}
              <span className="ml-1 text-muted-foreground/60">({formatDistanceToNow(stats.firstDate, { addSuffix: true })})</span>
            </p>
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {items.map(item => (
          <div key={item.label} className="glass-card p-4 flex flex-col gap-2">
            <span className={cn("", item.color)}>{item.icon}</span>
            <p className="text-2xl font-bold font-heading">{item.value}</p>
            <p className="text-xs text-muted-foreground">{item.label}</p>
          </div>
        ))}
      </div>
      <div className="glass-card p-4 flex items-center gap-3">
        <Heart className="h-5 w-5 text-primary fill-primary shrink-0" />
        <p className="text-sm text-muted-foreground">
          <span className="font-bold text-foreground text-base">{stats.total}</span> total memories captured together
        </p>
        <Clock className="h-4 w-4 text-muted-foreground/50 ml-auto shrink-0" />
      </div>
    </div>
  );
}
