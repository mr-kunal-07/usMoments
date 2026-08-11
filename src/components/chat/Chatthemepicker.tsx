import { memo, useCallback, useRef, useEffect } from "react";
import { Check, Lock, Loader2, X, Palette } from "lucide-react";
import { cn } from "@/lib/utils";
import { CHAT_THEMES, getTheme, isThemeUnlocked, ChatTheme } from "./Chatthemes";
import { useChatTheme } from "./Usechattheme";
import { usePlan } from "@/hooks/useSubscription";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
    onClose: () => void;
    onUpgrade?: () => void;
}

// ─── ThemeSwatch ──────────────────────────────────────────────────────────────

const ThemeSwatch = memo(function ThemeSwatch({
    theme,
    isActive,
    isLocked,
    isSaving,
    onSelect,
    onUpgrade,
}: {
    theme: ChatTheme;
    isActive: boolean;
    isLocked: boolean;
    isSaving: boolean;
    onSelect: (id: string) => void;
    onUpgrade?: () => void;
}) {
    const handleClick = useCallback(() => {
        if (isLocked) { onUpgrade?.(); return; }
        onSelect(theme.id);
    }, [isLocked, theme.id, onSelect, onUpgrade]);

    return (
        <button
            onClick={handleClick}
            aria-label={`${theme.name} theme${isLocked ? " — requires upgrade" : ""}${isActive ? " (active)" : ""}`}
            aria-pressed={isActive}
            className={cn(
                "relative flex flex-col items-center gap-2 p-2 rounded-xl transition-all",
                "border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                isActive
                    ? "border-primary bg-primary/6 scale-[1.03]"
                    : "border-border hover:border-primary/40 hover:bg-accent/20",
                isLocked && "opacity-60"
            )}
        >
            {/* Mini chat preview */}
            <div
                className="w-full h-14 rounded-lg overflow-hidden relative"
                style={{ background: `hsl(${theme.light["wa-bg"]})` }}
                aria-hidden
            >
                {/* Fake header strip */}
                <div
                    className="absolute top-0 left-0 right-0 h-4"
                    style={{ background: `hsl(${theme.light["wa-header"]})` }}
                />
                {/* Fake received bubble */}
                <div
                    className="absolute top-5 left-2 h-3 w-10 rounded-full"
                    style={{ background: `hsl(${theme.light["wa-bubble-in"]})`, border: `1px solid hsl(${theme.light["wa-meta"]} / 0.2)` }}
                />
                {/* Fake sent bubble */}
                <div
                    className="absolute top-9 right-2 h-3 w-12 rounded-full"
                    style={{ background: `hsl(${theme.light["wa-bubble-out"]})` }}
                />
                {/* Accent dot */}
                <div
                    className="absolute bottom-1.5 left-1.5 h-2 w-2 rounded-full"
                    style={{ background: `hsl(${theme.light["wa-online"]})` }}
                />
            </div>

            {/* Swatch dot */}
            <div
                className="h-4 w-4 rounded-full border-2 border-white shadow-sm"
                style={{ background: theme.swatch }}
                aria-hidden
            />

            {/* Name */}
            <span className="text-[10px] font-medium text-foreground leading-none">{theme.name}</span>

            {/* Active check */}
            {isActive && !isSaving && (
                <span className="absolute top-1.5 right-1.5 h-4 w-4 rounded-full bg-primary flex items-center justify-center" aria-hidden>
                    <Check className="h-2.5 w-2.5 text-white" />
                </span>
            )}

            {/* Saving spinner */}
            {isActive && isSaving && (
                <span className="absolute top-1.5 right-1.5" aria-hidden>
                    <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />
                </span>
            )}

            {/* Lock overlay */}
            {isLocked && (
                <span className="absolute top-1.5 right-1.5 h-4 w-4 rounded-full bg-muted flex items-center justify-center" aria-hidden>
                    <Lock className="h-2.5 w-2.5 text-muted-foreground" />
                </span>
            )}

            {/* Plan badge */}
            {theme.plan && (
                <span
                    className={cn(
                        "absolute bottom-8 left-1/2 -translate-x-1/2 text-[8px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap",
                        theme.plan === "soulmate"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-violet-100 text-violet-800"
                    )}
                    aria-hidden
                >
                    {theme.plan === "soulmate" ? "Soulmate" : "Dating"}
                </span>
            )}
        </button>
    );
});

// ─── ChatThemePicker ──────────────────────────────────────────────────────────

export const ChatThemePicker = memo(function ChatThemePicker({ onClose, onUpgrade }: Props) {
    const { themeId, setTheme, isSaving } = useChatTheme();
    const plan = usePlan();
    const panelRef = useRef<HTMLDivElement>(null);

    // Close on outside click
    useEffect(() => {
        const handler = (e: PointerEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
        };
        // Small delay so the button press that opened us doesn't immediately close
        const tid = setTimeout(() => document.addEventListener("pointerdown", handler), 50);
        return () => { clearTimeout(tid); document.removeEventListener("pointerdown", handler); };
    }, [onClose]);

    // Close on Escape
    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, [onClose]);

    const handleSelect = useCallback(async (id: string) => {
        await setTheme(id);
        // Keep picker open so user can see the change applied live — they close manually
    }, [setTheme]);

    const freeThemes = CHAT_THEMES.filter(t => !t.plan);
    const paidThemes = CHAT_THEMES.filter(t => !!t.plan);

    return (
        <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Chat theme picker"
            className={cn(
                "fixed inset-x-3 bottom-3 z-50 sm:inset-x-auto sm:bottom-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2",
                "w-auto sm:w-80",
                "rounded-2xl border border-border",
                "shadow-xl overflow-hidden",
            )}
            style={{ background: "hsl(var(--wa-header))" }}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
                <div className="flex items-center gap-2">
                    <Palette className="h-4 w-4 text-primary" aria-hidden />
                    <span className="text-sm font-semibold" style={{ color: "hsl(var(--wa-text))" }}>
                        Chat theme
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    {isSaving && (
                        <span className="flex items-center gap-1 text-[10px]" style={{ color: "hsl(var(--wa-online))" }}>
                            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                            Syncing…
                        </span>
                    )}
                    <button
                        onClick={onClose}
                        aria-label="Close theme picker"
                        className="p-1 rounded-full hover:bg-accent/20 transition-colors"
                        style={{ color: "hsl(var(--wa-text) / 0.5)" }}
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            </div>

            <div className="px-4 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
                {/* Sync note */}
                <p className="text-[10px] leading-relaxed" style={{ color: "hsl(var(--wa-meta))" }}>
                    Theme changes sync to your partner instantly.
                </p>

                {/* Free themes */}
                <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide mb-2.5" style={{ color: "hsl(var(--wa-meta))" }}>
                        Free
                    </p>
                    <div className="grid grid-cols-4 gap-2">
                        {freeThemes.map(theme => (
                            <ThemeSwatch
                                key={theme.id}
                                theme={theme}
                                isActive={themeId === theme.id || (!themeId && theme.id === "default")}
                                isLocked={false}
                                isSaving={isSaving && themeId === theme.id}
                                onSelect={handleSelect}
                            />
                        ))}
                    </div>
                </div>

                {/* Paid themes */}
                <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide mb-2.5" style={{ color: "hsl(var(--wa-meta))" }}>
                        Premium
                    </p>
                    <div className="grid grid-cols-4 gap-2">
                        {paidThemes.map(theme => {
                            const unlocked = isThemeUnlocked(theme, plan);
                            return (
                                <ThemeSwatch
                                    key={theme.id}
                                    theme={theme}
                                    isActive={themeId === theme.id}
                                    isLocked={!unlocked}
                                    isSaving={isSaving && themeId === theme.id}
                                    onSelect={handleSelect}
                                    onUpgrade={onUpgrade}
                                />
                            );
                        })}
                    </div>
                </div>

                {/* Upgrade nudge if user is on free */}
                {plan === "single" && onUpgrade && (
                    <button
                        onClick={onUpgrade}
                        className="w-full py-2 rounded-xl text-xs font-semibold transition-colors"
                        style={{
                            background: "hsl(var(--wa-online) / 0.12)",
                            color: "hsl(var(--wa-online))",
                        }}
                    >
                        Unlock all themes — Upgrade to Dating plan
                    </button>
                )}
            </div>
        </div>
    );
});

export default ChatThemePicker;
