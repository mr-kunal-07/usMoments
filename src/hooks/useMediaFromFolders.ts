import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePrivateScope } from "@/hooks/usePrivateScope";
import { useAuth } from "@/hooks/useAuth";

export interface MediaItem {
    id: string;
    file_name: string;
    file_path: string;
    file_type: "image" | "video";
    title: string;
    created_at: string;
}

/**
 * Hook to fetch media from multiple folders
 */
export function useMediaFromFolders() {
    const { user } = useAuth();
    const { allowedUserIds } = usePrivateScope();

    const fetchMediaFromFolders = useCallback(
        async (folderIds: string[]): Promise<Map<string, MediaItem[]>> => {
            if (!user || allowedUserIds.length === 0) {
                throw new Error("Not authenticated");
            }

            const result = new Map<string, MediaItem[]>();

            for (const folderId of folderIds) {
                try {
                    const { data, error } = await supabase
                        .from("media")
                        .select("id, file_name, file_path, file_type, title, created_at")
                        .in("uploaded_by", allowedUserIds)
                        .eq("folder_id", folderId)
                        .is("deleted_at", null)
                        .order("created_at", { ascending: false });

                    if (error) throw error;

                    result.set(folderId, data as MediaItem[]);
                } catch (error) {
                    console.error(`Failed to fetch media from folder ${folderId}:`, error);
                    result.set(folderId, []);
                }
            }

            return result;
        },
        [user, allowedUserIds]
    );

    return { fetchMediaFromFolders };
}
