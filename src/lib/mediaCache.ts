/**
 * IndexedDB-based media caching system
 * Stores media metadata, thumbnails, and enables intelligent loading
 */

export interface CachedMedia {
    id: string;
    title: string;
    file_path: string;
    file_size: number;
    file_type: "image" | "video";
    mime_type: string;
    created_at: string;
    is_starred: boolean;
    folder_id: string | null;
    uploaded_by: string;
    deleted_at: string | null;
    thumbnail?: string; // base64 thumbnail
    cachedAt: number; // timestamp
}

const DB_NAME = "usmoment_media_db";
const STORE_NAME = "media_cache";
const THUMBNAIL_STORE = "thumbnails";
const DB_VERSION = 1;
const CACHE_DURATION = 1 * 60 * 60 * 1000; // 1 hour

let db: IDBDatabase | null = null;

export async function initMediaCache(): Promise<IDBDatabase> {
    if (db) return db;

    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };

        request.onupgradeneeded = (e) => {
            const database = (e.target as IDBOpenDBRequest).result;

            // Create stores if they don't exist
            if (!database.objectStoreNames.contains(STORE_NAME)) {
                const mediaStore = database.createObjectStore(STORE_NAME, { keyPath: "id" });
                mediaStore.createIndex("created_at", "created_at", { unique: false });
                mediaStore.createIndex("folder_id", "folder_id", { unique: false });
                mediaStore.createIndex("cachedAt", "cachedAt", { unique: false });
            }

            if (!database.objectStoreNames.contains(THUMBNAIL_STORE)) {
                database.createObjectStore(THUMBNAIL_STORE, { keyPath: "id" });
            }
        };
    });
}

export async function cacheMediaList(media: CachedMedia[]): Promise<void> {
    const database = await initMediaCache();
    const transaction = database.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    for (const item of media) {
        await store.put({
            ...item,
            cachedAt: Date.now(),
        });
    }

    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
}

export async function getCachedMedia(
    folderId?: string | null,
    searchTerm?: string
): Promise<CachedMedia[] | null> {
    const database = await initMediaCache();
    const transaction = database.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
        let results: CachedMedia[] = [];
        const index = folderId !== undefined ? store.index("folder_id") : store;
        const query = folderId !== undefined ? folderId : undefined;
        const request = query !== undefined ? index.getAll(query) : store.getAll();

        request.onsuccess = () => {
            let data = request.result as CachedMedia[];

            // Filter out expired cache
            data = data.filter((item) => Date.now() - item.cachedAt < CACHE_DURATION);

            // Apply search filter if provided
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                data = data.filter(
                    (item) =>
                        item.title.toLowerCase().includes(term) ||
                        (item.mime_type?.toLowerCase().includes(term) ?? false)
                );
            }

            // Filter out deleted items
            data = data.filter((item) => !item.deleted_at);

            // Sort by created_at descending
            data.sort(
                (a, b) =>
                    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );

            resolve(data.length > 0 ? data : null);
        };

        request.onerror = () => reject(request.error);
    });
}

export async function cacheThumbnail(mediaId: string, thumb: string): Promise<void> {
    const database = await initMediaCache();
    const transaction = database.transaction([THUMBNAIL_STORE], "readwrite");
    const store = transaction.objectStore(THUMBNAIL_STORE);

    return new Promise((resolve, reject) => {
        const request = store.put({ id: mediaId, thumb, cachedAt: Date.now() });
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

export async function getCachedThumbnail(mediaId: string): Promise<string | null> {
    const database = await initMediaCache();
    const transaction = database.transaction([THUMBNAIL_STORE], "readonly");
    const store = transaction.objectStore(THUMBNAIL_STORE);

    return new Promise((resolve, reject) => {
        const request = store.get(mediaId);
        request.onsuccess = () => {
            const result = request.result as { id: string; thumb: string; cachedAt: number } | undefined;
            resolve(result?.thumb ?? null);
        };
        request.onerror = () => reject(request.error);
    });
}

export async function clearMediaCache(): Promise<void> {
    const database = await initMediaCache();
    const transaction = database.transaction([STORE_NAME, THUMBNAIL_STORE], "readwrite");

    return new Promise((resolve, reject) => {
        transaction.objectStore(STORE_NAME).clear();
        transaction.objectStore(THUMBNAIL_STORE).clear();

        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
}

export async function getCacheStats(): Promise<{ count: number; size: number }> {
    const database = await initMediaCache();
    const transaction = database.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => {
            const data = request.result as CachedMedia[];
            const size = JSON.stringify(data).length;
            resolve({ count: data.length, size });
        };
        request.onerror = () => reject(request.error);
    });
}
