import { Gauge, WifiOff } from "lucide-react";
import { useConnectionStatus } from "@/hooks/useConnectionStatus";

export function ConnectionStatusIndicator() {
  const { isOnline, isSlowConnection } = useConnectionStatus();

  if (isOnline && !isSlowConnection) return null;

  const Icon = isOnline ? Gauge : WifiOff;
  const message = isOnline
    ? "Slow connection detected. Loading may take longer."
    : "You are offline. Some features may be limited.";

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 px-4 py-2 text-center text-sm font-medium text-white transition-colors ${
        isOnline ? "bg-amber-600" : "bg-destructive"
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}
