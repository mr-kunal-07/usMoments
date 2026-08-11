import { forwardRef } from "react";
import {
  Heart, Star, Plane, Trophy, CalendarHeart,
  Camera, MapPin, Gift, Music, Zap,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type TemplateId =
  | "eternal" | "polaroid" | "bold" | "cinema"
  | "bloom" | "neon" | "wabi" | "journal";

export interface Milestone {
  id: string;
  title: string;
  date: string;
  description: string | null;
  type: string;
}

export interface Profile {
  display_name: string | null;
  avatar_url: string | null;
}

export interface PaletteData {
  id: string;
  label: string;
  swatch: string;
  bg: string;
  accent: string;
  accentRgb: string;
  text: string;
  subtext: string;
  card: string;
  line: string;
  isDark: boolean;
}

export interface Customization {
  title: string;
  tagline: string;
  startDate: string;
  showStats: boolean;
  showTimeline: boolean;
  paletteId: string;
}

export const DEFAULT_CUSTOMIZATION: Customization = {
  title: "",
  tagline: "Forever and always ❤️",
  startDate: "",
  showStats: true,
  showTimeline: true,
  paletteId: "",
};

// ─── Palettes ──────────────────────────────────────────────────────────────────

export const PALETTES: Record<TemplateId, PaletteData[]> = {
  eternal: [
    { id: "rose", label: "Rose Quartz", swatch: "linear-gradient(135deg,#ffd6e0,#ffacc7)", bg: "linear-gradient(135deg,#fff0f3 0%,#ffe4ef 50%,#fce7ff 100%)", accent: "#f43f5e", accentRgb: "244,63,94", text: "#1a0a0f", subtext: "#7a3050", card: "rgba(255,255,255,0.75)", line: "#fecdd3", isDark: false },
    { id: "violet", label: "Amethyst", swatch: "linear-gradient(135deg,#c4b5fd,#a78bfa)", bg: "linear-gradient(135deg,#f5f0ff 0%,#ede9ff 50%,#fae8ff 100%)", accent: "#7c3aed", accentRgb: "124,58,237", text: "#1a0a2e", subtext: "#5b3d8a", card: "rgba(255,255,255,0.75)", line: "#ddd6fe", isDark: false },
    { id: "peach", label: "Peach Nectar", swatch: "linear-gradient(135deg,#fdba74,#fb923c)", bg: "linear-gradient(135deg,#fff7ed 0%,#ffedd5 50%,#ffe4e6 100%)", accent: "#ea580c", accentRgb: "234,88,12", text: "#1a0f00", subtext: "#6b4020", card: "rgba(255,255,255,0.75)", line: "#fed7aa", isDark: false },
    { id: "midnight", label: "Midnight Blush", swatch: "linear-gradient(135deg,#312e81,#1e1b4b)", bg: "linear-gradient(135deg,#0f0c29 0%,#302b63 50%,#24243e 100%)", accent: "#f472b6", accentRgb: "244,114,182", text: "#ffffff", subtext: "#c4b5fd", card: "rgba(255,255,255,0.08)", line: "rgba(244,114,182,0.35)", isDark: true },
    { id: "coral", label: "Coral Bliss", swatch: "linear-gradient(135deg,#ff9a9e,#fad0c4)", bg: "linear-gradient(135deg,#fff5f5 0%,#ffe0e0 50%,#fff0f5 100%)", accent: "#e05c6a", accentRgb: "224,92,106", text: "#1a0808", subtext: "#7a3040", card: "rgba(255,255,255,0.75)", line: "#ffc0cb", isDark: false },
  ],
  polaroid: [
    { id: "cream", label: "Classic Cream", swatch: "#fdf8f0", bg: "linear-gradient(160deg,#fdf8f0 0%,#f5ead8 100%)", accent: "#d97706", accentRgb: "217,119,6", text: "#2c1a0a", subtext: "#7c5a3a", card: "#ffffff", line: "#fde68a", isDark: false },
    { id: "vintage", label: "Aged Sepia", swatch: "#f0e0c8", bg: "linear-gradient(160deg,#f9f0e3 0%,#f0e0c8 100%)", accent: "#92400e", accentRgb: "146,64,14", text: "#1c0f00", subtext: "#6b4a2a", card: "#fffdf8", line: "#fcd34d", isDark: false },
    { id: "summer", label: "Golden Hour", swatch: "linear-gradient(135deg,#fbbf24,#f59e0b)", bg: "linear-gradient(160deg,#fffbeb 0%,#fef3c7 100%)", accent: "#d97706", accentRgb: "217,119,6", text: "#1c1300", subtext: "#6b5010", card: "#ffffff", line: "#fef3c7", isDark: false },
    { id: "dusk", label: "Dusk Film", swatch: "linear-gradient(135deg,#b45309,#78350f)", bg: "linear-gradient(160deg,#1a0f00 0%,#2d1a00 100%)", accent: "#fbbf24", accentRgb: "251,191,36", text: "#fef3c7", subtext: "#d97706", card: "rgba(255,255,255,0.07)", line: "rgba(251,191,36,0.25)", isDark: true },
  ],
  bold: [
    { id: "pure", label: "Arctic White", swatch: "#f8fafc", bg: "#f8fafc", accent: "#e11d48", accentRgb: "225,29,72", text: "#0f172a", subtext: "#475569", card: "#ffffff", line: "#fecdd3", isDark: false },
    { id: "noir", label: "Ink Black", swatch: "linear-gradient(135deg,#1e293b,#0f172a)", bg: "#0f172a", accent: "#fbbf24", accentRgb: "251,191,36", text: "#f8fafc", subtext: "#94a3b8", card: "rgba(255,255,255,0.06)", line: "rgba(251,191,36,0.3)", isDark: true },
    { id: "bold-blush", label: "Soft Blush", swatch: "linear-gradient(135deg,#fce7f3,#fdf2f8)", bg: "linear-gradient(160deg,#fdf2f8 0%,#f0f9ff 100%)", accent: "#db2777", accentRgb: "219,39,119", text: "#1e0a14", subtext: "#6b3a55", card: "rgba(255,255,255,0.92)", line: "#fbcfe8", isDark: false },
    { id: "electric", label: "Electric Blue", swatch: "linear-gradient(135deg,#1d4ed8,#2563eb)", bg: "linear-gradient(160deg,#eff6ff 0%,#dbeafe 100%)", accent: "#1d4ed8", accentRgb: "29,78,216", text: "#0a0f1e", subtext: "#3b4f8a", card: "rgba(255,255,255,0.92)", line: "#bfdbfe", isDark: false },
    { id: "slate-red", label: "Slate & Red", swatch: "linear-gradient(135deg,#334155,#e11d48)", bg: "linear-gradient(160deg,#1e293b 0%,#0f172a 100%)", accent: "#f43f5e", accentRgb: "244,63,94", text: "#f8fafc", subtext: "#94a3b8", card: "rgba(255,255,255,0.06)", line: "rgba(244,63,94,0.25)", isDark: true },
  ],
  cinema: [
    { id: "gold", label: "Hollywood Gold", swatch: "linear-gradient(135deg,#d97706,#92400e)", bg: "linear-gradient(160deg,#080810 0%,#14100a 50%,#080810 100%)", accent: "#f59e0b", accentRgb: "245,158,11", text: "#fef3c7", subtext: "#d97706", card: "rgba(245,158,11,0.09)", line: "rgba(245,158,11,0.25)", isDark: true },
    { id: "silver", label: "Silver Screen", swatch: "linear-gradient(135deg,#e2e8f0,#94a3b8)", bg: "linear-gradient(160deg,#080814 0%,#0f172a 100%)", accent: "#e2e8f0", accentRgb: "226,232,240", text: "#f1f5f9", subtext: "#94a3b8", card: "rgba(255,255,255,0.05)", line: "rgba(226,232,240,0.15)", isDark: true },
    { id: "cinema-rose", label: "Crimson Velvet", swatch: "linear-gradient(135deg,#fb7185,#e11d48)", bg: "linear-gradient(160deg,#0a0008 0%,#1a0015 100%)", accent: "#fb7185", accentRgb: "251,113,133", text: "#fff1f2", subtext: "#fda4af", card: "rgba(251,113,133,0.07)", line: "rgba(251,113,133,0.2)", isDark: true },
    { id: "teal-noir", label: "Teal Noir", swatch: "linear-gradient(135deg,#0d9488,#0f766e)", bg: "linear-gradient(160deg,#020d0c 0%,#0a1f1e 100%)", accent: "#2dd4bf", accentRgb: "45,212,191", text: "#f0fdfa", subtext: "#5eead4", card: "rgba(45,212,191,0.07)", line: "rgba(45,212,191,0.2)", isDark: true },
  ],
  bloom: [
    { id: "blush-bloom", label: "Cherry Bloom", swatch: "linear-gradient(135deg,#fce7f3,#fbcfe8)", bg: "linear-gradient(135deg,#fff1f7 0%,#fce7f3 50%,#f5f0ff 100%)", accent: "#db2777", accentRgb: "219,39,119", text: "#1e0a14", subtext: "#7a3050", card: "rgba(255,255,255,0.68)", line: "#fecdd3", isDark: false },
    { id: "lavender", label: "Wisteria", swatch: "linear-gradient(135deg,#e9d5ff,#c4b5fd)", bg: "linear-gradient(135deg,#fdf4ff 0%,#ede9fe 50%,#e0f2fe 100%)", accent: "#7c3aed", accentRgb: "124,58,237", text: "#1a0a2e", subtext: "#5b3d8a", card: "rgba(255,255,255,0.68)", line: "#ddd6fe", isDark: false },
    { id: "mint", label: "Eucalyptus", swatch: "linear-gradient(135deg,#a7f3d0,#6ee7b7)", bg: "linear-gradient(135deg,#ecfdf5 0%,#d1fae5 50%,#cffafe 100%)", accent: "#059669", accentRgb: "5,150,105", text: "#0a1f17", subtext: "#3a6a5a", card: "rgba(255,255,255,0.68)", line: "#a7f3d0", isDark: false },
    { id: "terra", label: "Terracotta", swatch: "linear-gradient(135deg,#fb923c,#f97316)", bg: "linear-gradient(135deg,#fff7f0 0%,#ffe8d6 50%,#fef3c7 100%)", accent: "#c2410c", accentRgb: "194,65,12", text: "#1a0800", subtext: "#6b3010", card: "rgba(255,255,255,0.68)", line: "#fed7aa", isDark: false },
  ],
  neon: [
    { id: "neon-pink", label: "Neon Haze", swatch: "linear-gradient(135deg,#ec4899,#8b5cf6)", bg: "linear-gradient(135deg,#0d0015 0%,#120025 50%,#0a0a1a 100%)", accent: "#f0abfc", accentRgb: "240,171,252", text: "#fdf4ff", subtext: "#c084fc", card: "rgba(240,171,252,0.08)", line: "rgba(240,171,252,0.22)", isDark: true },
    { id: "neon-cyan", label: "Cyber Teal", swatch: "linear-gradient(135deg,#06b6d4,#0ea5e9)", bg: "linear-gradient(135deg,#000d14 0%,#001a24 50%,#000d14 100%)", accent: "#22d3ee", accentRgb: "34,211,238", text: "#ecfeff", subtext: "#67e8f9", card: "rgba(34,211,238,0.07)", line: "rgba(34,211,238,0.2)", isDark: true },
    { id: "neon-green", label: "Matrix Green", swatch: "linear-gradient(135deg,#16a34a,#15803d)", bg: "linear-gradient(135deg,#000d05 0%,#001a0a 50%,#000d05 100%)", accent: "#4ade80", accentRgb: "74,222,128", text: "#f0fdf4", subtext: "#86efac", card: "rgba(74,222,128,0.07)", line: "rgba(74,222,128,0.2)", isDark: true },
    { id: "neon-sunset", label: "Retrowave", swatch: "linear-gradient(135deg,#f97316,#ec4899)", bg: "linear-gradient(135deg,#0f0005 0%,#1a000f 50%,#0a0510 100%)", accent: "#fb923c", accentRgb: "249,146,60", text: "#fff7ed", subtext: "#fdba74", card: "rgba(249,146,60,0.08)", line: "rgba(249,146,60,0.22)", isDark: true },
  ],
  wabi: [
    { id: "wabi-ash", label: "Warm Ash", swatch: "linear-gradient(135deg,#d6d3d1,#a8a29e)", bg: "linear-gradient(135deg,#fafaf9 0%,#f5f5f4 100%)", accent: "#78716c", accentRgb: "120,113,108", text: "#1c1917", subtext: "#57534e", card: "rgba(255,255,255,0.82)", line: "#e7e5e4", isDark: false },
    { id: "wabi-clay", label: "Clay Earth", swatch: "linear-gradient(135deg,#c2a27a,#a37c50)", bg: "linear-gradient(135deg,#fdf6ee 0%,#f5ead8 100%)", accent: "#92400e", accentRgb: "146,64,14", text: "#1c0f00", subtext: "#5c4033", card: "rgba(255,255,255,0.78)", line: "#e5c9a0", isDark: false },
    { id: "wabi-ink", label: "Sumi Ink", swatch: "linear-gradient(135deg,#3f3f46,#18181b)", bg: "linear-gradient(135deg,#09090b 0%,#18181b 100%)", accent: "#d4d4d8", accentRgb: "212,212,216", text: "#fafafa", subtext: "#a1a1aa", card: "rgba(255,255,255,0.06)", line: "rgba(212,212,216,0.15)", isDark: true },
    { id: "wabi-sage", label: "Sage Forest", swatch: "linear-gradient(135deg,#84cc16,#65a30d)", bg: "linear-gradient(135deg,#f7fee7 0%,#ecfccb 100%)", accent: "#4d7c0f", accentRgb: "77,124,15", text: "#0f1a00", subtext: "#3a5c10", card: "rgba(255,255,255,0.78)", line: "#bef264", isDark: false },
  ],
  journal: [
    { id: "journal-ivory", label: "Cream Pages", swatch: "#fefce8", bg: "linear-gradient(160deg,#fefce8 0%,#fef9c3 100%)", accent: "#854d0e", accentRgb: "133,77,14", text: "#1c0f00", subtext: "#6b4a1a", card: "rgba(255,255,255,0.88)", line: "#fde047", isDark: false },
    { id: "journal-blue", label: "Blueprint", swatch: "linear-gradient(135deg,#dbeafe,#bfdbfe)", bg: "linear-gradient(160deg,#eff6ff 0%,#dbeafe 100%)", accent: "#1d4ed8", accentRgb: "29,78,216", text: "#0a0f1e", subtext: "#3b4f8a", card: "rgba(255,255,255,0.88)", line: "#93c5fd", isDark: false },
    { id: "journal-rose", label: "Love Letter", swatch: "linear-gradient(135deg,#ffe4e6,#fecdd3)", bg: "linear-gradient(160deg,#fff1f2 0%,#ffe4e6 100%)", accent: "#be123c", accentRgb: "190,18,60", text: "#1a0008", subtext: "#6b1030", card: "rgba(255,255,255,0.88)", line: "#fda4af", isDark: false },
    { id: "journal-night", label: "Night Ink", swatch: "linear-gradient(135deg,#1e3a5f,#0f2040)", bg: "linear-gradient(160deg,#060e1c 0%,#0f2040 100%)", accent: "#93c5fd", accentRgb: "147,197,253", text: "#eff6ff", subtext: "#93c5fd", card: "rgba(147,197,253,0.07)", line: "rgba(147,197,253,0.22)", isDark: true },
  ],
};

export const TEMPLATE_META: Record<TemplateId, { label: string; description: string; emoji: string }> = {
  eternal: { label: "Eternal", description: "Soft gradients, floating hearts, romantic", emoji: "🌸" },
  polaroid: { label: "Polaroid", description: "Warm cream, scattered film memories", emoji: "📸" },
  bold: { label: "Bold", description: "High-impact typography, dramatic minimal", emoji: "✦" },
  cinema: { label: "Cinema", description: "Dark luxury, film aesthetic, gold accents", emoji: "🎬" },
  bloom: { label: "Bloom", description: "Botanical pastels, floral, elegant", emoji: "🌺" },
  neon: { label: "Neon", description: "Dark cyberpunk, glowing neon accents", emoji: "💜" },
  wabi: { label: "Wabi", description: "Wabi-sabi minimalism, earthy beauty", emoji: "🪨" },
  journal: { label: "Journal", description: "Handwritten diary, paper textures", emoji: "📖" },
};

export const MILESTONE_ICONS: Record<string, typeof Heart> = {
  anniversary: CalendarHeart,
  milestone: Star,
  trip: Plane,
  birthday: Gift,
  photo: Camera,
  place: MapPin,
  music: Music,
  default: Trophy,
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

interface LoveStoryCardProps {
  templateId: TemplateId;
  customization: Customization;
  myProfile: Profile | null;
  partnerProfile: Profile | null;
  coupleStartDate: string | null;
  milestones: Milestone[];
  photoCount: number;
  messageCount: number;
}

function getDaysTogether(dateStr: string | null): number {
  if (!dateStr) return 0;
  const start = new Date(dateStr);
  const now = new Date();
  return Math.max(0, Math.floor((now.getTime() - start.getTime()) / 86400000));
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
    });
  } catch { return dateStr; }
}

function getActivePalette(templateId: TemplateId, paletteId: string): PaletteData {
  const palettes = PALETTES[templateId];
  return palettes.find((p) => p.id === paletteId) ?? palettes[0];
}

// Shared sub-components ─────────────────────────────────────────────────────────

function Avatar({ profile, size, pal }: { profile: Profile | null; size: number; pal: PaletteData }) {
  const name = profile?.display_name ?? "?";
  const initials = name.slice(0, 1).toUpperCase();
  if (profile?.avatar_url) {
    return (
      <img
        src={profile.avatar_url}
        alt={name}
        style={{
          width: size, height: size, borderRadius: "50%",
          objectFit: "cover", border: `2px solid ${pal.accent}`,
          flexShrink: 0,
        }}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: `rgba(${pal.accentRgb},0.18)`,
      border: `2px solid rgba(${pal.accentRgb},0.4)`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.38, fontWeight: 700, color: pal.accent,
    }}>
      {initials}
    </div>
  );
}

function StatBox({ value, label, pal }: { value: string | number; label: string; pal: PaletteData }) {
  return (
    <div style={{
      background: pal.card,
      border: `1px solid rgba(${pal.accentRgb},0.18)`,
      borderRadius: 12, padding: "10px 8px", textAlign: "center", flex: 1,
    }}>
      <div style={{ fontSize: 20, fontWeight: 800, color: pal.accent, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 9, color: pal.subtext, marginTop: 3, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
    </div>
  );
}

function TimelineItem({ m, pal, last }: { m: Milestone; pal: PaletteData; last: boolean }) {
  const Icon = MILESTONE_ICONS[m.type] ?? MILESTONE_ICONS.default;
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
        <div style={{
          width: 26, height: 26, borderRadius: "50%",
          background: `rgba(${pal.accentRgb},0.14)`,
          border: `1.5px solid rgba(${pal.accentRgb},0.4)`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Icon style={{ width: 12, height: 12, color: pal.accent }} />
        </div>
        {!last && (
          <div style={{ width: 1, flex: 1, minHeight: 14, background: pal.line, marginTop: 3 }} />
        )}
      </div>
      <div style={{ paddingTop: 3, paddingBottom: last ? 0 : 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: pal.text, lineHeight: 1.2 }}>{m.title}</div>
        <div style={{ fontSize: 9, color: pal.subtext, marginTop: 2 }}>{formatDate(m.date)}</div>
      </div>
    </div>
  );
}

// ─── Card Shell ─────────────────────────────────────────────────────────────────
// All templates share a 375px wide card (matches iPhone viewport) 
// with inline styles so html-to-image captures them perfectly.

const CARD_WIDTH = 375;
type FloatingHeart = {
  top: string;
  left?: string;
  right?: string;
  sz: number;
  op: number;
};
const FLOATING_HEARTS: FloatingHeart[] = [
  { top: "6%", left: "7%", sz: 13, op: 0.13 },
  { top: "12%", right: "9%", sz: 18, op: 0.10 },
  { top: "52%", left: "5%", sz: 11, op: 0.09 },
  { top: "72%", right: "6%", sz: 15, op: 0.11 },
];

export const LoveStoryCard = forwardRef<HTMLDivElement, LoveStoryCardProps>(
  function LoveStoryCard(props, ref) {
    const {
      templateId, customization,
      myProfile, partnerProfile,
      coupleStartDate, milestones,
      photoCount, messageCount,
    } = props;

    const pal = getActivePalette(templateId, customization.paletteId);
    const startDate = customization.startDate || coupleStartDate;
    const days = getDaysTogether(startDate);
    const myName = myProfile?.display_name ?? "You";
    const partnerName = partnerProfile?.display_name ?? "Partner";
    const title = customization.title || `${myName} & ${partnerName}`;
    const tagline = customization.tagline || "Forever and always ❤️";
    const shownMilestones = milestones.slice(0, 4);

    const commonProps = {
      pal, title, tagline, startDate, days,
      myName, partnerName, myProfile, partnerProfile,
      photoCount, messageCount,
      milestones: shownMilestones,
      showStats: customization.showStats,
      showTimeline: customization.showTimeline,
    };

    return (
      <div
        ref={ref}
        style={{
          width: "100%",
          maxWidth: CARD_WIDTH,
          margin: "0 auto",
          borderRadius: 28,
          overflow: "hidden",
          fontFamily: "'Georgia', serif",
        }}
      >
        {templateId === "eternal" && <EternalCard  {...commonProps} />}
        {templateId === "polaroid" && <PolaroidCard {...commonProps} />}
        {templateId === "bold" && <BoldCard     {...commonProps} />}
        {templateId === "cinema" && <CinemaCard   {...commonProps} />}
        {templateId === "bloom" && <BloomCard    {...commonProps} />}
        {templateId === "neon" && <NeonCard     {...commonProps} />}
        {templateId === "wabi" && <WabiCard     {...commonProps} />}
        {templateId === "journal" && <JournalCard  {...commonProps} />}
      </div>
    );
  }
);

// ─── Shared card prop type ─────────────────────────────────────────────────────

interface CardProps {
  pal: PaletteData;
  title: string;
  tagline: string;
  startDate: string | null;
  days: number;
  myName: string;
  partnerName: string;
  myProfile: Profile | null;
  partnerProfile: Profile | null;
  photoCount: number;
  messageCount: number;
  milestones: Milestone[];
  showStats: boolean;
  showTimeline: boolean;
}

// ─── 1. ETERNAL ───────────────────────────────────────────────────────────────

function EternalCard({ pal, title, tagline, startDate, days, myProfile, partnerProfile, photoCount, messageCount, milestones, showStats, showTimeline }: CardProps) {
  return (
    <div style={{ background: pal.bg, padding: "32px 24px 28px", position: "relative", minHeight: 480 }}>
      {/* Floating hearts */}
      {FLOATING_HEARTS.map((h, i) => (
        <Heart key={i} fill={pal.accent} color="transparent" style={{
          position: "absolute", top: h.top,
          left: h.left ?? "auto",
          right: h.right ?? "auto",
          width: h.sz, height: h.sz, opacity: h.op,
        }} />
      ))}

      {/* Couple header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 20 }}>
        <Avatar profile={myProfile} size={52} pal={pal} />
        <Heart fill={pal.accent} color="transparent" style={{ width: 22, height: 22, opacity: 0.8 }} />
        <Avatar profile={partnerProfile} size={52} pal={pal} />
      </div>

      <h2 style={{ textAlign: "center", fontSize: 22, fontWeight: 800, color: pal.text, margin: "0 0 6px", lineHeight: 1.2, fontFamily: "Georgia,serif" }}>{title}</h2>
      <p style={{ textAlign: "center", fontSize: 12, color: pal.subtext, margin: "0 0 20px", fontStyle: "italic" }}>{tagline}</p>

      {/* Together since pill */}
      {startDate && (
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
          <div style={{ background: `rgba(${pal.accentRgb},0.12)`, border: `1px solid rgba(${pal.accentRgb},0.25)`, borderRadius: 99, padding: "5px 16px", fontSize: 11, color: pal.accent, fontWeight: 600 }}>
            💕 Together since {formatDate(startDate)}
          </div>
        </div>
      )}

      {/* Stats */}
      {showStats && (
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          <StatBox value={days.toLocaleString()} label="Days" pal={pal} />
          <StatBox value={photoCount} label="Photos" pal={pal} />
          <StatBox value={messageCount} label="Messages" pal={pal} />
        </div>
      )}

      {/* Timeline */}
      {showTimeline && milestones.length > 0 && (
        <div style={{ background: pal.card, borderRadius: 16, padding: "14px 14px 10px", border: `1px solid rgba(${pal.accentRgb},0.14)` }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: pal.accent, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Our Milestones</div>
          {milestones.map((m, i) => <TimelineItem key={m.id} m={m} pal={pal} last={i === milestones.length - 1} />)}
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop: 20, textAlign: "center", fontSize: 10, color: pal.subtext, opacity: 0.7 }}>usMoments ✦ usMoments.app</div>
    </div>
  );
}

// ─── 2. POLAROID ──────────────────────────────────────────────────────────────

function PolaroidCard({ pal, title, tagline, startDate, days, myProfile, partnerProfile, photoCount, messageCount, milestones, showStats, showTimeline }: CardProps) {
  return (
    <div style={{ background: pal.bg, padding: "28px 22px 24px", minHeight: 480 }}>
      {/* Big polaroid frame */}
      <div style={{ background: pal.card, borderRadius: 4, padding: "16px 16px 40px", boxShadow: "0 4px 24px rgba(0,0,0,0.13)", marginBottom: 20, position: "relative" }}>
        {/* Photo area */}
        <div style={{ background: `rgba(${pal.accentRgb},0.09)`, height: 140, borderRadius: 2, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 4, overflow: "hidden" }}>
          {myProfile?.avatar_url || partnerProfile?.avatar_url ? (
            <div style={{ display: "flex", gap: 6, padding: 8 }}>
              {myProfile?.avatar_url && <img src={myProfile.avatar_url} style={{ height: 120, width: 100, objectFit: "cover", borderRadius: 2 }} />}
              {partnerProfile?.avatar_url && <img src={partnerProfile.avatar_url} style={{ height: 120, width: 100, objectFit: "cover", borderRadius: 2 }} />}
            </div>
          ) : (
            <div style={{ textAlign: "center" }}>
              <Camera style={{ width: 36, height: 36, color: pal.accent, opacity: 0.4, margin: "0 auto 6px" }} />
              <div style={{ fontSize: 11, color: pal.subtext }}>Your photos here</div>
            </div>
          )}
        </div>
        {/* Polaroid caption */}
        <div style={{ textAlign: "center", paddingTop: 8 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: pal.text, fontFamily: "Georgia,serif" }}>{title}</div>
          <div style={{ fontSize: 10, color: pal.subtext, marginTop: 4, fontStyle: "italic" }}>{tagline}</div>
        </div>
        {/* Tape strip decoration */}
        <div style={{ position: "absolute", top: -8, left: "50%", transform: "translateX(-50%)", width: 50, height: 18, background: `rgba(${pal.accentRgb},0.22)`, borderRadius: 2, opacity: 0.7 }} />
      </div>

      {/* Info strip */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, padding: "0 4px" }}>
        <div>
          <div style={{ fontSize: 10, color: pal.subtext }}>Together since</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: pal.text }}>{startDate ? formatDate(startDate) : "—"}</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 26, fontWeight: 900, color: pal.accent, lineHeight: 1 }}>{days.toLocaleString()}</div>
          <div style={{ fontSize: 9, color: pal.subtext, textTransform: "uppercase", letterSpacing: "0.06em" }}>days</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 10, color: pal.subtext }}>Memories</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: pal.text }}>{photoCount} photos</div>
        </div>
      </div>

      {/* Stats row */}
      {showStats && (
        <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
          <StatBox value={days.toLocaleString()} label="Days" pal={pal} />
          <StatBox value={photoCount} label="Photos" pal={pal} />
          <StatBox value={messageCount} label="Messages" pal={pal} />
        </div>
      )}

      {/* Timeline */}
      {showTimeline && milestones.length > 0 && (
        <div style={{ background: pal.card, borderRadius: 12, padding: "12px 14px", border: `1px solid ${pal.line}` }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: pal.accent, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>📽 Film Roll</div>
          {milestones.map((m, i) => <TimelineItem key={m.id} m={m} pal={pal} last={i === milestones.length - 1} />)}
        </div>
      )}

      <div style={{ marginTop: 18, textAlign: "center", fontSize: 10, color: pal.subtext, opacity: 0.6 }}>usMoments ✦ usMoments.app</div>
    </div>
  );
}

// ─── 3. BOLD ──────────────────────────────────────────────────────────────────

function BoldCard({ pal, title, tagline, startDate, days, myProfile, partnerProfile, photoCount, messageCount, milestones, showStats, showTimeline }: CardProps) {
  return (
    <div style={{ background: pal.bg, padding: "36px 24px 28px", minHeight: 480, position: "relative", overflow: "hidden" }}>
      {/* Big accent line */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 5, background: pal.accent }} />

      {/* Giant number */}
      <div style={{ position: "absolute", top: 20, right: 16, fontSize: 90, fontWeight: 900, color: `rgba(${pal.accentRgb},0.07)`, lineHeight: 1, userSelect: "none", fontFamily: "Georgia,serif" }}>
        {days > 0 ? days : "∞"}
      </div>

      <div style={{ marginBottom: 24, position: "relative" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: pal.accent, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 8 }}>
          ✦ usMoments
        </div>
        <h2 style={{ fontSize: 28, fontWeight: 900, color: pal.text, lineHeight: 1.1, margin: "0 0 6px", fontFamily: "Georgia,serif" }}>{title}</h2>
        <p style={{ fontSize: 13, color: pal.subtext, fontStyle: "italic", margin: 0 }}>{tagline}</p>
      </div>

      {/* Divider */}
      <div style={{ height: 2, background: `rgba(${pal.accentRgb},0.2)`, marginBottom: 20, borderRadius: 1 }} />

      {/* Big days feature */}
      {startDate && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: pal.subtext, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Together since</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: pal.text }}>{formatDate(startDate)}</div>
        </div>
      )}

      {/* Couple avatars */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <Avatar profile={myProfile} size={44} pal={pal} />
        <div style={{ flex: 1, height: 1, background: `rgba(${pal.accentRgb},0.25)` }} />
        <Heart fill={pal.accent} color="transparent" style={{ width: 20, height: 20 }} />
        <div style={{ flex: 1, height: 1, background: `rgba(${pal.accentRgb},0.25)` }} />
        <Avatar profile={partnerProfile} size={44} pal={pal} />
      </div>

      {showStats && (
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          <StatBox value={days.toLocaleString()} label="Days" pal={pal} />
          <StatBox value={photoCount} label="Photos" pal={pal} />
          <StatBox value={messageCount} label="Messages" pal={pal} />
        </div>
      )}

      {showTimeline && milestones.length > 0 && (
        <div style={{ background: pal.card, borderRadius: 12, padding: "12px 14px", border: `1px solid rgba(${pal.accentRgb},0.15)` }}>
          {milestones.map((m, i) => <TimelineItem key={m.id} m={m} pal={pal} last={i === milestones.length - 1} />)}
        </div>
      )}

      <div style={{ marginTop: 20, fontSize: 10, color: pal.subtext, opacity: 0.6 }}>usMoments ✦ usMoments.app</div>
    </div>
  );
}

// ─── 4. CINEMA ────────────────────────────────────────────────────────────────

function CinemaCard({ pal, title, tagline, startDate, days, myProfile, partnerProfile, photoCount, messageCount, milestones, showStats, showTimeline }: CardProps) {
  return (
    <div style={{ background: pal.bg, padding: "0 0 24px", minHeight: 480, position: "relative" }}>
      {/* Film strip top */}
      <div style={{ height: 28, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", padding: "0 12px", gap: 6, marginBottom: 0 }}>
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} style={{ width: 14, height: 10, borderRadius: 2, background: `rgba(${pal.accentRgb},0.3)`, flexShrink: 0 }} />
        ))}
      </div>

      {/* Main poster area */}
      <div style={{ padding: "24px 22px 20px", position: "relative" }}>
        {/* Studio tag */}
        <div style={{ fontSize: 9, fontWeight: 700, color: `rgba(${pal.accentRgb},0.7)`, textTransform: "uppercase", letterSpacing: "0.2em", marginBottom: 10 }}>
          ★ usMoments Original
        </div>

        {/* Couple avatars */}
        <div style={{ display: "flex", justifyContent: "center", gap: 20, marginBottom: 18 }}>
          <div style={{ textAlign: "center" }}>
            <Avatar profile={myProfile} size={56} pal={pal} />
            <div style={{ fontSize: 10, color: pal.subtext, marginTop: 5 }}>{myProfile?.display_name ?? "You"}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 1, height: 20, background: pal.line }} />
            <Heart fill={pal.accent} color="transparent" style={{ width: 18, height: 18, margin: "4px 0" }} />
            <div style={{ width: 1, height: 20, background: pal.line }} />
          </div>
          <div style={{ textAlign: "center" }}>
            <Avatar profile={partnerProfile} size={56} pal={pal} />
            <div style={{ fontSize: 10, color: pal.subtext, marginTop: 5 }}>{partnerProfile?.display_name ?? "Partner"}</div>
          </div>
        </div>

        {/* Title treatment */}
        <h2 style={{ textAlign: "center", fontSize: 24, fontWeight: 900, color: pal.text, margin: "0 0 6px", letterSpacing: "-0.02em", fontFamily: "Georgia,serif", lineHeight: 1.1 }}>
          {title}
        </h2>
        <p style={{ textAlign: "center", fontSize: 11, color: pal.subtext, margin: "0 0 18px", fontStyle: "italic" }}>{tagline}</p>

        {/* Divider */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
          <div style={{ flex: 1, height: 1, background: pal.line }} />
          <div style={{ fontSize: 9, color: pal.accent, textTransform: "uppercase", letterSpacing: "0.1em" }}>
            {startDate ? formatDate(startDate) : ""}
          </div>
          <div style={{ flex: 1, height: 1, background: pal.line }} />
        </div>

        {showStats && (
          <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
            <StatBox value={days.toLocaleString()} label="Days" pal={pal} />
            <StatBox value={photoCount} label="Photos" pal={pal} />
            <StatBox value={messageCount} label="Messages" pal={pal} />
          </div>
        )}

        {showTimeline && milestones.length > 0 && (
          <div style={{ background: pal.card, borderRadius: 12, padding: "12px 14px", border: `1px solid ${pal.line}` }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: pal.accent, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>🎬 Scenes</div>
            {milestones.map((m, i) => <TimelineItem key={m.id} m={m} pal={pal} last={i === milestones.length - 1} />)}
          </div>
        )}
      </div>

      {/* Film strip bottom */}
      <div style={{ height: 22, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", padding: "0 12px", gap: 6 }}>
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} style={{ width: 14, height: 8, borderRadius: 2, background: `rgba(${pal.accentRgb},0.3)`, flexShrink: 0 }} />
        ))}
      </div>
    </div>
  );
}

// ─── 5. BLOOM ─────────────────────────────────────────────────────────────────

function BloomCard({ pal, title, tagline, startDate, days, myProfile, partnerProfile, photoCount, messageCount, milestones, showStats, showTimeline }: CardProps) {
  return (
    <div style={{ background: pal.bg, padding: "32px 22px 28px", minHeight: 480, position: "relative" }}>
      {/* Floral corners */}
      <div style={{ position: "absolute", top: 0, left: 0, fontSize: 32, opacity: 0.15, lineHeight: 1 }}>🌸</div>
      <div style={{ position: "absolute", top: 0, right: 0, fontSize: 32, opacity: 0.15, lineHeight: 1 }}>🌺</div>
      <div style={{ position: "absolute", bottom: 0, left: 0, fontSize: 28, opacity: 0.12, lineHeight: 1 }}>🌿</div>
      <div style={{ position: "absolute", bottom: 0, right: 0, fontSize: 28, opacity: 0.12, lineHeight: 1 }}>🌼</div>

      {/* Couple */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, marginBottom: 18 }}>
        <Avatar profile={myProfile} size={50} pal={pal} />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <div style={{ fontSize: 8, color: pal.subtext, textTransform: "uppercase", letterSpacing: "0.1em" }}>with love</div>
          <Heart fill={pal.accent} color="transparent" style={{ width: 20, height: 20 }} />
        </div>
        <Avatar profile={partnerProfile} size={50} pal={pal} />
      </div>

      {/* Title */}
      <h2 style={{ textAlign: "center", fontSize: 21, fontWeight: 800, color: pal.text, margin: "0 0 5px", fontFamily: "Georgia,serif", lineHeight: 1.2 }}>{title}</h2>
      <p style={{ textAlign: "center", fontSize: 12, color: pal.subtext, margin: "0 0 6px", fontStyle: "italic" }}>{tagline}</p>

      {/* Floral divider */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "14px 0" }}>
        <div style={{ flex: 1, height: 1, background: pal.line }} />
        <span style={{ fontSize: 14, opacity: 0.6 }}>✿</span>
        <div style={{ flex: 1, height: 1, background: pal.line }} />
      </div>

      {startDate && (
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <div style={{ display: "inline-block", background: `rgba(${pal.accentRgb},0.1)`, borderRadius: 99, padding: "4px 14px", fontSize: 11, color: pal.accent, fontWeight: 600 }}>
            🌸 Since {formatDate(startDate)}
          </div>
        </div>
      )}

      {showStats && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <StatBox value={days.toLocaleString()} label="Days" pal={pal} />
          <StatBox value={photoCount} label="Photos" pal={pal} />
          <StatBox value={messageCount} label="Messages" pal={pal} />
        </div>
      )}

      {showTimeline && milestones.length > 0 && (
        <div style={{ background: pal.card, borderRadius: 16, padding: "12px 14px", border: `1px solid rgba(${pal.accentRgb},0.18)` }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: pal.accent, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>🌺 Our Garden</div>
          {milestones.map((m, i) => <TimelineItem key={m.id} m={m} pal={pal} last={i === milestones.length - 1} />)}
        </div>
      )}

      <div style={{ marginTop: 16, textAlign: "center", fontSize: 9, color: pal.subtext, opacity: 0.6 }}>usMoments ✦ usMoments.app</div>
    </div>
  );
}

// ─── 6. NEON ──────────────────────────────────────────────────────────────────

function NeonCard({ pal, title, tagline, startDate, days, myProfile, partnerProfile, photoCount, messageCount, milestones, showStats, showTimeline }: CardProps) {
  return (
    <div style={{ background: pal.bg, padding: "30px 22px 26px", minHeight: 480, position: "relative", overflow: "hidden" }}>
      {/* Glow orbs */}
      <div style={{ position: "absolute", top: "-15%", left: "-10%", width: 200, height: 200, borderRadius: "50%", background: `radial-gradient(circle,rgba(${pal.accentRgb},0.18) 0%,transparent 70%)`, pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "-10%", right: "-5%", width: 180, height: 180, borderRadius: "50%", background: `radial-gradient(circle,rgba(${pal.accentRgb},0.12) 0%,transparent 70%)`, pointerEvents: "none" }} />

      {/* Tag */}
      <div style={{ fontSize: 9, fontWeight: 700, color: pal.accent, textTransform: "uppercase", letterSpacing: "0.2em", marginBottom: 14, textShadow: `0 0 10px rgba(${pal.accentRgb},0.8)` }}>
        ⚡ usMoments
      </div>

      {/* Couple */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <Avatar profile={myProfile} size={48} pal={pal} />
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 20, fontWeight: 900, color: pal.text, margin: "0 0 3px", lineHeight: 1.1, fontFamily: "Georgia,serif", textShadow: `0 0 20px rgba(${pal.accentRgb},0.4)` }}>
            {title}
          </h2>
          <p style={{ fontSize: 11, color: pal.subtext, margin: 0, fontStyle: "italic" }}>{tagline}</p>
        </div>
        <Avatar profile={partnerProfile} size={48} pal={pal} />
      </div>

      {/* Neon divider */}
      <div style={{ height: 1, background: `linear-gradient(90deg,transparent,rgba(${pal.accentRgb},0.7),transparent)`, marginBottom: 18, boxShadow: `0 0 8px rgba(${pal.accentRgb},0.4)` }} />

      {startDate && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: pal.subtext, marginBottom: 2 }}>Together since</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: pal.accent, textShadow: `0 0 10px rgba(${pal.accentRgb},0.6)` }}>
            {formatDate(startDate)}
          </div>
        </div>
      )}

      {showStats && (
        <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
          {[
            { v: days.toLocaleString(), l: "Days" },
            { v: photoCount, l: "Photos" },
            { v: messageCount, l: "Messages" },
          ].map(({ v, l }) => (
            <div key={l} style={{ flex: 1, background: pal.card, borderRadius: 12, padding: "10px 8px", textAlign: "center", border: `1px solid rgba(${pal.accentRgb},0.25)`, boxShadow: `0 0 12px rgba(${pal.accentRgb},0.1)` }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: pal.accent, lineHeight: 1, textShadow: `0 0 10px rgba(${pal.accentRgb},0.7)` }}>{v}</div>
              <div style={{ fontSize: 9, color: pal.subtext, marginTop: 3, textTransform: "uppercase", letterSpacing: "0.06em" }}>{l}</div>
            </div>
          ))}
        </div>
      )}

      {showTimeline && milestones.length > 0 && (
        <div style={{ background: pal.card, borderRadius: 14, padding: "12px 14px", border: `1px solid rgba(${pal.accentRgb},0.25)`, boxShadow: `0 0 20px rgba(${pal.accentRgb},0.07)` }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: pal.accent, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10, textShadow: `0 0 8px rgba(${pal.accentRgb},0.6)` }}>
            <Zap style={{ display: "inline", width: 10, height: 10 }} /> Highlights
          </div>
          {milestones.map((m, i) => <TimelineItem key={m.id} m={m} pal={pal} last={i === milestones.length - 1} />)}
        </div>
      )}

      <div style={{ marginTop: 18, fontSize: 9, color: pal.subtext, opacity: 0.5 }}>usMoments ✦ usMoments.app</div>
    </div>
  );
}

// ─── 7. WABI ──────────────────────────────────────────────────────────────────

function WabiCard({ pal, title, tagline, startDate, days, myProfile, partnerProfile, photoCount, messageCount, milestones, showStats, showTimeline }: CardProps) {
  return (
    <div style={{ background: pal.bg, padding: "36px 26px 30px", minHeight: 480, position: "relative" }}>
      {/* Minimal brush stroke top */}
      <div style={{ height: 3, background: `rgba(${pal.accentRgb},0.3)`, borderRadius: 2, marginBottom: 28, width: "40%" }} />

      {/* Title block */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 26, fontWeight: 700, color: pal.text, margin: "0 0 6px", letterSpacing: "-0.03em", lineHeight: 1.1, fontFamily: "Georgia,serif" }}>{title}</h2>
        <p style={{ fontSize: 12, color: pal.subtext, margin: 0, fontStyle: "italic", fontWeight: 300 }}>{tagline}</p>
      </div>

      {/* Couple names — minimal */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
        <Avatar profile={myProfile} size={40} pal={pal} />
        <div style={{ fontSize: 12, color: pal.subtext }}>and</div>
        <Avatar profile={partnerProfile} size={40} pal={pal} />
      </div>

      {/* Thin divider */}
      <div style={{ height: 1, background: `rgba(${pal.accentRgb},0.2)`, marginBottom: 20 }} />

      {startDate && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 9, color: pal.subtext, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 3 }}>Since</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: pal.text }}>{formatDate(startDate)}</div>
          <div style={{ fontSize: 11, color: pal.subtext, marginTop: 2 }}>{days.toLocaleString()} days</div>
        </div>
      )}

      {showStats && (
        <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
          {[
            { v: photoCount, l: "photos" },
            { v: messageCount, l: "messages" },
          ].map(({ v, l }) => (
            <div key={l}>
              <div style={{ fontSize: 22, fontWeight: 700, color: pal.text, lineHeight: 1 }}>{v}</div>
              <div style={{ fontSize: 9, color: pal.subtext, textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 2 }}>{l}</div>
            </div>
          ))}
        </div>
      )}

      {showTimeline && milestones.length > 0 && (
        <div style={{ marginTop: 4 }}>
          <div style={{ fontSize: 9, color: pal.subtext, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 12 }}>Moments</div>
          {milestones.map((m, i) => <TimelineItem key={m.id} m={m} pal={pal} last={i === milestones.length - 1} />)}
        </div>
      )}

      {/* Bottom brush */}
      <div style={{ height: 2, background: `rgba(${pal.accentRgb},0.2)`, borderRadius: 2, marginTop: 24, width: "60%", marginLeft: "auto" }} />
      <div style={{ marginTop: 8, textAlign: "right", fontSize: 9, color: pal.subtext, opacity: 0.5 }}>usMoments ✦</div>
    </div>
  );
}

// ─── 8. JOURNAL ───────────────────────────────────────────────────────────────

function JournalCard({ pal, title, tagline, startDate, days, myProfile, partnerProfile, photoCount, messageCount, milestones, showStats, showTimeline }: CardProps) {
  return (
    <div style={{ background: pal.bg, padding: "28px 24px 28px", minHeight: 480, position: "relative" }}>
      {/* Ruled lines effect */}
      {Array.from({ length: 18 }).map((_, i) => (
        <div key={i} style={{
          position: "absolute", left: 0, right: 0,
          top: 60 + i * 26,
          height: 1, background: `rgba(${pal.accentRgb},0.07)`, pointerEvents: "none",
        }} />
      ))}

      {/* Left binding line */}
      <div style={{ position: "absolute", left: 52, top: 0, bottom: 0, width: 2, background: `rgba(${pal.accentRgb},0.2)` }} />
      {/* Red margin line */}
      <div style={{ position: "absolute", left: 50, top: 0, bottom: 0, width: 1, background: `rgba(220,38,38,0.25)` }} />

      {/* Main content — left padding for binding */}
      <div style={{ paddingLeft: 20, position: "relative" }}>
        {/* Date header */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, color: pal.subtext, fontStyle: "italic", marginBottom: 4 }}>
            {startDate ? formatDate(startDate) : "Dear diary…"}
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: pal.text, margin: 0, lineHeight: 1.15, fontFamily: "Georgia,serif" }}>{title}</h2>
        </div>

        {/* Couple row */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <Avatar profile={myProfile} size={38} pal={pal} />
          <span style={{ fontSize: 13, color: pal.subtext, fontStyle: "italic" }}>and</span>
          <Avatar profile={partnerProfile} size={38} pal={pal} />
        </div>

        {/* Tagline as journal entry */}
        <p style={{ fontSize: 13, color: pal.subtext, fontStyle: "italic", margin: "0 0 18px", lineHeight: 1.65 }}>
          "{tagline}"
        </p>

        {startDate && (
          <div style={{ marginBottom: 18, padding: "10px 12px", background: `rgba(${pal.accentRgb},0.08)`, borderRadius: 8, borderLeft: `3px solid rgba(${pal.accentRgb},0.5)` }}>
            <div style={{ fontSize: 10, color: pal.subtext, marginBottom: 2 }}>Together since</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: pal.text }}>{formatDate(startDate)}</div>
            <div style={{ fontSize: 11, color: pal.subtext, marginTop: 1 }}>{days.toLocaleString()} beautiful days</div>
          </div>
        )}

        {showStats && (
          <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
            <StatBox value={days.toLocaleString()} label="Days" pal={pal} />
            <StatBox value={photoCount} label="Photos" pal={pal} />
            <StatBox value={messageCount} label="Messages" pal={pal} />
          </div>
        )}

        {showTimeline && milestones.length > 0 && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: pal.accent, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>📖 Entries</div>
            {milestones.map((m, i) => <TimelineItem key={m.id} m={m} pal={pal} last={i === milestones.length - 1} />)}
          </div>
        )}

        <div style={{ marginTop: 20, fontSize: 10, color: pal.subtext, opacity: 0.5, fontStyle: "italic" }}>— usMoments ✦ usMoments.app</div>
      </div>
    </div>
  );
}
