// src/components/chat/canvas/canvas.utils.ts

import { MAX_CANVAS_WIDTH, MAX_CANVAS_HEIGHT } from "./canvas.constants";

// ─── FIX 1: Compressed history using dataURL instead of ImageData ─────────────
// ImageData at 1500x800 = ~4.8MB per state × 30 states = 144MB.
// dataURL (webp 0.7) ≈ 30–80KB per state × 15 states = ~1MB max.
export function snapshotCanvas(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL("image/webp", 0.7);
}

export function restoreSnapshot(
  ctx: CanvasRenderingContext2D,
  snapshot: string,
  w: number,
  h: number,
): Promise<void> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => { ctx.drawImage(img, 0, 0, w, h); resolve(); };
    img.onerror = () => resolve();
    img.src = snapshot;
  });
}

// ─── FIX 2: Normalize rect/circle coords so negative sizes work ───────────────
export function normalizeRect(
  sx: number, sy: number, ex: number, ey: number,
) {
  return {
    x: Math.min(sx, ex),
    y: Math.min(sy, ey),
    w: Math.abs(ex - sx),
    h: Math.abs(ey - sy),
  };
}

// ─── FIX 3: Flood fill using Uint8Array instead of Set (10x faster) ──────────
export function floodFill(
  canvas: HTMLCanvasElement,
  startX: number,
  startY: number,
  fillHex: string,
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data      = imageData.data;
  const width     = canvas.width;
  const height    = canvas.height;

  const toIdx = (x: number, y: number) => (y * width + x) * 4;

  const sx = Math.round(startX);
  const sy = Math.round(startY);
  if (sx < 0 || sx >= width || sy < 0 || sy >= height) return;

  const targetIdx = toIdx(sx, sy);
  const tr = data[targetIdx];
  const tg = data[targetIdx + 1];
  const tb = data[targetIdx + 2];
  // FIX 13: ignore alpha channel in target comparison — alpha variations
  // (e.g. from anti-aliasing) would otherwise break fill boundaries.

  const r = parseInt(fillHex.slice(1, 3), 16);
  const g = parseInt(fillHex.slice(3, 5), 16);
  const b = parseInt(fillHex.slice(5, 7), 16);

  // If already same color, nothing to do
  if (tr === r && tg === g && tb === b) return;

  // FIX 3: Uint8Array instead of Set — 10x faster for large fills
  const visited = new Uint8Array(width * height);
  const stack   = [sx + sy * width];

  while (stack.length) {
    const pos = stack.pop()!;
    const x   = pos % width;
    const y   = Math.floor(pos / width);

    if (x < 0 || x >= width || y < 0 || y >= height) continue;
    if (visited[pos]) continue;

    const idx = pos * 4;
    // FIX 13: compare only RGB, not alpha
    if (data[idx] !== tr || data[idx + 1] !== tg || data[idx + 2] !== tb) continue;

    visited[pos] = 1;
    data[idx]     = r;
    data[idx + 1] = g;
    data[idx + 2] = b;
    data[idx + 3] = 255;

    stack.push(pos + 1, pos - 1, pos + width, pos - width);
  }

  ctx.putImageData(imageData, 0, 0);
}

// ─── FIX 14: Apply devicePixelRatio for crisp retina rendering ────────────────
export function setupHiDpiCanvas(
  canvas: HTMLCanvasElement,
  displayWidth: number,
  displayHeight: number,
): { ratio: number; physicalW: number; physicalH: number } {
  const ratio    = Math.min(window.devicePixelRatio || 1, 2); // cap at 2x
  const physicalW = Math.min(Math.round(displayWidth  * ratio), MAX_CANVAS_WIDTH  * ratio);
  const physicalH = Math.min(Math.round(displayHeight * ratio), MAX_CANVAS_HEIGHT * ratio);

  canvas.width  = physicalW;
  canvas.height = physicalH;
  // CSS size stays the same — canvas scales internally
  canvas.style.width  = `${displayWidth}px`;
  canvas.style.height = `${displayHeight}px`;

  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.scale(ratio, ratio);
    ctx.lineCap  = "round";
    ctx.lineJoin = "round";
  }

  return { ratio, physicalW, physicalH };
}

// ─── FIX 11: Download with Safari fallback ────────────────────────────────────
export function downloadCanvas(canvas: HTMLCanvasElement, filename: string): void {
  const dataUrl = canvas.toDataURL("image/png");
  try {
    const link    = document.createElement("a");
    link.download = filename;
    link.href     = dataUrl;
    link.click();
  } catch {
    // iOS Safari fallback
    window.open(dataUrl, "_blank");
  }
}

// ─── FIX 8: Clamp text input position so it stays on screen ──────────────────
export function clampTextPos(
  x: number,
  y: number,
  canvasDisplayWidth: number,
  canvasDisplayHeight: number,
): { x: number; y: number } {
  return {
    x: Math.min(Math.max(x, 4), canvasDisplayWidth  - 180),
    y: Math.min(Math.max(y, 40), canvasDisplayHeight - 20),
  };
}
