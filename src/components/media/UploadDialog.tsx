import { memo, useCallback, useRef, useState } from "react";
import { CloudUpload, FileImage, FileVideo, Upload, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/useToast";
import { cn } from "@/lib/utils";
import { useBackgroundUploads } from "@/hooks/useBackgroundUploads";
import { useIsMobile } from "@/hooks/useMobile";
import { haptic } from "@/lib/haptics";

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/quicktime",
  "video/webm",
] as const;

const MAX_SIZE_BYTES = 500 * 1024 * 1024;
const ACCEPT_STRING = ALLOWED_TYPES.join(",");

function formatMB(bytes: number): string {
  return (bytes / 1_048_576).toFixed(1) + " MB";
}

function isVideoType(type: string): boolean {
  return type.startsWith("video/");
}

interface FileEntry {
  file: File;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folderId?: string | null;
}

const FileRow = memo(function FileRow({
  entry,
  index,
  uploading,
  onRemove,
}: {
  entry: FileEntry;
  index: number;
  uploading: boolean;
  onRemove: (i: number) => void;
}) {
  const { file } = entry;
  const isVideo = isVideoType(file.type);

  return (
    <div className="flex items-center gap-3 rounded-xl border border-transparent bg-muted/60 px-3 py-2.5 transition-colors">
      <span className="shrink-0 flex items-center justify-center h-8 w-8 rounded-lg bg-background border border-border">
        {isVideo ? (
          <FileVideo className="h-4 w-4 text-muted-foreground" aria-hidden />
        ) : (
          <FileImage className="h-4 w-4 text-muted-foreground" aria-hidden />
        )}
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate text-foreground leading-snug">{file.name}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{formatMB(file.size)}</p>
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 rounded-lg hover:bg-destructive/10 hover:text-destructive active:scale-95"
        onClick={(e) => {
          e.stopPropagation();
          onRemove(index);
        }}
        disabled={uploading}
        aria-label={`Remove ${file.name}`}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
});

export function UploadDialog({ open, onOpenChange, folderId }: Props) {
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();

  const { toast } = useToast();
  const { queueUploads, status } = useBackgroundUploads();
  const uploading = status.active;

  const reset = useCallback(() => {
    setEntries([]);
  }, []);

  const addFiles = useCallback(
    (incoming: FileList | File[]) => {
      const valid: File[] = [];
      const existingNames = new Set(entries.map((entry) => entry.file.name));

      Array.from(incoming).forEach((file) => {
        if (existingNames.has(file.name)) return;
        if (!ALLOWED_TYPES.includes(file.type as typeof ALLOWED_TYPES[number])) {
          toast({
            title: `Skipped: ${file.name}`,
            description: "Unsupported format. Use JPG, PNG, WebP, MP4, MOV or WebM.",
            variant: "destructive",
          });
          haptic("warning");
          return;
        }
        if (file.size > MAX_SIZE_BYTES) {
          toast({
            title: `Skipped: ${file.name}`,
            description: "File exceeds the 500 MB limit.",
            variant: "destructive",
          });
          haptic("warning");
          return;
        }
        valid.push(file);
      });

      if (valid.length) {
        setEntries((prev) => [...prev, ...valid.map((file): FileEntry => ({ file }))]);
        haptic("success");
      }
    },
    [entries, toast],
  );

  const removeFile = useCallback((index: number) => {
    setEntries((prev) => prev.filter((_, i) => i !== index));
    haptic("light");
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes("Files")) setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
    },
    [addFiles],
  );

  const handleSubmit = useCallback(async () => {
    if (!entries.length) return;

    try {
      await queueUploads(
        entries.map((entry) => ({
          file: entry.file,
          title: entry.file.name.replace(/\.[^.]+$/, ""),
          folderId,
        })),
      );
      toast({
        title: `Uploading ${entries.length} file${entries.length !== 1 ? "s" : ""}`,
        description: "You can keep using the app while this finishes in the background.",
      });
      haptic("success");
      reset();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Unable to start upload",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
      haptic("warning");
    }
  }, [entries, folderId, onOpenChange, queueUploads, reset, toast]);

  const pendingCount = entries.length;
  const hasEntries = entries.length > 0;

  const handleClose = useCallback(() => {
    if (uploading) return;
    reset();
    onOpenChange(false);
  }, [uploading, reset, onOpenChange]);

  const openFilePicker = useCallback(() => {
    haptic("light");
    inputRef.current?.click();
  }, []);

  const body = (
    <div className="flex-1 flex flex-col gap-4 px-5 py-4 min-h-0 overflow-hidden">
      <div
        role="button"
        tabIndex={0}
        aria-label="Click or drag files to upload"
        onKeyDown={(e) => e.key === "Enter" && openFilePicker()}
        className={cn(
          "relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed",
          "px-4 py-7 text-center cursor-pointer transition-all duration-200 select-none active:scale-[0.99]",
          dragOver ? "border-primary bg-primary/6 scale-[1.01]" : "border-border hover:border-primary/50 hover:bg-muted/40",
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={openFilePicker}
      >
        <span
          className={cn(
            "flex items-center justify-center h-12 w-12 rounded-2xl mb-1 bg-primary/10 transition-transform duration-200",
            dragOver && "scale-110",
          )}
        >
          <Upload
            className={cn("h-6 w-6 text-primary transition-transform duration-200", dragOver && "-translate-y-0.5")}
            aria-hidden
          />
        </span>

        <p className="text-sm font-semibold text-foreground">
          {dragOver ? "Drop to add files" : "Drag & drop or tap to browse"}
        </p>
        <p className="text-xs text-muted-foreground max-w-[260px] leading-relaxed">
          JPG, PNG, WebP, MP4, MOV, WebM. Up to 500 MB each.
        </p>

        <input
          ref={inputRef}
          id="file-input-multi"
          type="file"
          className="sr-only"
          accept={ACCEPT_STRING}
          multiple
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {hasEntries && (
        <ScrollArea className="flex-1 min-h-0 -mx-1 px-1">
          <div className="space-y-1.5 pb-1">
            {entries.map((entry, index) => (
              <FileRow
                key={`${entry.file.name}-${index}`}
                entry={entry}
                index={index}
                uploading={uploading}
                onRemove={removeFile}
              />
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );

  const footer = (
    <>
      <Button
        variant="outline"
        className="flex-1 sm:flex-none rounded-xl h-10 active:scale-[0.98]"
        onClick={handleClose}
        disabled={uploading}
      >
        Cancel
      </Button>
      <Button
        className="flex-1 sm:flex-none rounded-xl h-10 gap-2 active:scale-[0.98]"
        onClick={handleSubmit}
        disabled={!pendingCount || uploading}
      >
        <Upload className="h-3.5 w-3.5" aria-hidden />
        Upload {pendingCount > 0 ? `${pendingCount} file${pendingCount !== 1 ? "s" : ""}` : ""}
      </Button>
    </>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={(nextOpen) => { if (!nextOpen) handleClose(); }}>
        <SheetContent
          side="bottom"
          className="flex max-h-[92dvh] flex-col gap-0 overflow-hidden rounded-t-[28px] border-border/70 p-0 pb-[env(safe-area-inset-bottom,0px)]"
        >
          <div className="flex justify-center pt-3">
            <div className="h-1 w-11 rounded-full bg-muted-foreground/30" />
          </div>
          <SheetHeader className="px-5 pt-4 pb-4 border-b border-border/60 shrink-0 text-left">
            <SheetTitle className="flex items-center gap-2.5 text-base font-semibold">
              <span className="flex items-center justify-center h-7 w-7 rounded-lg bg-primary/10">
                <CloudUpload className="h-4 w-4 text-primary" aria-hidden />
              </span>
              Upload Media
            </SheetTitle>
          </SheetHeader>
          {body}
          <SheetFooter className="px-5 pb-5 pt-3 border-t border-border/60 shrink-0 flex-row gap-2">
            {footer}
          </SheetFooter>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) handleClose(); }}>
      <DialogContent className="flex w-[calc(100vw-2rem)] max-w-lg max-h-[calc(100dvh-4rem)] sm:max-h-[90vh] flex-col gap-0 overflow-hidden rounded-2xl border border-border/60 p-0">
        <DialogHeader className="px-5 pt-5 pb-4 border-b border-border/60 shrink-0">
          <DialogTitle className="flex items-center gap-2.5 text-base font-semibold">
            <span className="flex items-center justify-center h-7 w-7 rounded-lg bg-primary/10">
              <CloudUpload className="h-4 w-4 text-primary" aria-hidden />
            </span>
            Upload Media
          </DialogTitle>
        </DialogHeader>
        {body}
        <DialogFooter className="px-5 pb-5 pt-3 border-t border-border/60 shrink-0 flex-row gap-2 sm:gap-2">
          {footer}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default UploadDialog;
