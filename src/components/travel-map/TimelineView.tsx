import { memo, useMemo } from "react";
import { motion } from "framer-motion";
import { MapPin, Calendar, ChevronRight, CheckCircle2 } from "lucide-react";
import { TravelLocation } from "@/hooks/useTravelLocations";
import { format, parseISO, isValid } from "date-fns";
import { cn } from "@/lib/utils";

// ─── Constants ────────────────────────────────────────────────────────────────

const TRIP_EMOJIS: Record<string, string> = {
  Trip: "✈️",
  Anniversary: "💍",
  Vacation: "🏖️",
  "Date Night": "🌹",
  "Road Trip": "🚗",
  Adventure: "🏔️",
  Honeymoon: "💑",
};

// Cap per-card animation delay so deep lists don't make users wait forever.
const MAX_CARD_DELAY_S = 0.4;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTripEmoji(tags: string[]): string {
  for (const tag of tags) {
    if (TRIP_EMOJIS[tag]) return TRIP_EMOJIS[tag];
  }
  return "❤️";
}

/** FIX: Safe date formatter — returns null instead of throwing on bad input. */
function safeDateFormat(dateStr: string, fmt: string): string | null {
  try {
    const d = parseISO(dateStr);
    return isValid(d) ? format(d, fmt) : null;
  } catch {
    return null;
  }
}

interface GroupedYear {
  year: string;
  locations: TravelLocation[];
}

/**
 * FIX: Combined memo — groups and sorts in one pass.
 * FIX: "Unknown" always sorts to the end regardless of locale collation.
 */
function groupAndSortByYear(locations: TravelLocation[]): GroupedYear[] {
  const sorted = [...locations].sort((a, b) => {
    if (!a.date_visited && !b.date_visited) return 0;
    if (!a.date_visited) return 1;
    if (!b.date_visited) return -1;
    return b.date_visited.localeCompare(a.date_visited);
  });

  const map = sorted.reduce<Record<string, TravelLocation[]>>((acc, loc) => {
    const year = loc.date_visited?.slice(0, 4) ?? "Unknown";
    (acc[year] ??= []).push(loc);
    return acc;
  }, {});

  // FIX: Explicit numeric sort; "Unknown" always goes last.
  return Object.entries(map)
    .sort(([a], [b]) => {
      if (a === "Unknown") return 1;
      if (b === "Unknown") return -1;
      return Number(b) - Number(a);
    })
    .map(([year, locs]) => ({ year, locations: locs }));
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  locations: TravelLocation[];
  onSelectLocation: (loc: TravelLocation) => void;
}

interface TripCardProps {
  loc: TravelLocation;
  animDelay: number;
  onSelect: (loc: TravelLocation) => void;
}

// ─── TripCard ─────────────────────────────────────────────────────────────────

const TripCard = memo(function TripCard({ loc, animDelay, onSelect }: TripCardProps) {
  const emoji = getTripEmoji(loc.tags ?? []);

  // FIX: Safe date format — won't throw on malformed date strings.
  const formattedDate = loc.date_visited
    ? safeDateFormat(loc.date_visited, "MMM d, yyyy")
    : null;

  // FIX: Guard photo_urls — only use the first entry if it's a non-empty string.
  const thumbUrl =
    loc.photo_urls && loc.photo_urls.length > 0 && typeof loc.photo_urls[0] === "string"
      ? loc.photo_urls[0]
      : null;

  const placeLine = [loc.city, loc.country].filter(Boolean).join(", ");

  // FIX: Richer aria-label with date and visited state for screen readers.
  const ariaLabel = [
    `View ${loc.location_name}`,
    placeLine && `in ${placeLine}`,
    formattedDate && `visited ${formattedDate}`,
    loc.visited && "marked as visited",
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      // FIX: Cap delay so deep-list cards don't wait forever.
      transition={{ delay: Math.min(animDelay, MAX_CARD_DELAY_S), duration: 0.25, ease: "easeOut" }}
      onClick={() => onSelect(loc)}
      className="w-full text-left group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-2xl"
      aria-label={ariaLabel}
    >
      <div
        className={cn(
          "relative rounded-2xl border bg-card overflow-hidden transition-all duration-200",
          "hover:shadow-md hover:-translate-y-0.5",
          loc.visited
            ? "border-green-500/25 hover:border-green-500/50"
            : "border-border/50 hover:border-primary/30",
        )}
      >
        {/* Visited accent bar */}
        {loc.visited && (
          <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-green-400 to-green-600 rounded-l-2xl" aria-hidden />
        )}

        <div className="flex items-stretch gap-0">
          {/* Thumbnail — full-height left panel when present */}
          {thumbUrl && (
            <div className="shrink-0 w-20 sm:w-24 overflow-hidden rounded-l-2xl">
              <img
                src={thumbUrl}
                alt=""
                aria-hidden
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                loading="lazy"
              />
            </div>
          )}

          {/* Content */}
          <div className={cn("flex-1 min-w-0 p-3 sm:p-4", loc.visited && "pl-4")}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 min-w-0">
                {/* Emoji badge */}
                <span
                  className="shrink-0 flex items-center justify-center h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-primary/8 text-base sm:text-lg"
                  aria-hidden
                >
                  {emoji}
                </span>

                <div className="min-w-0 pt-0.5">
                  {/* Title row */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h4 className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors leading-tight">
                      {loc.location_name}
                    </h4>
                    {loc.visited && (
                      <CheckCircle2
                        className="h-3.5 w-3.5 text-green-500 shrink-0"
                        aria-label="Visited"
                      />
                    )}
                  </div>

                  {/* Place + date meta */}
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {placeLine && (
                      <span className="flex items-center gap-1 text-[10px] sm:text-[11px] text-muted-foreground">
                        <MapPin className="h-2.5 w-2.5 shrink-0" aria-hidden />
                        {placeLine}
                      </span>
                    )}
                    {formattedDate && (
                      <span className="flex items-center gap-1 text-[10px] sm:text-[11px] text-muted-foreground">
                        <Calendar className="h-2.5 w-2.5 shrink-0" aria-hidden />
                        {formattedDate}
                      </span>
                    )}
                  </div>

                  {/* Description and tags removed for a cleaner timeline */}
                </div>
              </div>

              {/* Chevron — only when no thumbnail */}
              {!thumbUrl && (
                <ChevronRight
                  className="h-4 w-4 text-muted-foreground/40 shrink-0 mt-1 group-hover:text-primary group-hover:translate-x-0.5 transition-all"
                  aria-hidden
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.button>
  );
});

// ─── Empty state ──────────────────────────────────────────────────────────────

const EmptyState = memo(function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 sm:py-32 text-center px-6 gap-4">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", damping: 14, stiffness: 200 }}
        className="relative"
      >
        <div className="text-6xl sm:text-7xl" aria-hidden>🗺️</div>
        {/* Subtle pulse ring */}
        <motion.div
          className="absolute inset-0 rounded-full bg-primary/10"
          animate={{ scale: [1, 1.6, 1], opacity: [0.4, 0, 0.4] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          aria-hidden
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.3 }}
        className="space-y-1.5"
      >
        <h3 className="text-lg sm:text-xl font-bold text-foreground">No trips pinned yet</h3>
        <p className="text-sm text-muted-foreground max-w-[240px] leading-relaxed">
          Add your first travel memory to start your journey
        </p>
      </motion.div>
    </div>
  );
});

// ─── TimelineView ─────────────────────────────────────────────────────────────

export const TimelineView = memo(function TimelineView({ locations, onSelectLocation }: Props) {
  // FIX: Single memo — groups, sorts years, and keeps "Unknown" last.
  const groups = useMemo(() => groupAndSortByYear(locations), [locations]);

  if (locations.length === 0) return <EmptyState />;

  // Running card counter for staggered animation across all year groups.
  let globalCardIndex = 0;

  return (
    <div className="max-w-lg mx-auto px-3 sm:px-4 py-5 sm:py-8 space-y-8 sm:space-y-10">
      {groups.map((group, yi) => (
        <motion.section
          key={group.year}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: Math.min(yi * 0.06, 0.24), duration: 0.3, ease: "easeOut" }}
          aria-label={`Trips in ${group.year}`}
        >
          {/* Year header */}
          <div className="flex items-center gap-3 mb-3 sm:mb-4">
            <div
              className={cn(
                "px-3 py-1 rounded-full border text-sm font-bold shrink-0",
                group.year === "Unknown"
                  ? "bg-muted/60 border-border/60 text-muted-foreground"
                  : "bg-primary/10 border-primary/25 text-primary",
              )}
            >
              {group.year === "Unknown" ? "Undated" : group.year}
            </div>

            {/* Count pill */}
            <span className="text-[10px] sm:text-[11px] text-muted-foreground shrink-0">
              {group.locations.length} {group.locations.length === 1 ? "trip" : "trips"}
            </span>

            <div className="flex-1 h-px bg-gradient-to-r from-border/60 to-transparent" aria-hidden />
          </div>

          {/* Cards — no left border/timeline line; cards are self-contained */}
          <div className="space-y-2.5 sm:space-y-3">
            {group.locations.map((loc) => {
              const delay = (globalCardIndex++) * 0.04;
              return (
                <TripCard
                  key={loc.id}
                  loc={loc}
                  animDelay={delay}
                  onSelect={onSelectLocation}
                />
              );
            })}
          </div>
        </motion.section>
      ))}
    </div>
  );
});

export default TimelineView;
