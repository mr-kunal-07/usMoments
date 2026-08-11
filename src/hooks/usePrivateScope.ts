import { useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useMyCouple } from "@/hooks/useCouple";

export function usePrivateScope() {
  const { user } = useAuth();
  const { data: couple } = useMyCouple();

  const partnerId =
    couple?.status === "active"
      ? (couple.user1_id === user?.id ? couple.user2_id : couple.user1_id)
      : null;

  const allowedUserIds = useMemo(() => {
    if (!user?.id) return [] as string[];
    return partnerId ? [user.id, partnerId] : [user.id];
  }, [partnerId, user?.id]);

  const scopeKey = allowedUserIds.join(",");

  return {
    allowedUserIds,
    couple,
    partnerId,
    scopeKey,
  };
}
