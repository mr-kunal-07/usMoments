import { useCallback, useEffect, useState } from "react";

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type InstallOutcome = "accepted" | "dismissed" | "unavailable" | "error";
type NavigatorWithStandalone = Navigator & { standalone?: boolean };
type WindowWithMSStream = Window & { MSStream?: unknown };

interface InstallState {
  prompt: BeforeInstallPromptEvent | null;
  isInstalled: boolean;
  isInstalling: boolean;
}

const subscribers = new Set<() => void>();
let initialized = false;
let installState: InstallState = {
  prompt: null,
  isInstalled: false,
  isInstalling: false,
};

export function isInstalledStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches
    || (window.navigator as NavigatorWithStandalone).standalone === true
  );
}

export function isIOSInstallTarget() {
  if (typeof window === "undefined") return false;
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent)
    && !(window as WindowWithMSStream).MSStream
    && !isInstalledStandalone()
  );
}

function publish(patch: Partial<InstallState>) {
  installState = { ...installState, ...patch };
  subscribers.forEach((subscriber) => subscriber());
}

export function initializePWAInstall() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  installState = { ...installState, isInstalled: isInstalledStandalone() };

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    publish({ prompt: event as BeforeInstallPromptEvent, isInstalled: false });
  });

  window.addEventListener("appinstalled", () => {
    publish({ prompt: null, isInstalled: true, isInstalling: false });
  });

  window.matchMedia("(display-mode: standalone)").addEventListener("change", () => {
    publish({ isInstalled: isInstalledStandalone() });
  });
}

async function requestInstall(): Promise<InstallOutcome> {
  const prompt = installState.prompt;
  if (!prompt || installState.isInstalling) return "unavailable";

  publish({ isInstalling: true });
  try {
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    // A BeforeInstallPromptEvent is single-use, including after dismissal.
    publish({ prompt: null, isInstalling: false });
    return outcome;
  } catch (error) {
    console.error("[pwa] install prompt failed", error);
    publish({ prompt: null, isInstalling: false });
    return "error";
  }
}

export function usePWAInstall() {
  const [state, setState] = useState(installState);

  useEffect(() => {
    initializePWAInstall();
    const sync = () => setState(installState);
    subscribers.add(sync);
    sync();
    return () => {
      subscribers.delete(sync);
    };
  }, []);

  const install = useCallback(() => requestInstall(), []);

  return {
    canInstall: Boolean(state.prompt) && !state.isInstalled,
    install,
    isIOS: isIOSInstallTarget(),
    isInstalled: state.isInstalled,
    isInstalling: state.isInstalling,
  };
}
