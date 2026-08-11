
export interface ThemeTokens {
    /** Chat area background */
    "wa-bg": string;
    /** Header bar + input bar + popup menus */
    "wa-header": string;
    /** Sent-by-me bubble */
    "wa-bubble-out": string;
    /** Received bubble */
    "wa-bubble-in": string;
    /** Primary text on bubbles and header */
    "wa-text": string;
    /** Timestamps, subtitles, meta text */
    "wa-meta": string;
    /** Online dot, active ticks, typing indicator, reply accent */
    "wa-online": string;
    /** Message input pill background */
    "wa-input-bg": string;
    /** Date separators + system messages */
    "wa-system-bubble": string;
    /** Avatar fallback background */
    "wa-avatar": string;
    /** Voice waveform played portion */
    "wa-voice-thumb": string;
    /** Blue double-tick (read receipt) */
    "wa-tick-blue": string;
}

export interface ChatTheme {
    id: string;
    name: string;
    /** Emoji shown in the picker */
    emoji: string;
    /** Swatch colour shown in the picker (CSS colour string) */
    swatch: string;
    /** Plan required to unlock — undefined means free */
    plan?: "dating" | "soulmate";
    light: ThemeTokens;
    dark: ThemeTokens;
}

// ─── Theme catalogue ──────────────────────────────────────────────────────────

export const CHAT_THEMES: ChatTheme[] = [
    // ── Default (matches original hardcoded values) ───────────────────────────
    {
        id: "default",
        name: "Mono",
        emoji: "⚫",
        swatch: "#111111",
        light: {
            "wa-bg": "0 0% 93%",
            "wa-header": "0 0% 100%",
            "wa-bubble-out": "0 0% 82%",
            "wa-bubble-in": "0 0% 100%",
            "wa-text": "0 0% 10%",
            "wa-meta": "0 0% 40%",
            "wa-online": "142 69% 38%",
            "wa-input-bg": "0 0% 100%",
            "wa-system-bubble": "0 0% 86%",
            "wa-avatar": "0 0% 60%",
            "wa-voice-thumb": "0 0% 30%",
            "wa-tick-blue": "207 90% 50%",
        },
        dark: {
            "wa-bg": "0 0% 8%",
            "wa-header": "0 0% 6%",
            "wa-bubble-out": "0 0% 20%",
            "wa-bubble-in": "0 0% 14%",
            "wa-text": "0 0% 92%",
            "wa-meta": "0 0% 52%",
            "wa-online": "142 69% 43%",
            "wa-input-bg": "0 0% 12%",
            "wa-system-bubble": "0 0% 11%",
            "wa-avatar": "0 0% 25%",
            "wa-voice-thumb": "0 0% 70%",
            "wa-tick-blue": "207 90% 65%",
        },
    },

    // ── Rose ─────────────────────────────────────────────────────────────────
    {
        id: "rose",
        name: "Rose",
        emoji: "🌹",
        swatch: "#f43f5e",
        light: {
            "wa-bg": "350 60% 97%",
            "wa-header": "0 0% 100%",
            "wa-bubble-out": "350 90% 92%",
            "wa-bubble-in": "0 0% 100%",
            "wa-text": "350 40% 15%",
            "wa-meta": "350 15% 52%",
            "wa-online": "350 80% 52%",
            "wa-input-bg": "0 0% 100%",
            "wa-system-bubble": "350 30% 92%",
            "wa-avatar": "350 80% 88%",
            "wa-voice-thumb": "350 80% 52%",
            "wa-tick-blue": "350 80% 52%",
        },
        dark: {
            "wa-bg": "350 30% 8%",
            "wa-header": "350 25% 11%",
            "wa-bubble-out": "350 50% 20%",
            "wa-bubble-in": "350 20% 15%",
            "wa-text": "350 30% 95%",
            "wa-meta": "350 15% 55%",
            "wa-online": "350 80% 62%",
            "wa-input-bg": "350 20% 14%",
            "wa-system-bubble": "350 20% 18%",
            "wa-avatar": "350 50% 28%",
            "wa-voice-thumb": "350 80% 62%",
            "wa-tick-blue": "350 80% 62%",
        },
    },

    // ── Ocean ─────────────────────────────────────────────────────────────────
    {
        id: "ocean",
        name: "Ocean",
        emoji: "🌊",
        swatch: "#0ea5e9",
        light: {
            "wa-bg": "200 60% 96%",
            "wa-header": "200 40% 100%",
            "wa-bubble-out": "200 80% 88%",
            "wa-bubble-in": "0 0% 100%",
            "wa-text": "200 60% 12%",
            "wa-meta": "200 20% 50%",
            "wa-online": "200 90% 42%",
            "wa-input-bg": "0 0% 100%",
            "wa-system-bubble": "200 40% 90%",
            "wa-avatar": "200 70% 82%",
            "wa-voice-thumb": "200 90% 42%",
            "wa-tick-blue": "200 90% 42%",
        },
        dark: {
            "wa-bg": "200 50% 7%",
            "wa-header": "200 40% 10%",
            "wa-bubble-out": "200 50% 18%",
            "wa-bubble-in": "200 30% 13%",
            "wa-text": "200 40% 95%",
            "wa-meta": "200 20% 52%",
            "wa-online": "200 80% 55%",
            "wa-input-bg": "200 30% 12%",
            "wa-system-bubble": "200 30% 16%",
            "wa-avatar": "200 50% 26%",
            "wa-voice-thumb": "200 80% 55%",
            "wa-tick-blue": "200 80% 55%",
        },
    },

    // ── Forest ────────────────────────────────────────────────────────────────
    {
        id: "forest",
        name: "Forest",
        emoji: "🌿",
        swatch: "#22c55e",
        light: {
            "wa-bg": "140 40% 96%",
            "wa-header": "0 0% 100%",
            "wa-bubble-out": "140 60% 88%",
            "wa-bubble-in": "0 0% 100%",
            "wa-text": "140 40% 10%",
            "wa-meta": "140 15% 48%",
            "wa-online": "140 70% 38%",
            "wa-input-bg": "0 0% 100%",
            "wa-system-bubble": "140 30% 90%",
            "wa-avatar": "140 60% 82%",
            "wa-voice-thumb": "140 70% 38%",
            "wa-tick-blue": "140 70% 38%",
        },
        dark: {
            "wa-bg": "140 30% 7%",
            "wa-header": "140 25% 10%",
            "wa-bubble-out": "140 40% 17%",
            "wa-bubble-in": "140 20% 13%",
            "wa-text": "140 30% 94%",
            "wa-meta": "140 15% 52%",
            "wa-online": "140 65% 48%",
            "wa-input-bg": "140 20% 12%",
            "wa-system-bubble": "140 20% 16%",
            "wa-avatar": "140 40% 24%",
            "wa-voice-thumb": "140 65% 48%",
            "wa-tick-blue": "140 65% 48%",
        },
    },

    // ── Sunset (paid) ─────────────────────────────────────────────────────────
    {
        id: "sunset",
        name: "Sunset",
        emoji: "🌅",
        swatch: "#f97316",
        plan: "dating",
        light: {
            "wa-bg": "25 80% 97%",
            "wa-header": "0 0% 100%",
            "wa-bubble-out": "25 90% 90%",
            "wa-bubble-in": "0 0% 100%",
            "wa-text": "25 50% 12%",
            "wa-meta": "25 20% 50%",
            "wa-online": "25 90% 48%",
            "wa-input-bg": "0 0% 100%",
            "wa-system-bubble": "25 40% 92%",
            "wa-avatar": "25 80% 85%",
            "wa-voice-thumb": "25 90% 48%",
            "wa-tick-blue": "25 90% 48%",
        },
        dark: {
            "wa-bg": "25 40% 7%",
            "wa-header": "25 35% 10%",
            "wa-bubble-out": "25 55% 18%",
            "wa-bubble-in": "25 25% 13%",
            "wa-text": "25 30% 95%",
            "wa-meta": "25 15% 52%",
            "wa-online": "25 85% 58%",
            "wa-input-bg": "25 25% 12%",
            "wa-system-bubble": "25 25% 16%",
            "wa-avatar": "25 55% 26%",
            "wa-voice-thumb": "25 85% 58%",
            "wa-tick-blue": "25 85% 58%",
        },
    },

    // ── Midnight (paid) ───────────────────────────────────────────────────────
    {
        id: "midnight",
        name: "Midnight",
        emoji: "🌙",
        swatch: "#6366f1",
        plan: "dating",
        light: {
            "wa-bg": "240 30% 96%",
            "wa-header": "240 20% 100%",
            "wa-bubble-out": "240 60% 88%",
            "wa-bubble-in": "0 0% 100%",
            "wa-text": "240 30% 12%",
            "wa-meta": "240 15% 50%",
            "wa-online": "240 70% 58%",
            "wa-input-bg": "0 0% 100%",
            "wa-system-bubble": "240 25% 91%",
            "wa-avatar": "240 60% 84%",
            "wa-voice-thumb": "240 70% 58%",
            "wa-tick-blue": "240 70% 58%",
        },
        dark: {
            "wa-bg": "240 35% 6%",
            "wa-header": "240 30% 9%",
            "wa-bubble-out": "240 45% 18%",
            "wa-bubble-in": "240 25% 12%",
            "wa-text": "240 30% 96%",
            "wa-meta": "240 15% 54%",
            "wa-online": "240 70% 68%",
            "wa-input-bg": "240 25% 11%",
            "wa-system-bubble": "240 25% 15%",
            "wa-avatar": "240 45% 26%",
            "wa-voice-thumb": "240 70% 68%",
            "wa-tick-blue": "240 70% 68%",
        },
    },

    // ── Cherry blossom (soulmate) ─────────────────────────────────────────────
    {
        id: "cherry",
        name: "Cherry",
        emoji: "🌸",
        swatch: "#ec4899",
        plan: "soulmate",
        light: {
            "wa-bg": "330 70% 97%",
            "wa-header": "0 0% 100%",
            "wa-bubble-out": "330 80% 91%",
            "wa-bubble-in": "0 0% 100%",
            "wa-text": "330 50% 13%",
            "wa-meta": "330 15% 52%",
            "wa-online": "330 80% 52%",
            "wa-input-bg": "0 0% 100%",
            "wa-system-bubble": "330 40% 93%",
            "wa-avatar": "330 70% 86%",
            "wa-voice-thumb": "330 80% 52%",
            "wa-tick-blue": "330 80% 52%",
        },
        dark: {
            "wa-bg": "330 35% 7%",
            "wa-header": "330 30% 10%",
            "wa-bubble-out": "330 45% 19%",
            "wa-bubble-in": "330 20% 14%",
            "wa-text": "330 30% 96%",
            "wa-meta": "330 15% 54%",
            "wa-online": "330 75% 62%",
            "wa-input-bg": "330 20% 13%",
            "wa-system-bubble": "330 20% 17%",
            "wa-avatar": "330 45% 27%",
            "wa-voice-thumb": "330 75% 62%",
            "wa-tick-blue": "330 75% 62%",
        },
    },

    // ── Sand (soulmate) ───────────────────────────────────────────────────────
    {
        id: "sand",
        name: "Sand",
        emoji: "🏖️",
        swatch: "#d97706",
        plan: "soulmate",
        light: {
            "wa-bg": "40 50% 96%",
            "wa-header": "40 30% 100%",
            "wa-bubble-out": "40 70% 88%",
            "wa-bubble-in": "0 0% 100%",
            "wa-text": "40 40% 12%",
            "wa-meta": "40 15% 50%",
            "wa-online": "40 80% 42%",
            "wa-input-bg": "0 0% 100%",
            "wa-system-bubble": "40 35% 91%",
            "wa-avatar": "40 65% 83%",
            "wa-voice-thumb": "40 80% 42%",
            "wa-tick-blue": "40 80% 42%",
        },
        dark: {
            "wa-bg": "40 30% 7%",
            "wa-header": "40 25% 10%",
            "wa-bubble-out": "40 40% 17%",
            "wa-bubble-in": "40 20% 13%",
            "wa-text": "40 25% 95%",
            "wa-meta": "40 15% 52%",
            "wa-online": "40 75% 52%",
            "wa-input-bg": "40 20% 12%",
            "wa-system-bubble": "40 20% 16%",
            "wa-avatar": "40 40% 25%",
            "wa-voice-thumb": "40 75% 52%",
            "wa-tick-blue": "40 75% 52%",
        },
    },
];

// ─── Lookup helpers ───────────────────────────────────────────────────────────

export const DEFAULT_THEME_ID = "default";

export function getTheme(id: string | null | undefined): ChatTheme {
    return CHAT_THEMES.find(t => t.id === id) ?? CHAT_THEMES[0];
}

/** Build a style object to spread onto the root chat div */
export function buildThemeStyle(
    theme: ChatTheme,
    isDark: boolean
): React.CSSProperties {
    const tokens = isDark ? theme.dark : theme.light;
    return Object.fromEntries(
        Object.entries(tokens).map(([k, v]) => [`--${k}`, v])
    ) as React.CSSProperties;
}

/** Resolve whether a theme is unlocked given the user's plan */
export function isThemeUnlocked(theme: ChatTheme, plan: string): boolean {
    if (!theme.plan) return true;
    if (theme.plan === "dating") return plan === "dating" || plan === "soulmate";
    if (theme.plan === "soulmate") return plan === "soulmate";
    return false;
}