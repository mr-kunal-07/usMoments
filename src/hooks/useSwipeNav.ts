import { useRef, useCallback } from "react";

interface Options {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  /** Minimum horizontal distance (px) to trigger. Default 60 */
  threshold?: number;
  /** Max vertical drift allowed (px) before cancelling. Default 80 */
  maxVerticalDrift?: number;
}

/**
 * Returns touch handlers to attach to a container element.
 * Fires onSwipeLeft / onSwipeRight when a qualifying horizontal swipe is detected.
 * Ignores swipes that start on a scrollable child (e.g. horizontal card carousels).
 */
export function useSwipeNav({
  onSwipeLeft,
  onSwipeRight,
  threshold = 60,
  maxVerticalDrift = 80,
}: Options) {
  const startX = useRef(0);
  const startY = useRef(0);
  const cancelled = useRef(false);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    startX.current = t.clientX;
    startY.current = t.clientY;
    cancelled.current = false;
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (cancelled.current) return;
    const dx = e.touches[0].clientX - startX.current;
    const dy = Math.abs(e.touches[0].clientY - startY.current);
    // Cancel if vertical movement too large
    if (dy > maxVerticalDrift) { cancelled.current = true; }
    // Cancel if horizontal scroll container is being used
    if (Math.abs(dx) > 10) {
      const el = e.target as HTMLElement;
      const scrollable = el.closest('[data-swipe-ignore]');
      if (scrollable) { cancelled.current = true; }
    }
  }, [maxVerticalDrift]);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (cancelled.current) return;
    const dx = e.changedTouches[0].clientX - startX.current;
    if (Math.abs(dx) < threshold) return;
    if (dx < 0) onSwipeLeft?.();
    else onSwipeRight?.();
  }, [threshold, onSwipeLeft, onSwipeRight]);

  return { onTouchStart, onTouchMove, onTouchEnd };
}
