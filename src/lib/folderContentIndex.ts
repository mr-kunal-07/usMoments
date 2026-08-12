export interface FolderLike {
  id: string;
  parent_id: string | null;
}

export interface FolderMediaLike {
  folder_id: string | null;
}

const ROOT_KEY = "__root__";

export function createFolderContentIndex<
  TFolder extends FolderLike,
  TMedia extends FolderMediaLike,
>(folders: readonly TFolder[], media: readonly TMedia[]) {
  const childrenByParent = new Map<string, TFolder[]>();
  const directMediaByFolder = new Map<string, TMedia[]>();
  const subtreeMediaByFolder = new Map<string, TMedia[]>();

  for (const folder of folders) {
    const parentKey = folder.parent_id ?? ROOT_KEY;
    const children = childrenByParent.get(parentKey) ?? [];
    children.push(folder);
    childrenByParent.set(parentKey, children);
  }

  for (const item of media) {
    if (!item.folder_id) continue;
    const directMedia = directMediaByFolder.get(item.folder_id) ?? [];
    directMedia.push(item);
    directMediaByFolder.set(item.folder_id, directMedia);
  }

  const collectSubtreeMedia = (folderId: string, visiting: Set<string>): TMedia[] => {
    const cached = subtreeMediaByFolder.get(folderId);
    if (cached) return cached;
    if (visiting.has(folderId)) return [];

    visiting.add(folderId);
    const result = [...(directMediaByFolder.get(folderId) ?? [])];
    for (const child of childrenByParent.get(folderId) ?? []) {
      result.push(...collectSubtreeMedia(child.id, visiting));
    }
    visiting.delete(folderId);
    subtreeMediaByFolder.set(folderId, result);
    return result;
  };

  return {
    getChildren(parentId: string | null): readonly TFolder[] {
      return childrenByParent.get(parentId ?? ROOT_KEY) ?? [];
    },
    getDirectMedia(folderId: string): readonly TMedia[] {
      return directMediaByFolder.get(folderId) ?? [];
    },
    getSubtreeMedia(folderId: string): readonly TMedia[] {
      return collectSubtreeMedia(folderId, new Set());
    },
    getSubtreeCount(folderId: string): number {
      return collectSubtreeMedia(folderId, new Set()).length;
    },
  };
}
