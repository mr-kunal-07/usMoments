/**
 * Example: Optimized Media Gallery Component
 * Shows how to use all the caching and performance features together
 */

import { useCallback, useEffect, useMemo } from "react";
import { useMediaInfiniteWithCache } from "@/hooks/useMediaCache";
import { VirtualScrollMediaGrid, LazyImage } from "@/components/VirtualScrollMediaGrid";
import { getPublicUrl } from "@/hooks/useMedia";
import { useIsMobile } from "@/hooks/use-mobile";
import { Loader2 } from "lucide-react";

interface OptimizedMediaGalleryProps {
    folderId?: string | null;
    search?: string;
    onMediaClick?: (mediaId: string, index: number) => void;
    className?: string;
}

export function OptimizedMediaGallery({
    folderId,
    search,
    onMediaClick,
    className,
}: OptimizedMediaGalleryProps) {
    const isMobile = useIsMobile();
    const {
        data,
        hasNextPage,
        fetchNextPage,
        isFetchingNextPage,
        isLoading,
    } = useMediaInfiniteWithCache(folderId, search);

    // Flatten paginated data
    const allMedia = useMemo(() => {
        return data?.pages?.flatMap((page) => page.items) ?? [];
    }, [data?.pages]);

    // Auto-fetch next page when scrolling
    useEffect(() => {
        if (hasNextPage && allMedia.length > 50 && !isFetchingNextPage) {
            // We could auto-fetch here, but usually infinite scroll observer is better
        }
    }, [hasNextPage, allMedia.length, isFetchingNextPage]);

    const columnCount = isMobile ? 2 : 3;
    const itemHeight = isMobile ? 250 : 300;

    const renderMediaItem = useCallback(
        (media: any, index: number) => (
            <div
                key={media.id}
                className="relative group rounded-lg overflow-hidden bg-gray-200 hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => onMediaClick?.(media.id, index)}
            >
                <LazyImage
                    src={getPublicUrl(media.file_path)}
                    alt={media.title || "Media"}
                    className="w-full h-full object-cover"
                />

                {/* Overlay on hover */}
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors opacity-0 group-hover:opacity-100">
                    <div className="absolute bottom-2 left-2 right-2 text-white text-xs truncate">
                        {media.title}
                    </div>
                </div>

                {/* Video badge */}
                {media.file_type === "video" && (
                    <div className="absolute top-2 right-2 bg-white/90 rounded-full p-1.5">
                        <svg
                            className="w-3 h-3"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                        >
                            <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                        </svg>
                    </div>
                )}
            </div>
        ),
        [onMediaClick]
    );

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
        );
    }

    if (allMedia.length === 0) {
        return (
            <div className="flex items-center justify-center h-96 text-gray-400">
                <p>No media found</p>
            </div>
        );
    }

    return (
        <div className={className}>
            <VirtualScrollMediaGrid
                media={allMedia}
                renderItem={renderMediaItem}
                itemHeight={itemHeight}
                columnCount={columnCount}
                gap={12}
                hasMore={hasNextPage}
                onLoadMore={() => fetchNextPage()}
                loadingPlaceholder={
                    isFetchingNextPage && (
                        <div className="col-span-full flex justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                        </div>
                    )
                }
            />
        </div>
    );
}

/**
 * Example usage in Dashboard:
 * 
 * <OptimizedMediaGallery
 *   folderId={selectedFolder}
 *   search={searchQuery}
 *   onMediaClick={(id, index) => {
 *     setPreviewIndex(index);
 *     setPreviewOpen(true);
 *   }}
 *   className="w-full h-full"
 * />
 */
