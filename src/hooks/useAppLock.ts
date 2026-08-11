import { useState, useEffect, useCallback } from "react";

export const PIN_HASH_KEY = "usmoment_pin_hash";
export const LOCK_KEY = "usmoment_lock_method";
export const BIOMETRIC_CRED_ID_KEY = "usmoment_biometric_cred_id";
export const APP_LOCK_EVENT = "usmoment-app-lock-changed";

const LEGACY_PIN_KEY = "usMoments_pin";
const LEGACY_LOCK_KEY = "usMoments_lock_method";
const LEGACY_BIOMETRIC_CRED_ID_KEY = "usMoments_biometric_cred_id";

// How many ms of background before re-locking (15 seconds)
const LOCK_TIMEOUT_MS = 15_000;

export type LockMethod = "pin" | "biometric" | null;

function hex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(`usmoment:${pin}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return hex(digest);
}

function dispatchLockChange() {
  window.dispatchEvent(new Event(APP_LOCK_EVENT));
}

export function getLockMethod(): LockMethod {
  const value = localStorage.getItem(LOCK_KEY) ?? localStorage.getItem(LEGACY_LOCK_KEY);
  return value === "pin" || value === "biometric" ? value : null;
}

export function hasConfiguredPin(): boolean {
  return !!(localStorage.getItem(PIN_HASH_KEY) ?? localStorage.getItem(LEGACY_PIN_KEY));
}

export async function verifyPin(pin: string): Promise<boolean> {
  const storedHash = localStorage.getItem(PIN_HASH_KEY);
  if (storedHash) return (await hashPin(pin)) === storedHash;

  const legacyPin = localStorage.getItem(LEGACY_PIN_KEY);
  if (legacyPin !== pin) return false;

  await savePin(pin);
  return true;
}

export async function savePin(pin: string): Promise<void> {
  const pinHash = await hashPin(pin);
  localStorage.setItem(PIN_HASH_KEY, pinHash);
  localStorage.removeItem(LEGACY_PIN_KEY);
  dispatchLockChange();
}

export function clearPin(): void {
  localStorage.removeItem(PIN_HASH_KEY);
  localStorage.removeItem(LEGACY_PIN_KEY);
  dispatchLockChange();
}

export function getBiometricCredentialId(): string | null {
  return localStorage.getItem(BIOMETRIC_CRED_ID_KEY) ?? localStorage.getItem(LEGACY_BIOMETRIC_CRED_ID_KEY);
}

export function saveBiometricCredentialId(credentialIdBase64: string): void {
  localStorage.setItem(BIOMETRIC_CRED_ID_KEY, credentialIdBase64);
  localStorage.removeItem(LEGACY_BIOMETRIC_CRED_ID_KEY);
  dispatchLockChange();
}

export function clearBiometricCredentialId(): void {
  localStorage.removeItem(BIOMETRIC_CRED_ID_KEY);
  localStorage.removeItem(LEGACY_BIOMETRIC_CRED_ID_KEY);
  dispatchLockChange();
}

export function setStoredLockMethod(method: LockMethod): void {
  if (method) localStorage.setItem(LOCK_KEY, method);
  else localStorage.removeItem(LOCK_KEY);
  localStorage.removeItem(LEGACY_LOCK_KEY);
  dispatchLockChange();
}

export function clearAppLock(): void {
  localStorage.removeItem(PIN_HASH_KEY);
  localStorage.removeItem(LOCK_KEY);
  localStorage.removeItem(BIOMETRIC_CRED_ID_KEY);
  localStorage.removeItem(LEGACY_PIN_KEY);
  localStorage.removeItem(LEGACY_LOCK_KEY);
  localStorage.removeItem(LEGACY_BIOMETRIC_CRED_ID_KEY);
  dispatchLockChange();
}

export function useAppLock(isAuthenticated: boolean) {
  const [locked, setLocked] = useState<boolean>(() => {
    return !!getLockMethod();
  });

  const unlock = useCallback(() => setLocked(false), []);

  useEffect(() => {
    if (!isAuthenticated) {
      setLocked(false);
      return;
    }

    let hiddenAt: number | null = null;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
      } else if (document.visibilityState === "visible") {
        const method = getLockMethod();
        if (!method) return;
        const elapsed = hiddenAt ? Date.now() - hiddenAt : Infinity;
        if (elapsed >= LOCK_TIMEOUT_MS) {
          setLocked(true);
        }
        hiddenAt = null;
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [isAuthenticated]);

  useEffect(() => {
    const syncLockState = () => {
      const method = getLockMethod();
      setLocked(!!method);
    };

    const onStorage = (event: StorageEvent) => {
      if (
        event.key === LOCK_KEY ||
        event.key === LEGACY_LOCK_KEY ||
        event.key === PIN_HASH_KEY ||
        event.key === LEGACY_PIN_KEY ||
        event.key === BIOMETRIC_CRED_ID_KEY ||
        event.key === LEGACY_BIOMETRIC_CRED_ID_KEY
      ) {
        syncLockState();
      }
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener(APP_LOCK_EVENT, syncLockState);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(APP_LOCK_EVENT, syncLockState);
    };
  }, []);

  const lockMethod = getLockMethod();

  return { locked: isAuthenticated && locked && !!lockMethod, lockMethod, unlock };
}
