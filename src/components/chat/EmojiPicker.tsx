import { useEffect, useRef, memo, lazy, Suspense } from "react";
import { Loader2, SmilePlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/useTheme";

interface Props {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

interface LazyEmojiPickerProps {
  onSelect: (emoji: string) => void;
  isDark: boolean;
}

let emojiPickerModulePromise: Promise<typeof import("emoji-picker-react")> | null = null;

function loadEmojiPickerModule() {
  if (!emojiPickerModulePromise) {
    emojiPickerModulePromise = import("emoji-picker-react");
  }
  return emojiPickerModulePromise;
}

export function preloadEmojiPicker(): void {
  void loadEmojiPickerModule();
}

const EmojiPickerLib = lazy(async () => {
  const module = await loadEmojiPickerModule();

  return {
    default: function EmojiPickerLoaded({ onSelect, isDark }: LazyEmojiPickerProps) {
      return (
        <module.default
          onEmojiClick={(emojiData) => onSelect(emojiData.emoji)}
          theme={isDark ? module.Theme.DARK : module.Theme.LIGHT}
          width="100%"
          height="100%"
          autoFocusSearch={false}
          searchPlaceholder="Search emoji..."
          previewConfig={{ showPreview: false }}
          defaultSkinTone={module.SkinTones.NEUTRAL}
          skinTonesDisabled={false}
          lazyLoadEmojis
          style={{
            "--epr-bg-color": "hsl(var(--wa-header))",
            "--epr-category-label-bg-color": "hsl(var(--wa-header))",
            "--epr-search-input-bg-color": "hsl(var(--wa-input-bg))",
            "--epr-search-input-text-color": "hsl(var(--wa-text))",
            "--epr-search-input-placeholder-color": "hsl(var(--wa-meta))",
            "--epr-text-color": "hsl(var(--wa-text))",
            "--epr-hover-bg-color": "hsl(var(--wa-system-bubble))",
            "--epr-focus-bg-color": "hsl(var(--wa-system-bubble))",
            "--epr-highlight-color": "hsl(var(--wa-online))",
            "--epr-border-color": "hsl(var(--border))",
            "--epr-header-padding": "10px 10px 2px",
            "--epr-emoji-size": "24px",
            "--epr-emoji-gap": "4px",
            "--epr-border-radius": "22px",
            "--epr-shadow": "none",
            "--epr-active-skin-tone-indicator-border-color": "hsl(var(--wa-online))",
            "--epr-category-navigation-button-size": "30px",
            "--epr-scrollbar-thumb-color": "hsl(var(--wa-meta) / 0.3)",
            overflow: "hidden",
            borderRadius: 22,
            border: "1px solid hsl(var(--border))",
            boxShadow: "0 14px 48px rgba(0,0,0,0.22)",
          } as React.CSSProperties}
        />
      );
    },
  };
});

const EmojiPickerFallback = memo(function EmojiPickerFallback() {
  return (
    <div
      className="flex h-full w-full flex-col rounded-[22px] border border-border bg-[hsl(var(--wa-header))] shadow-2xl"
      aria-hidden
    >
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[hsl(var(--wa-system-bubble))]">
          <SmilePlus className="h-4 w-4 text-[hsl(var(--wa-online))]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-[hsl(var(--wa-text))]">Emoji</div>
          <div className="text-xs text-[hsl(var(--wa-meta))]">Loading your reactions...</div>
        </div>
        <Loader2 className="h-4 w-4 animate-spin text-[hsl(var(--wa-meta))]" />
      </div>
      <div className="grid flex-1 grid-cols-7 gap-2 p-4">
        {Array.from({ length: 28 }).map((_, index) => (
          <div
            key={index}
            className="aspect-square rounded-2xl bg-[hsl(var(--wa-system-bubble))] opacity-70"
          />
        ))}
      </div>
    </div>
  );
});

export const EmojiPicker = memo(function EmojiPicker({ onSelect, onClose }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { isDarkTheme } = useTheme();

  useEffect(() => {
    preloadEmojiPicker();
  }, []);

  useEffect(() => {
    const handler = (event: PointerEvent) => {
      const path = event.composedPath();
      if (containerRef.current && !path.includes(containerRef.current)) {
        onClose();
      }
    };

    const tid = setTimeout(() => document.addEventListener("pointerdown", handler), 80);
    return () => {
      clearTimeout(tid);
      document.removeEventListener("pointerdown", handler);
    };
  }, [onClose]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "fixed inset-x-2 bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] z-50",
        "sm:absolute sm:inset-x-auto sm:bottom-full sm:left-0 sm:mb-2",
        "animate-in fade-in slide-in-from-bottom-2 duration-150",
      )}
      onPointerDown={(event) => event.stopPropagation()}
      role="dialog"
      aria-label="Emoji picker"
      aria-modal="true"
    >
      <div className="h-[min(24rem,52vh)] w-full max-w-[min(26rem,calc(100vw-1rem))] sm:h-[25rem] sm:w-[22rem]">
        <Suspense fallback={<EmojiPickerFallback />}>
          <EmojiPickerLib onSelect={onSelect} isDark={isDarkTheme} />
        </Suspense>
      </div>
    </div>
  );
});

export default EmojiPicker;
