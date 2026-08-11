import { ChevronRight, Home } from "lucide-react";
import { Folder } from "@/hooks/useFolders";
import { cn } from "@/lib/utils";

interface Props {
  folderId: string;
  folders: Folder[];
  onNavigate: (id: string) => void;
}

function buildAncestors(folderId: string, folders: Folder[]): Folder[] {
  const path: Folder[] = [];
  let current = folders.find(f => f.id === folderId);
  while (current) {
    path.unshift(current);
    current = current.parent_id ? folders.find(f => f.id === current!.parent_id) : undefined;
  }
  return path;
}

export function FolderBreadcrumb({ folderId, folders, onNavigate }: Props) {
  const ancestors = buildAncestors(folderId, folders);

  if (ancestors.length === 0) return null;

  return (
    <nav className="flex items-center gap-1 text-sm text-muted-foreground mb-1 flex-wrap">
      <button
        onClick={() => onNavigate("all")}
        className="flex items-center gap-1 hover:text-foreground transition-colors"
      >
        <Home className="h-3.5 w-3.5" />
        <span>All Files</span>
      </button>

      {ancestors.map((folder, i) => {
        const isLast = i === ancestors.length - 1;
        return (
          <span key={folder.id} className="flex items-center gap-1">
            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
            <button
              onClick={() => !isLast && onNavigate(folder.id)}
              className={cn(
                "transition-colors",
                isLast
                  ? "text-foreground font-medium cursor-default"
                  : "hover:text-foreground"
              )}
            >
              {folder.name}
            </button>
          </span>
        );
      })}
    </nav>
  );
}
