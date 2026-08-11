/**
 * Message Pagination & Infinite Scroll Implementation
 * 
 * This file contains ready-to-use code for implementing message pagination
 * and infinite scroll in the chat. Copy this into your hooks directory.
 */

import React from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMyCouple } from "@/hooks/useCouple";
import { decryptMessages } from "@/lib/crypto";
import { QK } from "@/lib/queryKeys";
import { Message } from "@/hooks/useMessages";

/**
 * Constants for pagination tuning
 */
const INITIAL_LOAD = 50;      // Load first 50 messages
const PAGE_SIZE = 30;         // Load 30 more when scrolling up
const MESSAGE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Hook for fetching messages with infinite scroll pagination
 * 
 * Usage in ChatView:
 * const {
 *   data,
 *   isLoading,
 *   hasNextPage,
 *   fetchNextPage,
 *   isFetchingNextPage
 * } = useMessagesInfinite();
 * 
 * const allMessages = data?.pages?.flatMap(p => p.messages) ?? [];
 */
export function useMessagesInfinite() {
    const { user } = useAuth();
    const { data: couple } = useMyCouple();
    const queryClient = useQueryClient();

    const coupleId = couple?.status === "active" ? couple.id : null;

    return useInfiniteQuery({
        queryKey: ["messages-infinite", coupleId],
        enabled: !!coupleId && !!user,
        initialPageParam: 0,

        async queryFn({ pageParam }) {
            if (!coupleId) throw new Error("No couple");

            // Page 0: most recent 50 messages
            // Page 1+: older messages (go backwards in time)
            const isFirstPage = pageParam === 0;
            const limit = isFirstPage ? INITIAL_LOAD : PAGE_SIZE;

            // Calculate offset for pagination
            // Page 0: offset 0, limit 50
            // Page 1: offset 50, limit 30
            // Page 2: offset 80, limit 30
            const offset = isFirstPage ? 0 : (INITIAL_LOAD + (pageParam - 1) * PAGE_SIZE);

            const cutoff = new Date(
                Date.now() - MESSAGE_TTL_MS
            ).toISOString();

            // Main query
            const { data, error } = await supabase
                .from("messages")
                .select("*, reactions:message_reactions(*)")
                .eq("couple_id", coupleId)
                .is("deleted_at", null)
                .gte("created_at", cutoff)
                .order("created_at", { ascending: false })
                .range(offset, offset + limit - 1);

            if (error) throw error;

            // Reverse to chronological order (oldest first)
            const raw = (data ?? []).reverse() as Message[];

            // Decrypt messages
            const decrypted = await decryptMessages(raw, coupleId);

            // Check if there are more messages
            const { count } = await supabase
                .from("messages")
                .select("*", { count: "exact", head: true })
                .eq("couple_id", coupleId)
                .is("deleted_at", null)
                .gte("created_at", cutoff);

            const totalMessages = count ?? 0;
            const loadedSoFar = offset + data.length;
            const hasMore = loadedSoFar < totalMessages;

            return {
                messages: decrypted,
                hasMore,
                nextPage: hasMore ? pageParam + 1 : undefined,
            };
        },

        getNextPageParam: (lastPage) => lastPage.nextPage,
    });
}

/**
 * Hook to handle infinite scroll trigger (when user scrolls to top)
 * 
 * Usage:
 * const { isNearTop } = useInfiniteScrollTrigger(scrollContainerRef);
 * 
 * useEffect(() => {
 *   if (isNearTop && hasNextPage && !isFetchingNextPage) {
 *     fetchNextPage();
 *   }
 * }, [isNearTop, hasNextPage, isFetchingNextPage]);
 */
export function useInfiniteScrollTrigger(
    containerRef: React.RefObject<HTMLElement>
) {
    const [isNearTop, setIsNearTop] = React.useState(false);

    React.useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleScroll = () => {
            // Trigger when scrolled to top (within 500px)
            const isNear = container.scrollTop < 500;
            setIsNearTop(isNear);
        };

        container.addEventListener("scroll", handleScroll, { passive: true });
        return () => container.removeEventListener("scroll", handleScroll);
    }, [containerRef]);

    return { isNearTop };
}

/**
 * ==========================================
 * AUDIO CACHING UTILITIES
 * ==========================================
 */

const AUDIO_CACHE_NAME = "chat-audio-v1";
const MAX_AUDIO_CACHE_SIZE = 100 * 1024 * 1024; // 100MB

/**
 * Cache an audio message URL in Service Worker
 */
export async function cacheAudioMessage(
    messageId: string,
    audioUrl: string
): Promise<void> {
    if (!("caches" in window)) return;

    try {
        const cache = await caches.open(AUDIO_CACHE_NAME);

        // Check cache size to avoid overflow
        const keys = await cache.keys();
        if (keys.length > 1000) {
            // Remove oldest entries
            for (let i = 0; i < 100; i++) {
                if (keys[i]) await cache.delete(keys[i]);
            }
        }

        // Cache the audio file
        const response = await fetch(audioUrl);
        if (response.ok) {
            await cache.put(audioUrl, response);
        }
    } catch (error) {
        console.warn("[cacheAudioMessage] Failed to cache audio:", error);
    }
}

/**
 * Get cached audio URL if available, otherwise return original
 */
export async function getCachedAudioUrl(
    audioUrl: string
): Promise<string> {
    if (!("caches" in window)) return audioUrl;

    try {
        const cache = await caches.open(AUDIO_CACHE_NAME);
        const response = await cache.match(audioUrl);

        if (response) {
            return URL.createObjectURL(await response.blob());
        }
    } catch (error) {
        console.warn("[getCachedAudioUrl] Failed to retrieve cached audio:", error);
    }

    return audioUrl;
}

/**
 * Preload audio messages retroactively
 * Call this once when chat loads to cache all voice messages
 */
export async function preloadAllAudioMessages(
    messages: Message[]
): Promise<void> {
    const audioMessages = messages.filter(
        m => m.message_type === "voice" && m.audio_url
    );

    // Cache in batches of 5 to avoid overwhelming network
    for (let i = 0; i < audioMessages.length; i += 5) {
        const batch = audioMessages.slice(i, i + 5);
        await Promise.all(
            batch.map(m =>
                cacheAudioMessage(m.id, m.audio_url!)
            )
        );

        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 100));
    }
}

/**
 * Clear audio cache (call on logout or user request)
 */
export async function clearAudioCache(): Promise<void> {
    if (!("caches" in window)) return;

    try {
        const cacheNames = await caches.keys();
        for (const name of cacheNames) {
            if (name.includes("audio")) {
                await caches.delete(name);
            }
        }
    } catch (error) {
        console.warn("[clearAudioCache] Failed to clear cache:", error);
    }
}

/**
 * ==========================================
 * DRAWING IMAGE CACHING
 * ==========================================
 */

const DRAWING_CACHE_NAME = "chat-drawings-v1";

/**
 * Cache drawing image (stored as blob thumbnail)
 */
export async function cacheDrawingThumbnail(
    messageId: string,
    imageBlobUrl: string
): Promise<void> {
    if (!("caches" in window)) return;

    try {
        const cache = await caches.open(DRAWING_CACHE_NAME);
        const response = await fetch(imageBlobUrl);

        if (response.ok) {
            // Store with message ID as key
            await cache.put(
                `drawing-${messageId}`,
                response
            );
        }
    } catch (error) {
        console.warn("[cacheDrawingThumbnail] Failed to cache drawing:", error);
    }
}

/**
 * Get cached drawing thumbnail
 */
export async function getCachedDrawingThumbnail(
    messageId: string
): Promise<string | null> {
    if (!("caches" in window)) return null;

    try {
        const cache = await caches.open(DRAWING_CACHE_NAME);
        const response = await cache.match(`drawing-${messageId}`);

        if (response) {
            return URL.createObjectURL(await response.blob());
        }
    } catch (error) {
        console.warn("[getCachedDrawingThumbnail] Failed to retrieve drawing:", error);
    }

    return null;
}

/**
 * ==========================================
 * IMPLEMENTATION EXAMPLE IN ChatView
 * ==========================================
 * 
 * Replace the existing useMessages call with:
 * 
 * const {
 *   data,
 *   isLoading,
 *   hasNextPage,
 *   fetchNextPage,
 *   isFetchingNextPage,
 * } = useMessagesInfinite();
 * 
 * const scrollContainerRef = useRef<HTMLDivElement>(null);
 * const { isNearTop } = useInfiniteScrollTrigger(scrollContainerRef);
 * 
 * // Flatten paginated data
 * const messages = useMemo(() => {
 *   return data?.pages?.flatMap(page => page.messages) ?? [];
 * }, [data?.pages]);
 * 
 * // Auto-fetch on scroll to top
 * useEffect(() => {
 *   if (isNearTop && hasNextPage && !isFetchingNextPage) {
 *     void fetchNextPage();
 *   }
 * }, [isNearTop, hasNextPage, isFetchingNextPage, fetchNextPage]);
 * 
 * // Preload audio on mount
 * useEffect(() => {
 *   if (messages.length > 0) {
 *     void preloadAllAudioMessages(messages);
 *   }
 * }, [messages]);
 * 
 * // Return the updated message list render
 */
