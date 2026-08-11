import JSZip from "jszip";
import { getPublicUrl } from "@/hooks/useMedia";

export interface MediaToDownload {
    id: string;
    file_name: string;
    file_path: string;
    file_type: "image" | "video";
    title: string;
    created_at: string;
}

/**
 * Download media files as a ZIP archive without quality loss
 * The files are downloaded from Supabase public URLs and stored as-is in the ZIP
 * @param mediaItems - Array of media items to download
 * @param onProgress - Optional callback to track download progress
 * @returns Promise that resolves when download is complete
 */
export async function downloadMediaAsZip(
    mediaItems: MediaToDownload[],
    onProgress?: (current: number, total: number) => void
): Promise<void> {
    if (mediaItems.length === 0) {
        throw new Error("No media items selected");
    }

    const zip = new JSZip();
    let completed = 0;

    try {
        // Fetch all files in parallel for faster download
        const filePromises = mediaItems.map(async (item) => {
            try {
                // Construct the public URL for the file
                const url = getPublicUrl(item.file_path);
                console.log(`[Download] Fetching: ${item.file_name} from ${url}`);

                // Fetch the file as a blob (preserves original quality)
                const response = await fetch(url, {
                    headers: {
                        'Accept': '*/*',
                    }
                });
                if (!response.ok) {
                    throw new Error(`Failed to download ${item.file_name} (HTTP ${response.status})`);
                }

                const blob = await response.blob();
                console.log(`[Download] Success: ${item.file_name} (${blob.size} bytes, ${blob.type})`);

                if (blob.size === 0) {
                    console.warn(`[Download] Warning: Empty blob for ${item.file_name}`);
                }

                // Create a folder structure by date
                const dateObj = new Date(item.created_at);
                const dateStr = dateObj.toISOString().split("T")[0]; // YYYY-MM-DD
                const folderPath = `by-date/${dateStr}`;

                // Get or create the folder and add file to it
                const folder = zip.folder(folderPath);
                if (!folder) {
                    throw new Error("Failed to create folder in ZIP");
                }
                folder.file(item.file_name, blob);
                console.log(`[Download] Added to ZIP: ${folderPath}/${item.file_name}`);

                completed++;
                onProgress?.(completed, mediaItems.length);
            } catch (error) {
                console.error(`[Download] Failed to download ${item.file_name}:`, error);
                // Still increment to show progress even on failures
                completed++;
                onProgress?.(completed, mediaItems.length);
            }
        });

        await Promise.all(filePromises);

        // Check if ZIP has any files
        const files = Object.keys(zip.files);
        console.log(`[Download] ZIP contains ${files.length} entries:`, files);

        // Generate ZIP file and trigger download
        const zipBlob = await zip.generateAsync({ type: "blob" });
        console.log(`[Download] Generated ZIP blob: ${zipBlob.size} bytes`);

        if (zipBlob.size === 0) {
            throw new Error("Generated ZIP file is empty - no files were added");
        }

        // Create download link
        const url = URL.createObjectURL(zipBlob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `memories-${new Date().toISOString().slice(0, 10)}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error("Error creating ZIP:", error);
        throw error;
    }
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

/**
 * Download media from multiple folders as a single ZIP
 * Fetches media from each folder and combines them into one ZIP
 * @param folderIds - Array of folder IDs to download from
 * @param fetchMediaFromFolder - Function to fetch media from a folder
 * @param onProgress - Optional callback to track download progress
 * @returns Promise that resolves when download is complete
 */
export async function downloadFoldersAsZip(
    folderIds: string[],
    fetchMediaFromFolder: (folderId: string) => Promise<MediaToDownload[]>,
    onProgress?: (current: number, total: number) => void
): Promise<void> {
    if (folderIds.length === 0) {
        throw new Error("No folders selected");
    }

    const zip = new JSZip();
    let totalFiles = 0;
    let completed = 0;

    try {
        // First, fetch all media from all folders
        console.log(`[Download] Fetching media from ${folderIds.length} folders...`);
        const allMediaByFolder: Map<string, MediaToDownload[]> = new Map();

        for (const folderId of folderIds) {
            try {
                const media = await fetchMediaFromFolder(folderId);
                allMediaByFolder.set(folderId, media);
                totalFiles += media.length;
                console.log(`[Download] Folder ${folderId}: ${media.length} files`);
            } catch (error) {
                console.error(`[Download] Failed to fetch media from folder ${folderId}:`, error);
            }
        }

        if (totalFiles === 0) {
            throw new Error("No media found in selected folders");
        }

        console.log(`[Download] Total files to download: ${totalFiles}`);

        // Now download all files
        const allDownloadPromises: Promise<void>[] = [];

        allMediaByFolder.forEach((mediaItems, folderName) => {
            mediaItems.forEach((item) => {
                const promise = (async () => {
                    try {
                        const url = getPublicUrl(item.file_path);
                        console.log(`[Download] Fetching: ${item.file_name}`);

                        const response = await fetch(url, {
                            headers: { 'Accept': '*/*' }
                        });

                        if (!response.ok) {
                            throw new Error(`Failed to download ${item.file_name} (HTTP ${response.status})`);
                        }

                        const blob = await response.blob();
                        console.log(`[Download] Success: ${item.file_name} (${blob.size} bytes)`);

                        // Create folder structure: folder-name/by-date/YYYY-MM-DD/
                        const dateObj = new Date(item.created_at);
                        const dateStr = dateObj.toISOString().split("T")[0];
                        const folderPath = `${folderName}/by-date/${dateStr}`;

                        const folder = zip.folder(folderPath);
                        if (!folder) {
                            throw new Error("Failed to create folder in ZIP");
                        }
                        folder.file(item.file_name, blob);
                        console.log(`[Download] Added to ZIP: ${folderPath}/${item.file_name}`);

                        completed++;
                        onProgress?.(completed, totalFiles);
                    } catch (error) {
                        console.error(`[Download] Failed to download ${item.file_name}:`, error);
                        completed++;
                        onProgress?.(completed, totalFiles);
                    }
                })();
                allDownloadPromises.push(promise);
            });
        });

        await Promise.all(allDownloadPromises);

        // Generate and download ZIP
        const files = Object.keys(zip.files);
        console.log(`[Download] ZIP contains ${files.length} entries`);

        const zipBlob = await zip.generateAsync({ type: "blob" });
        console.log(`[Download] Generated ZIP blob: ${zipBlob.size} bytes`);

        if (zipBlob.size === 0) {
            throw new Error("Generated ZIP file is empty");
        }

        // Trigger download
        const url = URL.createObjectURL(zipBlob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `memories-folders-${new Date().toISOString().slice(0, 10)}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error("[Download] Error creating folders ZIP:", error);
        throw error;
    }
}
