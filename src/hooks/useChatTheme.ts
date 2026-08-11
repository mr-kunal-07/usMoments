import { useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMyCouple } from "@/hooks/useCouple";
import { useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UseChatThemeReturn {
    /** Currently active theme ID for this couple */
    themeId: string | null;
    /** True while the initial fetch is in flight */
    isLoading: boolean;
    /** Save a new theme — optimistically updates and syncs to partner in realtime */
    setTheme: (themeId: string) => Promise<void>;
    /** True while a save is in flight */
    isSaving: boolean;
}

interface CoupleThemeRow {
    chat_theme_id?: string | null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Reads and writes the `chat_theme_id` column on the `couples` table.
 *
 * Both partners see the theme change in realtime via a Supabase postgres_changes
 * subscription — no page refresh or polling needed.
 *
 * Prerequisites (run the SQL migration below first):
 *   ALTER TABLE couples ADD COLUMN IF NOT EXISTS chat_theme_id text DEFAULT 'default';
 */
export function useChatTheme(): UseChatThemeReturn {
    const { data: couple } = useMyCouple();
    const queryClient = useQueryClient();
    const coupleId = couple?.status === "active" ? couple.id : null;
    const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

    // ── Fetch ────────────────────────────────────────────────────────────────
    const { data: themeId = null, isLoading } = useQuery<string | null>({
        queryKey: ["chat-theme", coupleId],
        enabled: !!coupleId,
        staleTime: Infinity, // only changes via mutation or realtime push
        queryFn: async () => {
            const { data, error } = await supabase
                .from("couples" as never)
                .select("*")
                .eq("id", coupleId!)
                .single() as unknown as { data: CoupleThemeRow | null; error: unknown };

            if (error || !data) return null;
            return data.chat_theme_id ?? "default";
        },
    });

    // ── Realtime subscription ────────────────────────────────────────────────
    // When the partner changes the theme their UPDATE fires here and we
    // invalidate the query so the local UI reflects it immediately.
    useEffect(() => {
        if (!coupleId) return;

        channelRef.current = supabase
            .channel(`chat-theme:${coupleId}`)
            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "couples",
                    filter: `id=eq.${coupleId}`,
                },
                (payload) => {
                    const updatedRow = payload.new as CoupleThemeRow | null;
                    const newThemeId = updatedRow?.chat_theme_id;
                    if (newThemeId !== undefined) {
                        // Write the new value directly into the cache — avoids a round-trip
                        queryClient.setQueryData(["chat-theme", coupleId], newThemeId ?? "default");
                    }
                }
            )
            .subscribe();

        return () => {
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
            }
        };
    }, [coupleId, queryClient]);

    // ── Mutation ─────────────────────────────────────────────────────────────
    const mutation = useMutation({
        mutationFn: async (newThemeId: string) => {
            if (!coupleId) throw new Error("No active couple");
            const { error } = await supabase
                .from("couples" as never)
                .update({ chat_theme_id: newThemeId } as never)
                .eq("id", coupleId);
            if (error) throw error;
        },
        // Optimistic update so the UI changes instantly before the DB round-trip
        onMutate: async (newThemeId) => {
            await queryClient.cancelQueries({ queryKey: ["chat-theme", coupleId] });
            const prev = queryClient.getQueryData(["chat-theme", coupleId]);
            queryClient.setQueryData(["chat-theme", coupleId], newThemeId);
            return { prev };
        },
        onError: (_err, _vars, ctx) => {
            // Roll back if the update fails
            if (ctx?.prev !== undefined) {
                queryClient.setQueryData(["chat-theme", coupleId], ctx.prev);
            }
        },
    });

    const setTheme = useCallback(
        (newThemeId: string) => mutation.mutateAsync(newThemeId),
        [mutation]
    );

    return {
        themeId,
        isLoading,
        setTheme,
        isSaving: mutation.isPending,
    };
}
