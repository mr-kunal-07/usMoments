import { useEffect, useMemo, useState } from "react";
import { CalendarHeart, Heart, Loader2, Sparkles } from "lucide-react";
import {
  differenceInCalendarDays,
  format,
  getMonth,
  getYear,
  startOfDay,
} from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { relationshipDateTheme as theme } from "@/components/couples/relationshipDateTheme";

interface RelationshipDatePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selected?: Date;
  onSelect: (date?: Date) => void;
  onConfirm: () => void;
  isPending: boolean;
  confirmDisabled: boolean;
}

const MONTHS = Array.from({ length: 12 }, (_, month) => ({
  value: month.toString(),
  label: format(new Date(2024, month, 1), "MMMM"),
}));

function createYears(currentYear: number): number[] {
  return Array.from({ length: 101 }, (_, index) => currentYear - index);
}

export function RelationshipDatePicker({
  open,
  onOpenChange,
  selected,
  onSelect,
  onConfirm,
  isPending,
  confirmDisabled,
}: RelationshipDatePickerProps) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const years = useMemo(() => createYears(getYear(today)), [today]);
  const [visibleMonth, setVisibleMonth] = useState(() => selected ?? today);

  useEffect(() => {
    if (open) setVisibleMonth(selected ?? today);
  }, [open, selected, today]);

  const sharedDays = selected
    ? Math.max(0, differenceInCalendarDays(today, startOfDay(selected)))
    : null;

  const changeVisibleMonth = (year: number, month: number) => {
    setVisibleMonth(new Date(year, month, 1));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="grid max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-[400px] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden rounded-lg p-0 shadow-2xl sm:max-h-[calc(100dvh-3rem)] sm:max-w-[430px]"
        style={{ background: theme.surface, border: `1px solid ${theme.border}`, color: theme.text }}
      >
        <DialogHeader className="border-b px-4 pb-3 pt-4 text-left sm:px-5 sm:pb-4 sm:pt-5" style={{ background: theme.tileBackground, borderColor: theme.border }}>
          <div className="mb-2 flex items-center gap-2.5 sm:mb-3 sm:gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md shadow-sm sm:h-10 sm:w-10" style={{ background: theme.iconBackground, color: theme.text }}>
              <CalendarHeart className="h-[18px] w-[18px] sm:h-5 sm:w-5" aria-hidden />
            </span>
            <div className="min-w-0 pr-6">
              <DialogTitle className="text-sm font-bold sm:text-base" style={{ color: theme.text }}>Our beginning</DialogTitle>
              <DialogDescription className="mt-0.5 text-[11px] sm:text-xs" style={{ color: theme.mutedText }}>
                Choose the day your story became us.
              </DialogDescription>
            </div>
          </div>

          <div className="flex min-h-10 items-center gap-2.5 border-l-2 pl-3 sm:min-h-12 sm:gap-3" style={{ borderColor: theme.mutedText }} aria-live="polite">
            {selected && sharedDays !== null ? (
              <>
                <Heart className="h-4 w-4 shrink-0 fill-current" style={{ color: theme.text }} aria-hidden />
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold sm:text-sm" style={{ color: theme.text }}>{format(selected, "EEEE, MMMM d, yyyy")}</p>
                  <p className="text-[10px] sm:text-[11px]" style={{ color: theme.mutedText }}>
                    {sharedDays === 0 ? "Your day one starts today" : `${sharedDays.toLocaleString()} shared days begin here`}
                  </p>
                </div>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 shrink-0" style={{ color: theme.text }} aria-hidden />
                <p className="text-xs" style={{ color: theme.mutedText }}>Pick the first page of your shared timeline.</p>
              </>
            )}
          </div>
        </DialogHeader>

        <div className="overflow-y-auto overscroll-contain px-4 py-3 sm:px-5 sm:py-4">
          <div className="mb-2 grid grid-cols-[minmax(0,1fr)_96px] gap-2 sm:mb-3 sm:grid-cols-[1fr_104px]" aria-label="Choose calendar month and year">
            <Select
              value={getMonth(visibleMonth).toString()}
              onValueChange={(value) => changeVisibleMonth(getYear(visibleMonth), Number(value))}
            >
              <SelectTrigger className="h-8 rounded-md text-xs font-semibold sm:h-9" style={{ background: theme.softSurface, borderColor: theme.border, color: theme.text }}>
                <SelectValue aria-label="Month" />
              </SelectTrigger>
              <SelectContent className="border-[hsl(36_20%_70%/0.6)] bg-[hsl(40_30%_96%)] text-[hsl(30_20%_28%)]">
                {MONTHS.map((month) => (
                  <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={getYear(visibleMonth).toString()}
              onValueChange={(value) => changeVisibleMonth(Number(value), getMonth(visibleMonth))}
            >
              <SelectTrigger className="h-8 rounded-md text-xs font-semibold sm:h-9" style={{ background: theme.softSurface, borderColor: theme.border, color: theme.text }}>
                <SelectValue aria-label="Year" />
              </SelectTrigger>
              <SelectContent className="max-h-64 border-[hsl(36_20%_70%/0.6)] bg-[hsl(40_30%_96%)] text-[hsl(30_20%_28%)]">
                {years.map((year) => (
                  <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Calendar
            mode="single"
            month={visibleMonth}
            onMonthChange={setVisibleMonth}
            selected={selected}
            onSelect={onSelect}
            disabled={{ after: today }}
            fromYear={years.at(-1)}
            toYear={years[0]}
            showOutsideDays={false}
            className="w-full p-0"
            modifiers={{ storyBeginning: selected ? [selected] : [] }}
            classNames={{
              months: "w-full",
              month: "w-full space-y-1 sm:space-y-2",
              caption: "hidden",
              nav: "hidden",
              table: "w-full table-fixed border-collapse",
              head_row: "grid grid-cols-7",
              head_cell: "h-6 text-center text-[9px] font-semibold uppercase text-[hsl(30_15%_42%)] sm:h-7 sm:text-[10px]",
              row: "mt-0.5 grid grid-cols-7 sm:mt-1",
              cell: "relative h-8 p-0 text-center sm:h-10",
              day: "relative h-8 w-full rounded-md p-0 text-[11px] font-medium text-[hsl(30_20%_28%)] transition-colors hover:bg-[hsl(40_25%_90%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(30_28%_44%)] focus-visible:ring-inset aria-selected:opacity-100 sm:h-10 sm:text-xs",
              day_selected: "bg-[hsl(30_28%_44%)] text-[hsl(40_30%_95%)] shadow-sm hover:bg-[hsl(30_28%_44%)] hover:text-[hsl(40_30%_95%)]",
              day_today: "border border-[hsl(30_28%_44%/0.45)] bg-[hsl(40_25%_90%)] text-[hsl(30_20%_28%)]",
              day_disabled: "cursor-not-allowed text-[hsl(30_15%_42%)] opacity-30 hover:bg-transparent",
              day_hidden: "invisible",
            }}
          />

          <div className="mt-2 flex items-start gap-2 border-t pt-2 text-[9px] leading-4 sm:mt-3 sm:items-center sm:pt-3 sm:text-[10px]" style={{ borderColor: theme.border, color: theme.mutedText }}>
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: theme.text }} aria-hidden />
            <span>The date will become your yearly Together Since anniversary.</span>
          </div>
        </div>

        <DialogFooter className="grid grid-cols-2 gap-2 border-t px-4 py-2.5 sm:grid-cols-2 sm:px-5 sm:py-3" style={{ background: theme.softSurface, borderColor: theme.border }}>
          <Button type="button" variant="ghost" className="h-9 text-xs hover:bg-black/5 sm:text-sm" style={{ color: theme.text }} onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button type="button" className="h-9 min-w-0 gap-1.5 px-2 text-xs hover:brightness-110 sm:px-4 sm:text-sm" style={{ background: theme.actionBackground, color: theme.actionText }} onClick={onConfirm} disabled={confirmDisabled || isPending}>
            {isPending ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin sm:h-4 sm:w-4" aria-hidden /> : <Heart className="h-3.5 w-3.5 shrink-0 fill-current sm:h-4 sm:w-4" aria-hidden />}
            <span className="sm:hidden">Save date</span>
            <span className="hidden whitespace-nowrap sm:inline">Save our beginning</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
