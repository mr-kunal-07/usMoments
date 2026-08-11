import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type PresencePayload = {
  userId?: string;
  ts?: number;
  presence_ref?: string;
};

const HEARTBEAT_INTERVAL_MS = 5_000;
const ONLINE_GRACE_MS = 12_000;

export function usePresence(
  coupleId: string | null | undefined,
  currentUserId: string | null | undefined,
  partnerId: string | null | undefined
) {
  const [partnerOnline, setPartnerOnline] = useState(false);
  const [partnerLastSeen, setPartnerLastSeen] = useState<Date | null>(null);

  useEffect(() => {
    if (!coupleId || !currentUserId || !partnerId) {
      setPartnerOnline(false);
      setPartnerLastSeen(null);
      return;
    }

    const channel = supabase.channel(`presence:${coupleId}`, {
      config: { presence: { key: currentUserId } },
    });

    let heartbeatId: ReturnType<typeof setInterval> | null = null;
    let staleCheckId: ReturnType<typeof setInterval> | null = null;
    let isTracked = false;

    const sendHeartbeat = async () => {
      try {
        await channel.track({ userId: currentUserId, ts: Date.now() });
        isTracked = true;
      } catch {
        // ignore transient realtime failures
      }
    };

    const stopHeartbeat = () => {
      if (heartbeatId) {
        clearInterval(heartbeatId);
        heartbeatId = null;
      }
    };

    const startHeartbeat = () => {
      stopHeartbeat();
      heartbeatId = setInterval(() => {
        void sendHeartbeat();
      }, HEARTBEAT_INTERVAL_MS);
    };

    const untrackSelf = async () => {
      if (!isTracked) return;
      try {
        await channel.untrack();
      } catch {
        // ignore transient realtime failures
      } finally {
        isTracked = false;
      }
    };

    const getPartnerEntries = (): PresencePayload[] => {
      const state = channel.presenceState<PresencePayload>();
      const direct = state[partnerId];
      if (Array.isArray(direct)) return direct;

      return Object.entries(state)
        .filter(([key]) => key === partnerId)
        .flatMap(([, entries]) => entries as PresencePayload[]);
    };

    const getLatestPartnerPresence = (): PresencePayload | null => {
      const entries = getPartnerEntries();
      if (!entries.length) return null;

      return entries.reduce<PresencePayload | null>((latest, entry) => {
        if (!latest) return entry;
        return (entry.ts ?? 0) > (latest.ts ?? 0) ? entry : latest;
      }, null);
    };

    const syncPartnerStatus = () => {
      const latest = getLatestPartnerPresence();

      if (!latest) {
        setPartnerOnline(false);
        return;
      }

      const seenAt = latest.ts ? new Date(latest.ts) : null;
      if (seenAt) setPartnerLastSeen(seenAt);

      const isFresh = !!latest.ts && Date.now() - latest.ts <= ONLINE_GRACE_MS;
      setPartnerOnline(isFresh);
    };

    channel
      .on("presence", { event: "sync" }, syncPartnerStatus)
      .on("presence", { event: "join" }, syncPartnerStatus)
      .on("presence", { event: "leave" }, ({ leftPresences }) => {
        const entries = (leftPresences as PresencePayload[] | undefined) ?? [];
        const latest = entries.reduce<PresencePayload | null>((acc, entry) => {
          if (entry.userId !== partnerId) return acc;
          if (!acc) return entry;
          return (entry.ts ?? 0) > (acc.ts ?? 0) ? entry : acc;
        }, null);

        if (latest?.ts) setPartnerLastSeen(new Date(latest.ts));
        syncPartnerStatus();
      })
      .subscribe(async (status) => {
        if (status !== "SUBSCRIBED") return;

        if (document.visibilityState === "visible") {
          await sendHeartbeat();
          startHeartbeat();
        }
        syncPartnerStatus();
        staleCheckId = setInterval(syncPartnerStatus, 5_000);
      });

    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible") {
        await sendHeartbeat();
        startHeartbeat();
        syncPartnerStatus();
        return;
      }

      stopHeartbeat();
      await untrackSelf();
      setPartnerOnline(false);
    };

    window.addEventListener("focus", handleVisibilityChange);
    window.addEventListener("blur", handleVisibilityChange);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      stopHeartbeat();
      if (staleCheckId) clearInterval(staleCheckId);
      window.removeEventListener("focus", handleVisibilityChange);
      window.removeEventListener("blur", handleVisibilityChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      void untrackSelf().finally(() => {
        void supabase.removeChannel(channel);
      });
    };
  }, [coupleId, currentUserId, partnerId]);

  return { partnerOnline, partnerLastSeen };
}
