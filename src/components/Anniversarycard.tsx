import { format } from "date-fns";
import { Heart, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Milestone } from "@/hooks/useMilestones";
import { getPublicUrl } from "@/hooks/useMedia";
import {
  MediaMap,
  completedYears,
  durationLabel,
  COUNTDOWN_THRESHOLD_DAYS,
} from "@/lib/Milestoneutils";
import { CountdownRing } from "@/components/Countdownring";

interface AnniversaryCardProps {
  milestone: Milestone;
  /** Pre-computed days until next occurrence — avoids re-computing in child. */
  days: number;
  mediaMap: MediaMap;
  onDelete: () => void;
  canDelete: boolean;
}

/**
 * Left widget logic:
 *
 *  - Today                   → CountdownRing (days=0, shows heart)
 *  - ≤ COUNTDOWN_THRESHOLD   → CountdownRing (shows urgency)
 *  - everything else         → DurationWidget (shows how long together)
 *
 * This prevents the confusing "264 days" ring on a "Together Since" card
 * where users expect to see a duration, not a countdown to the next Dec 2.
 */
export function AnniversaryCard({
  milestone,
  days,
  mediaMap,
  onDelete,
  canDelete,
}: AnniversaryCardProps) {
  const photo = milestone.media_id ? mediaMap[milestone.media_id] : null;
  const dateObj = new Date(milestone.date);
  const isToday = days === 0;
  const isUpcoming = days <= COUNTDOWN_THRESHOLD_DAYS;
  const showRing = isToday || isUpcoming;

  const yearsAgo = completedYears(milestone.date);
  const duration = durationLabel(milestone.date);

  return (
    <div
      className={cn(
        "group relative rounded-2xl border overflow-hidden transition-all hover:border-primary/30",
        isToday
          ? "border-primary/40 bg-primary/5"
          : "border-border/60 bg-card/60 backdrop-blur-sm"
      )}
    >
      {/* Today shimmer */}
      {isToday && (
        <div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent animate-pulse pointer-events-none"
          aria-hidden
        />
      )}

      <div className="flex items-stretch">
        {/* Photo strip */}
        {photo && (
          <div className="w-20 shrink-0">
            <img
              src={getPublicUrl(photo.file_path)}
              alt={photo.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <div className="flex-1 flex items-center gap-4 px-4 py-4 min-w-0">
          {/* Left widget: countdown ring when close/today, duration otherwise */}
          {showRing ? (
            <CountdownRing days={days} />
          ) : (
            <DurationWidget duration={duration} />
          )}

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="font-semibold font-heading text-sm text-foreground truncate">
              {milestone.title}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {format(dateObj, "MMMM d")}
              {yearsAgo > 0 && (
                <span className="ml-2 text-muted-foreground/50">
                  · {yearsAgo} year{yearsAgo !== 1 ? "s" : ""} ago
                </span>
              )}
            </p>
            {milestone.description && (
              <p className="text-xs text-muted-foreground/70 mt-1 line-clamp-1">
                {milestone.description}
              </p>
            )}
          </div>

          {/* Right badge + delete */}
          <div className="shrink-0 text-right">
            {isToday ? (
              <span className="text-xs font-semibold text-primary flex items-center gap-1">
                <Heart className="h-3 w-3 fill-current" aria-hidden /> Today!
              </span>
            ) : isUpcoming ? (
              // Upcoming: show countdown
              days <= 7 ? (
                <span className="text-xs font-medium text-rose-400">{days}d away</span>
              ) : (
                <span className="text-xs font-medium text-amber-400">{days}d away</span>
              )
            ) : (
              // Far away: show the duration (how long they've been together)
              <span className="text-xs text-muted-foreground">{duration}</span>
            )}

            {canDelete && (
              <button
                onClick={onDelete}
                aria-label={`Delete ${milestone.title}`}
                className="opacity-0 group-hover:opacity-100 transition-opacity mt-1 block ml-auto h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── DurationWidget ────────────────────────────────────────────────────────────
// Replaces the CountdownRing when the anniversary is far away.
// Shows how long they've been together in a clean pill widget.

function DurationWidget({ duration }: { duration: string }) {
  // Split e.g. "2y 3mo" or "2 years" into value + unit for two-line display
  const parts = duration.split(" ");
  const value = parts[0];
  const unit = parts.slice(1).join(" ");

  return (
    <div
      className="relative w-14 h-14 shrink-0 flex flex-col items-center justify-center rounded-full border-2 border-primary/20 bg-primary/5"
      aria-label={`Together for ${duration}`}
      role="img"
    >
      <span className="text-[11px] font-bold leading-none text-primary">{value}</span>
      {unit && (
        <span className="text-[8px] leading-none mt-0.5 text-primary/60">{unit}</span>
      )}
    </div>
  );
}