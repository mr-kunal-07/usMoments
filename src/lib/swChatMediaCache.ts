const PRIVATE_MEDIA_CACHE_NAMES = new Set([
  "supabase-media-cache",
  "chat-media-v1-audio",
  "chat-media-v1-drawings",
  "chat-media-v1-metadata",
]);

/** Remove user-specific media cached by current and legacy service workers. */
export async function clearChatMediaCaches(): Promise<void> {
  if (!("caches" in globalThis)) return;

  const cacheNames = await globalThis.caches.keys();
  await Promise.all(
    cacheNames
      .filter((name) =>
        PRIVATE_MEDIA_CACHE_NAMES.has(name) ||
        name.startsWith("chat-") ||
        name.startsWith("media-cache"),
      )
      .map((name) => globalThis.caches.delete(name)),
  );
}
