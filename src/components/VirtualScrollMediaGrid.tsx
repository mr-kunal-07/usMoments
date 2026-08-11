/**
 * Virtual scrolling media grid for high-performance rendering
 * Only renders visible items in viewport
 */

import { useMemo, useRef, useEffect, useState } from "react";
import { Media } from "@/hooks/useMedia";
import { cn } from "@/lib/utils";

interface VirtualScrollProps {
    media: Media[];
    renderItem: (item: Media, index: number) => React.ReactNode;
    itemHeight: number;
    columnCount?: number;
    gap?: number;
    className?: string;
    loadingPlaceholder?: React.ReactNode;
    hasMore?: boolean;
    onLoadMore?: () => void;
}

export function VirtualScrollMediaGrid({
    media,
    renderItem,
    itemHeight,
    columnCount = 3,
    gap = 16,
    className,
    loadingPlaceholder,
    hasMore,
    onLoadMore,
}: VirtualScrollProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [visibleRange, setVisibleRange] = useState({ start: 0, end: columnCount * 3 });

    const itemWidth = `calc((100% - ${gap * (columnCount - 1)}px) / ${columnCount})`;

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleScroll = () => {
            const scrollTop = container.scrollTop;
            const viewportHeight = container.clientHeight;

            // Calculate which rows are visible
            const rowHeight = itemHeight + gap;
            const startRow = Math.max(0, Math.floor(scrollTop / rowHeight) - 1);
            const endRow =
                Math.ceil((scrollTop + viewportHeight) / rowHeight) +
                columnCount;

            const start = startRow * columnCount;
            const end = Math.min(media.length, endRow * columnCount);

            setVisibleRange({ start, end });

            // Load more when near bottom
            if (
                scrollTop + viewportHeight >
                container.scrollHeight - 500 &&
                hasMore &&
                onLoadMore
            ) {
                onLoadMore();
            }
        };

        container.addEventListener("scroll", handleScroll, { passive: true });
        return () =>
            container.removeEventListener("scroll", handleScroll);
    }, [media.length, itemHeight, gap, columnCount, hasMore, onLoadMore]);

    // Calculate offscreen items to render
    const visibleItems = useMemo(() => {
        return media.slice(visibleRange.start, visibleRange.end);
    }, [media, visibleRange]);

    // Calculate top offset for visible items
    const topOffset =
        Math.floor(visibleRange.start / columnCount) *
        (itemHeight + gap);

    return (
        <div
            ref={containerRef}
            className={cn(
                "overflow-y-auto overflow-x-hidden",
                className
            )}
            style={{ height: "100%" }}
        >
            {/* Virtual spacer for off-screen content above */}
            <div style={{ height: topOffset }} />

            {/* Grid container */}
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: `repeat(${columnCount}, 1fr)`,
                    gap: `${gap}px`,
                    padding: `0 ${gap / 2}px`,
                }}
            >
                {visibleItems.map((item, idx) =>
                    renderItem(item, visibleRange.start + idx)
                )}

                {/* Loading indicator */}
                {loadingPlaceholder && (
                    <div
                        style={{
                            gridColumn: "1 / -1",
                            display: "flex",
                            justifyContent: "center",
                            padding: 16,
                        }}
                    >
                        {loadingPlaceholder}
                    </div>
                )}
            </div>

            {/* Virtual spacer for off-screen content below */}
            <div
                style={{
                    height: Math.max(
                        0,
                        (media.length - visibleRange.end) *
                        ((itemHeight + gap) / columnCount)
                    ),
                }}
            />
        </div>
    );
}

interface LazyImageProps {
    src: string;
    blur?: string;
    alt: string;
    className?: string;
    onLoad?: () => void;
}

/**
 * Lazy-loaded image with blur-up effect
 */
export function LazyImage({
    src,
    blur,
    alt,
    className,
    onLoad,
}: LazyImageProps) {
    const [loaded, setLoaded] = useState(false);

    return (
        <div className={cn("relative overflow-hidden bg-gray-200", className)}>
            {/* Blur placeholder */}
            {blur && !loaded && (
                <img
                    src={blur}
                    alt={alt}
                    className="absolute inset-0 w-full h-full object-cover blur-md"
                />
            )}

            {/* Full image */}
            <img
                src={src}
                alt={alt}
                className={cn(
                    "w-full h-full object-cover transition-opacity duration-300",
                    loaded ? "opacity-100" : "opacity-0"
                )}
                loading="lazy"
                onLoad={() => {
                    setLoaded(true);
                    onLoad?.();
                }}
            />
        </div>
    );
}
