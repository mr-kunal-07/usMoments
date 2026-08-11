import { useRef, useState, useCallback, useId } from "react";
import { toPng } from "html-to-image";
import {
  Download, Share2, Palette, Loader2, Heart, Sparkles,
  Settings2, Save, Check, X, Camera, Film,
  Flower2, Zap, Feather, BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useProfile, useAllProfiles } from "@/hooks/useProfile";
import { useMyCouple } from "@/hooks/useCouple";
import { useAuth } from "@/hooks/useAuth";
import { useMilestones } from "@/hooks/useMilestones";
import { useMedia } from "@/hooks/useMedia";
import { useMessages } from "@/hooks/useMessages";
import {
  LoveStoryCard,
  TemplateId, Customization, DEFAULT_CUSTOMIZATION,
  PALETTES, TEMPLATE_META,
} from "@/components/LoveStoryCard";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// ─── Constants ─────────────────────────────────────────────────────────────────

const STORAGE_PREFIX = "usMoments_love_story_";

export const ALL_TEMPLATES: TemplateId[] = [
  "eternal", "polaroid", "bold", "cinema", "bloom", "neon", "wabi", "journal",
];

type ExportMode = "png" | "story" | "post";

const EXPORT_ACTIONS: {
  mode: ExportMode; label: string;
  Icon: React.ElementType; variant: "default" | "outline";
}[] = [
    { mode: "png", label: "Save", Icon: Download, variant: "default" },
    { mode: "story", label: "Story", Icon: Share2, variant: "outline" },
    { mode: "post", label: "Post", Icon: Share2, variant: "outline" },
  ];

// ─── Storage ───────────────────────────────────────────────────────────────────

function loadCustomization(id: TemplateId): Customization {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + id);
    if (raw) return { ...DEFAULT_CUSTOMIZATION, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULT_CUSTOMIZATION, paletteId: PALETTES[id][0].id };
}

function saveCustomization(id: TemplateId, c: Customization): void {
  localStorage.setItem(STORAGE_PREFIX + id, JSON.stringify(c));
}

function buildInitialCustomizations(): Record<TemplateId, Customization> {
  return Object.fromEntries(
    ALL_TEMPLATES.map((t) => [t, loadCustomization(t)])
  ) as Record<TemplateId, Customization>;
}

function triggerDownload(dataUrl: string, filename: string): void {
  const a = document.createElement("a");
  a.download = filename;
  a.href = dataUrl;
  a.click();
}

// ─── TemplateChip ──────────────────────────────────────────────────────────────

function TemplateChip({ templateId, isActive, onClick }: {
  templateId: TemplateId; isActive: boolean; onClick: () => void;
}) {
  const meta = TEMPLATE_META[templateId];
  const palette = PALETTES[templateId][0];
  return (
    <button
      onClick={onClick}
      aria-pressed={isActive}
      aria-label={`Select ${meta.label} template`}
      className={cn(
        "relative flex-shrink-0 flex flex-col items-center gap-1.5 rounded-2xl border-2 transition-all duration-200",
        "w-[68px] sm:w-[76px] p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        isActive
          ? "border-primary bg-primary/5 shadow-md scale-[1.05]"
          : "border-border/50 bg-card hover:border-border hover:bg-muted/40 active:scale-95"
      )}
    >
      <div
        className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center overflow-hidden"
        style={{ background: palette.bg }}
        aria-hidden
      >
        <span className="text-base sm:text-lg leading-none">{meta.emoji}</span>
      </div>
      <span className={cn(
        "text-[9px] sm:text-[10px] font-semibold leading-none truncate w-full text-center",
        isActive ? "text-primary" : "text-muted-foreground"
      )}>
        {meta.label}
      </span>
      {isActive && (
        <span className="absolute -top-1 -right-1 h-4 w-4 bg-primary rounded-full flex items-center justify-center shadow-sm">
          <Check className="h-2.5 w-2.5 text-primary-foreground" />
        </span>
      )}
    </button>
  );
}

// ─── PaletteSwatch ─────────────────────────────────────────────────────────────

function PaletteSwatch({ palette, isActive, onSelect }: {
  palette: { id: string; label: string; swatch: string };
  isActive: boolean; onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      aria-pressed={isActive}
      aria-label={`Select ${palette.label}`}
      title={palette.label}
      className={cn(
        "h-8 w-8 rounded-xl border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        isActive ? "border-primary scale-110 shadow-md" : "border-transparent hover:scale-105 hover:border-border"
      )}
      style={{ background: palette.swatch }}
    />
  );
}

// ─── CustomizePanel ────────────────────────────────────────────────────────────

interface CustomizePanelProps {
  activeTemplate: TemplateId;
  custom: Customization;
  defaultTitle: string;
  fallbackDate: string;
  saved: boolean;
  onPatch: (p: Partial<Customization>) => void;
  onSave: () => void;
  isDrawer?: boolean;
  onClose?: () => void;
}

function CustomizePanel({
  activeTemplate, custom, defaultTitle, fallbackDate,
  saved, onPatch, onSave, isDrawer, onClose,
}: CustomizePanelProps) {
  const id = useId();
  const palettes = PALETTES[activeTemplate];
  const activePalId = custom.paletteId || palettes[0].id;
  const activeLabel = palettes.find((x) => x.id === activePalId)?.label;

  const TOGGLES = [
    { key: "showStats" as const, label: "Stats", desc: "Days, photos, messages" },
    { key: "showTimeline" as const, label: "Timeline", desc: "Milestones & anniversaries" },
  ];

  return (
    <div id={id} className={cn("space-y-3", isDrawer && "px-4 pb-8")}>
      {isDrawer && (
        <div className="flex items-center justify-between py-3 sticky top-0 bg-background/95 backdrop-blur-sm z-10 border-b border-border">
          <div className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-muted-foreground" aria-hidden />
            <span className="text-sm font-semibold">Customize</span>
          </div>
          {onClose && (
            <button onClick={onClose} aria-label="Close"
              className="h-7 w-7 rounded-full flex items-center justify-center bg-muted hover:bg-muted/70 transition-colors">
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}
        </div>
      )}

      {/* Palette */}
      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Palette className="h-4 w-4 text-muted-foreground" aria-hidden />
          <span className="text-sm font-semibold">Color Palette</span>
        </div>
        <div className="flex gap-2 flex-wrap">
          {palettes.map((p) => (
            <PaletteSwatch key={p.id} palette={p} isActive={activePalId === p.id} onSelect={() => onPatch({ paletteId: p.id })} />
          ))}
        </div>
        {activeLabel && <p className="text-xs text-muted-foreground mt-2">{activeLabel}</p>}
      </section>

      {/* Text */}
      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <Heart className="h-4 w-4 text-primary fill-primary" aria-hidden />
          <span className="text-sm font-semibold">Text</span>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="couple-title" className="text-xs text-muted-foreground">Couple Title</Label>
          <Input id="couple-title" value={custom.title} onChange={(e) => onPatch({ title: e.target.value })} placeholder={defaultTitle} className="h-9 text-sm" />
          <p className="text-[10px] text-muted-foreground">Leave blank to use partner names</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tagline" className="text-xs text-muted-foreground">Tagline / Quote</Label>
          <Input id="tagline" value={custom.tagline} onChange={(e) => onPatch({ tagline: e.target.value })} placeholder="Forever and always ❤️" className="h-9 text-sm" />
        </div>
      </section>

      {/* Date */}
      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-2">
        <span className="text-sm font-semibold">Together Since</span>
        <input type="date" id="together-since"
          value={custom.startDate || fallbackDate}
          onChange={(e) => onPatch({ startDate: e.target.value })}
          className="w-full h-9 rounded-lg border border-border bg-background text-foreground text-sm px-3 focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        <p className="text-[10px] text-muted-foreground">Override the "Together since" date</p>
      </section>

      {/* Toggles */}
      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-3">
        <span className="text-sm font-semibold">Sections</span>
        {TOGGLES.map(({ key, label, desc }) => (
          <div key={key} className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm">{label}</p>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
            <Switch checked={custom[key]} onCheckedChange={(v) => onPatch({ [key]: v })} aria-label={`Toggle ${label}`} />
          </div>
        ))}
      </section>

      <Button onClick={onSave} className="w-full gap-2" variant={saved ? "secondary" : "default"}>
        {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
        {saved ? "Saved!" : "Save Customization"}
      </Button>
      <p className="text-[10px] text-muted-foreground text-center">Each template saves separately across sessions.</p>
    </div>
  );
}

// ─── ExportRow ─────────────────────────────────────────────────────────────────

function ExportRow({ exporting, onExport }: { exporting: boolean; onExport: (m: ExportMode) => void }) {
  return (
    <>
      {EXPORT_ACTIONS.map(({ mode, label, Icon, variant }) => (
        <Button key={mode} onClick={() => onExport(mode)} disabled={exporting}
          variant={variant} size="sm" aria-label={`${label} card`}
          className="gap-1.5 flex-1 h-10 text-xs rounded-xl">
          {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
          {label}
        </Button>
      ))}
    </>
  );
}

// ─── LoveStoryView ─────────────────────────────────────────────────────────────

export function LoveStoryView() {
  const cardRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const { user } = useAuth();
  const { data: myProfile } = useProfile();
  const { data: profiles = [] } = useAllProfiles();
  const { data: couple } = useMyCouple();
  const { data: milestones = [] } = useMilestones();
  const { data: media = [] } = useMedia();
  const { data: messages = [] } = useMessages();

  const [activeTemplate, setActiveTemplate] = useState<TemplateId>("eternal");
  const [customizations, setCustomizations] = useState<Record<TemplateId, Customization>>(buildInitialCustomizations);
  const [saved, setSaved] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const partnerId = couple?.status === "active"
    ? (couple.user1_id === user?.id ? couple.user2_id : couple.user1_id) : null;
  const partnerProfile = partnerId ? (profiles.find((p) => p.user_id === partnerId) ?? null) : null;
  const custom = customizations[activeTemplate];
  const myName = myProfile?.display_name ?? "You";
  const partnerName = partnerProfile?.display_name ?? "Partner";
  const defaultTitle = `${myName} ❤️ ${partnerName}`;
  const fallbackDate = couple?.created_at?.slice(0, 10) ?? "";

  const patchCustomization = useCallback((patch: Partial<Customization>) => {
    setCustomizations((prev) => ({ ...prev, [activeTemplate]: { ...prev[activeTemplate], ...patch } }));
    setSaved(false);
  }, [activeTemplate]);

  const handleSave = useCallback(() => {
    saveCustomization(activeTemplate, custom);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    toast({ title: "✅ Saved!" });
  }, [activeTemplate, custom, toast]);

  const handleSelectTemplate = useCallback((t: TemplateId) => {
    setActiveTemplate(t);
    setSaved(false);
  }, []);

  const handleExport = useCallback(async (mode: ExportMode) => {
    if (!cardRef.current) return;
    setExporting(true);
    try {
      const dataUrl = await toPng(cardRef.current, { cacheBust: true, pixelRatio: 3, style: { borderRadius: "28px" } });
      if (mode === "png") {
        triggerDownload(dataUrl, `usMoments-love-story-${activeTemplate}.png`);
        toast({ title: "💾 Downloaded!" });
        return;
      }
      const blob = await fetch(dataUrl).then((r) => r.blob());
      const file = new File([blob], "love-story.png", { type: "image/png" });
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "Our Love Story ❤️" });
        toast({ title: "Shared!" });
      } else {
        triggerDownload(dataUrl, mode === "story" ? "love-story-story.png" : "love-story-post.png");
        toast({ title: "Downloaded", description: `Open Instagram → ${mode === "story" ? "Story" : "Post"} → select image.` });
      }
    } catch { toast({ title: "Export failed", variant: "destructive" }); }
    finally { setExporting(false); }
  }, [activeTemplate, toast]);

  const panelProps = { activeTemplate, custom, defaultTitle, fallbackDate, saved, onPatch: patchCustomization, onSave: handleSave };

  return (
    <div className="min-h-full bg-background flex flex-col">

      {/* Header */}
      <header className="px-2 sm:px-6 pt-3 pb-2 max-w-6xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-primary" aria-hidden />
          <h1 className="text-lg sm:text-2xl font-bold font-heading tracking-tight">Love Story Card</h1>
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Choose a template, customize, and export.</p>
      </header>

      {/* Template carousel */}
      <nav aria-label="Template selection" className="max-w-6xl mx-auto w-full px-2 sm:px-6">
        <div
          className="flex gap-2 overflow-x-auto pb-2 pt-1 scrollbar-none"
          style={{ scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch" }}
          role="radiogroup"
        >
          {ALL_TEMPLATES.map((t) => (
            <div key={t} style={{ scrollSnapAlign: "start", flexShrink: 0 }}>
              <TemplateChip templateId={t} isActive={activeTemplate === t} onClick={() => handleSelectTemplate(t)} />
            </div>
          ))}
          <div className="w-1 flex-shrink-0" aria-hidden />
        </div>
      </nav>

      {/* Main layout */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-2 sm:px-6 pb-28 sm:pb-10 mt-3">
        <div className="flex flex-col lg:flex-row gap-5 lg:gap-8 items-start">

          {/* Card + export */}
          <div className="w-full lg:flex-1 flex flex-col items-center gap-4 min-w-0">
            <div
              className="w-full rounded-[28px] overflow-hidden"
              style={{
                maxWidth: 420,
                margin: "0 auto",
                filter: "drop-shadow(0 10px 20px rgba(0,0,0,0.10))",
              }}
            >
              <LoveStoryCard
                ref={cardRef}
                templateId={activeTemplate}
                customization={custom}
                myProfile={myProfile ?? null}
                partnerProfile={partnerProfile}
                coupleStartDate={couple?.created_at ?? null}
                milestones={milestones}
                photoCount={media.length}
                messageCount={messages.length}
              />
            </div>

            {/* Desktop export row */}
            <div className="hidden sm:flex gap-2 w-full" style={{ maxWidth: 420, margin: "0 auto" }}>
              <ExportRow exporting={exporting} onExport={handleExport} />
            </div>
          </div>

          {/* Desktop sidebar */}
          <aside className="hidden lg:block w-72 shrink-0" aria-label="Customization">
            <CustomizePanel {...panelProps} />
          </aside>
        </div>
      </main>

      {/* Mobile sticky bottom bar */}
      <div className="fixed bottom-0 mb-10 inset-x-0 z-30 lg:hidden bg-background/96 backdrop-blur-md border-t border-border">
        <div className="flex gap-2 px-4 py-3 max-w-xl mx-auto"
          style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}>
          <button onClick={() => setDrawerOpen(true)}
            className="flex items-center gap-1.5 px-3 h-10 rounded-xl border border-border bg-card text-xs font-semibold shrink-0 active:bg-muted/50 transition-colors">
            <Settings2 className="h-4 w-4 text-muted-foreground" aria-hidden />
            Style
          </button>
          <div className="flex gap-2 flex-1">
            <ExportRow exporting={exporting} onExport={handleExport} />
          </div>
        </div>
      </div>

      {/* Drawer backdrop */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setDrawerOpen(false)} aria-hidden />
      )}

      {/* Drawer panel */}
      <div role="dialog" aria-modal="true" aria-label="Customization panel"
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 lg:hidden bg-background rounded-t-3xl border-t border-border overflow-y-auto",
          "transition-transform duration-300 ease-out will-change-transform",
          drawerOpen ? "translate-y-0" : "translate-y-full"
        )}
        style={{ maxHeight: "88dvh" }}
      >
        <div className="flex justify-center pt-3">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/25" aria-hidden />
        </div>
        <CustomizePanel {...panelProps} isDrawer onClose={() => setDrawerOpen(false)} />
      </div>
    </div>
  );
}