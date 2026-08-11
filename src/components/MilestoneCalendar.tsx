import { useState, useMemo } from "react";
import { DayPicker } from "react-day-picker";
import { format, isSameDay, startOfDay, differenceInDays } from "date-fns";
import { Heart, Clock, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Milestone } from "@/hooks/useMilestones";
import { getPublicUrl } from "@/hooks/useMedia";
import { buttonVariants } from "@/components/ui/button";
import {
  anniversaryOccurrencesInMonth,
  completedYears,
  daysUntil,
  getNextOccurrence,
  MediaMap,
} from "@/lib/Milestoneutils";

// ─── DayPicker classNames (module-level const) ─────────────────────────────────
// FIX: hoisted out of component — was being rebuilt as a new object on every render.

const DAY_PICKER_CLASS_NAMES = {
  months: "flex flex-col",
  month: "space-y-3 w-full",
  caption: "flex justify-center relative items-center mb-2",
  caption_label: "text-sm font-semibold font-heading tracking-wide",
  nav: "space-x-1 flex items-center",
  nav_button: cn(buttonVariants({ variant: "ghost" }), "h-7 w-7 p-0 opacity-50 hover:opacity-100 transition-opacity"),
  nav_button_previous: "absolute left-1",
  nav_button_next: "absolute right-1",
  table: "w-full border-collapse",
  head_row: "flex w-full",
  head_cell: "text-muted-foreground rounded-md flex-1 font-medium text-[0.7rem] text-center py-1 uppercase tracking-wider",
  row: "flex w-full mt-1",
  cell: "relative flex-1 text-center text-sm p-0 focus-within:relative focus-within:z-20",
  day: cn(buttonVariants({ variant: "ghost" }), "w-full h-10 p-0 font-normal mx-auto flex flex-col items-center justify-center rounded-xl aria-selected:opacity-100 hover:bg-accent/50 transition-colors"),
  day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground rounded-xl font-semibold",
  day_today: "ring-1 ring-primary/30 font-semibold text-primary",
  day_outside: "text-muted-foreground opacity-25",
  day_disabled: "text-muted-foreground opacity-25",
  day_hidden: "invisible",
} as const;

// ─── Props ─────────────────────────────────────────────────────────────────────

interface MilestoneCalendarProps {
  milestones: Milestone[];
  mediaMap: MediaMap;
}

// ─── Helpers (module-level, no duplication with AnniversariesView) ─────────────

/**
 * Returns all dates in a given month that have at least one milestone (anniversary
 * recurring or one-time milestone).
 */
function getMilestoneDatesForMonth(
  milestones: Milestone[],
  year: number,
  month: number // 0-indexed
): { anniversaryDates: Date[]; milestoneDates: Date[] } {
  const anniversaryDates: Date[] = [];
  const milestoneDates: Date[] = [];

  for (const m of milestones) {
    if (m.type === "anniversary") {
      // FIX: uses anniversaryOccurrencesInMonth which calls setYear (not getFullYear ±1)
      // so Feb-29 anniversaries don't overflow into March on non-leap years.
      anniversaryDates.push(
        ...anniversaryOccurrencesInMonth(m.date, year, month)
      );
    } else {
      milestoneDates.push(new Date(m.date));
    }
  }

  return { anniversaryDates, milestoneDates };
}

/**
 * Returns all milestones that apply to a specific calendar day.
 * Anniversaries match by month+day (any year). One-time milestones match exact date.
 */
function getMilestonesForDay(milestones: Milestone[], day: Date): Milestone[] {
  return milestones.filter((m) => {
    if (m.type === "anniversary") {
      const d = new Date(m.date);
      return d.getMonth() === day.getMonth() && d.getDate() === day.getDate();
    }
    return isSameDay(new Date(m.date), day);
  });
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function MilestoneCalendar({ milestones, mediaMap }: MilestoneCalendarProps) {
  const [month, setMonth] = useState(new Date());
  const [selected, setSelected] = useState<Date | undefined>();

  // FIX: memoized on month + milestones — not recomputed on every render
  const { anniversaryDates, milestoneDates } = useMemo(
    () => getMilestoneDatesForMonth(milestones, month.getFullYear(), month.getMonth()),
    [milestones, month]
  );

  // FIX: memoized on selected day + milestones
  const selectedMilestones = useMemo(
    () => (selected ? getMilestonesForDay(milestones, selected) : []),
    [milestones, selected]
  );

  return (
    <div className="space-y-4">
      {/* Calendar card */}
      <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm p-4">
        <DayPicker
          mode="single"
          selected={selected}
          onSelect={setSelected}
          month={month}
          onMonthChange={setMonth}
          showOutsideDays
          className="pointer-events-auto w-full"
          classNames={DAY_PICKER_CLASS_NAMES}
          components={{
            IconLeft: () => <ChevronLeft className="h-4 w-4" aria-hidden />,
            IconRight: () => <ChevronRight className="h-4 w-4" aria-hidden />,
            DayContent: ({ date }) => {
              const hasAnniversary = anniversaryDates.some((d) => isSameDay(d, date));
              const hasMilestone = milestoneDates.some((d) => isSameDay(d, date));
              return (
                <span className="flex flex-col items-center gap-0.5">
                  <span>{date.getDate()}</span>
                  {(hasAnniversary || hasMilestone) && (
                    <span className="flex gap-0.5 items-center" aria-hidden>
                      {hasAnniversary && (
                        <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block" />
                      )}
                      {hasMilestone && (
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                      )}
                    </span>
                  )}
                </span>
              );
            },
          }}
          modifiers={{ anniversary: anniversaryDates, milestone: milestoneDates }}
        />

        {/* Legend */}
        <div className="flex items-center gap-5 mt-3 pt-3 border-t border-border/40 justify-center">
          <LegendItem color="bg-primary" label="Anniversary" />
          <LegendItem color="bg-amber-400" label="Milestone" />
        </div>
      </div>

      {/* Selected day panel */}
      {selected && selectedMilestones.length > 0 && (
        <div className="space-y-2.5" aria-label={`Milestones for ${format(selected, "MMMM d")}`}>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest px-1">
            {format(selected, "EEEE, MMMM d")}
          </p>
          {selectedMilestones.map((m) => (
            <CalendarMilestoneCard
              key={m.id}
              milestone={m}
              selectedDay={selected}
              mediaMap={mediaMap}
            />
          ))}
        </div>
      )}

      {selected && selectedMilestones.length === 0 && (
        <div className="rounded-2xl border border-border/40 bg-card/40 py-8 text-center">
          <p className="text-sm text-muted-foreground">
            Nothing on {format(selected, "MMMM d")}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── CalendarMilestoneCard ─────────────────────────────────────────────────────

interface CalendarMilestoneCardProps {
  milestone: Milestone;
  selectedDay: Date;
  mediaMap: MediaMap;
}

function CalendarMilestoneCard({ milestone, selectedDay, mediaMap }: CalendarMilestoneCardProps) {
  const photo = milestone.media_id ? mediaMap[milestone.media_id] : null;
  const isAnniversary = milestone.type === "anniversary";
  const original = new Date(milestone.date);

  // FIX: use completedYears (differenceInYears-based) instead of manual getFullYear subtraction
  const yearsAgo = isAnniversary ? completedYears(milestone.date, selectedDay) : 0;

  // FIX: daysUntil imported from shared utils — no duplicate definition
  const days = isAnniversary
    ? differenceInDays(getNextOccurrence(milestone.date), startOfDay(new Date()))
    : null;

  const ordinal = (n: number) =>
    n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`;

  return (
    <div
      className={cn(
        "rounded-2xl border overflow-hidden transition-all",
        isAnniversary
          ? "border-primary/25 bg-primary/5"
          : "border-amber-400/20 bg-amber-500/5"
      )}
    >
      <div className="flex items-stretch">
        {/* Photo strip or icon */}
        {photo ? (
          <div className="w-20 shrink-0">
            <img
              src={getPublicUrl(photo.file_path)}
              alt={photo.title}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div
            className={cn(
              "w-16 shrink-0 flex items-center justify-center text-2xl",
              isAnniversary ? "bg-primary/10" : "bg-amber-500/10"
            )}
            aria-hidden
          >
            {isAnniversary ? "💑" : "⭐"}
          </div>
        )}

        <div className="flex-1 px-4 py-3.5 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold font-heading text-sm text-foreground truncate">
                {milestone.title}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                <Clock className="h-3 w-3 opacity-50" aria-hidden />
                {format(original, "MMMM d, yyyy")}
                {isAnniversary && yearsAgo > 0 && (
                  <span className="text-muted-foreground/50">
                    · {yearsAgo} yr{yearsAgo !== 1 ? "s" : ""} ago
                  </span>
                )}
              </p>
              {milestone.description && (
                <p className="text-xs text-muted-foreground/70 mt-1 line-clamp-2">
                  {milestone.description}
                </p>
              )}
            </div>

            {isAnniversary && (
              <div className="shrink-0 text-right">
                {yearsAgo > 0 && (
                  <span className="text-[11px] font-semibold text-primary block">
                    {ordinal(yearsAgo)}
                  </span>
                )}
                {days === 0 ? (
                  <span className="text-[11px] text-primary flex items-center gap-0.5 justify-end">
                    <Heart className="h-2.5 w-2.5 fill-current" aria-hidden /> Today!
                  </span>
                ) : days !== null ? (
                  <span className="text-[11px] text-muted-foreground">{days}d</span>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── LegendItem ────────────────────────────────────────────────────────────────

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className={cn("w-2 h-2 rounded-full inline-block", color)} aria-hidden />
      {label}
    </span>
  );
}