// src/components/chat/canvas/canvas.constants.ts

export const COLORS = [
  "#1a1a1a", "#ffffff", "#ef4444", "#f97316", "#eab308",
  "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899", "#06b6d4",
] as const;

export const BG_COLORS = [
  "#ffffff", "#fff9f0", "#f0f7ff", "#f0fff4", "#1a1a1a",
] as const;

export const SIZES = [2, 4, 8, 14, 20] as const;

// FIX 1: Reduced from 30 to 15 to prevent memory explosion.
// At 1500x800 canvas each ImageData ≈ 4.8MB. 30 states = ~144MB.
// We store dataURLs (compressed) instead — see canvas.utils.ts.
export const HISTORY_LIMIT = 15;

// FIX 14: Max canvas resolution to prevent blurry retina AND
// limit DOS attack surface for user-generated content.
export const MAX_CANVAS_WIDTH  = 1200;
export const MAX_CANVAS_HEIGHT = 900;

export type Tool = "pen" | "eraser" | "line" | "rect" | "circle" | "text" | "fill";

export const TOOL_KEYS: Record<string, Tool> = {
  p: "pen",
  e: "eraser",
  l: "line",
  r: "rect",
  c: "circle",
  t: "text",
  f: "fill",
};
