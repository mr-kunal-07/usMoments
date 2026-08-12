import { lazy, Suspense, useCallback, useMemo, useState } from "react";
import { CalendarDays, Heart, Pencil } from "lucide-react";
import { differenceInCalendarDays, format, isValid, parseISO, startOfDay } from "date-fns";
import { useMilestones, useAddMilestone, useUpdateMilestone } from "@/hooks/useMilestones";
import { useToast } from "@/hooks/useToast";
import { relationshipDateTheme as theme } from "@/components/couples/relationshipDateTheme";

const START_MILESTONE_TITLE = "Together Since";
const loadRelationshipDatePicker = () => import("@/components/couples/RelationshipDatePicker");
const RelationshipDatePicker = lazy(() =>
  loadRelationshipDatePicker().then((module) => ({ default: module.RelationshipDatePicker })),
);

function parseMilestoneDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : undefined;
}

export function DaysTogether() {
  const { data: milestones = [] } = useMilestones();
  const addMilestone = useAddMilestone();
  const updateMilestone = useUpdateMilestone();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [draftDate, setDraftDate] = useState<Date>();

  const startMilestone = milestones.find(
    (milestone) => milestone.type === "anniversary" && milestone.title === START_MILESTONE_TITLE,
  );
  const savedDate = useMemo(() => parseMilestoneDate(startMilestone?.date), [startMilestone?.date]);
  const daysTogether = savedDate
    ? Math.max(0, differenceInCalendarDays(startOfDay(new Date()), startOfDay(savedDate)))
    : null;
  const isPending = addMilestone.isPending || updateMilestone.isPending;

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    if (nextOpen) setDraftDate(savedDate);
    setOpen(nextOpen);
  }, [savedDate]);

  const handleSave = useCallback(async () => {
    if (!draftDate || isPending) return;

    const today = startOfDay(new Date());
    const selectedDate = startOfDay(draftDate);
    if (!isValid(selectedDate) || selectedDate > today) {
      toast({ title: "Choose today or an earlier date", variant: "destructive" });
      return;
    }

    const date = format(selectedDate, "yyyy-MM-dd");
    try {
      if (startMilestone) {
        await updateMilestone.mutateAsync({ id: startMilestone.id, date });
      } else {
        await addMilestone.mutateAsync({
          title: START_MILESTONE_TITLE,
          date,
          type: "anniversary",
          description: "The day our story began",
        });
      }
      toast({ title: "Your beginning is saved" });
      setOpen(false);
    } catch {
      toast({ title: "Could not save the date", variant: "destructive" });
    }
  }, [addMilestone, draftDate, isPending, startMilestone, toast, updateMilestone]);

  const hasChanged = draftDate
    ? format(draftDate, "yyyy-MM-dd") !== startMilestone?.date
    : false;

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => handleOpenChange(true)}
        onPointerEnter={() => void loadRelationshipDatePicker()}
        onFocus={() => void loadRelationshipDatePicker()}
        className="group relative w-full overflow-hidden rounded-md px-3 py-2.5 text-left transition-[filter,transform] hover:brightness-[1.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(30_28%_44%)] focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar active:scale-[0.99]"
        style={{ background: theme.tileBackground, border: `1px solid ${theme.border}` }}
        aria-label={savedDate ? "Edit your relationship start date" : "Set your relationship start date"}
      >
        <span className="absolute inset-y-0 left-0 w-0.5" style={{ background: theme.mutedText }} aria-hidden />
        {savedDate && daysTogether !== null ? (
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md shadow-sm" style={{ background: theme.iconBackground, color: theme.text }}>
              <Heart className="h-4 w-4 fill-current" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline gap-1.5">
                <span className="text-lg font-bold tabular-nums leading-none" style={{ color: theme.text }}>
                  {daysTogether.toLocaleString()}
                </span>
                <span className="text-[10px] font-semibold uppercase" style={{ color: theme.mutedText }}>days together</span>
              </span>
              <span className="mt-1 flex items-center gap-1 text-[10px]" style={{ color: theme.mutedText }}>
                <CalendarDays className="h-3 w-3" aria-hidden />
                <span className="truncate">Our story began {format(savedDate, "MMM d, yyyy")}</span>
              </span>
            </span>
            <Pencil
              className="h-3.5 w-3.5 shrink-0 opacity-55 transition-opacity group-hover:opacity-100"
              style={{ color: theme.mutedText }}
              aria-hidden
            />
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md shadow-sm" style={{ background: theme.iconBackground, color: theme.text }}>
              <Heart className="h-4 w-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold" style={{ color: theme.text }}>Mark your day one</span>
              <span className="mt-0.5 block truncate text-[10px]" style={{ color: theme.mutedText }}>
                Add where your story began
              </span>
            </span>
            <CalendarDays className="h-3.5 w-3.5 shrink-0" style={{ color: theme.text }} aria-hidden />
          </div>
        )}
      </button>

      {open && (
        <Suspense fallback={null}>
          <RelationshipDatePicker
            open={open}
            onOpenChange={handleOpenChange}
            selected={draftDate}
            onSelect={setDraftDate}
            onConfirm={handleSave}
            isPending={isPending}
            confirmDisabled={!draftDate || !hasChanged}
          />
        </Suspense>
      )}
    </div>
  );
}
