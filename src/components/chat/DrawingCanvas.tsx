import { useRef, useState, useEffect, useCallback, memo } from "react";
import { X, Send, Eraser, Pencil, Minus, Square, Circle, Type } from "lucide-react";
import { COLORS, SIZES, TOOL_KEYS, type Tool } from "./canvas/canvas.constants";
import {
  normalizeRect, floodFill, setupHiDpiCanvas,
  clampTextPos, snapshotCanvas, restoreSnapshot,
} from "./canvas/canvas.utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  onSend: (dataUrl: string) => void;
  onClose: () => void;
}

// Widen the literal-union colour types from constants to plain string
// so that the custom colour picker (which always yields `string`) is compatible.
type Color = string;

// ─── Constants ────────────────────────────────────────────────────────────────

const TOOLS: { id: Tool; label: string; key: string; icon: React.ReactNode }[] = [
  { id: "pen", label: "Pen", key: "P", icon: <Pencil className="h-4 w-4" /> },
  { id: "eraser", label: "Eraser", key: "E", icon: <Eraser className="h-4 w-4" /> },
  { id: "line", label: "Line", key: "L", icon: <Minus className="h-4 w-4" /> },
  { id: "rect", label: "Rect", key: "R", icon: <Square className="h-4 w-4" /> },
  { id: "circle", label: "Circle", key: "C", icon: <Circle className="h-4 w-4" /> },
  { id: "text", label: "Text", key: "T", icon: <Type className="h-4 w-4" /> },
  { id: "fill", label: "Fill", key: "F", icon: <span style={{ fontSize: 14 }}>🪣</span> },
];

const CURSOR: Record<Tool, string> = {
  pen: "crosshair", eraser: "crosshair", line: "crosshair",
  rect: "crosshair", circle: "crosshair", text: "text", fill: "cell",
};

const swatchStyle = (active: boolean, c: Color): React.CSSProperties => ({
  background: c,
  transform: active ? "scale(1.25)" : "scale(1)",
  boxShadow: active ? `0 0 0 2px hsl(var(--wa-header)), 0 0 0 3.5px ${c}` : "none",
  transition: "transform 0.1s, box-shadow 0.1s",
});

// ─── Component ────────────────────────────────────────────────────────────────

export const DrawingCanvas = memo(function DrawingCanvas({ onSend, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);

  // All draw-state lives in a ref so pointer callbacks never go stale
  const live = useRef<{
    color: Color;
    size: number; opacity: number; tool: Tool; dpr: number;
  }>({
    color: COLORS[0],
    size: SIZES[1],
    opacity: 100,
    tool: "pen",
    dpr: 1,
  });

  // UI state — only used for re-renders
  const [color, setColorState] = useState<Color>(COLORS[0]);
  const [size, setSizeState] = useState<number>(SIZES[1]);
  const [tool, setToolState] = useState<Tool>("pen");
  const [opacity, setOpacityState] = useState<number>(100);
  const [fontSize, setFontSize] = useState<number>(24);
  const [isDrawing, setIsDrawing] = useState(false);
  const [showText, setShowText] = useState(false);
  const [textPos, setTextPos] = useState({ x: 0, y: 0 });
  const [textValue, setTextValue] = useState("");

  // Unified setters keep live ref + UI state in sync
  const setColor = useCallback((v: Color) => { live.current.color = v; setColorState(v); }, []);
  const setSize = useCallback((v: number) => { live.current.size = v; setSizeState(v); }, []);
  const setTool = useCallback((v: Tool) => { live.current.tool = v; setToolState(v); }, []);
  const setOpacity = useCallback((v: number) => { live.current.opacity = v; setOpacityState(v); }, []);

  // ── Canvas resize ──────────────────────────────────────────────────────────

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    const container = containerRef.current;
    if (!canvas || !overlay || !container) return;

    const { clientWidth: w, clientHeight: h } = container;
    if (!w || !h) return;

    let snapshot: string | null = null;
    if (canvas.width > 0) try { snapshot = snapshotCanvas(canvas); } catch { /* ignore */ }

    const { ratio } = setupHiDpiCanvas(canvas, w, h);
    live.current.dpr = ratio;

    overlay.width = canvas.width;
    overlay.height = canvas.height;
    overlay.style.width = canvas.style.width;
    overlay.style.height = canvas.style.height;
    const overlayCtx = overlay.getContext("2d");
    if (overlayCtx) {
      overlayCtx.setTransform(ratio, 0, 0, ratio, 0, 0);
      overlayCtx.lineCap = "round";
      overlayCtx.lineJoin = "round";
    }

    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    if (snapshot) restoreSnapshot(ctx, snapshot, w, h);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    resizeCanvas();
    const ro = new ResizeObserver(resizeCanvas);
    ro.observe(container);
    return () => ro.disconnect();
  }, [resizeCanvas]);

  // ── Pointer events ─────────────────────────────────────────────────────────

  const getPos = useCallback((e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  const startPos = useRef<{ x: number; y: number } | null>(null);
  const activePointer = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const pendingPos = useRef<{ x: number; y: number } | null>(null);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (activePointer.current !== null && e.pointerId !== activePointer.current) return;
    activePointer.current = e.pointerId;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    const pos = getPos(e);
    const { tool, color, opacity, size, dpr } = live.current;

    if (tool === "text") {
      const container = containerRef.current;
      setTextPos(clampTextPos(pos.x, pos.y, container?.clientWidth ?? 400, container?.clientHeight ?? 600));
      setTextValue("");
      setShowText(true);
      setTimeout(() => textInputRef.current?.focus(), 50);
      return;
    }

    if (tool === "fill") {
      const canvas = canvasRef.current;
      if (canvas) floodFill(canvas, pos.x * dpr, pos.y * dpr, color);
      return;
    }

    setIsDrawing(true);
    startPos.current = pos;

    if (tool === "pen" || tool === "eraser") {
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx) return;
      if (tool === "eraser") {
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "destination-out";
        ctx.strokeStyle = "rgba(0,0,0,1)";
        ctx.lineWidth = size * 2;
      } else {
        ctx.globalAlpha = opacity / 100;
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = color;
        ctx.lineWidth = e.pointerType === "pen" && e.pressure > 0
          ? size * (0.5 + e.pressure) : size;
      }
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    }
  }, [getPos]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDrawing || e.pointerId !== activePointer.current) return;

    const { tool, color, opacity, size, dpr } = live.current;

    if (tool === "pen" || tool === "eraser") {
      pendingPos.current = getPos(e);
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const pos = pendingPos.current;
        if (!pos) return;
        const ctx = canvasRef.current?.getContext("2d");
        if (!ctx) return;
        if (e.pointerType === "pen" && e.pressure > 0 && tool !== "eraser") {
          ctx.lineWidth = live.current.size * (0.5 + e.pressure);
        }
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
      });
      return;
    }

    const overlay = overlayRef.current;
    const octx = overlay?.getContext("2d");
    if (!octx || !overlay || !startPos.current) return;

    const pos = getPos(e);
    const { x: sx, y: sy } = startPos.current;
    const { x: ex, y: ey } = pos;

    octx.clearRect(0, 0, overlay.width / dpr, overlay.height / dpr);
    octx.globalAlpha = opacity / 100;
    octx.strokeStyle = color;
    octx.lineWidth = size;
    octx.lineCap = "round";
    octx.beginPath();

    if (tool === "line") {
      octx.moveTo(sx, sy);
      octx.lineTo(ex, ey);
    } else if (tool === "rect") {
      const { x, y, w, h } = normalizeRect(sx, sy, ex, ey);
      octx.rect(x, y, w, h);
    } else if (tool === "circle") {
      const { x, y, w, h } = normalizeRect(sx, sy, ex, ey);
      octx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    }
    octx.stroke();
  }, [isDrawing, getPos]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (e.pointerId !== activePointer.current) return;
    activePointer.current = null;
    if (!isDrawing) return;
    setIsDrawing(false);

    const { tool, opacity, dpr } = live.current;

    if (tool === "pen" || tool === "eraser") {
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      const ctx = canvasRef.current?.getContext("2d");
      if (ctx) { ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1; }
      return;
    }

    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    const ctx = canvas?.getContext("2d");
    const octx = overlay?.getContext("2d");
    if (!canvas || !overlay || !ctx || !octx) return;

    ctx.globalAlpha = opacity / 100;
    ctx.drawImage(
      overlay,
      0,
      0,
      overlay.width,
      overlay.height,
      0,
      0,
      canvas.width / dpr,
      canvas.height / dpr,
    );
    ctx.globalAlpha = 1;
    octx.clearRect(0, 0, overlay.width / dpr, overlay.height / dpr);
    startPos.current = null;
  }, [isDrawing]);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (document.activeElement === textInputRef.current) return;
      const mapped = TOOL_KEYS[e.key.toLowerCase()];
      if (mapped) setTool(mapped);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setTool]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const commitText = useCallback(() => {
    if (!textValue.trim()) { setShowText(false); return; }
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.globalAlpha = live.current.opacity / 100;
    ctx.fillStyle = live.current.color;
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.fillText(textValue, textPos.x, textPos.y);
    ctx.globalAlpha = 1;
    setShowText(false);
    setTextValue("");
  }, [textValue, textPos, fontSize]);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const container = containerRef.current;
    if (!ctx || !canvas) return;
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, container?.clientWidth ?? canvas.width, container?.clientHeight ?? canvas.height);
  }, []);

  const handleSend = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas) return;
    const w = container?.clientWidth ?? 800;
    const h = container?.clientHeight ?? 600;
    const off = document.createElement("canvas");
    off.width = w;
    off.height = h;
    const ctx = off.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, w, h);
    onSend(off.toDataURL("image/png"));
  }, [onSend]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-[90] flex flex-col"
      style={{ background: "hsl(var(--background))", height: "100dvh" }}
      role="dialog"
      aria-modal="true"
      aria-label="Drawing canvas"
    >
      {/* ── Top bar ── */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0"
        style={{ background: "hsl(var(--wa-header))", paddingTop: "calc(0.5rem + env(safe-area-inset-top, 0px))" }}
      >
        <button
          onClick={onClose}
          className="p-2 rounded-full"
          style={{ color: "hsl(var(--wa-text))" }}
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <span className="text-sm font-semibold" style={{ color: "hsl(var(--wa-text))" }}>
          ✏️ Draw &amp; Send
        </span>

        <button
          onClick={clearCanvas}
          className="px-2 py-1 rounded-lg text-xs font-medium"
          style={{ color: "hsl(var(--wa-text) / 0.6)" }}
        >
          Clear
        </button>
      </div>

      {/* ── Tool bar ── */}
      <div
        className="flex items-center px-1 py-1 border-b border-border shrink-0 overflow-x-auto"
        style={{ background: "hsl(var(--wa-header))", gap: "clamp(0px, 0.5vw, 4px)" }}
      >
        {TOOLS.map(t => (
          <button
            key={t.id}
            onClick={() => setTool(t.id)}
            aria-label={`${t.label} (${t.key})`}
            aria-pressed={tool === t.id}
            className="flex items-center gap-1 rounded-lg font-medium transition-colors shrink-0"
            style={{
              padding: "clamp(4px, 1.2vw, 8px) clamp(6px, 1.5vw, 10px)",
              fontSize: "clamp(10px, 1.5vw, 12px)",
              minHeight: 36,
              background: tool === t.id ? "hsl(var(--wa-online) / 0.15)" : "transparent",
              color: tool === t.id ? "hsl(var(--wa-online))" : "hsl(var(--wa-text) / 0.6)",
            }}
          >
            {t.icon}
            {/* Label hidden on xs, shown from sm up */}
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* ── Canvas ── */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden relative"
        style={{ background: "#ffffff", touchAction: "none" }}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0"
          style={{ cursor: CURSOR[tool], touchAction: "none" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          aria-label="Drawing surface"
        />
        <canvas
          ref={overlayRef}
          className="absolute inset-0 pointer-events-none"
          style={{ zIndex: 1 }}
        />

        {/* Floating text input */}
        {showText && (
          <div
            className="absolute z-10 flex items-center gap-1"
            style={{ left: textPos.x, top: textPos.y - fontSize - 4 }}
          >
            <input
              ref={textInputRef}
              value={textValue}
              onChange={e => setTextValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") commitText();
                if (e.key === "Escape") setShowText(false);
              }}
              className="border border-border rounded px-2 py-1 bg-white text-black outline-none shadow-lg"
              style={{ fontSize, minWidth: "min(120px, 40vw)", maxWidth: "min(220px, 60vw)" }}
              placeholder="Type here…"
            />
            <button
              onClick={commitText}
              className="px-2 py-1 rounded text-xs font-semibold text-white"
              style={{ background: "hsl(var(--wa-online))" }}
            >
              OK
            </button>
            <button
              onClick={() => setShowText(false)}
              className="px-2 py-1 rounded text-xs text-white"
              style={{ background: "hsl(var(--wa-text) / 0.3)" }}
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* ── Bottom toolbar ── */}
      <div
        className="shrink-0 border-t border-border px-3 pt-2"
        style={{
          background: "hsl(var(--wa-header))",
          paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))",
        }}
      >
        {/* Row 1: Draw colors */}
        <div className="flex items-center gap-0.5 mb-1 overflow-x-auto">

          {/* Draw colour swatches */}
          <div className="flex items-center shrink-0" style={{ gap: "clamp(0px, 0.5vw, 2px)" }} role="group" aria-label="Brush color">
            {COLORS.map(c => (
              <button
                key={c}
                onClick={() => { setColor(c); if (tool === "eraser") setTool("pen"); }}
                aria-label={`Color ${c}`}
                aria-pressed={tool !== "eraser" && color === c}
                className="flex items-center justify-center shrink-0"
                style={{ minHeight: 44, minWidth: "clamp(32px, 6vw, 44px)" }}
              >
                <span
                  className="rounded-full block border border-black/10"
                  style={{
                    ...swatchStyle(tool !== "eraser" && color === c, c),
                    width: "clamp(20px, 4vw, 28px)",
                    height: "clamp(20px, 4vw, 28px)",
                  }}
                />
              </button>
            ))}

            {/* Custom colour picker */}
            <label
              className="flex items-center justify-center cursor-pointer shrink-0"
              style={{ minHeight: 44, minWidth: "clamp(32px, 6vw, 44px)" }}
              aria-label="Custom color"
            >
              <span
                className="rounded-full border-2 border-dashed border-border flex items-center justify-center"
                style={{
                  width: "clamp(20px, 4vw, 28px)",
                  height: "clamp(20px, 4vw, 28px)",
                  fontSize: 10,
                  color: "hsl(var(--wa-meta))",
                }}
              >
                +
              </span>
              <input
                type="color"
                className="sr-only"
                value={color}
                onChange={e => { setColor(e.target.value); if (tool === "eraser") setTool("pen"); }}
              />
            </label>
          </div>
        </div>

        {/* Row 2: Brush size + Opacity + Font size (text only) + Send */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">

          {/* Brush sizes */}
          <div className="flex items-center gap-0.5 shrink-0" role="group" aria-label="Brush size">
            {SIZES.map(s => (
              <button
                key={s}
                onClick={() => setSize(s)}
                aria-label={`Size ${s}`}
                aria-pressed={size === s}
                className="flex items-center justify-center rounded-full transition-colors"
                style={{
                  minHeight: 44,
                  minWidth: "clamp(32px, 6vw, 44px)",
                  background: size === s ? "hsl(var(--wa-text) / 0.12)" : "transparent",
                }}
              >
                <span
                  className="rounded-full block"
                  style={{
                    width: s + 2,
                    height: s + 2,
                    background: tool === "eraser" ? "#aaa" : color,
                  }}
                />
              </button>
            ))}
          </div>

          {/* Opacity slider */}
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <span className="shrink-0" style={{ fontSize: 10, color: "hsl(var(--wa-meta))" }}>
              {opacity}%
            </span>
            <input
              type="range"
              min={10} max={100} step={10}
              value={opacity}
              onChange={e => setOpacity(Number(e.target.value))}
              className="w-full h-1 rounded-full"
              aria-label="Opacity"
              style={{ accentColor: "hsl(var(--wa-online))", minWidth: 60 }}
            />
          </div>

          {/* Font size — text tool only */}
          {tool === "text" && (
            <div className="flex items-center gap-1 shrink-0">
              <span style={{ fontSize: 10, color: "hsl(var(--wa-meta))" }}>
                Aa {fontSize}px
              </span>
              <input
                type="range"
                min={12} max={64} step={4}
                value={fontSize}
                onChange={e => setFontSize(Number(e.target.value))}
                className="h-1 rounded-full"
                style={{ width: "clamp(60px, 12vw, 80px)", accentColor: "hsl(var(--wa-online))" }}
                aria-label="Font size"
              />
            </div>
          )}

          {/* Send */}
          <button
            onClick={handleSend}
            className="flex items-center justify-center rounded-full transition-transform active:scale-95 shrink-0 ml-auto"
            style={{
              width: "clamp(40px, 8vw, 44px)",
              height: "clamp(40px, 8vw, 44px)",
              background: "hsl(var(--wa-online))",
            }}
            aria-label="Send drawing"
          >
            <Send className="h-5 w-5 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
});

export default DrawingCanvas;
