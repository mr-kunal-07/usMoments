/**
 * Service Worker Enhancement for Chat Media Caching
 * 
 * This extends the existing Service Worker to handle chat-specific media:
 * - Voice message audio files (cache-first strategy)
 * - Drawing images (cache-first strategy)
 * 
 * Add this to your existing service worker or sw.ts file
 */

/**
 * Chat media cache strategy
 * Use cache-first for audio/drawings (they never change once sent)
 */
const CHAT_MEDIA_CACHE_VERSION = "chat-media-v1";
const CHAT_AUDIO_CACHE = `${CHAT_MEDIA_CACHE_VERSION}-audio`;
const CHAT_DRAWINGS_CACHE = `${CHAT_MEDIA_CACHE_VERSION}-drawings`;
const CHAT_METADATA_CACHE = `${CHAT_MEDIA_CACHE_VERSION}-metadata`;

/**
 * Detect if a request is for chat audio
 * Pattern: /storage/v1/object/public/media/{userId}/{uuid}.webm
 */
function isChatAudioRequest(url: string): boolean {
    try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;

        // Match: .webm, .mp4, .ogg, .m4a audio extensions
        return (
            pathname.includes("/media/") &&
            /\.(webm|mp4|ogg|m4a)$/i.test(pathname)
        );
    } catch {
        return false;
    }
}

/**
 * Detect if a request is for drawing images
 * Marked with query param ?type=drawing or content-type image
 */
function isChatDrawingRequest(url: string): boolean {
    try {
        const urlObj = new URL(url);

        // Check for drawing marker in URL
        if (urlObj.searchParams.get("type") === "drawing") {
            return true;
        }

        // Or if it's a blob URL for drawing
        const pathname = urlObj.pathname;
        return (
            pathname.includes("/drawings/") ||
            pathname.includes("/canvas/")
        );
    } catch {
        return false;
    }
}

/**
 * Cache-first strategy for immutable media
 * (Perfect for audio messages and drawings)
 */
async function cacheFirstStrategy(
    request: Request,
    cacheName: string
): Promise<Response> {
    // Check cache first
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
        return cachedResponse;
    }

    try {
        // Fetch from network with timeout
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15_000); // 15s timeout

        const networkResponse = await fetch(request, {
            signal: controller.signal,
        });

        clearTimeout(timeout);

        // Cache successful responses
        if (networkResponse.ok) {
            const cache = await caches.open(cacheName);
            await cache.put(request, networkResponse.clone());
        }

        return networkResponse;
    } catch (error) {
        // Network failed, return cached or error
        const fallbackCache = await caches.match(request);
        if (fallbackCache) {
            return fallbackCache;
        }

        return new Response(
            JSON.stringify({
                error: "Failed to load media - offline or network error",
            }),
            {
                status: 503,
                headers: { "Content-Type": "application/json" },
            }
        );
    }
}

/**
 * Register chat media cache handlers
 * Call this from your service worker registration:
 * 
 * In sw.ts or your service worker file:
 * ```
 * import { registerChatMediaCacheHandlers } from '@/lib/swChatMediaCache';
 * registerChatMediaCacheHandlers();
 * ```
 */
export function registerChatMediaCacheHandlers(): void {
    if (typeof self === "undefined") return;

    const sw = self as any;

    // Intercept fetch events for chat media
    sw.addEventListener("fetch", (event: FetchEvent) => {
        const { request } = event;

        // Only handle GET requests
        if (request.method !== "GET") return;

        // Audio messages: use cache-first
        if (isChatAudioRequest(request.url)) {
            event.respondWith(
                cacheFirstStrategy(request, CHAT_AUDIO_CACHE)
            );
            return;
        }

        // Drawing images: use cache-first
        if (isChatDrawingRequest(request.url)) {
            event.respondWith(
                cacheFirstStrategy(request, CHAT_DRAWINGS_CACHE)
            );
            return;
        }
    });

    // Cleanup old cache versions on activate
    sw.addEventListener("activate", (event: ExtendableEvent) => {
        event.waitUntil(
            caches.keys().then((cacheNames) =>
                Promise.all(
                    cacheNames
                        .filter((name) =>
                            name.startsWith("chat-media") &&
                            !name.includes(CHAT_MEDIA_CACHE_VERSION)
                        )
                        .map((name) => {
                            console.log(`[SW] Deleting old cache: ${name}`);
                            return caches.delete(name);
                        })
                )
            )
        );
    });
}

/**
 * Manually clear chat caches (call on logout)
 */
export async function clearChatMediaCaches(): Promise<void> {
    if (!("caches" in self)) return;

    const sw = self as any;
    const cacheNames = await sw.caches.keys();

    await Promise.all(
        cacheNames
            .filter((name: string) => name.startsWith("chat-"))
            .map((name: string) => {
                console.log(`[SW] Clearing: ${name}`);
                return sw.caches.delete(name);
            })
    );
}

/**
 * Get cache statistics for chat media
 */
export async function getChatMediaCacheStats(): Promise<{
    audioSize: number;
    audioCount: number;
    drawingSize: number;
    drawingCount: number;
    totalSize: number;
}> {
    if (!("caches" in self)) {
        return {
            audioSize: 0,
            audioCount: 0,
            drawingSize: 0,
            drawingCount: 0,
            totalSize: 0,
        };
    }

    const sw = self as any;

    let audioSize = 0;
    let audioCount = 0;
    let drawingSize = 0;
    let drawingCount = 0;

    // Check audio cache
    try {
        const audioCache = await sw.caches.open(CHAT_AUDIO_CACHE);
        const audioRequests = await audioCache.keys();
        audioCount = audioRequests.length;

        for (const request of audioRequests) {
            const response = await audioCache.match(request);
            if (response?.headers.get("content-length")) {
                audioSize += parseInt(response.headers.get("content-length") || "0");
            }
        }
    } catch (e) {
        console.warn("[getChatMediaCacheStats] Error reading audio cache:", e);
    }

    // Check drawings cache
    try {
        const drawingCache = await sw.caches.open(CHAT_DRAWINGS_CACHE);
        const drawingRequests = await drawingCache.keys();
        drawingCount = drawingRequests.length;

        for (const request of drawingRequests) {
            const response = await drawingCache.match(request);
            if (response?.headers.get("content-length")) {
                drawingSize += parseInt(response.headers.get("content-length") || "0");
            }
        }
    } catch (e) {
        console.warn("[getChatMediaCacheStats] Error reading drawing cache:", e);
    }

    return {
        audioSize,
        audioCount,
        drawingSize,
        drawingCount,
        totalSize: audioSize + drawingSize,
    };
}

/**
 * ============================================
 * INTEGRATION INSTRUCTIONS
 * ============================================
 * 
 * 1. In your existing sw.ts (or service worker):
 * 
 *    import { registerChatMediaCacheHandlers } from '@/lib/swChatMediaCache';
 *    
 *    // Call this early in your service worker initialization
 *    registerChatMediaCacheHandlers();
 * 
 * 2. In your logout handler:
 * 
 *    import { clearChatMediaCaches } from '@/lib/swChatMediaCache';
 *    
 *    const handleLogout = async () => {
 *      await clearChatMediaCaches();
 *      // ... rest of logout
 *    };
 * 
 * 3. Optional: Monitor cache stats in your chat debug panel:
 * 
 *    import { getChatMediaCacheStats } from '@/lib/swChatMediaCache';
 *    
 *    const stats = await getChatMediaCacheStats();
 *    console.log(`Chat cache: ${(stats.totalSize / 1024 / 1024).toFixed(2)}MB`);
 * 
 * ============================================
 */
