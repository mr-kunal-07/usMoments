/**
 * Service Worker enhancement for intelligent media caching
 * Add this to your existing service worker or use as a new sw-media.ts
 * 
 * To use, add to your vite config:
 * import { getModulePreloadList } from 'vite';
 * // Include this as a plugin or manually register
 */

const CACHE_VERSION = "media-cache-v1";
const MEDIA_CACHE = `${CACHE_VERSION}-media`;
const API_CACHE = `${CACHE_VERSION}-api`;
const STALE_WHILE_REVALIDATE_TIMEOUT = 3000; // 3 seconds

// Cache strategies
const MEDIA_EXTENSIONS = [
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".webp",
    ".mp4",
    ".webm",
    ".mov",
];

function isMediaRequest(url: string): boolean {
    return MEDIA_EXTENSIONS.some((ext) =>
        url.toLowerCase().endsWith(ext)
    );
}

function isApiRequest(url: string): boolean {
    return url.includes("/rest/v1/") || url.includes("localhost:3000");
}

/**
 * Network first with 3-second timeout - good for fresh media
 */
async function networkFirstStrategy(request: Request): Promise<Response> {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), STALE_WHILE_REVALIDATE_TIMEOUT);

        const networkResponse = await fetch(request, {
            signal: controller.signal,
        });

        clearTimeout(timeout);

        if (networkResponse.ok) {
            const cache = await caches.open(MEDIA_CACHE);
            cache.put(request, networkResponse.clone());
        }

        return networkResponse;
    } catch {
        // Network failed or timed out, try cache
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }

        // Return placeholder or error response
        return new Response("Offline - not in cache", { status: 503 });
    }
}

/**
 * Cache first with network fallback - good for thumbnails
 */
async function cacheFirstStrategy(request: Request): Promise<Response> {
    const cachedResponse = await caches.match(request);

    if (cachedResponse) {
        return cachedResponse;
    }

    try {
        const networkResponse = await fetch(request);

        if (networkResponse.ok) {
            const cache = await caches.open(MEDIA_CACHE);
            cache.put(request, networkResponse.clone());
        }

        return networkResponse;
    } catch {
        return new Response("Offline - not available", {
            status: 503,
        });
    }
}



/**
 * Manually clear media caches when needed
 */
export async function clearMediaCaches(): Promise<void> {
    const cacheNames = await caches.keys();
    await Promise.all(
        cacheNames
            .filter((name) => name.startsWith("media-cache"))
            .map((name) => caches.delete(name))
    );
}

/**
 * Preload media files into cache
 */
export async function preloadMediaIntoCache(
    urls: string[],
    batchSize = 5
): Promise<void> {
    const cache = await caches.open(MEDIA_CACHE);

    for (let i = 0; i < urls.length; i += batchSize) {
        const batch = urls.slice(i, i + batchSize);
        await Promise.all(
            batch.map(async (url) => {
                try {
                    const response = await fetch(url);
                    if (response.ok) {
                        await cache.put(url, response);
                    }
                } catch (error) {
                    console.debug(`Failed to preload ${url}:`, error);
                }
            })
        );

        // Small delay between batches to avoid overwhelming network
        await new Promise((resolve) =>
            setTimeout(resolve, 100)
        );
    }
}

/**
 * Get cache statistics
 */
export async function getMediaCacheStats(): Promise<{
    size: number;
    count: number;
    caches: Record<string, number>;
}> {
    const cacheNames = await caches.keys();
    const mediaCaches = cacheNames.filter((name) =>
        name.startsWith("media-cache")
    );

    let totalSize = 0;
    let totalCount = 0;
    const stats: Record<string, number> = {};

    for (const cacheName of mediaCaches) {
        const cache = await caches.open(cacheName);
        const requests = await cache.keys();
        stats[cacheName] = requests.length;
        totalCount += requests.length;

        for (const request of requests) {
            const response = await cache.match(request);
            if (response && response.headers.get("content-length")) {
                totalSize += parseInt(
                    response.headers.get("content-length") || "0"
                );
            }
        }
    }

    return { size: totalSize, count: totalCount, caches: stats };
}
