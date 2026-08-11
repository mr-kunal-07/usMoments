/**
 * Responsive Image & WebP Utilities
 * Provides helpers for serving optimized images with WebP fallback
 */

export interface ResponsiveImageProps {
    src: string;
    alt: string;
    width?: number;
    height?: number;
    sizes?: string;
    priority?: boolean;
    className?: string;
}

/**
 * Generate srcset for responsive images
 * Assumes images are hosted on Supabase storage with CDN transformation support
 * Format: [URL]?w=[WIDTH]&q=[QUALITY]
 */
export const generateResponsiveSrcSet = (
    baseUrl: string,
    widths: number[] = [320, 640, 1280],
    format: "webp" | "jpg" = "webp"
): string => {
    return widths
        .map((width) => {
            const separator = baseUrl.includes("?") ? "&" : "?";
            const quality = width <= 320 ? 60 : width <= 640 ? 75 : 90;
            return `${baseUrl}${separator}w=${width}&q=${quality}&fm=${format} ${width}w`;
        })
        .join(", ");
};

/**
 * Get WebP-enabled srcset with fallback
 */
export const getOptimizedImageUrl = (
    url: string,
    options: {
        width?: number;
        quality?: number;
        format?: "webp" | "jpg";
    } = {}
): string => {
    const { width, quality = 80, format = "webp" } = options;

    if (!url) return "";

    // Skip transformation for non-Supabase URLs
    if (!url.includes("supabase")) return url;

    const separator = url.includes("?") ? "&" : "?";
    let optimized = url + separator;

    if (width) optimized += `w=${width}&`;
    optimized += `q=${quality}&fm=${format}`;

    return optimized;
};

/**
 * Lazy load image detection using Intersection Observer
 * Returns a handler function to attach to img element
 */
export const useLazyLoadImage = (
    onLoad?: () => void
): ((element: HTMLImageElement | null) => void) => {
    return (img: HTMLImageElement | null) => {
        if (!img) return;

        if ("IntersectionObserver" in window) {
            const observer = new IntersectionObserver(
                ([entry]) => {
                    if (entry.isIntersecting && img.dataset.src) {
                        img.src = img.dataset.src;
                        img.removeAttribute("data-src");
                        observer.unobserve(img);
                        onLoad?.();
                    }
                },
                { rootMargin: "50px" }
            );

            observer.observe(img);
        } else {
            // Fallback for older browsers
            if (img.dataset.src) {
                img.src = img.dataset.src;
                img.removeAttribute("data-src");
                onLoad?.();
            }
        }
    };
};

/**
 * Image blur placeholder generator (low-res base64 preview)
 * Use with progressive image loading
 */
export const generatePlaceholderFromUrl = async (
    url: string
): Promise<string> => {
    try {
        const img = new Image();
        img.crossOrigin = "anonymous";

        return new Promise((resolve) => {
            img.onload = () => {
                const canvas = document.createElement("canvas");
                canvas.width = 10;
                canvas.height = Math.round((10 * img.height) / img.width);

                const ctx = canvas.getContext("2d");
                if (ctx) {
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    resolve(canvas.toDataURL("image/jpeg", 0.3));
                } else {
                    resolve("");
                }
            };
            img.onerror = () => resolve("");
            img.src = url;
        });
    } catch {
        return "";
    }
};

/**
 * Check browser support for WebP
 */
export const supportsWebP = (): boolean => {
    try {
        const canvas = document.createElement("canvas");
        return (
            canvas.toDataURL("image/webp").indexOf("image/webp") === 0
        );
    } catch {
        return false;
    }
};

/**
 * Size optimization: Load smaller images on mobile
 */
export const getResponsiveWidth = (): number => {
    if (typeof window === "undefined") return 1280;

    const width = window.innerWidth;
    if (width < 480) return 320;
    if (width < 1024) return 640;
    return 1280;
};
