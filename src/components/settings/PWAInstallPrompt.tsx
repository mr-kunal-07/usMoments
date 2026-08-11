import { useState, useEffect } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePWAInstall } from "@/hooks/usePWAInstall";

const PWA_DISMISS_KEY = "pwa-dismissed-at";
const DISMISS_COOLDOWN_MS = 1000 * 60 * 60 * 24 * 3;

export function PWAInstallPrompt() {
  const [dismissed, setDismissed] = useState(false);
  const { canInstall, install, isIOS, isInstalled } = usePWAInstall();

  useEffect(() => {
    const lastDismissedAt = Number(localStorage.getItem(PWA_DISMISS_KEY) ?? "0");
    const isCoolingDown = Number.isFinite(lastDismissedAt) && Date.now() - lastDismissedAt < DISMISS_COOLDOWN_MS;
    setDismissed(isCoolingDown || isInstalled);
  }, [isInstalled]);

  const handleInstall = async () => {
    const outcome = await install();
    if (outcome === "accepted") {
      setDismissed(true);
      return;
    }

    localStorage.setItem(PWA_DISMISS_KEY, String(Date.now()));
    setDismissed(true);
  };

  const handleDismiss = () => {
    localStorage.setItem(PWA_DISMISS_KEY, String(Date.now()));
    setDismissed(true);
  };

  if (dismissed) return null;

  if (canInstall) {
    return (
      <div className="fixed bottom-20 sm:bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 z-50 animate-in slide-in-from-bottom-4 duration-300">
        <div className="glass-card rounded-2xl p-4 shadow-xl flex items-start gap-3">
          <img src="/pwa-icon-192.png" alt="App icon" className="h-12 w-12 rounded-xl shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm font-heading">Install usMoments</p>
            <p className="text-xs text-muted-foreground mt-0.5">Add it to your home screen for a smoother mobile experience.</p>
            <div className="flex gap-2 mt-3">
              <Button size="sm" className="h-8 text-xs gap-1.5 flex-1" onClick={handleInstall}>
                <Download className="h-3.5 w-3.5" /> Install
              </Button>
              <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={handleDismiss}>
                Later
              </Button>
            </div>
          </div>
          <button onClick={handleDismiss} className="text-muted-foreground hover:text-foreground shrink-0 mt-0.5">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  if (isIOS) {
    return (
      <div className="fixed bottom-20 left-4 right-4 z-50 animate-in slide-in-from-bottom-4 duration-300">
        <div className="glass-card rounded-2xl p-4 shadow-xl flex items-start gap-3">
          <img src="/pwa-icon-192.png" alt="App icon" className="h-12 w-12 rounded-xl shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm font-heading">Install usMoments</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Tap <span className="font-medium">Share</span> then <span className="font-medium">Add to Home Screen</span>.
            </p>
          </div>
          <button onClick={handleDismiss} className="text-muted-foreground hover:text-foreground shrink-0 mt-0.5">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return null;
}
