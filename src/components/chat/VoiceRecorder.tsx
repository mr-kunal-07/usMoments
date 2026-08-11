import { useState, useRef, useEffect, useCallback, memo } from "react";
import { Send, Loader2, Mic, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";

const MAX_SECONDS = 120;
const WAVEFORM_BARS = 28;

function formatTime(s: number): string {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function detectMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
  return types.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

function getAudioFileMeta(mimeType: string): { extension: string; uploadType: string } {
  if (mimeType.includes("mp4")) return { extension: "m4a", uploadType: "audio/mp4" };
  if (mimeType.includes("ogg")) return { extension: "ogg", uploadType: "audio/ogg" };
  return { extension: "webm", uploadType: "audio/webm" };
}

const Waveform = memo(function Waveform({ isRecording }: { isRecording: boolean }) {
  return (
    <div className="flex items-center gap-[2px] h-8" aria-hidden>
      {Array.from({ length: WAVEFORM_BARS }).map((_, i) => (
        <span
          key={i}
          className="rounded-full w-[3px] shrink-0"
          style={{
            background: "hsl(var(--wa-online))",
            height: isRecording ? undefined : "4px",
            animation: isRecording
              ? `waveBar 0.9s ease-in-out ${(i * 60) % 700}ms infinite alternate`
              : "none",
            minHeight: 4,
          }}
        />
      ))}
    </div>
  );
});

interface Props {
  onSend: (audioUrl: string, duration: string) => void;
  onCancel: () => void;
  disabled?: boolean;
}

export const VoiceRecorder = memo(function VoiceRecorder({ onSend, onCancel, disabled }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [isRecording, setIsRecording] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [seconds, setSeconds] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopPromiseRef = useRef<Promise<void> | null>(null);
  const stopResolveRef = useRef<(() => void) | null>(null);
  const isStoppingRef = useRef(false);
  const secondsRef = useRef(0);

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    stopPromiseRef.current = null;
    stopResolveRef.current = null;
    isStoppingRef.current = false;
  }, []);

  useEffect(() => {
    secondsRef.current = seconds;
  }, [seconds]);

  const startRecording = useCallback(async () => {
    try {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        throw new Error("Voice recording is not supported on this device");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      const mimeType = detectMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      stopPromiseRef.current = new Promise<void>((resolve) => {
        stopResolveRef.current = resolve;
      });

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stopResolveRef.current?.();
        stopResolveRef.current = null;
      };
      recorder.start();

      setIsRecording(true);
      setSeconds(0);

      timerRef.current = setInterval(() => {
        setSeconds((value) => value + 1);
      }, 1000);
    } catch (error) {
      toast({
        title: "Microphone unavailable",
        description: error instanceof Error ? error.message : "Please allow microphone access and try again.",
        variant: "destructive",
      });
      onCancel();
    }
  }, [onCancel, toast]);

  const stopAndSend = useCallback(async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive" || isStoppingRef.current || !user) return;

    isStoppingRef.current = true;
    setIsRecording(false);
    setIsPending(true);

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;

    try {
      const duration = formatTime(secondsRef.current);
      recorder.requestData();
      recorder.stop();
      await stopPromiseRef.current;

      const recorderMimeType = recorder.mimeType || chunksRef.current[0]?.type || detectMimeType();
      const { extension, uploadType } = getAudioFileMeta(recorderMimeType);
      const blob = new Blob(chunksRef.current, { type: uploadType });

      if (!blob.size) {
        throw new Error("Recording was empty. Please try again.");
      }

      const filePath = `${user.id}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from("audio").upload(filePath, blob, {
        contentType: uploadType,
        upsert: false,
      });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("audio").getPublicUrl(filePath);
      onSend(data.publicUrl, duration);
    } catch (error) {
      toast({
        title: "Failed to send voice message",
        description: error instanceof Error ? error.message : "Upload failed",
        variant: "destructive",
      });
      onCancel();
    } finally {
      cleanup();
      setIsPending(false);
    }
  }, [cleanup, onCancel, onSend, toast, user]);

  const cancel = useCallback(() => {
    if (isStoppingRef.current) return;

    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      recorder.stop();
    }

    setIsRecording(false);
    cleanup();
    onCancel();
  }, [cleanup, onCancel]);

  useEffect(() => {
    if (seconds >= MAX_SECONDS && isRecording) {
      void stopAndSend();
    }
  }, [isRecording, seconds, stopAndSend]);

  useEffect(() => {
    void startRecording();
    return cleanup;
  }, [cleanup, startRecording]);

  const progress = Math.min(100, (seconds / MAX_SECONDS) * 100);
  const timeLeft = MAX_SECONDS - seconds;

  return (
    <div
      className="relative flex flex-1 items-center gap-3 overflow-hidden rounded-3xl px-4 py-2.5"
      style={{ background: "hsl(var(--wa-input-bg))" }}
      role="status"
      aria-label={`Recording: ${formatTime(seconds)}`}
    >
      <div
        className="absolute inset-0 rounded-3xl opacity-20"
        style={{
          background: `linear-gradient(90deg, hsl(var(--wa-online)) ${progress}%, transparent ${progress}%)`,
          transition: "background 1s linear",
        }}
        aria-hidden
      />

      <button
        type="button"
        onClick={cancel}
        disabled={isPending}
        className="z-10 shrink-0 text-white/40 transition-colors hover:text-red-400"
        aria-label="Cancel recording"
      >
        <Trash2 className="h-5 w-5" />
      </button>

      <div className="z-10 flex min-w-0 flex-1 items-center gap-3">
        {isPending ? (
          <div className="flex items-center gap-2 text-sm text-white/60">
            <Loader2 className="h-4 w-4 animate-spin" style={{ color: "hsl(var(--wa-online))" }} aria-hidden />
            <span>Sending...</span>
          </div>
        ) : (
          <>
            <span
              className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full"
              style={{ background: "hsl(var(--wa-online))" }}
              aria-hidden
            />
            <span
              className="shrink-0 text-sm font-mono font-semibold tabular-nums"
              style={{ color: "hsl(var(--wa-online))" }}
              aria-live="off"
            >
              {formatTime(seconds)}
            </span>
            {timeLeft <= 15 && (
              <span className="shrink-0 text-[10px] font-medium" style={{ color: "hsl(var(--destructive))" }}>
                {timeLeft}s left
              </span>
            )}
            <div className="flex-1 overflow-hidden">
              <Waveform isRecording={isRecording} />
            </div>
          </>
        )}
      </div>

      <button
        type="button"
        onClick={() => void stopAndSend()}
        disabled={isPending || seconds < 1 || disabled}
        className="z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all active:scale-95 disabled:opacity-30"
        style={{ background: "hsl(var(--wa-online))" }}
        aria-label="Send voice message"
      >
        <Send className="h-4 w-4 text-white" />
      </button>
    </div>
  );
});

export const MicButton = memo(function MicButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="mb-0.5 shrink-0 text-white/40 transition-colors hover:text-white/70"
      aria-label="Record voice message"
    >
      <Mic className="h-5 w-5" />
    </button>
  );
});

export default VoiceRecorder;
