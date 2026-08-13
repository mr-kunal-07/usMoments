import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  Maximize2,
  Mic,
  MicOff,
  Minimize2,
  Phone,
  PhoneOff,
  SwitchCamera,
  Video,
  Volume1,
  Volume2,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { type CallState, type CallType } from "@/hooks/useWebRTC";
import { playDialingTone, playRingtone, stopCallSound } from "@/lib/callSounds";

type HTMLMediaElementWithSinkId = HTMLAudioElement & {
  setSinkId?: (sinkId: string) => Promise<void>;
};

type NavigatorWithAudioSession = Navigator & {
  audioSession?: {
    type?: string;
  };
};

interface Props {
  callState: CallState;
  callType: CallType;
  incomingCallType: CallType;
  partnerName: string;
  partnerAvatarUrl?: string;
  partnerInitials: string;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  onAccept: () => void;
  onReject: () => void;
  onHangUp: () => void;
  isMuted: boolean;
  isSpeaker: boolean;
  onToggleMute: () => void;
  onToggleSpeaker: () => void;
  connectedAt: number | null;
  partnerOnline?: boolean;
  onBackCamera?: () => void;
  isFrontCamera?: boolean;
  minimized?: boolean;
  onMinimize?: () => void;
  onRestore?: () => void;
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

const CallButton = memo(function CallButton({
  onClick,
  label,
  bg,
  size = "lg",
  hideLabel = false,
  children,
}: {
  onClick: () => void;
  label: string;
  bg: string;
  size?: "sm" | "lg";
  hideLabel?: boolean;
  children: React.ReactNode;
}) {
  const dim = size === "lg"
    ? "h-14 w-14 sm:h-16 sm:w-16"
    : "h-11 w-11 sm:h-14 sm:w-14";
  const iconSize = size === "lg" ? "h-5 w-5 sm:h-7 sm:w-7" : "h-5 w-5 sm:h-6 sm:w-6";

  return (
    <div className="flex flex-col items-center gap-1 sm:gap-2">
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className={`${dim} flex touch-manipulation items-center justify-center rounded-full transition-transform duration-150 ease-out hover:scale-[1.03] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80`}
        style={{ background: bg }}
      >
        <span className={iconSize}>
          {children}
        </span>
      </button>
      {!hideLabel && <span className="hidden sm:inline text-xs text-white/70">{label}</span>}
    </div>
  );
});

export const CallModal = memo(function CallModal({
  callState,
  callType,
  incomingCallType,
  partnerName,
  partnerAvatarUrl,
  partnerInitials,
  localStream,
  remoteStream,
  onAccept,
  onReject,
  onHangUp,
  isMuted,
  isSpeaker,
  onToggleMute,
  onToggleSpeaker,
  connectedAt,
  partnerOnline,
  onBackCamera,
  isFrontCamera = true,
  minimized = false,
  onMinimize,
  onRestore,
}: Props) {
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const miniRemoteVideoRef = useRef<HTMLVideoElement>(null);
  const miniLocalVideoRef = useRef<HTMLVideoElement>(null);
  const miniLocalPiPRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const dragRef = useRef(false);
  const dragFrameRef = useRef<number | null>(null);
  const pendingDragPositionRef = useRef<{ x: number; y: number } | null>(null);
  const [displayDuration, setDisplayDuration] = useState(0);
  const [miniPosition, setMiniPosition] = useState<{ x: number; y: number }>(() => {
    if (typeof window === "undefined") return { x: 16, y: 100 };
    return {
      x: Math.max(16, window.innerWidth - 160),
      y: Math.max(80, window.innerHeight - 320),
    };
  });

  const isVideo = callState === "ringing" ? incomingCallType === "video" : callType === "video";
  const isConnected = callState === "connected";
  const isCalling = callState === "calling";
  const isRinging = callState === "ringing";
  const canMinimize = !!onMinimize && isVideo && !isRinging;
  const hasRemoteVideo = !!remoteStream?.getVideoTracks().some((track) => track.readyState === "live");
  const hasLocalVideo = !!localStream?.getVideoTracks().some((track) => track.readyState === "live");

  useEffect(() => {
    if (!isConnected || !connectedAt) {
      setDisplayDuration(0);
      return;
    }

    const update = () => {
      setDisplayDuration(Math.max(0, Math.floor((Date.now() - connectedAt) / 1000)));
    };

    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, [connectedAt, isConnected]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 768px)");
    const handleChange = () => setIsMobileViewport(mediaQuery.matches);
    handleChange();
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const attachStream = useCallback(async (
    element: HTMLVideoElement | null,
    stream: MediaStream | null,
    muted = false,
  ) => {
    if (!element) return;
    element.muted = muted;
    if (element.srcObject !== stream) {
      element.srcObject = stream;
    }
    if (!stream) return;
    try {
      await element.play();
    } catch {
      // autoplay can be blocked briefly until the browser is ready
    }
  }, []);

  const clampMiniPosition = useCallback((x: number, y: number) => {
    if (typeof window === "undefined") return { x, y };

    const width = 144;
    const height = 208;
    const maxX = Math.max(16, window.innerWidth - width - 16);
    const maxY = Math.max(80, window.innerHeight - height - 16);

    return {
      x: Math.min(Math.max(16, x), maxX),
      y: Math.min(Math.max(16, y), maxY),
    };
  }, []);

  useEffect(() => {
    // Audio is routed through the dedicated audio element to avoid double playback.
    void attachStream(remoteVideoRef.current, remoteStream, true);
    void attachStream(miniRemoteVideoRef.current, remoteStream, true);
  }, [attachStream, hasRemoteVideo, minimized, remoteStream]);

  useEffect(() => {
    void attachStream(localVideoRef.current, localStream, true);
    void attachStream(miniLocalVideoRef.current, localStream, true);
    void attachStream(miniLocalPiPRef.current, localStream, true);
  }, [attachStream, hasLocalVideo, hasRemoteVideo, localStream, minimized]);

  useEffect(() => {
    if (!minimized) return;

    const handleResize = () => {
      setMiniPosition((previous) => clampMiniPosition(previous.x, previous.y));
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [clampMiniPosition, minimized]);

  useEffect(() => {
    const navigatorWithAudioSession = navigator as NavigatorWithAudioSession;
    const audioSession = navigatorWithAudioSession.audioSession;
    if (!audioSession || callState === "idle") return;

    const previousType = audioSession.type;

    try {
      audioSession.type = isSpeaker ? "playback" : "default";
    } catch {
      // browser does not allow changing audio session mode here
    }

    return () => {
      try {
        audioSession.type = previousType ?? "auto";
      } catch {
        // ignore unsupported cleanup
      }
    };
  }, [callState, isSpeaker]);

  useEffect(() => {
    const audioEl = remoteAudioRef.current;
    if (!audioEl || !remoteStream) return;

    const sinkAudioEl = audioEl as HTMLMediaElementWithSinkId;

    const applyRouting = async () => {
      sourceNodeRef.current?.disconnect();
      sourceNodeRef.current = null;
      if (audioCtxRef.current) {
        await audioCtxRef.current.close().catch(() => { });
        audioCtxRef.current = null;
      }

      if (isSpeaker) {
        if ("setSinkId" in sinkAudioEl && sinkAudioEl.setSinkId) {
          try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const speakerDevice = devices.find(
              (device) => device.kind === "audiooutput" && /speaker|loud/i.test(device.label),
            );
            await sinkAudioEl.setSinkId(speakerDevice?.deviceId ?? "");
            audioEl.srcObject = remoteStream;
            audioEl.muted = false;
            return;
          } catch {
            // fall through to AudioContext fallback
          }
        }

        try {
          audioEl.muted = true;
          audioEl.srcObject = remoteStream;

          const ctx = new AudioContext();
          audioCtxRef.current = ctx;
          if (ctx.state === "suspended") await ctx.resume();

          const source = ctx.createMediaStreamSource(remoteStream);
          sourceNodeRef.current = source;
          source.connect(ctx.destination);
        } catch (error) {
          console.warn("Speaker routing via AudioContext failed:", error);
          audioEl.muted = false;
          audioEl.srcObject = remoteStream;
        }

        return;
      }

      // Default to earphone (receiver/default audio output)
      if ("setSinkId" in sinkAudioEl && sinkAudioEl.setSinkId) {
        try {
          // Try to set to default/earphone device
          await sinkAudioEl.setSinkId("");
          audioEl.srcObject = remoteStream;
          audioEl.muted = false;
          return;
        } catch {
          // Fall back to communications if no specific output
          try {
            await sinkAudioEl.setSinkId("communications");
            audioEl.srcObject = remoteStream;
            audioEl.muted = false;
            return;
          } catch {
            // fall through to default element routing
          }
        }
      }

      // Ensure earphone is used by default (not speaker)
      audioEl.muted = false;
      audioEl.srcObject = remoteStream;
      await audioEl.play().catch(() => { });
    };

    void applyRouting();

    return () => {
      sourceNodeRef.current?.disconnect();
      sourceNodeRef.current = null;
      audioCtxRef.current?.close().catch(() => { });
      audioCtxRef.current = null;
    };
  }, [isSpeaker, remoteStream]);

  useEffect(() => {
    if (callState === "ringing") playRingtone();
    else if (callState === "calling") playDialingTone();
    else stopCallSound();

    return () => stopCallSound();
  }, [callState]);

  const statusText = (() => {
    if (isCalling) {
      return partnerOnline === false
        ? (isVideo ? "Partner is offline. Trying video call..." : "Partner is offline. Trying voice call...")
        : (isVideo ? "Ringing video call..." : "Ringing voice call...");
    }
    if (isRinging) return incomingCallType === "video" ? "Incoming video call" : "Incoming voice call";
    if (isConnected) return formatDuration(displayDuration);
    return "";
  })();

  const updateMiniPosition = useCallback((clientX: number, clientY: number) => {
    pendingDragPositionRef.current = clampMiniPosition(
      clientX - dragOffsetRef.current.x,
      clientY - dragOffsetRef.current.y,
    );
    if (dragFrameRef.current !== null) return;

    dragFrameRef.current = window.requestAnimationFrame(() => {
      if (pendingDragPositionRef.current) setMiniPosition(pendingDragPositionRef.current);
      dragFrameRef.current = null;
    });
  }, [clampMiniPosition]);

  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!dragRef.current) return;
    updateMiniPosition(event.clientX, event.clientY);
  }, [updateMiniPosition]);

  const handleTouchMove = useCallback((event: TouchEvent) => {
    if (!dragRef.current) return;
    const touch = event.touches[0];
    if (!touch) return;
    updateMiniPosition(touch.clientX, touch.clientY);
  }, [updateMiniPosition]);

  const stopDragging = useCallback(() => {
    dragRef.current = false;
    pendingDragPositionRef.current = null;
    if (dragFrameRef.current !== null) {
      window.cancelAnimationFrame(dragFrameRef.current);
      dragFrameRef.current = null;
    }
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("mouseup", stopDragging);
    window.removeEventListener("touchmove", handleTouchMove);
    window.removeEventListener("touchend", stopDragging);
  }, [handleMouseMove, handleTouchMove]);

  const startDragging = useCallback((clientX: number, clientY: number) => {
    dragRef.current = true;
    dragOffsetRef.current = {
      x: clientX - miniPosition.x,
      y: clientY - miniPosition.y,
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", stopDragging);
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", stopDragging);
  }, [handleMouseMove, handleTouchMove, miniPosition.x, miniPosition.y, stopDragging]);

  useEffect(() => stopDragging, [stopDragging]);

  if (callState === "idle") return null;

  if (minimized && isVideo) {
    return (
      <div
        className="fixed z-[110] cursor-move overflow-hidden rounded-md border border-white/10 bg-black/95"
        style={{
          left: 0,
          top: 0,
          transform: `translate3d(${miniPosition.x}px, ${miniPosition.y}px, 0)`,
          willChange: "transform",
        }}
        onMouseDown={(event) => startDragging(event.clientX, event.clientY)}
        onTouchStart={(event) => {
          const touch = event.touches[0];
          if (!touch) return;
          startDragging(touch.clientX, touch.clientY);
        }}
      >
        <audio ref={remoteAudioRef} autoPlay playsInline aria-hidden />

        <div className="relative h-[14rem] w-[9.5rem] bg-black sm:h-52 sm:w-36">
          {hasRemoteVideo ? (
            <video
              ref={miniRemoteVideoRef}
              autoPlay
              playsInline
              muted
              className="h-full w-full object-cover"
              aria-hidden
            />
          ) : hasLocalVideo ? (
            <video
              ref={miniLocalVideoRef}
              autoPlay
              playsInline
              muted
              aria-hidden
              className="h-full w-full object-cover"
              style={{ transform: isFrontCamera ? "scaleX(-1)" : "none" }}
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-3 text-center">
              <Avatar className="h-14 w-14 ring-2 ring-white/20">
                <AvatarImage src={partnerAvatarUrl} />
                <AvatarFallback className="text-lg font-bold">{partnerInitials}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-semibold text-white">{partnerName}</p>
                <p className="text-xs text-white/70">{statusText}</p>
              </div>
            </div>
          )}

          <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 px-2 py-2">
            <div className="min-w-0 flex-1 pr-1">
              <p className="truncate text-[11px] text-white/70">{statusText}</p>
            </div>
            {hasLocalVideo && (
              <div className="relative shrink-0 overflow-hidden rounded-md border border-white/15 bg-black">
                <video
                  ref={miniLocalPiPRef}
                  autoPlay
                  playsInline
                  muted
                  aria-hidden
                  className="h-20 w-14 object-cover"
                  style={{ transform: isFrontCamera ? "scaleX(-1)" : "none" }}
                />
                <div className="absolute inset-x-0 bottom-0 bg-black/10 px-1 py-0.5 text-center text-[10px] text-white">
                  You
                </div>
              </div>
            )}
          </div>

          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/60 px-2 py-2">
            <button
              type="button"
              onClick={onRestore}
              onMouseDown={(event) => event.stopPropagation()}
              onTouchStart={(event) => event.stopPropagation()}
              aria-label="Restore call"
              className="rounded-md bg-black/55 p-2 text-white"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onHangUp}
              onMouseDown={(event) => event.stopPropagation()}
              onTouchStart={(event) => event.stopPropagation()}
              aria-label="End call"
              className="rounded-md bg-red-600 p-2 text-white"
            >
              <PhoneOff className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col"
      style={{ background: "hsl(var(--background))" }}
      role="dialog"
      aria-modal="true"
      aria-label={`${isVideo ? "Video" : "Voice"} call with ${partnerName}`}
    >
      <audio ref={remoteAudioRef} autoPlay playsInline aria-hidden />

      {isVideo && hasRemoteVideo && (
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 h-full w-full object-cover"
          aria-hidden
        />
      )}

      {(!isVideo || (!hasRemoteVideo && !hasLocalVideo)) && (
        <div className="absolute inset-0 bg-black" aria-hidden />
      )}

      {isVideo && !hasRemoteVideo && hasLocalVideo && (
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover"
          style={{ transform: isFrontCamera ? "scaleX(-1)" : "none" }}
        />
      )}

      <div
        className="relative z-10 flex h-full flex-col items-center justify-between px-4 animate-in fade-in-0 duration-200 sm:px-6 sm:py-12"
        style={{
          paddingTop: "max(2rem, env(safe-area-inset-top, 0px))",
          paddingBottom: "max(2rem, env(safe-area-inset-bottom, 0px))",
        }}
      >
        <div className="absolute left-4 right-4 top-4 flex items-start justify-between gap-3">
          {isVideo ? (
            <div className="min-w-0 rounded-md bg-black/45 px-4 py-3 backdrop-blur-sm">
              <p className="max-w-[65vw] truncate font-heading text-xl font-bold text-white sm:text-2xl">{partnerName}</p>
              <p className="mt-1 text-sm text-white/70" aria-live="polite">
                {statusText}
              </p>
            </div>
          ) : (
            <div />
          )}
          {canMinimize && (
            <button
              type="button"
              onClick={onMinimize}
              className="rounded-md bg-black/45 p-2 text-white"
              aria-label="Minimize call"
            >
              <Minimize2 className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex flex-col items-center gap-4 text-center">
          {!isVideo && (
            <>
              <div className={`relative ${isRinging ? "animate-pulse" : ""}`}>
                <Avatar className="h-24 w-24 ring-4 ring-border">
                  <AvatarImage src={partnerAvatarUrl} />
                  <AvatarFallback className="text-2xl font-bold">{partnerInitials}</AvatarFallback>
                </Avatar>

                {partnerOnline !== undefined && (
                  <span
                    className="absolute bottom-1 right-1 h-4 w-4 rounded-full border-2"
                    style={{
                      borderColor: "hsl(0 0% 7%)",
                      background: partnerOnline ? "hsl(142 71% 45%)" : "hsl(0 0% 50%)",
                    }}
                    aria-label={partnerOnline ? "Online" : "Offline"}
                  />
                )}
              </div>

              <div className="rounded-md bg-black/45 px-4 py-3 backdrop-blur-sm">
                <p className="max-w-[80vw] truncate font-heading text-2xl font-bold text-white">{partnerName}</p>
                <p className="mt-1 text-sm text-white/70" aria-live="polite">
                  {statusText}
                </p>
                {isConnected && (
                  <div className="mt-2 flex items-center justify-center gap-1.5">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-green-400" aria-hidden />
                    <span className="text-xs font-medium text-green-400">Connected</span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {isVideo && hasLocalVideo && hasRemoteVideo && (
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            aria-hidden
            className="absolute right-4 top-14 h-32 w-24 rounded-md border border-white/20 object-cover sm:top-16 sm:h-40 sm:w-28"
            style={{ transform: isFrontCamera ? "scaleX(-1)" : "none" }}
          />
        )}

        <div className="rounded-md bg-black/45 px-3 py-3 backdrop-blur-sm sm:px-4">
          <div className="flex items-center justify-center gap-2 sm:gap-4 lg:gap-6 flex-nowrap">
            {isRinging ? (
              <>
                <CallButton onClick={onReject} label="Decline" bg="hsl(var(--destructive))" size="lg" hideLabel={isMobileViewport}>
                  <PhoneOff className="text-white" />
                </CallButton>
                <CallButton onClick={onAccept} label="Accept" bg="hsl(var(--wa-online))" size="lg" hideLabel={isMobileViewport}>
                  {incomingCallType === "video" ? (
                    <Video className="text-white" />
                  ) : (
                    <Phone className="text-white" />
                  )}
                </CallButton>
              </>
            ) : (
              <>
                <CallButton
                  onClick={onToggleMute}
                  label={isMuted ? "Unmute" : "Mute"}
                  bg={isMuted ? "hsl(0 0% 95%)" : "hsl(0 0% 20%)"}
                  size="sm"
                  hideLabel={isMobileViewport}
                >
                  {isMuted ? (
                    <MicOff style={{ color: "hsl(0 0% 10%)" }} />
                  ) : (
                    <Mic className="text-white" />
                  )}
                </CallButton>

                <CallButton
                  onClick={onToggleSpeaker}
                  label={isSpeaker ? "Speaker" : "Phone"}
                  bg={isSpeaker ? "hsl(0 0% 95%)" : "hsl(0 0% 20%)"}
                  size="sm"
                  hideLabel={isMobileViewport}
                >
                  {isSpeaker ? (
                    <Volume2 style={{ color: "hsl(0 0% 10%)" }} />
                  ) : (
                    <Volume1 className="text-white" />
                  )}
                </CallButton>

                <CallButton onClick={onHangUp} label="End" bg="hsl(var(--destructive))" size="lg" hideLabel={isMobileViewport}>
                  <PhoneOff className="text-white" />
                </CallButton>

                {isVideo && onBackCamera && (
                  <CallButton onClick={onBackCamera} label="Back camera" bg="hsl(0 0% 20%)" size="sm" hideLabel={isMobileViewport}>
                    <SwitchCamera className="text-white" />
                  </CallButton>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

export default CallModal;
