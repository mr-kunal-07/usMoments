import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAllProfiles } from "@/hooks/useProfile";
import { sendNotification } from "@/hooks/useNotifications";
import { uploadMediaFile, type Media } from "@/hooks/useMedia";
import { invalidateMedia, QK } from "@/lib/queryKeys";
import { useToast } from "@/hooks/use-toast";

type UploadQueueItem = {
  file: File;
  title: string;
  description?: string;
  folderId?: string | null;
};

type UploadStatus = {
  active: boolean;
  total: number;
  completed: number;
  succeeded: number;
  failed: number;
  currentFileName: string | null;
};

type BackgroundUploadsContextValue = {
  queueUploads: (items: UploadQueueItem[]) => void;
  status: UploadStatus;
};

const BackgroundUploadsContext = createContext<BackgroundUploadsContextValue | undefined>(undefined);

const initialStatus: UploadStatus = {
  active: false,
  total: 0,
  completed: 0,
  succeeded: 0,
  failed: 0,
  currentFileName: null,
};

function BackgroundUploadProgress({ status }: { status: UploadStatus }) {
  if (!status.active) return null;

  const percent = status.total > 0
    ? Math.round((status.completed / status.total) * 100)
    : 0;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[120]">
      <div className="h-1 w-full bg-border/50">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="mx-auto mt-2 flex w-fit max-w-[calc(100vw-1rem)] items-center gap-2 rounded-md border border-border/70 bg-background/95 px-3 py-1.5 shadow-sm backdrop-blur-sm">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />
        <p className="truncate text-xs text-foreground">
          Uploading {status.completed}/{status.total}
          {status.currentFileName ? ` - ${status.currentFileName}` : ""}
        </p>
      </div>
    </div>
  );
}

export function BackgroundUploadsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { data: profiles = [] } = useAllProfiles();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const runningRef = useRef(false);
  const [status, setStatus] = useState<UploadStatus>(initialStatus);

  const queueUploads = useCallback((items: UploadQueueItem[]) => {
    if (!user) throw new Error("You need to be signed in to upload.");
    if (!items.length) return;
    if (runningRef.current) throw new Error("An upload is already in progress.");

    runningRef.current = true;
    setStatus({
      active: true,
      total: items.length,
      completed: 0,
      succeeded: 0,
      failed: 0,
      currentFileName: items[0]?.file.name ?? null,
    });

    const allUserIds = profiles.map((p) => p.user_id);
    const uploaderName =
      profiles.find((p) => p.user_id === user.id)?.display_name ?? "You";

    void (async () => {
      let succeeded = 0;
      let failed = 0;

      for (let index = 0; index < items.length; index += 1) {
        const item = items[index];

        setStatus((prev) => ({
          ...prev,
          currentFileName: item.file.name,
        }));

        try {
          const result = await uploadMediaFile({
            file: item.file,
            title: item.title,
            description: item.description,
            folderId: item.folderId,
            userId: user.id,
          }) as Media;

          if (allUserIds.length > 1) {
            await sendNotification({
              actorId: user.id,
              allUserIds,
              type: "upload",
              mediaId: result.id ?? null,
              message: `${uploaderName} uploaded "${item.title}" to the vault.`,
            });
          }

          succeeded += 1;
        } catch (error) {
          failed += 1;
          toast({
            title: `Upload failed: ${item.file.name}`,
            description: error instanceof Error ? error.message : "Please try again.",
            variant: "destructive",
          });
        } finally {
          setStatus((prev) => ({
            ...prev,
            completed: index + 1,
            succeeded,
            failed,
            currentFileName: index + 1 < items.length ? items[index + 1].file.name : null,
          }));
        }
      }

      invalidateMedia(queryClient);
      queryClient.invalidateQueries({ queryKey: QK.memoriesTimeline() });
      queryClient.invalidateQueries({ queryKey: QK.onThisDay() });
      queryClient.invalidateQueries({ queryKey: QK.relationshipStats() });
      queryClient.invalidateQueries({ queryKey: QK.activityFeed() });

      toast({
        title: failed > 0
          ? `Uploaded ${succeeded} of ${items.length} files`
          : `Uploaded ${succeeded} file${succeeded !== 1 ? "s" : ""}`,
        description: failed > 0 ? `${failed} file${failed !== 1 ? "s" : ""} failed.` : undefined,
        variant: failed > 0 ? "destructive" : "default",
      });

      runningRef.current = false;
      setTimeout(() => setStatus(initialStatus), 600);
    })();
  }, [profiles, queryClient, toast, user]);

  const value = useMemo(() => ({ queueUploads, status }), [queueUploads, status]);

  return (
    <BackgroundUploadsContext.Provider value={value}>
      <BackgroundUploadProgress status={status} />
      {children}
    </BackgroundUploadsContext.Provider>
  );
}

export function useBackgroundUploads() {
  const ctx = useContext(BackgroundUploadsContext);
  if (!ctx) throw new Error("[useBackgroundUploads] must be used inside <BackgroundUploadsProvider>.");
  return ctx;
}
