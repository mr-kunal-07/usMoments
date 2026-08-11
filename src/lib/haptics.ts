type HapticPattern = "light" | "medium" | "success" | "warning";

const PATTERNS: Record<HapticPattern, number | number[]> = {
  light: 10,
  medium: 18,
  success: [12, 35, 12],
  warning: [30, 35, 30],
};

export function haptic(pattern: HapticPattern = "light") {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;

  try {
    navigator.vibrate(PATTERNS[pattern]);
  } catch {
    // Haptics are best-effort and should never block UI interactions.
  }
}
