import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

function isStandalonePwa(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = `${base64Url}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

async function getVapidPublicKey(accessToken: string): Promise<string | null> {
  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-push`, {
    method: "GET",
    headers: {
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) return null;

  const data = (await response.json()) as { publicKey?: string };
  return data.publicKey ?? null;
}

export async function sendPushRequest(
  accessToken: string,
  payload: Record<string, unknown>,
): Promise<Response> {
  return fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-push`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
}

async function saveSubscription(userId: string, subscription: PushSubscription): Promise<void> {
  const json = subscription.toJSON();
  const p256dh = json.keys?.p256dh;
  const authKey = json.keys?.auth;

  if (!subscription.endpoint || !p256dh || !authKey) return;

  await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", userId)
    .eq("endpoint", subscription.endpoint);

  await supabase.from("push_subscriptions").insert({
    user_id: userId,
    endpoint: subscription.endpoint,
    p256dh,
    auth_key: authKey,
  });
}

function canUsePush(): boolean {
  if (typeof window === "undefined") return false;
  return ("serviceWorker" in navigator) && ("PushManager" in window) && ("Notification" in window);
}

async function subscribeCurrentUser(requestPermission: boolean): Promise<"granted" | "denied" | "unsupported" | "skipped"> {
  if (!canUsePush()) return "unsupported";
  if (!isStandalonePwa()) return "skipped";

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) return "skipped";

  const registration = await navigator.serviceWorker.ready;

  let permission = Notification.permission;
  if (permission === "default" && requestPermission) {
    permission = await Notification.requestPermission();
  }

  if (permission !== "granted") {
    return permission === "denied" ? "denied" : "skipped";
  }

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    const publicKey = await getVapidPublicKey(session.access_token);
    if (!publicKey) return "skipped";

    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToUint8Array(publicKey),
    });
  }

  if (!subscription) return "skipped";
  await saveSubscription(session.user.id, subscription);
  return "granted";
}

export function usePushSubscription(): void {
  useEffect(() => {
    if (!canUsePush()) return;
    if (!isStandalonePwa()) return;
    if (Notification.permission !== "granted") return;

    let cancelled = false;

    void (async () => {
      try {
        if (cancelled) return;
        await subscribeCurrentUser(false);
      } catch (error) {
        console.warn("Push subscription setup failed:", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);
}

export async function enablePushNotifications(): Promise<"granted" | "denied" | "unsupported" | "skipped"> {
  try {
    return await subscribeCurrentUser(true);
  } catch (error) {
    console.warn("enablePushNotifications failed:", error);
    return "skipped";
  }
}

export function pushSupportState(): {
  supported: boolean;
  standalone: boolean;
  permission: NotificationPermission | "unsupported";
} {
  if (!canUsePush()) {
    return { supported: false, standalone: false, permission: "unsupported" };
  }

  return {
    supported: true,
    standalone: isStandalonePwa(),
    permission: Notification.permission,
  };
}

export async function pushToPartner(title: string, body: string, url = "/dashboard"): Promise<void> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      console.warn("pushToPartner skipped: no active session");
      return;
    }

    const response = await sendPushRequest(session.access_token, { title, body, url });
    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.warn("pushToPartner request failed:", response.status, errorText);
    }
  } catch (error) {
    console.warn("pushToPartner failed:", error);
  }
}
