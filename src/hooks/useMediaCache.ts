/**
 * Enhanced media hook with IndexedDB caching and progressive loading
 * Use this as a drop-in replacement for useMedia
 */

import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Tables } from "@/integrations/supabase/types";
import { QK, invalidateMedia } from "@/lib/queryKeys";
import { usePrivateScope } from "@/hooks/usePrivateScope";
import { cacheMediaList, getCachedMedia, initMediaCache } from "@/lib/mediaCache";

export type Media = Tables<"media"> & {
    uploader_name?: string | null;
    taken_at?: string | null;
    deleted_at?: string | null;
};

const PAGE_SIZE = 20; // Reduced from 50 for safer pagination
const INITIAL_LOAD = 50; // Load initial batch from DB, then paginate

/**
 * Fetches media with intelligent caching
 * 1. Check IndexedDB cache first (instant load)
 * 2. Fetch from DB with pagination
 * 3. Cache results for future use
 */
export function useMediaWithCache(folderId?: string | null, search?: string) {
    const { user } = useAuth();
    const { allowedUserIds, scopeKey } = usePrivateScope();

    return useQuery({
        queryKey: [...QK.media(folderId, search), scopeKey, "cached"],
        staleTime: 60_000, // Increased stale time due to caching
        queryFn: async () => {
            // Try cache first
            await initMediaCache();
            const cached = await getCachedMedia(
                folderId,
                search
            );

            if (cached && !search) {
                // Use cache for non-search queries if available
                return cached as Media[];
            }

            // Fetch from DB (limited payload)
            let query = supabase
                .from("media")
                .select("*")
                .in("uploaded_by", allowedUserIds)
                .is("deleted_at", null);

            if (folderId !== undefined) {
                if (folderId) query = query.eq("folder_id", folderId);
                else query = query.is("folder_id", null);
            }

            if (search) {
                query = query.or(
                    `title.ilike.%${search}%,description.ilike.%${search}%`
                );
            }

            const { data, error } = await query
                .order("created_at", { ascending: false })
                .limit(INITIAL_LOAD); // Load only 50 items max

            if (error) throw error;

            const media = data as Media[];

            // Cache the results
            if (media.length > 0) {
                void cacheMediaList(
                    media.map((m) => ({
                        id: m.id,
                        title: m.title || "",
                        file_path: m.file_path || "",
                        file_size: m.file_size || 0,
                        file_type: (m.file_type as "image" | "video") || "image",
                        mime_type: m.mime_type || "",
                        created_at: m.created_at || "",
                        is_starred: m.is_starred || false,
                        folder_id: m.folder_id || null,
                        uploaded_by: m.uploaded_by || "",
                        deleted_at: m.deleted_at || null,
                    }))
                );
            }

            return media;
        },
        enabled: !!user && allowedUserIds.length > 0,
    });
}

/**
 * Infinite scroll with caching
 * Optimized for large vaults with progressive loading
 */
export function useMediaInfiniteWithCache(
    folderId?: string | null,
    search?: string
) {
    const { user } = useAuth();
    const { allowedUserIds, scopeKey } = usePrivateScope();

    return useInfiniteQuery({
        queryKey: [...QK.mediaInfinite(), folderId, search, scopeKey, "cached"],
        staleTime: 60_000,
        initialPageParam: 0,
        queryFn: async ({ pageParam = 0 }) => {
            // First page: try cache
            if (pageParam === 0 && !search) {
                await initMediaCache();
                const cached = await getCachedMedia(folderId, search);
                if (cached && cached.length > 0) {
                    // Return cached items in pages of PAGE_SIZE
                    const itemsPerPage = PAGE_SIZE;
                    return {
                        items: cached.slice(
                            0,
                            itemsPerPage
                        ) as Media[],
                        nextPage:
                            cached.length > itemsPerPage ? 1 : undefined,
                    };
                }
            }

            // Fetch from DB
            let query = supabase
                .from("media")
                .select("*")
                .in("uploaded_by", allowedUserIds)
                .is("deleted_at", null);

            if (folderId !== undefined) {
                if (folderId) query = query.eq("folder_id", folderId);
                else query = query.is("folder_id", null);
            }

            if (search) {
                query = query.or(
                    `title.ilike.%${search}%,description.ilike.%${search}%`
                );
            }

            const { data, error } = await query
                .order("created_at", {
                    ascending: false,
                })
                .range(
                    pageParam * PAGE_SIZE,
                    (pageParam + 1) * PAGE_SIZE - 1
                );

            if (error) throw error;

            const media = data as Media[];

            // Cache results
            if (media.length > 0) {
                void cacheMediaList(
                    media.map((m) => ({
                        id: m.id,
                        title: m.title || "",
                        file_path: m.file_path || "",
                        file_size: m.file_size || 0,
                        file_type: (m.file_type as "image" | "video") || "image",
                        mime_type: m.mime_type || "",
                        created_at: m.created_at || "",
                        is_starred: m.is_starred || false,
                        folder_id: m.folder_id || null,
                        uploaded_by: m.uploaded_by || "",
                        deleted_at: m.deleted_at || null,
                    }))
                );
            }

            return {
                items: media,
                nextPage:
                    media.length === PAGE_SIZE
                        ? pageParam + 1
                        : undefined,
            };
        },
        getNextPageParam: (last) => last.nextPage,
        enabled: !!user && allowedUserIds.length > 0,
    });
}
