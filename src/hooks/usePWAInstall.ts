import { useCallback, useEffect, useState } from "react";

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type NavigatorWithStandalone = Navigator & { standalone?: boolean };
type WindowWithMSStream = Window & { MSStream?: unknown };

export function isInstalledStandalone() {
  if (typeof window === "undefined") return false;

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as NavigatorWithStandalone).standalone === true
  );
}

export function isIOSInstallTarget() {
  if (typeof window === "undefined") return false;

  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) &&
    !(window as WindowWithMSStream).MSStream &&
    !isInstalledStandalone()
  );
}

export function usePWAInstall() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const updateInstallState = () => {
      setIsInstalled(isInstalledStandalone());
      setIsIOS(isIOSInstallTarget());
    };

    updateInstallState();

    const beforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as BeforeInstallPromptEvent);
      updateInstallState();
    };

    const appInstalled = () => {
      setPrompt(null);
      setIsInstalled(true);
      setIsIOS(false);
    };

    const standaloneQuery = window.matchMedia("(display-mode: standalone)");
    standaloneQuery.addEventListener("change", updateInstallState);
    window.addEventListener("beforeinstallprompt", beforeInstallPrompt);
    window.addEventListener("appinstalled", appInstalled);

    return () => {
      standaloneQuery.removeEventListener("change", updateInstallState);
      window.removeEventListener("beforeinstallprompt", beforeInstallPrompt);
      window.removeEventListener("appinstalled", appInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!prompt) return "unavailable" as const;

    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") {
      setPrompt(null);
      setIsInstalled(true);
    }

    return outcome;
  }, [prompt]);

  return {
    canInstall: !!prompt,
    install,
    isIOS,
    isInstalled,
  };
}
