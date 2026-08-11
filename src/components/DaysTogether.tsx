import { useState, useCallback } from "react";
import { Heart, CalendarDays, Pencil } from "lucide-react";
import { differenceInDays, format, parseISO, isValid } from "date-fns";
import { useMilestones, useAddMilestone, useUpdateMilestone } from "@/hooks/useMilestones";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const C = {
  bg: "linear-gradient(135deg, hsl(40 30% 88%) 0%, hsl(36 25% 82%) 100%)",
  border: "hsl(36 20% 70% / 0.6)",
  iconBg: "linear-gradient(135deg, hsl(36 25% 75%), hsl(30 20% 68%))",
  num: "hsl(30 20% 28%)",
  label: "hsl(30 15% 42%)",
  btnBg: "linear-gradient(135deg, hsl(30 28% 44%), hsl(36 22% 52%))",
} as const;

export function DaysTogether() {
  const { data: milestones = [] } = useMilestones();
  const addMilestone = useAddMilestone();
  const updateMilestone = useUpdateMilestone();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const startMilestone = milestones.find(
    m => m.type === "anniversary" && m.title === "Together Since"
  );

  const [dateInput, setDateInput] = useState(startMilestone?.date ?? "");
  const parsedDate = startMilestone?.date ? parseISO(startMilestone.date) : null;
  const validDate = parsedDate && isValid(parsedDate) ? parsedDate : null;
  const days = validDate ? differenceInDays(new Date(), validDate) : null;
  const years = days !== null ? (days / 365).toFixed(1) : null;
  const isPending = addMilestone.isPending || updateMilestone.isPending;

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (next) setDateInput(startMilestone?.date ?? "");
      setOpen(next);
    },
    [startMilestone?.date]
  );

  const handleSave = useCallback(async () => {
    if (!dateInput || isPending) return;
    const parsed = parseISO(dateInput);
    if (!isValid(parsed) || parsed > new Date()) {
      toast({ title: "Invalid date", variant: "destructive" });
      return;
    }
    try {
      if (startMilestone) {
        await updateMilestone.mutateAsync({ id: startMilestone.id, date: dateInput });
      } else {
        await addMilestone.mutateAsync({
          title: "Together Since",
          date: dateInput,
          type: "anniversary",
          description: "The day our story began 💕",
        });
      }
      toast({ title: "💕 Saved!" });
      setOpen(false);
    } catch {
      toast({ title: "Failed to save", variant: "destructive" });
    }
  }, [dateInput, isPending, startMilestone, addMilestone, updateMilestone, toast]);

  return (
    <div className="w-full">
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="w-full text-left group rounded-lg transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
            style={{
              background: C.bg,
              border: `1px solid ${C.border}`,
              padding: "8px 10px", // Reduced from 12-14px
            }}
          >
            {days !== null && validDate ? (
              <div className="flex items-center justify-between gap-2">
                {/* Compact icon */}
                <div
                  className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: C.iconBg }}
                >
                  <Heart className="h-3.5 w-3.5 fill-current" style={{ color: C.num }} />
                </div>

                {/* Inline day count + date */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-lg font-bold tabular-nums" style={{ color: C.num }}>
                      {days.toLocaleString()}
                    </span>
                    <span className="text-[10px] font-medium" style={{ color: C.label }}>
                      days
                    </span>
                    {years && (
                      <span className="text-[10px]" style={{ color: C.label }}>
                        · {years}yr
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <CalendarDays className="h-2.5 w-2.5" style={{ color: C.label }} />
                    <span className="text-[10px] truncate" style={{ color: C.label }}>
                      Since {format(validDate, "MMM d, yyyy")}
                    </span>
                  </div>
                </div>

                {/* Edit icon */}
                <Pencil
                  className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity shrink-0"
                  style={{ color: C.label }}
                />
              </div>
            ) : (
              // Compact empty state
              <div className="flex items-center gap-2.5">
                <div
                  className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: C.iconBg }}
                >
                  <Heart className="h-3.5 w-3.5" style={{ color: C.num }} />
                </div>
                <span className="text-sm font-semibold" style={{ color: C.num }}>
                  Set start date 💕
                </span>
              </div>
            )}
          </button>
        </PopoverTrigger>

        <PopoverContent
          side="top"
          sideOffset={6}
          className="w-[280px] p-3 shadow-xl border-0"
          style={{ background: "hsl(40 30% 96%)", border: `1px solid ${C.border}` }}
        >
          <p className="text-xs font-semibold mb-2" style={{ color: C.num }}>
            {days !== null ? "Change start date" : "When did you get together?"}
          </p>

          <Input
            type="date"
            value={dateInput}
            onChange={e => setDateInput(e.target.value)}
            max={new Date().toISOString().split("T")[0]}
            className="h-9 text-sm border-0 focus-visible:ring-1 mb-2"
            style={{ background: "hsl(40 25% 90%)", color: C.num, borderRadius: "0.5rem" }}
          />

          <button
            type="button"
            onClick={handleSave}
            disabled={!dateInput || isPending || dateInput === startMilestone?.date}
            className="w-full h-8 rounded-lg flex items-center justify-center gap-1.5 text-xs font-semibold transition-all active:scale-[0.97] disabled:opacity-50"
            style={{ background: C.btnBg, color: "hsl(40 30% 95%)" }}
          >
            {isPending ? (
              <span className="h-3 w-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
            ) : (
              <Heart className="h-3 w-3 fill-current" />
            )}
            {startMilestone ? "Save" : "Set Date"}
          </button>
        </PopoverContent>
      </Popover>
    </div>
  );
}