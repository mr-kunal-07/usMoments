import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const TYPING_THROTTLE_MS = 700;
const TYPING_TIMEOUT_MS = 1200;

export function useTyping(coupleId: string | null | undefined, currentUserId: string | null | undefined) {
  const [partnerTyping, setPartnerTyping] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSentRef = useRef<number>(0);

  useEffect(() => {
    if (!coupleId || !currentUserId) {
      setPartnerTyping(false);
      return;
    }

    const channel = supabase
      .channel(`typing:${coupleId}`, {
        config: { broadcast: { self: false } },
      })
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (payload?.userId === currentUserId) return;
        setPartnerTyping(Boolean(payload?.isTyping));
        if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
        if (payload?.isTyping) {
          clearTimerRef.current = setTimeout(() => setPartnerTyping(false), TYPING_TIMEOUT_MS);
        }
      })
      .subscribe();

    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
      clearTimerRef.current = null;
    };
  }, [coupleId, currentUserId]);

  const sendTyping = useCallback((isTyping = true) => {
    const now = Date.now();
    if (isTyping && now - lastSentRef.current < TYPING_THROTTLE_MS) return;
    lastSentRef.current = now;
    channelRef.current?.send({
      type: "broadcast",
      event: "typing",
      payload: { userId: currentUserId, isTyping },
    });
  }, [currentUserId]);

  const stopTyping = useCallback(() => {
    sendTyping(false);
  }, [sendTyping]);

  return { partnerTyping, sendTyping, stopTyping };
}
