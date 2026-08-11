import { useState } from "react";
import { RotateCcw, Trash2, Clock } from "lucide-react";
import { useRecentlyDeletedMedia, usePermanentDeleteMedia, useRestoreMedia, getPublicUrl } from "@/hooks/useMedia";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow, differenceInDays } from "date-fns";

export function RecentlyDeletedView() {
  const { data: items = [], isLoading } = useRecentlyDeletedMedia();
  const restore = useRestoreMedia();
  const permanentDelete = usePermanentDeleteMedia();
  const { toast } = useToast();
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const handleRestore = async (id: string) => {
    await restore.mutateAsync(id);
    toast({ title: "Restored successfully" });
  };

  const handlePermanentDelete = async () => {
    if (!confirmId) return;
    const item = items.find(i => i.id === confirmId);
    if (!item) return;
    await permanentDelete.mutateAsync({ id: item.id, filePath: item.file_path });
    toast({ title: "Permanently deleted" });
    setConfirmId(null);
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square rounded-xl" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
          <Trash2 className="h-7 w-7 text-muted-foreground" />
        </div>
        <div>
          <p className="font-semibold text-foreground">No deleted items</p>
          <p className="text-sm text-muted-foreground mt-1">Deleted photos & videos appear here for 14 days before permanent removal.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mb-4 flex items-center gap-2 rounded-lg bg-muted/50 border border-border px-3 py-2.5">
        <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
        <p className="text-xs text-muted-foreground">
          Items are permanently deleted after <strong className="text-foreground">14 days</strong>. Restore them before then.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {items.map(item => {
          const daysLeft = item.deleted_at
            ? 14 - differenceInDays(new Date(), new Date(item.deleted_at))
            : 14;
          const url = getPublicUrl(item.file_path);
          const isUrgent = daysLeft <= 3;

          return (
            <div key={item.id} className="group relative rounded-xl overflow-hidden border border-border bg-muted/30">
              {/* Thumbnail */}
              <div className="aspect-square relative overflow-hidden">
                {item.file_type === "video" ? (
                  <video src={url} className="w-full h-full object-cover opacity-60" />
                ) : (
                  <img src={url} alt={item.title} className="w-full h-full object-cover opacity-60" />
                )}
                {/* Overlay */}
                <div className="absolute inset-0 bg-background/40" />
                {/* Days left badge */}
                <Badge
                  className={`absolute top-2 left-2 text-[10px] h-5 px-1.5 border-0 ${
                    isUrgent ? "bg-destructive text-destructive-foreground" : "bg-muted/80 text-muted-foreground"
                  }`}
                >
                  {daysLeft}d left
                </Badge>
              </div>

              {/* Info + actions */}
              <div className="p-2 space-y-1.5">
                <p className="text-xs font-medium text-foreground truncate">{item.title}</p>
                <p className="text-[10px] text-muted-foreground">
                  Deleted {item.deleted_at ? formatDistanceToNow(new Date(item.deleted_at), { addSuffix: true }) : ""}
                </p>
                <div className="flex gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 h-7 text-xs gap-1"
                    onClick={() => handleRestore(item.id)}
                    disabled={restore.isPending}
                  >
                    <RotateCcw className="h-3 w-3" />
                    Restore
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setConfirmId(item.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <AlertDialog open={!!confirmId} onOpenChange={open => !open && setConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently delete?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. The file will be removed from storage immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={handlePermanentDelete}
              disabled={permanentDelete.isPending}
            >
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
