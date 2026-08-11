import { useState, useMemo, useCallback } from "react";
import { useMilestones, useAddMilestone, useDeleteMilestone, Milestone } from "@/hooks/useMilestones";
import { useMedia, getPublicUrl } from "@/hooks/useMedia";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import {
  Plus, Heart, Star, Calendar as CalendarIcon,
  List, Image, AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { MilestoneCalendar } from "@/components/MilestoneCalendar";
import { AnniversaryCard } from "@/components/Anniversarycard";
import { MilestoneTimelineCard } from "@/components/Milestonetimelinecard";
import { DeleteConfirmDialog } from "@/components/Deleteconfirmdialog";
import {
  daysUntil,
  MilestoneType,
  MediaMap,
} from "@/lib/Milestoneutils";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface AddForm {
  title: string;
  date: string;
  description: string;
  // FIX: typed using shared MilestoneType instead of inline string union
  type: MilestoneType;
  media_id: string | null;
}

// FIX: factory function avoids shared-reference mutation bugs
const makeDefaultForm = (): AddForm => ({
  title: "",
  date: "",
  description: "",
  type: "milestone",
  media_id: null,
});

// ─── Main View ─────────────────────────────────────────────────────────────────

type ViewMode = "list" | "calendar";

interface PendingDelete {
  id: string;
  title: string;
}

export function AnniversariesView() {
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: milestones = [], isLoading } = useMilestones();
  const { data: allMedia = [], isLoading: mediaLoading } = useMedia();
  const addMilestone = useAddMilestone();
  const deleteMilestone = useDeleteMilestone();

  // ── UI state ──────────────────────────────────────────────────────────────
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<AddForm>(makeDefaultForm);
  const [pickMedia, setPickMedia] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);

  // ── Memoized derived data ─────────────────────────────────────────────────

  // FIX: mediaMap memoized — no longer rebuilt on every render
  const mediaMap = useMemo<MediaMap>(
    () => Object.fromEntries(allMedia.map((x) => [x.id, x])),
    [allMedia]
  );

  // FIX: both filtered/sorted lists memoized
  const anniversaries = useMemo(
    () =>
      milestones
        .filter((m) => m.type === "anniversary")
        .map((m) => ({ milestone: m, days: daysUntil(m.date) }))
        .sort((a, b) => a.days - b.days),
    [milestones]
  );

  const milestoneList = useMemo(
    () =>
      milestones
        .filter((m) => m.type === "milestone")
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [milestones]
  );

  // FIX: mediaImages memoized — filtered once, not on every render
  const mediaImages = useMemo(
    () => allMedia.filter((m) => m.file_type === "image"),
    [allMedia]
  );

  // ── Handlers ──────────────────────────────────────────────────────────────

  // FIX: form reset on close, not just on successful submit
  const handleOpenAdd = useCallback(() => {
    setForm(makeDefaultForm());
    setShowAdd(true);
  }, []);

  const handleCloseAdd = useCallback(() => {
    setShowAdd(false);
    // Reset form + close any sub-popovers cleanly
    setForm(makeDefaultForm());
    setDatePickerOpen(false);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.date) return;

    try {
      await addMilestone.mutateAsync({
        ...form,
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        media_id: form.media_id,
      });
      handleCloseAdd();
      toast({ title: "✅ Milestone saved!" });
    } catch {
      // FIX: surface mutation errors to the user
      toast({
        title: "Failed to save milestone",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  // FIX: delete now requires confirmation — no immediate fire
  const handleDeleteRequest = useCallback((id: string, title: string) => {
    setPendingDelete({ id, title });
  }, []);

  const handleDeleteConfirm = async () => {
    if (!pendingDelete) return;
    try {
      await deleteMilestone.mutateAsync(pendingDelete.id);
      toast({ title: "Milestone deleted." });
    } catch {
      toast({
        title: "Failed to delete",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setPendingDelete(null);
    }
  };

  const handleDateSelect = useCallback((d: Date | undefined) => {
    if (!d) return;
    setForm((f) => ({ ...f, date: format(d, "yyyy-MM-dd") }));
    setDatePickerOpen(false);
  }, []);

  const handleMediaSelect = useCallback((id: string) => {
    setForm((f) => ({ ...f, media_id: id }));
    setPickMedia(false);
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold font-heading gradient-text">Our Milestones</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Anniversaries, special moments &amp; countdowns
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* View mode toggle */}
          <div
            className="flex items-center gap-0.5 bg-muted/60 rounded-lg p-1 border border-border/50"
            role="group"
            aria-label="View mode"
          >
            {(["list", "calendar"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                aria-pressed={viewMode === mode}
                aria-label={`${mode} view`}
                className={cn(
                  "h-7 w-7 rounded-md flex items-center justify-center transition-all",
                  viewMode === mode
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {mode === "list"
                  ? <List className="h-3.5 w-3.5" aria-hidden />
                  : <CalendarIcon className="h-3.5 w-3.5" aria-hidden />
                }
              </button>
            ))}
          </div>

          <Button onClick={handleOpenAdd} size="sm" className="gap-1.5 h-8 px-3 font-medium">
            <Plus className="h-3.5 w-3.5" aria-hidden />
            <span className="hidden sm:inline">Add</span>
          </Button>
        </div>
      </div>

      {/* Calendar view */}
      {viewMode === "calendar" && (
        <MilestoneCalendar milestones={milestones} mediaMap={mediaMap} />
      )}

      {/* List view */}
      {viewMode === "list" && (
        <div className="space-y-8">
          {/* Anniversaries section */}
          {anniversaries.length > 0 && (
            <section aria-label="Anniversaries" className="space-y-3">
              <SectionHeader
                icon={<Heart className="h-3.5 w-3.5 text-primary fill-primary" />}
                iconBg="bg-primary/10"
                label="Anniversaries"
                count={anniversaries.length}
              />
              <div className="space-y-2.5">
                {anniversaries.map(({ milestone, days }) => (
                  <AnniversaryCard
                    key={milestone.id}
                    milestone={milestone}
                    days={days}
                    mediaMap={mediaMap}
                    canDelete={milestone.created_by === user?.id}
                    onDelete={() => handleDeleteRequest(milestone.id, milestone.title)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Milestones / special moments section */}
          {milestoneList.length > 0 && (
            <section aria-label="Special moments" className="space-y-3">
              <SectionHeader
                icon={<Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />}
                iconBg="bg-amber-500/10"
                label="Special Moments"
                count={milestoneList.length}
              />
              <div className="relative pl-6">
                {/* Vertical timeline line — scoped to this container */}
                <div className="absolute left-2 top-2 bottom-2 w-px bg-border/60" aria-hidden />
                <div className="space-y-3">
                  {milestoneList.map((m, i) => (
                    <MilestoneTimelineCard
                      key={m.id}
                      milestone={m}
                      mediaMap={mediaMap}
                      isLast={i === milestoneList.length - 1}
                      canDelete={m.created_by === user?.id}
                      onDelete={() => handleDeleteRequest(m.id, m.title)}
                    />
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Empty state */}
          {!isLoading && milestones.length === 0 && <EmptyState onAdd={handleOpenAdd} />}
        </div>
      )}

      {/* ── Add milestone dialog ─────────────────────────────────────────── */}
      <Dialog open={showAdd} onOpenChange={(open) => { if (!open) handleCloseAdd(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-base">Add milestone</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Type selector */}
            <div className="grid grid-cols-2 gap-2" role="group" aria-label="Milestone type">
              {(["anniversary", "milestone"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, type: t }))}
                  aria-pressed={form.type === t}
                  className={cn(
                    "py-2.5 px-3 rounded-lg text-sm font-medium border transition-all",
                    form.type === t
                      ? "bg-primary/10 border-primary/50 text-primary"
                      : "bg-muted/30 border-border/50 text-muted-foreground hover:border-primary/30 hover:text-foreground"
                  )}
                >
                  {t === "anniversary" ? "💑 Anniversary" : "⭐ Milestone"}
                </button>
              ))}
            </div>

            {/* Title */}
            <div className="space-y-1.5">
              <label htmlFor="milestone-title" className="text-xs text-muted-foreground">
                Title <span className="text-destructive">*</span>
              </label>
              <Input
                id="milestone-title"
                placeholder="First Date, Proposal…"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                required
                autoComplete="off"
              />
            </div>

            {/* Date picker */}
            <div className="space-y-1.5">
              <label
                htmlFor="milestone-date-trigger"
                className="text-xs text-muted-foreground flex items-center gap-1"
              >
                <CalendarIcon className="h-3 w-3" aria-hidden />
                Date <span className="text-destructive">*</span>
              </label>
              <Popover
                open={datePickerOpen}
                onOpenChange={setDatePickerOpen}
              >
                <PopoverTrigger asChild>
                  <button
                    id="milestone-date-trigger"
                    type="button"
                    className={cn(
                      "w-full flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm text-left transition-colors hover:border-primary/50 focus:outline-none focus:ring-1 focus:ring-ring",
                      !form.date && "text-muted-foreground"
                    )}
                    aria-label={form.date ? `Selected date: ${form.date}` : "Pick a date"}
                  >
                    <CalendarIcon className="h-4 w-4 shrink-0 opacity-50" aria-hidden />
                    {form.date
                      ? format(new Date(form.date + "T00:00:00"), "MMMM d, yyyy")
                      : "Pick a date"}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-50" align="start">
                  <Calendar
                    mode="single"
                    selected={form.date ? new Date(form.date + "T00:00:00") : undefined}
                    onSelect={handleDateSelect}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Description */}
            <Textarea
              placeholder="Description (optional)"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={2}
            />

            {/* Attach photo */}
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Image className="h-3 w-3" aria-hidden /> Attach a photo
              </p>
              {form.media_id ? (
                <SelectedPhoto
                  src={getPublicUrl(allMedia.find((m) => m.id === form.media_id)?.file_path ?? "")}
                  onRemove={() => setForm((f) => ({ ...f, media_id: null }))}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setPickMedia(true)}
                  className="border border-dashed border-border/70 rounded-lg px-4 py-3 text-xs text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors w-full"
                >
                  Pick from vault
                </button>
              )}
            </div>

            {/* FIX: show mutation error inline */}
            {addMilestone.isError && (
              <p className="text-xs text-destructive flex items-center gap-1.5" role="alert">
                <AlertCircle className="h-3.5 w-3.5" aria-hidden />
                Failed to save — please try again.
              </p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="ghost" size="sm" onClick={handleCloseAdd}>
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={addMilestone.isPending || !form.title.trim() || !form.date}
              >
                {addMilestone.isPending ? "Saving…" : "Save milestone"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Media picker dialog ──────────────────────────────────────────── */}
      <Dialog open={pickMedia} onOpenChange={setPickMedia}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading text-base">Pick a photo</DialogTitle>
          </DialogHeader>

          {/* FIX: show loading state from useMedia */}
          {mediaLoading ? (
            <div className="flex items-center justify-center py-10">
              <span className="text-sm text-muted-foreground animate-pulse">Loading photos…</span>
            </div>
          ) : mediaImages.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">No photos yet</p>
          ) : (
            <div className="grid grid-cols-4 gap-2 max-h-72 overflow-y-auto">
              {mediaImages.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleMediaSelect(m.id)}
                  aria-pressed={form.media_id === m.id}
                  aria-label={m.title || "Select photo"}
                  className={cn(
                    "aspect-square rounded-lg overflow-hidden border-2 transition-all hover:scale-105",
                    form.media_id === m.id ? "border-primary" : "border-transparent"
                  )}
                >
                  <img
                    src={getPublicUrl(m.file_path)}
                    alt={m.title}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation ──────────────────────────────────────────── */}
      <DeleteConfirmDialog
        open={!!pendingDelete}
        title={`Delete "${pendingDelete?.title}"?`}
        description="This milestone will be permanently removed and cannot be recovered."
        onConfirm={handleDeleteConfirm}
        onCancel={() => setPendingDelete(null)}
        isPending={deleteMilestone.isPending}
      />
    </div>
  );
}

// ─── Small leaf components ─────────────────────────────────────────────────────

function SectionHeader({
  icon,
  iconBg,
  label,
  count,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  count: number;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center", iconBg)}>
        {icon}
      </div>
      <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </h3>
      <div className="flex-1 h-px bg-border/50" aria-hidden />
      <span className="text-xs text-muted-foreground/60" aria-label={`${count} items`}>
        {count}
      </span>
    </div>
  );
}

function SelectedPhoto({
  src,
  onRemove,
}: {
  src: string;
  onRemove: () => void;
}) {
  return (
    <div className="relative w-20 h-20">
      <img
        src={src}
        alt="Selected photo"
        className="w-full h-full object-cover rounded-lg border border-border/50"
      />
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove selected photo"
        className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center shadow-sm"
      >
        ×
      </button>
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
      <div className="h-16 w-16 rounded-2xl bg-primary/8 border border-primary/15 flex items-center justify-center">
        <Heart className="h-7 w-7 text-primary/40" aria-hidden />
      </div>
      <div>
        <p className="font-semibold font-heading text-foreground">No milestones yet</p>
        <p className="text-sm text-muted-foreground mt-1">
          Add your first anniversary or a special moment to remember.
        </p>
      </div>
      <Button onClick={onAdd} size="sm" className="gap-1.5 mt-1">
        <Plus className="h-3.5 w-3.5" aria-hidden /> Add your first milestone
      </Button>
    </div>
  );
}