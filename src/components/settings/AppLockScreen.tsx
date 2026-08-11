import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Delete, Fingerprint, Loader2, Lock, LogOut } from "lucide-react";
import {
  clearAppLock,
  getBiometricCredentialId,
  hasConfiguredPin,
  type LockMethod,
  verifyPin,
} from "@/hooks/useAppLock";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

const KEYS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["", "0", "backspace"],
];

type Screen = "lock" | "forgot-pin";

interface Props {
  lockMethod: LockMethod;
  onUnlock: () => void;
}

export function AppLockScreen({ lockMethod, onUnlock }: Props) {
  const [pin, setPin] = useState("");
  const [shake, setShake] = useState(false);
  const [biometricError, setBiometricError] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>("lock");
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  const handleBiometric = useCallback(async () => {
    setBiometricError(null);

    try {
      if (!("PublicKeyCredential" in window)) {
        setBiometricError("Biometrics not supported on this device.");
        return;
      }

      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);

      const credIdBase64 = getBiometricCredentialId();
      const allowCredentials: PublicKeyCredentialDescriptor[] = credIdBase64
        ? [
          {
            type: "public-key",
            id: Uint8Array.from(atob(credIdBase64), (char) => char.charCodeAt(0)),
            transports: ["internal"] as AuthenticatorTransport[],
          },
        ]
        : [];

      await navigator.credentials.get({
        publicKey: {
          challenge,
          timeout: 60_000,
          userVerification: "required",
          rpId: window.location.hostname,
          allowCredentials,
        },
      });

      onUnlock();
    } catch {
      if (hasConfiguredPin()) {
        setBiometricError("Biometric check failed. Enter your PIN.");
      } else {
        setBiometricError("Biometric unlock is not available on this device.");
      }
    }
  }, [onUnlock]);

  useEffect(() => {
    if (lockMethod === "biometric") {
      void handleBiometric();
    }
  }, [handleBiometric, lockMethod]);

  const handleKey = async (key: string) => {
    if (key === "backspace") {
      setPin((value) => value.slice(0, -1));
      return;
    }

    if (!key) return;

    const next = pin + key;
    setPin(next);

    if (next.length < 4) return;

    const isValid = await verifyPin(next);
    if (isValid) {
      setTimeout(() => onUnlock(), 120);
      return;
    }

    if (navigator.vibrate) navigator.vibrate([40, 30, 40]);
    setShake(true);
    setTimeout(() => {
      setShake(false);
      setPin("");
    }, 600);
  };

  const handleResetLock = async () => {
    setRecoveryLoading(true);
    setRecoveryError(null);

    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      clearAppLock();
    } catch {
      setRecoveryError("Could not sign out. Please try again.");
    } finally {
      setRecoveryLoading(false);
    }
  };

  const showPinPad =
    lockMethod === "pin" || (lockMethod === "biometric" && !!biometricError && hasConfiguredPin());

  if (screen === "forgot-pin") {
    return (
      <div
        className="fixed inset-0 z-[9999] flex flex-col items-center justify-center select-none px-6"
        style={{ background: "hsl(var(--background))" }}
      >
        <button
          onClick={() => {
            setScreen("lock");
            setRecoveryError(null);
          }}
          className="absolute left-6 top-6 flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-primary/20 bg-primary/10">
            <LogOut className="h-7 w-7 text-primary" />
          </div>
          <h2 className="font-heading text-xl font-bold text-foreground">Reset Device Lock?</h2>
          <p className="max-w-xs text-center text-sm text-muted-foreground">
            To reset the PIN or biometric lock on this device, sign out and sign in again. This
            clears only the local app-lock settings.
          </p>
        </div>

        <div className="w-full max-w-xs space-y-4">
          {recoveryError && <p className="text-center text-xs text-destructive">{recoveryError}</p>}

          <button
            onClick={() => void handleResetLock()}
            disabled={recoveryLoading}
            className={cn(
              "flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all active:scale-[0.98]",
              "bg-primary text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            {recoveryLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Signing out...
              </>
            ) : (
              "Sign Out & Reset Lock"
            )}
          </button>

          <p className="text-center text-[11px] text-muted-foreground/60">
            You will need to sign in again before accessing the vault.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex select-none flex-col items-center justify-center"
      style={{ background: "hsl(var(--background))" }}
    >
      <div className="mb-10 flex flex-col items-center gap-3">
        <div className="h-16 w-16 overflow-hidden rounded-2xl shadow-lg ring-2 ring-border">
          <img src="/pwa-icon-192.png" alt="usMoments" className="h-full w-full object-cover" />
        </div>
        <h1 className="font-heading text-xl font-bold gradient-text">usMoments</h1>
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Lock className="h-3.5 w-3.5" />
          <span>App is locked</span>
        </div>
      </div>

      {lockMethod === "biometric" && (
        <div className="mb-8 flex flex-col items-center gap-3">
          <button
            onClick={() => void handleBiometric()}
            className={cn(
              "flex h-20 w-20 items-center justify-center rounded-full border-2 border-primary/30 bg-primary/10 transition-all active:scale-95 hover:bg-primary/20",
            )}
          >
            <Fingerprint className="h-10 w-10 text-primary" />
          </button>
          <span className="text-sm text-muted-foreground">{biometricError ?? "Touch to unlock"}</span>
        </div>
      )}

      {showPinPad && (
        <>
          <div className={cn("mb-8 flex gap-3 transition-all", shake && "animate-bounce")}>
            {Array.from({ length: Math.max(4, pin.length || 4) }).map((_, index) => (
              <div
                key={index}
                className={cn(
                  "h-4 w-4 rounded-full border-2 transition-all duration-150",
                  index < pin.length
                    ? "scale-110 border-primary bg-primary"
                    : "border-muted-foreground/40 bg-transparent",
                )}
              />
            ))}
          </div>

          <div className="grid w-64 grid-cols-3 gap-3">
            {KEYS.flat().map((key, index) => (
              <button
                key={index}
                onClick={() => void handleKey(key)}
                disabled={!key}
                className={cn(
                  "h-16 rounded-2xl text-xl font-semibold transition-all active:scale-95",
                  key === "backspace"
                    ? "text-muted-foreground hover:bg-muted/60"
                    : key
                      ? "border border-border bg-card text-foreground shadow-sm hover:bg-accent"
                      : "invisible",
                )}
              >
                {key === "backspace" ? <Delete className="mx-auto h-5 w-5" /> : key}
              </button>
            ))}
          </div>

          <button
            onClick={() => setScreen("forgot-pin")}
            className="mt-6 text-xs text-muted-foreground underline underline-offset-2 transition-colors hover:text-primary"
          >
            Forgot PIN?
          </button>
        </>
      )}

      {lockMethod === "biometric" && !biometricError && !hasConfiguredPin() && (
        <p className="mt-6 px-8 text-center text-xs text-muted-foreground/60">
          Use your fingerprint or face to unlock.
        </p>
      )}

      {lockMethod === "biometric" && !getBiometricCredentialId() && (
        <p className="mt-3 px-8 text-center text-xs text-muted-foreground/60">
          No saved biometric credential was found for this device.
        </p>
      )}
    </div>
  );
}
