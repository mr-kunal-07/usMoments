import { memo, useCallback, useEffect, useRef } from "react";
import { Check, Loader2, Lock, Palette, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { CHAT_THEMES, isThemeUnlocked, type ChatTheme } from "./chatThemes";
import { useChatTheme } from "@/hooks/useChatTheme";
import { usePlan } from "@/hooks/useSubscription";

interface Props {
  onClose: () => void;
  onUpgrade?: () => void;
}

interface ThemeSwatchProps {
  theme: ChatTheme;
  isActive: boolean;
  isLocked: boolean;
  isSaving: boolean;
  onSelect: (id: string) => void;
  onUpgrade?: () => void;
}

const ThemeSwatch = memo(function ThemeSwatch({
  theme,
  isActive,
  isLocked,
  isSaving,
  onSelect,
  onUpgrade,
}: ThemeSwatchProps) {
  const handleClick = useCallback(() => {
    if (isLocked) {
      onUpgrade?.();
      return;
    }
    onSelect(theme.id);
  }, [isLocked, onSelect, onUpgrade, theme.id]);

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={`${theme.name} theme${isLocked ? ", locked" : ""}${isActive ? ", selected" : ""}`}
      aria-pressed={isActive}
      className={cn(
        "group relative min-w-0 rounded-md border p-1.5 text-left transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        isActive
          ? "border-primary bg-primary/10"
          : "border-border/80 hover:border-primary/50 hover:bg-accent/20",
      )}
    >
      <div
        className={cn(
          "relative h-12 overflow-hidden rounded-md border border-black/5 transition-opacity sm:h-14",
          isLocked && "opacity-55",
        )}
        style={{ background: `hsl(${theme.light["wa-bg"]})` }}
        aria-hidden="true"
      >
        <div
          className="absolute inset-x-0 top-0 h-3.5 border-b border-black/5"
          style={{ background: `hsl(${theme.light["wa-header"]})` }}
        />
        <div
          className="absolute left-1.5 top-5 h-2.5 w-[48%] rounded-sm border border-black/5"
          style={{ background: `hsl(${theme.light["wa-bubble-in"]})` }}
        />
        <div
          className="absolute bottom-1.5 right-1.5 h-3 w-[58%] rounded-sm"
          style={{ background: `hsl(${theme.light["wa-bubble-out"]})` }}
        />
        <span
          className="absolute bottom-2.5 right-2.5 h-1 w-1 rounded-full"
          style={{ background: `hsl(${theme.light["wa-online"]})` }}
        />
      </div>

      <div className="mt-1.5 flex min-w-0 items-center gap-1.5">
        <span
          className="h-3 w-3 shrink-0 rounded-full border border-background shadow-sm"
          style={{ background: theme.swatch }}
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1 truncate text-[10px] font-semibold text-foreground sm:text-xs">
          {theme.name}
        </span>
        {isSaving ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" aria-label="Saving theme" />
        ) : isActive ? (
          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary" aria-hidden="true">
            <Check className="h-2.5 w-2.5 text-primary-foreground" />
          </span>
        ) : isLocked ? (
          <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        ) : null}
      </div>

      {theme.plan && (
        <span
          className="mt-0.5 block truncate text-[9px] font-medium text-muted-foreground"
          aria-hidden="true"
        >
          {theme.plan === "soulmate" ? "Soulmate plan" : "Dating plan"}
        </span>
      )}
    </button>
  );
});

function ThemeSection({
  title,
  description,
  themes,
  themeId,
  plan,
  isSaving,
  onSelect,
  onUpgrade,
}: {
  title: string;
  description: string;
  themes: ChatTheme[];
  themeId: string | null | undefined;
  plan: string;
  isSaving: boolean;
  onSelect: (id: string) => void;
  onUpgrade?: () => void;
}) {
  return (
    <section aria-labelledby={`theme-section-${title.toLowerCase()}`}>
      <div className="mb-2.5">
        <h3 id={`theme-section-${title.toLowerCase()}`} className="text-xs font-semibold text-foreground">
          {title}
        </h3>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{description}</p>
      </div>
      <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
        {themes.map((theme) => {
          const isActive = themeId === theme.id || (!themeId && theme.id === "default");
          return (
            <ThemeSwatch
              key={theme.id}
              theme={theme}
              isActive={isActive}
              isLocked={!isThemeUnlocked(theme, plan)}
              isSaving={isSaving && isActive}
              onSelect={onSelect}
              onUpgrade={onUpgrade}
            />
          );
        })}
      </div>
    </section>
  );
}

export const ChatThemePicker = memo(function ChatThemePicker({ onClose, onUpgrade }: Props) {
  const { themeId, setTheme, isSaving } = useChatTheme();
  const plan = usePlan();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousActiveElement = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousActiveElement?.focus();
    };
  }, [onClose]);

  const handleSelect = useCallback(async (id: string) => {
    await setTheme(id);
  }, [setTheme]);

  const freeThemes = CHAT_THEMES.filter((theme) => !theme.plan);
  const paidThemes = CHAT_THEMES.filter((theme) => Boolean(theme.plan));
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center p-2 sm:items-center sm:p-5">
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-black/45 backdrop-blur-[1px]"
        onClick={onClose}
        aria-label="Close theme picker"
        tabIndex={-1}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="chat-theme-title"
        aria-describedby="chat-theme-description"
        className={cn(
          "relative flex max-h-[min(86dvh,620px)] w-full max-w-lg flex-col overflow-hidden",
          "rounded-md border border-border bg-card shadow-2xl",
          "animate-in slide-in-from-bottom-4 fade-in-0 duration-200 sm:zoom-in-95",
        )}
      >
        <header className="flex shrink-0 items-start gap-3 border-b border-border px-4 py-3.5 sm:px-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Palette className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex items-center gap-2">
              <h2 id="chat-theme-title" className="text-sm font-semibold text-foreground sm:text-base">
                Choose a chat theme
              </h2>
              {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" aria-label="Syncing theme" />}
            </div>
            <p id="chat-theme-description" className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Your selection updates this chat for both of you.
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Close theme picker"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
          <ThemeSection
            title="Included themes"
            description="Available on your current plan."
            themes={freeThemes}
            themeId={themeId}
            plan={plan}
            isSaving={isSaving}
            onSelect={handleSelect}
          />
          <ThemeSection
            title="Premium themes"
            description="Preview any theme and upgrade to unlock it."
            themes={paidThemes}
            themeId={themeId}
            plan={plan}
            isSaving={isSaving}
            onSelect={handleSelect}
            onUpgrade={onUpgrade}
          />
        </div>

      </div>
    </div>
  );
});

export default ChatThemePicker;
