import { useState, useRef, useEffect, useCallback, memo } from "react";
import {
  Send, Trash2, Lock, Reply, X, Check, CheckCheck, Smile,
  Mic, Play, Pause, ArrowLeft, Pencil, CheckSquare, Phone, Video,
  Palette,
} from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useMessages, Message } from "@/hooks/useMessages";
import { useAuth } from "@/hooks/useAuth";
import { useMyCouple } from "@/hooks/useCouple";
import { useAllProfiles, useProfile } from "@/hooks/useProfile";
import { useTyping } from "@/hooks/useTyping";
import { usePresence } from "@/hooks/usePresence";
import { VoiceRecorder } from "@/components/chat/VoiceRecorder";
import { useWebRTC, type WebRTCSession } from "@/hooks/useWebRTC";
import { cn } from "@/lib/utils";
import { usePlan, canUseVoiceMessages } from "@/hooks/useSubscription";
import { UpgradeGateModal } from "@/components/billing/UpgradeGateModal";
import { EmojiPicker, preloadEmojiPicker } from "@/components/chat/EmojiPicker";
import { DrawingCanvas } from "@/components/chat/DrawingCanvas";
import { ChatThemePicker } from "@/components/chat/ChatThemePicker";
import { useChatTheme } from "@/hooks/useChatTheme";
import { getTheme, buildThemeStyle } from "@/components/chat/chatThemes";
import { useTheme } from "@/hooks/useTheme";
import { useToast } from "@/hooks/useToast";
import { supabase } from "@/integrations/supabase/client";
import { invalidateMedia } from "@/lib/queryKeys";
import { preloadAllAudioMessages, useInfiniteScrollTrigger } from "@/hooks/useMessagesInfinite";

// ─── Constants ────────────────────────────────────────────────────────────────

const EMOJI_REACTIONS = ["❤️", "😂", "😮", "😢", "👍", "🔥"] as const;
const WAVEFORM_HEIGHTS = [6, 9, 14, 10, 7, 12, 16, 8, 11, 6, 13, 18, 10, 7, 15, 9, 12, 6, 10, 14, 8, 16, 11, 7, 13, 9, 6, 12, 10, 8];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDay(dateStr: string): string {
  const d = new Date(dateStr);
  if (isToday(d)) return "TODAY";
  if (isYesterday(d)) return "YESTERDAY";
  return format(d, "MMMM d, yyyy").toUpperCase();
}

function groupByDay(messages: Message[]): { day: string; messages: Message[] }[] {
  return messages.reduce<{ day: string; messages: Message[] }[]>((acc, msg) => {
    const day = format(new Date(msg.created_at), "yyyy-MM-dd");
    const last = acc[acc.length - 1];
    if (last?.day === day) last.messages.push(msg);
    else acc.push({ day, messages: [msg] });
    return acc;
  }, []);
}

function groupReactions(reactions: Message["reactions"]): [string, number][] {
  const map: Record<string, number> = {};
  (reactions ?? []).forEach(r => { map[r.emoji] = (map[r.emoji] ?? 0) + 1; });
  return Object.entries(map);
}

function formatAudioTime(s: number): string {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  return `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl);
  if (!response.ok) throw new Error("Failed to prepare drawing image");
  return response.blob();
}

function getMediaPathFromPublicUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const marker = "/storage/v1/object/public/media/";
    const markerIndex = parsed.pathname.indexOf(marker);
    if (markerIndex === -1) return null;
    return decodeURIComponent(parsed.pathname.slice(markerIndex + marker.length));
  } catch {
    return null;
  }
}

// ─── ReadReceipt ──────────────────────────────────────────────────────────────

const ReadReceipt = memo(function ReadReceipt({ msg, isMe }: { msg: Message; isMe: boolean }) {
  if (!isMe) return null;
  return msg.read_at
    ? <CheckCheck className="h-3.5 w-3.5 text-[hsl(var(--wa-tick-blue))] inline-block ml-0.5" />
    : <Check className="h-3.5 w-3.5 text-[hsl(var(--wa-meta))] inline-block ml-0.5" />;
});

// ─── AudioBubble ──────────────────────────────────────────────────────────────

const AudioBubble = memo(function AudioBubble({
  url, duration, avatarUrl, avatarFallback, isMe, time, msg,
}: {
  url: string; duration?: string; avatarUrl?: string;
  avatarFallback: string; isMe: boolean; time: string; msg: Message;
}) {
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const lastTimeRef = useRef(0);

  useEffect(() => {
    lastTimeRef.current = currentTime;
  }, [currentTime]);

  useEffect(() => {
    setPlaying(false);
    setCurrentTime(0);
    setAudioDuration(null);
    lastTimeRef.current = 0;
  }, [url]);

  const togglePlay = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
      return;
    }

    void a.play().catch(() => {
      setPlaying(false);
    });
  }, [playing]);

  const safeDuration = audioDuration && Number.isFinite(audioDuration) && audioDuration > 0
    ? audioDuration
    : null;
  const progress = safeDuration ? Math.min(1, currentTime / safeDuration) : 0;

  return (
    <div className="flex items-center gap-3 min-w-[220px] max-w-[280px] py-1">
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime ?? 0)}
        onLoadedMetadata={() => {
          const audio = audioRef.current;
          if (!audio) return;
          const nextDuration = Number.isFinite(audio.duration) && audio.duration > 0
            ? audio.duration
            : null;
          setAudioDuration(nextDuration);
          if (lastTimeRef.current > 0 && Math.abs(audio.currentTime - lastTimeRef.current) > 0.25) {
            audio.currentTime = Math.min(lastTimeRef.current, audio.duration || lastTimeRef.current);
          }
        }}
        onEnded={() => { setPlaying(false); setCurrentTime(0); }}
      />

      <Avatar className="h-10 w-10 shrink-0 ring-2 ring-border">
        <AvatarImage src={avatarUrl} />
        <AvatarFallback className="text-xs font-semibold" style={{ background: "hsl(var(--wa-avatar))", color: "hsl(var(--wa-text))" }}>
          {avatarFallback}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <button
            onClick={togglePlay}
            aria-label={playing ? "Pause" : "Play"}
            className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 transition-all active:scale-95"
            style={{ background: "hsl(var(--wa-voice-thumb))" }}
          >
            {playing
              ? <Pause className="h-3.5 w-3.5 text-white" />
              : <Play className="h-3.5 w-3.5 text-white ml-0.5" />}
          </button>

          <div className="flex items-center gap-[2px] flex-1 h-8" aria-hidden>
            {WAVEFORM_HEIGHTS.map((h, i) => (
              <span
                key={i}
                className="rounded-full w-[2.5px] shrink-0 transition-colors"
                style={{
                  height: h + "px",
                  background: i / WAVEFORM_HEIGHTS.length < progress
                    ? "hsl(var(--wa-voice-thumb))"
                    : "hsl(var(--wa-text) / 0.2)",
                }}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between mt-1">
          <span className="text-[10px]" style={{ color: "hsl(var(--wa-meta))" }}>
            {playing && safeDuration
              ? formatAudioTime(currentTime)
              : safeDuration ? formatAudioTime(safeDuration) : (duration ?? "0:00")}
          </span>
          <span className="flex items-center gap-0.5 text-[10px]" style={{ color: "hsl(var(--wa-meta))" }}>
            {time}
            <ReadReceipt msg={msg} isMe={isMe} />
          </span>
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => (
  prevProps.url === nextProps.url &&
  prevProps.duration === nextProps.duration &&
  prevProps.avatarUrl === nextProps.avatarUrl &&
  prevProps.avatarFallback === nextProps.avatarFallback &&
  prevProps.isMe === nextProps.isMe &&
  prevProps.time === nextProps.time &&
  prevProps.msg.id === nextProps.msg.id &&
  prevProps.msg.read_at === nextProps.msg.read_at
));

// ─── SwipeableMessage ─────────────────────────────────────────────────────────

interface SwipeableMessageProps {
  children: React.ReactNode;
  onSwipeReply: () => void;
  isMe: boolean;
}

const SwipeableMessage = memo(function SwipeableMessage({ children, onSwipeReply }: SwipeableMessageProps) {
  const startXRef = useRef<number | null>(null);
  const triggered = useRef(false);
  const [offset, setOffset] = useState(0);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
    triggered.current = false;
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (startXRef.current === null) return;
    const dx = e.touches[0].clientX - startXRef.current;
    if (dx > 0) {
      setOffset(Math.min(dx, 60));
      if (dx > 50 && !triggered.current) {
        triggered.current = true;
        onSwipeReply();
        navigator.vibrate?.(20);
      }
    }
  }, [onSwipeReply]);

  const onTouchEnd = useCallback(() => {
    startXRef.current = null;
    setOffset(0);
  }, []);

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={{ transform: `translateX(${offset}px)`, transition: offset === 0 ? "transform 0.2s ease" : "none" }}
    >
      {children}
    </div>
  );
});

// ─── SwipeBackWrapper ─────────────────────────────────────────────────────────

const SwipeBackWrapper = memo(function SwipeBackWrapper({
  children, onBack,
}: {
  children: React.ReactNode;
  onBack?: () => void;
}) {
  const startXRef = useRef<number | null>(null);
  const startYRef = useRef<number | null>(null);
  const [dragX, setDragX] = useState(0);
  const committed = useRef(false);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const x = e.touches[0].clientX;
    if (x > 30) return;
    startXRef.current = x;
    startYRef.current = e.touches[0].clientY;
    committed.current = false;
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (startXRef.current === null) return;
    const dx = e.touches[0].clientX - startXRef.current;
    const dy = Math.abs(e.touches[0].clientY - (startYRef.current ?? 0));
    if (dy > dx * 1.5) { startXRef.current = null; return; }
    if (dx > 0) { e.stopPropagation(); setDragX(Math.min(dx, 120)); }
  }, []);

  const onTouchEnd = useCallback(() => {
    if (dragX > 80 && !committed.current) {
      committed.current = true;
      navigator.vibrate?.(15);
      onBack?.();
    }
    startXRef.current = null;
    startYRef.current = null;
    setDragX(0);
  }, [dragX, onBack]);

  if (!onBack) return <>{children}</>;

  return (
    <div
      className="flex flex-col h-full"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={{
        transform: dragX > 0 ? `translateX(${dragX * 0.4}px)` : undefined,
        transition: dragX === 0 ? "transform 0.2s ease" : "none",
      }}
    >
      {children}
    </div>
  );
});

// ─── TypingBubble ─────────────────────────────────────────────────────────────

const TypingBubble = memo(function TypingBubble({ avatarUrl, initials }: { avatarUrl?: string; initials: string }) {
  return (
    <div className="flex items-end gap-1.5 pr-12 sm:pr-20">
      <Avatar className="h-7 w-7 self-end mb-0.5">
        <AvatarImage src={avatarUrl} />
        <AvatarFallback className="text-[10px]" style={{ background: "hsl(var(--wa-avatar))", color: "hsl(var(--wa-bg))" }}>
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="px-4 py-3 rounded-2xl rounded-tl-sm shadow-sm" style={{ background: "hsl(var(--wa-bubble-in))" }}>
        <div className="flex items-center gap-1" aria-label="Partner is typing">
          {[0, 150, 300].map(delay => (
            <span
              key={delay}
              className="h-2 w-2 rounded-full animate-bounce"
              style={{ background: "hsl(var(--wa-meta))", animationDelay: `${delay}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
});

// ─── ChatView ─────────────────────────────────────────────────────────────────

export function ChatView({
  onBack,
  onUpgrade,
  callSession,
}: {
  onBack?: () => void;
  onUpgrade?: () => void;
  callSession?: WebRTCSession;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: couple } = useMyCouple();
  const { data: profiles = [] } = useAllProfiles();
  const { data: myProfile } = useProfile();
  const {
    data: messages = [],
    sendMessage, deleteMessage, addReaction, removeReaction, isLoading,
  } = useMessages({ markAsRead: true });
  const plan = usePlan();
  const canVoice = canUseVoiceMessages(plan);
  const canReact = plan !== "single";
  const { isDarkTheme } = useTheme();
  const { themeId } = useChatTheme();
  const chatTheme = getTheme(themeId);
  const themeStyle = buildThemeStyle(chatTheme, isDarkTheme);

  // ── State ──────────────────────────────────────────────────────────────────
  const [text, setText] = useState("");
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [emojiPickerId, setEmojiPickerId] = useState<string | null>(null);
  const [voiceMode, setVoiceMode] = useState(false);
  const [kbOffset, setKbOffset] = useState(0);
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);
  const [gateModal, setGateModal] = useState<{ feature: string } | null>(null);
  const [longPressId, setLongPressId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showDrawing, setShowDrawing] = useState(false);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [previewDrawingUrl, setPreviewDrawingUrl] = useState<string | null>(null);
  const [savingDrawingIds, setSavingDrawingIds] = useState<Set<string>>(new Set());

  const selectMode = selectedIds.size > 0;
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isInitialScroll = useRef(true);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const { isNearTop } = useInfiniteScrollTrigger(messagesContainerRef);

  // ── Derived ────────────────────────────────────────────────────────────────
  const coupleId = couple?.status === "active" ? couple.id : null;
  const partnerId = couple?.status === "active"
    ? (couple.user1_id === user?.id ? couple.user2_id : couple.user1_id)
    : null;
  const partnerProfile = partnerId ? profiles.find(p => p.user_id === partnerId) : null;
  const partnerName = partnerProfile?.display_name ?? "Partner";
  const myInitials = (myProfile?.display_name ?? user?.email ?? "Me").slice(0, 2).toUpperCase();
  const partnerInitials = (partnerProfile?.display_name ?? "?").slice(0, 2).toUpperCase();

  const { partnerTyping, sendTyping, stopTyping } = useTyping(coupleId, user?.id);
  const { partnerOnline } = usePresence(coupleId, user?.id, partnerId);

  // ── WebRTC ─────────────────────────────────────────────────────────────────
  const localCallSession = useWebRTC({
    coupleId,
    myUserId: user?.id ?? null,
    partnerUserId: partnerId ?? null,
    partnerOnline,
    enabled: !callSession,
  });
  const activeCallSession = callSession ?? localCallSession;
  const {
    callState, callType, incomingCallType,
    localStream, remoteStream,
    startCall, acceptCall, rejectCall, hangUp,
    isMuted, isSpeaker, toggleMute, toggleSpeaker, flipCamera, isFrontCamera,
    callError, clearCallError,
  } = activeCallSession;

  useEffect(() => {
    if (callSession) return;
    if (!callError) return;
    toast({
      title: "Call error",
      description: callError,
      variant: "destructive",
    });
    clearCallError();
  }, [callError, callSession, clearCallError, toast]);

  useEffect(() => {
    const callAction = searchParams.get("callAction");
    if (!callAction) return;
    if (callState !== "ringing") return;

    const clearCallAction = () => {
      const next = new URLSearchParams(searchParams);
      next.delete("callAction");
      next.delete("callType");
      const query = next.toString();
      navigate(query ? `?${query}` : ".", { replace: true, relative: "path" });
    };

    if (callAction === "accept") {
      void acceptCall().finally(clearCallAction);
      return;
    }

    if (callAction === "decline") {
      rejectCall("declined");
      clearCallAction();
    }
  }, [acceptCall, callState, navigate, rejectCall, searchParams]);

  // ── VisualViewport keyboard offset ─────────────────────────────────────────
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) {
      setViewportHeight(window.innerHeight);
      return;
    }

    const update = () => {
      setViewportHeight(vv.height);
      setKbOffset(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
    };

    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  // ── Scroll: instant on initial load, smooth on new messages ───────────────
  useEffect(() => {
    if (!bottomRef.current) return;
    bottomRef.current.scrollIntoView({ behavior: isInitialScroll.current ? "auto" : "smooth" });
    isInitialScroll.current = false;
  }, [messages.length]);

  useEffect(() => {
    if (kbOffset <= 0) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [kbOffset]);

  // Preload audio messages for instant playback
  useEffect(() => {
    if (messages && messages.length > 0) {
      void preloadAllAudioMessages(messages);
    }
  }, [messages]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const preload = () => preloadEmojiPicker();
    const browserWindow = window as Window &
      typeof globalThis & {
        requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
        cancelIdleCallback?: (handle: number) => void;
      };

    if (browserWindow.requestIdleCallback && browserWindow.cancelIdleCallback) {
      const idleId = browserWindow.requestIdleCallback(preload, { timeout: 1200 });
      return () => browserWindow.cancelIdleCallback?.(idleId);
    }

    const timeoutId = globalThis.setTimeout(preload, 500);
    return () => globalThis.clearTimeout(timeoutId);
  }, []);

  // Mark-as-read is handled inside useMessages with a 1s debounce.
  // No duplicate effect needed here.

  // ── Close popups on outside click ──────────────────────────────────────────
  useEffect(() => {
    const handler = () => { setEmojiPickerId(null); setLongPressId(null); };
    if (emojiPickerId || longPressId) document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [emojiPickerId, longPressId]);

  // ── Long-press select ──────────────────────────────────────────────────────
  const startLongPress = useCallback((e: React.TouchEvent, id: string) => {
    // Clear any existing selection immediately so stale highlights don't appear
    window.getSelection()?.removeAllRanges();
    longPressTimer.current = setTimeout(() => {
      // Dismiss any native selection that snuck in during the 450 ms hold
      window.getSelection()?.removeAllRanges();
      navigator.vibrate?.(30);
      setLongPressId(id);
    }, 450);
  }, []);

  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearSelect = useCallback(() => setSelectedIds(new Set()), []);

  const selectAllMessages = useCallback(() => {
    setSelectedIds(new Set(messages.map(message => message.id)));
  }, [messages]);

  const allMessagesSelected = messages.length > 0 && selectedIds.size === messages.length;

  const toggleSelectAll = useCallback(() => {
    if (allMessagesSelected) {
      clearSelect();
      return;
    }
    selectAllMessages();
  }, [allMessagesSelected, clearSelect, selectAllMessages]);

  // FIX: parallel deletes instead of sequential await loop
  const handleDeleteSelected = useCallback(async () => {
    await Promise.all([...selectedIds].map(id => deleteMessage.mutateAsync(id)));
    clearSelect();
  }, [selectedIds, deleteMessage, clearSelect]);

  // ── Send handlers ──────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || sendMessage.isPending) return;
    stopTyping();
    setText("");
    const replyId = replyTo?.id ?? null;
    setReplyTo(null);
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.focus();
    }
    // BUG FIX: wrap in try/catch so an encryption or network error doesn't
    // crash the component — the optimistic rollback in useMessages handles
    // removing the stuck message from the list automatically on error.
    try {
      await sendMessage.mutateAsync({ content: trimmed, replyToId: replyId, messageType: "text" });
    } catch (err) {
      console.error("[handleSend] failed:", err);
      // Re-focus input so user can retry immediately
    }
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [text, replyTo, sendMessage, stopTyping]);

  const handleVoiceSend = useCallback(async (audioUrl: string, duration: string) => {
    setVoiceMode(false);
    stopTyping();
    const replyId = replyTo?.id ?? null;
    setReplyTo(null);
    try {
      await sendMessage.mutateAsync({ content: duration, replyToId: replyId, messageType: "voice", audioUrl });
    } catch (err) {
      console.error("[handleVoiceSend] failed:", err);
    }
  }, [replyTo, sendMessage, stopTyping]);

  const handleDrawingUploadSend = useCallback(async (dataUrl: string) => {
    setShowDrawing(false);
    const replyId = replyTo?.id ?? null;
    try {
      if (!user) throw new Error("Not authenticated");

      const drawingBlob = await dataUrlToBlob(dataUrl);
      const filePath = `${user.id}/drawings/${crypto.randomUUID()}.png`;
      const { error: uploadError } = await supabase.storage
        .from("media")
        .upload(filePath, drawingBlob, {
          contentType: "image/png",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("media").getPublicUrl(filePath);
      await sendMessage.mutateAsync({
        content: "Drawing",
        replyToId: replyId,
        messageType: "drawing",
        audioUrl: data.publicUrl,
      });
    } catch (err) {
      console.error("[handleDrawingUploadSend] failed:", err);
      toast({
        title: "Failed to send drawing",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    }
    setReplyTo(null);
  }, [replyTo, sendMessage, toast, user]);

  const handleSaveDrawingToMemories = useCallback(async (msg: Message, drawingUrl: string) => {
    if (!user) {
      toast({ title: "Sign in required", description: "Please sign in again and try saving the drawing.", variant: "destructive" });
      return;
    }

    setSavingDrawingIds((previous) => new Set(previous).add(msg.id));

    try {
      const drawingResponse = await fetch(drawingUrl);
      if (!drawingResponse.ok) throw new Error("Could not load the drawing image.");
      const drawingBlob = await drawingResponse.blob();

      let filePath = getMediaPathFromPublicUrl(drawingUrl);
      if (!filePath) {
        filePath = `${user.id}/drawings/${crypto.randomUUID()}.png`;
        const { error: uploadError } = await supabase.storage.from("media").upload(filePath, drawingBlob, {
          contentType: drawingBlob.type || "image/png",
          upsert: false,
        });
        if (uploadError) throw uploadError;
      }

      const fileName = filePath.split("/").pop() ?? `${msg.id}.png`;
      const title = `Chat Drawing ${format(new Date(msg.created_at), "MMM d, yyyy h:mm a")}`;

      const { error } = await supabase.from("media").insert({
        title,
        description: "Saved from chat drawing",
        file_name: fileName,
        file_path: filePath,
        file_size: drawingBlob.size,
        file_type: "image",
        mime_type: drawingBlob.type || "image/png",
        folder_id: null,
        uploaded_by: user.id,
        taken_at: msg.created_at,
      } as never);

      if (error) throw error;

      invalidateMedia(queryClient);
      toast({
        title: "Saved to memories",
        description: "This drawing now appears in your shared vault.",
      });
    } catch (error) {
      console.error("[handleSaveDrawingToMemories] failed:", error);
      toast({
        title: "Failed to save drawing",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSavingDrawingIds((previous) => {
        const next = new Set(previous);
        next.delete(msg.id);
        return next;
      });
    }
  }, [queryClient, toast, user]);

  // Drawing reuses the audioUrl column — messageType="drawing" tells the renderer
  const handleDrawingSend = useCallback(async (dataUrl: string) => {
    setShowDrawing(false);
    stopTyping();
    try {
      await sendMessage.mutateAsync({
        content: "🎨 Drawing",
        replyToId: replyTo?.id ?? null,
        messageType: "drawing",
        audioUrl: dataUrl,
      });
    } catch (err) {
      console.error("[handleDrawingSend] failed:", err);
    }
    setReplyTo(null);
  }, [replyTo, sendMessage, stopTyping]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
    if (e.key === "Escape") setReplyTo(null);
  }, [handleSend]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextValue = e.target.value;
    setText(nextValue);
    if (nextValue.trim()) sendTyping(true);
    else stopTyping();
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
  }, [sendTyping, stopTyping]);

  const handleInputFocus = useCallback(() => {
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    });
  }, []);

  const handleReact = useCallback((msg: Message, emoji: string) => {
    if (!canReact) { setGateModal({ feature: "Emoji Reactions" }); return; }
    const myReaction = (msg.reactions ?? []).find(r => r.user_id === user?.id && r.emoji === emoji);
    if (myReaction) removeReaction.mutate({ messageId: msg.id, emoji });
    else addReaction.mutate({ messageId: msg.id, emoji });
    setEmojiPickerId(null);
  }, [canReact, user, addReaction, removeReaction]);

  // FIX: stable per-message swipe reply handler — created once per unique message
  // ID via a message map, preventing memo invalidation on every parent render.
  const msgMap = Object.fromEntries(messages.map(m => [m.id, m]));

  const makeSwipeReplyHandler = useCallback((msgId: string) => () => {
    if (!selectMode) {
      const m = msgMap[msgId];
      if (m) { setReplyTo(m); inputRef.current?.focus(); }
    }
  }, [selectMode, msgMap]);

  // ── No couple guard ────────────────────────────────────────────────────────
  if (couple?.status !== "active") {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8 bg-background">
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
          <Lock className="h-7 w-7 text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-xl font-bold font-heading text-foreground">No Partner Connected</h2>
          <p className="text-sm text-muted-foreground mt-1">Connect with your partner to start chatting.</p>
        </div>
      </div>
    );
  }

  const groups = groupByDay(messages);

  return (
    <SwipeBackWrapper onBack={onBack}>
      <div
        className="isolate flex h-full min-h-0 w-full max-w-full flex-col overflow-hidden"
        style={{
          ...themeStyle,
          background: "hsl(var(--wa-bg))",
          height: viewportHeight ? `${viewportHeight}px` : undefined,
          transition: "height 0.15s ease",
        }}
      >
        {/* ── Header ── */}
        {selectMode ? (
          <div
            className="sticky top-0 flex min-w-0 items-center gap-1.5 px-2 py-2 shrink-0 z-20 sm:gap-2 sm:px-3"
            style={{
              background: "hsl(var(--wa-header))",
              borderBottom: "1px solid hsl(var(--border))",
              paddingTop: "calc(0.5rem + env(safe-area-inset-top, 0px))",
            }}
          >
            <button type="button" onClick={clearSelect} className="p-1 rounded-full shrink-0" style={{ color: "hsl(var(--wa-text))" }} aria-label="Clear selection">
              <X className="h-4 w-4" />
            </button>
            <span className="flex-1 text-sm font-semibold" style={{ color: "hsl(var(--wa-text))" }}>
              {selectedIds.size} selected
            </span>
            <button
              type="button"
              onClick={toggleSelectAll}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium"
              style={{
                background: allMessagesSelected ? "hsl(var(--wa-online) / 0.14)" : "hsl(var(--wa-text) / 0.08)",
                color: allMessagesSelected ? "hsl(var(--wa-online))" : "hsl(var(--wa-text))",
              }}
            >
              <CheckSquare className="h-3.5 w-3.5" />
              {allMessagesSelected ? "Unselect all" : "Select all"}
            </button>
            <button
              type="button"
              onClick={handleDeleteSelected}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium"
              style={{ background: "hsl(var(--destructive) / 0.12)", color: "hsl(var(--destructive))" }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          </div>
        ) : (
          <div
            className="sticky top-0 flex min-w-0 items-center gap-1.5 px-2 py-2 shrink-0 z-20 sm:gap-2 sm:px-3"
            style={{
              background: "hsl(var(--wa-header))",
              borderBottom: "1px solid hsl(var(--border))",
              paddingTop: "calc(0.5rem + env(safe-area-inset-top, 0px))",
            }}
          >
            {onBack && (
              <button type="button" onClick={onBack} className="sm:hidden p-1 rounded-full shrink-0" style={{ color: "hsl(var(--wa-text))" }} aria-label="Back">
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}

            <div className="relative shrink-0">
              <Avatar className="h-8 w-8 ring-1 ring-border">
                <AvatarImage src={partnerProfile?.avatar_url ?? undefined} />
                <AvatarFallback className="text-xs font-semibold" style={{ background: "hsl(var(--wa-avatar))", color: "hsl(var(--wa-bg))" }}>
                  {partnerInitials}
                </AvatarFallback>
              </Avatar>
              <span
                className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 transition-colors"
                style={{
                  borderColor: "hsl(var(--wa-header))",
                  background: partnerOnline ? "hsl(var(--wa-online))" : "hsl(var(--wa-meta))",
                }}
                aria-label={partnerOnline ? "Online" : "Offline"}
              />
            </div>

            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
              <div className="flex min-w-0 items-center gap-1.5">
                <p className="block min-w-0 flex-1 truncate text-sm font-semibold leading-none" style={{ color: "hsl(var(--wa-text))" }}>
                  {partnerName}
                </p>
              </div>
              <p className="text-[10px] truncate mt-0.5" style={{ color: "hsl(var(--wa-meta))" }} aria-live="polite">
                {partnerTyping ? (
                  <span style={{ color: "hsl(var(--wa-online))" }}>typing...</span>
                ) : partnerOnline ? (
                  <span style={{ color: "hsl(var(--wa-online))" }}>online</span>
                ) : (
                  <span>offline</span>
                )}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-0 min-w-fit sm:gap-0.5">
              <button type="button" onClick={() => void startCall("voice")} disabled={callState !== "idle"} className="rounded-full p-1.5 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed sm:p-2" style={{ color: "hsl(var(--wa-text) / 0.7)" }} title="Voice call" aria-label="Voice call">
                <Phone className="h-5 w-5" />
              </button>
              <button type="button" onClick={() => void startCall("video")} disabled={callState !== "idle"} className="rounded-full p-1.5 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed sm:p-2" style={{ color: "hsl(var(--wa-text) / 0.7)" }} title="Video call" aria-label="Video call">
                <Video className="h-5 w-5" />
              </button>
              <div className="relative">
                <button
                  onClick={() => setShowThemePicker(p => !p)}
                  className="rounded-full p-1.5 active:scale-95 transition-colors sm:p-2"
                  style={{
                    color: showThemePicker ? "hsl(var(--wa-online))" : "hsl(var(--wa-text) / 0.7)",
                    background: showThemePicker ? "hsl(var(--wa-online) / 0.1)" : "transparent",
                  }}
                  title="Chat theme"
                  aria-label="Change chat theme"
                  aria-expanded={showThemePicker}
                >
                  <Palette className="h-5 w-5" />
                </button>
                {showThemePicker && (
                  <ChatThemePicker
                    onClose={() => setShowThemePicker(false)}
                    onUpgrade={() => { setShowThemePicker(false); onUpgrade?.(); }}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Call Modal ── */}

        {/* ── Messages ── */}
        <div
          className="flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-2 py-2 sm:px-3"
          style={{
            background: "hsl(var(--wa-bg))",
            paddingBottom: kbOffset > 0 ? "0.5rem" : undefined,
          }}
        >
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="h-5 w-5 border-2 border-border border-t-foreground rounded-full animate-spin" aria-label="Loading messages" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2 text-center">
              <div className="px-4 py-2 rounded-lg text-xs" style={{ background: "hsl(var(--wa-system-bubble))", color: "hsl(var(--wa-meta))" }}>
                Messages are private between you two
              </div>
            </div>
          ) : (
            <div className="space-y-1 pb-2">
              {groups.map(group => (
                <div key={group.day}>
                  <div className="flex items-center justify-center my-3">
                    <span
                      className="text-[11px] font-medium px-3 py-1 rounded-full"
                      style={{ background: "hsl(var(--wa-system-bubble))", color: "hsl(var(--wa-meta))" }}
                    >
                      {formatDay(group.messages[0].created_at)}
                    </span>
                  </div>

                  <div className="space-y-0.5">
                    {group.messages.map((msg, i) => {
                      const isMe = msg.sender_id === user?.id;
                      const prevSame = i > 0 && group.messages[i - 1].sender_id === msg.sender_id;
                      const nextSame = i < group.messages.length - 1 && group.messages[i + 1].sender_id === msg.sender_id;
                      const reactions = groupReactions(msg.reactions);
                      const repliedMsg = msg.reply_to_id ? msgMap[msg.reply_to_id] : null;

                      // FIX: typed field access — cast once per message, not inline per usage
                      const msgEx = msg as Message & { message_type?: string; audio_url?: string };
                      const isVoice = msgEx.message_type === "voice";
                      const isDrawing = msgEx.message_type === "drawing";
                      const audioUrl = msgEx.audio_url;

                      // FIX: stable handler — created from a memoized factory, keyed on msg.id
                      const handleSwipeReply = makeSwipeReplyHandler(msg.id);

                      return (
                        <SwipeableMessage key={msg.id} onSwipeReply={handleSwipeReply} isMe={isMe}>
                          <div
                            className={cn(
                              "flex items-end gap-1 group relative max-w-full transition-colors sm:gap-1.5",
                              isMe ? "justify-end pl-8 sm:pl-20" : "justify-start pr-8 sm:pr-20",
                              selectedIds.has(msg.id) && "bg-primary/10 rounded-lg"
                            )}
                            onMouseEnter={() => setHoveredId(msg.id)}
                            onMouseLeave={() => setHoveredId(null)}
                            onTouchStart={(e) => startLongPress(e, msg.id)}
                            onTouchEnd={cancelLongPress}
                            onTouchMove={cancelLongPress}
                            // Suppress the native iOS/Android context menu (Copy / Select All)
                            // that appears after ~500 ms — our custom long-press UI replaces it.
                            onContextMenu={(e) => e.preventDefault()}
                            onClick={() => { if (selectMode) toggleSelect(msg.id); }}
                            // Prevent text selection on mobile during the long-press hold.
                            // `select-none` on this row covers the bubble + timestamp.
                            // Desktop users can still select text because browsers only apply
                            // user-select:none to pointer-device interactions differently,
                            // and we re-enable it on the bubble text via inline style below.
                            style={{ WebkitUserSelect: "none", userSelect: "none" }}
                          >
                            {/* Partner avatar */}
                            {!isMe && (
                              <div className="w-7 shrink-0 self-end mb-0.5">
                                {!nextSame && (
                                  <Avatar className="h-7 w-7">
                                    <AvatarImage src={partnerProfile?.avatar_url ?? undefined} />
                                    <AvatarFallback className="text-[10px]" style={{ background: "hsl(var(--wa-avatar))", color: "hsl(var(--wa-bg))" }}>
                                      {partnerInitials}
                                    </AvatarFallback>
                                  </Avatar>
                                )}
                              </div>
                            )}

                            <div className={cn("flex flex-col max-w-[min(88vw,24rem)] sm:max-w-[70%]", isMe ? "items-end" : "items-start")}>
                              {/* Reply preview */}
                              {repliedMsg && (
                                <div
                                  className="text-[11px] px-3 py-1.5 rounded-t-lg mb-0 w-full border-l-[3px] max-w-full"
                                  style={{
                                    background: "hsl(var(--wa-system-bubble))",
                                    borderColor: "hsl(var(--wa-online))",
                                    borderBottomLeftRadius: 0, borderBottomRightRadius: 0,
                                  }}
                                >
                                  <span className="font-semibold block" style={{ color: "hsl(var(--wa-online))" }}>
                                    {repliedMsg.sender_id === user?.id ? "You" : partnerName}
                                  </span>
                                  <span className="truncate block" style={{ color: "hsl(var(--wa-text) / 0.7)" }}>
                                    {repliedMsg.content.slice(0, 60)}{repliedMsg.content.length > 60 ? "..." : ""}
                                  </span>
                                </div>
                              )}

                              {/* Bubble */}
                              <div
                                className={cn("relative text-sm leading-relaxed break-words", isVoice ? "px-2 py-2" : "px-3 py-2 pb-1 shadow-sm")}
                                style={{
                                  background: isMe ? "hsl(var(--wa-bubble-out))" : "hsl(var(--wa-bubble-in))",
                                  color: "hsl(var(--wa-text))",
                                  borderRadius: prevSame ? "12px" : isMe ? "12px 4px 12px 12px" : "4px 12px 12px 12px",
                                }}
                              >
                                {isVoice && audioUrl ? (
                                  <AudioBubble
                                    url={audioUrl} duration={msg.content}
                                    avatarUrl={isMe ? (myProfile?.avatar_url ?? undefined) : (partnerProfile?.avatar_url ?? undefined)}
                                    avatarFallback={isMe ? myInitials : partnerInitials}
                                    isMe={isMe} time={format(new Date(msg.created_at), "h:mm a")} msg={msg}
                                  />
                                ) : isDrawing && audioUrl ? (
                                  <div className="relative space-y-2">
                                    <button
                                      type="button"
                                      onClick={() => setPreviewDrawingUrl(audioUrl)}
                                      className="block overflow-hidden rounded-lg"
                                      aria-label="Open drawing preview"
                                    >
                                      <img
                                        src={audioUrl}
                                        alt="Drawing"
                                        className="max-h-[280px] max-w-[min(68vw,260px)] rounded-lg object-contain transition-transform hover:scale-[1.01] sm:max-h-[320px]"
                                        style={{ background: "#fff" }}
                                        loading="lazy"
                                      />
                                    </button>
                                    <div className="flex items-center justify-between gap-2">
                                      <button
                                        type="button"
                                        onClick={() => void handleSaveDrawingToMemories(msg, audioUrl)}
                                        disabled={savingDrawingIds.has(msg.id)}
                                        className="rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors disabled:opacity-60"
                                        style={{
                                          background: "hsl(var(--wa-system-bubble))",
                                          color: "hsl(var(--wa-online))",
                                        }}
                                      >
                                        {savingDrawingIds.has(msg.id) ? "Saving..." : "Save to memories"}
                                      </button>
                                      <span
                                        className="flex items-center gap-0.5 text-[10px] select-none leading-none whitespace-nowrap"
                                        style={{ color: "hsl(var(--wa-meta))" }}
                                      >
                                        {format(new Date(msg.created_at), "h:mm a")}
                                        <ReadReceipt msg={msg} isMe={isMe} />
                                      </span>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <span
                                      className="break-words"
                                      // Re-enable selection on desktop (mouse users).
                                      // On mobile this is overridden by the parent's
                                      // user-select:none, which is what we want.
                                      style={{ WebkitUserSelect: "text", userSelect: "text" }}
                                    >{msg.content}</span>
                                    <span className="inline-block w-16 h-3 ml-1" aria-hidden />
                                    <span
                                      className="absolute bottom-1.5 right-2.5 flex items-center gap-0.5 text-[10px] select-none leading-none whitespace-nowrap"
                                      style={{ color: "hsl(var(--wa-meta))" }}
                                    >
                                      {format(new Date(msg.created_at), "h:mm a")}
                                      <ReadReceipt msg={msg} isMe={isMe} />
                                    </span>
                                  </>
                                )}
                              </div>

                              {/* Reactions */}
                              {reactions.length > 0 && (
                                <div className={cn("flex gap-1 mt-1 flex-wrap", isMe ? "justify-end" : "justify-start")}>
                                  {reactions.map(([emoji, count]) => {
                                    const iMine = (msg.reactions ?? []).some(r => r.user_id === user?.id && r.emoji === emoji);
                                    return (
                                      <button
                                        key={emoji}
                                        onClick={() => handleReact(msg, emoji)}
                                        className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs border transition-colors"
                                        style={{
                                          background: iMine ? "hsl(var(--wa-bubble-out) / 0.5)" : "hsl(var(--wa-system-bubble))",
                                          borderColor: iMine ? "hsl(var(--wa-online) / 0.5)" : "transparent",
                                          color: "hsl(var(--wa-text))",
                                        }}
                                        aria-label={`${emoji} reaction${count > 1 ? `, ${count}` : ""}`}
                                      >
                                        {emoji} {count > 1 && <span>{count}</span>}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>

                            {/* Long-press emoji bar */}
                            {longPressId === msg.id && (
                              <div
                                className="absolute -top-12 left-1/2 z-50 flex max-w-[calc(100vw-24px)] -translate-x-1/2 gap-1 overflow-x-auto rounded-2xl border border-border px-2.5 py-2 shadow-2xl"
                                style={{ background: "hsl(var(--wa-header))" }}
                                onTouchStart={e => e.stopPropagation()}
                                role="toolbar" aria-label="Reactions"
                              >
                                {EMOJI_REACTIONS.map(emoji => (
                                  <button
                                    key={emoji}
                                    onTouchEnd={e => { e.preventDefault(); e.stopPropagation(); handleReact(msg, emoji); setLongPressId(null); }}
                                    className="text-xl active:scale-125 transition-transform px-0.5"
                                    aria-label={`React ${emoji}`}
                                  >
                                    {emoji}
                                  </button>
                                ))}
                                <button
                                  onTouchEnd={e => { e.preventDefault(); e.stopPropagation(); setLongPressId(null); toggleSelect(msg.id); }}
                                  className="flex items-center justify-center w-8 h-8 rounded-full"
                                  style={{ color: "hsl(var(--wa-text) / 0.7)" }}
                                  aria-label="Select message"
                                >
                                  <CheckSquare className="h-5 w-5" />
                                </button>
                              </div>
                            )}

                            {/* Selected checkmark */}
                            {selectedIds.has(msg.id) && (
                              <div className={cn("shrink-0 self-center", isMe ? "order-first mr-1" : "order-last ml-1")} aria-hidden>
                                <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                                  <Check className="h-3 w-3 text-primary-foreground" />
                                </div>
                              </div>
                            )}

                            {/* Hover actions (desktop) */}
                            {hoveredId === msg.id && !selectMode && (
                              <div className={cn("hidden sm:flex items-center gap-0.5 shrink-0 self-center", isMe ? "order-first mr-1" : "order-last ml-1")} role="toolbar">
                                <div className="relative">
                                  <button
                                    onClick={e => { e.stopPropagation(); setEmojiPickerId(id => id === msg.id ? null : msg.id); }}
                                    className="p-1.5 rounded-full hover:bg-accent/30"
                                    style={{ color: "hsl(var(--wa-text) / 0.6)" }}
                                    aria-label="Add reaction"
                                  >
                                    <Smile className="h-3.5 w-3.5" />
                                  </button>
                                  {emojiPickerId === msg.id && (
                                    <div
                                      className={cn("absolute bottom-9 flex gap-1 rounded-2xl px-2.5 py-2 shadow-xl z-50 border border-border", isMe ? "right-0" : "left-0")}
                                      style={{ background: "hsl(var(--wa-header))" }}
                                      onClick={e => e.stopPropagation()}
                                      role="listbox"
                                    >
                                      {EMOJI_REACTIONS.map(emoji => (
                                        <button type="button" key={emoji} onClick={() => handleReact(msg, emoji)} className="text-xl hover:scale-125 transition-transform" aria-label={emoji}>
                                          {emoji}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <button type="button" onClick={() => { setReplyTo(msg); inputRef.current?.focus(); }} className="p-1.5 rounded-full hover:bg-accent/30" style={{ color: "hsl(var(--wa-text) / 0.6)" }} aria-label="Reply">
                                  <Reply className="h-3.5 w-3.5" />
                                </button>
                                <button type="button" onClick={() => toggleSelect(msg.id)} className="p-1.5 rounded-full hover:bg-accent/30" style={{ color: "hsl(var(--wa-text) / 0.6)" }} aria-label="Select">
                                  <CheckSquare className="h-3.5 w-3.5" />
                                </button>
                                <button type="button" onClick={() => deleteMessage.mutateAsync(msg.id)} className="p-1.5 rounded-full hover:bg-destructive/10" style={{ color: "hsl(var(--wa-text) / 0.5)" }} aria-label="Delete">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        </SwipeableMessage>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* ── Reply Banner ── */}
        {replyTo && (
          <div
            className="flex items-center gap-3 px-3 py-2 shrink-0 border-t border-border"
            style={{ background: "hsl(var(--wa-header))" }}
          >
            <div
              className="w-1 self-stretch rounded-full shrink-0"
              style={{ background: "hsl(var(--wa-online))" }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold" style={{ color: "hsl(var(--wa-online))" }}>
                {replyTo.sender_id === user?.id ? "You" : partnerName}
              </p>
              <p className="text-xs truncate" style={{ color: "hsl(var(--wa-text) / 0.7)" }}>
                {replyTo.content.slice(0, 80)}{replyTo.content.length > 80 ? "..." : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setReplyTo(null)}
              className="p-1 rounded-full hover:bg-muted/40 transition-colors"
              style={{ color: "hsl(var(--wa-text) / 0.5)" }}
              aria-label="Cancel reply"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* ── Input Bar ── */}
        <div
          className="flex shrink-0 items-end gap-2 border-t border-border px-2 pt-2 pb-2 sm:px-3 sm:gap-2.5 sm:pb-3"
          style={{
            background: "hsl(var(--wa-bg))",
            paddingBottom: kbOffset > 0
              ? "0.5rem"
              : "calc(0.5rem + env(safe-area-inset-bottom, 0px))",
          }}
        >
          {voiceMode ? (
            <div className="flex-1">
              <VoiceRecorder
                onSend={handleVoiceSend}
                onCancel={() => setVoiceMode(false)}
                disabled={sendMessage.isPending}
              />
            </div>
          ) : (
            <>
              <div
                className="flex min-w-0 flex-1 items-end gap-1 rounded-3xl border border-border px-2 py-2 focus-within:ring-2 focus-within:ring-green-500/20 sm:gap-2 sm:px-3"
                style={{ background: "hsl(var(--wa-input-bg))" }}
              >
                {/* Emoji button */}
                <div className="relative shrink-0">
                  <button
                    onClick={() => setShowEmojiPicker(p => !p)}
                    onMouseEnter={preloadEmojiPicker}
                    onTouchStart={preloadEmojiPicker}
                    onFocus={preloadEmojiPicker}
                    className="shrink-0 p-1"
                    style={{
                      color: showEmojiPicker
                        ? "hsl(var(--wa-online))"
                        : "hsl(var(--wa-text) / 0.45)",
                    }}
                    aria-label="Emoji"
                    aria-expanded={showEmojiPicker}
                    type="button"
                  >
                    <Smile className="h-5 w-5" />
                  </button>

                  {showEmojiPicker && (
                    <EmojiPicker
                      onSelect={(emoji) => {
                        setText(t => t + emoji);
                        inputRef.current?.focus();
                      }}
                      onClose={() => setShowEmojiPicker(false)}
                    />
                  )}
                </div>

                {/* Textarea */}
                <textarea
                  ref={inputRef}
                  value={text}
                  onChange={handleInputChange}
                  onFocus={handleInputFocus}
                  onBlur={stopTyping}
                  onKeyDown={handleKeyDown}
                  placeholder={replyTo ? "Write a reply..." : "Message..."}
                  rows={1}
                  className="min-w-0 flex-1 bg-transparent border-0 outline-none resize-none py-1 text-[16px] leading-relaxed max-h-32 overflow-y-auto placeholder:text-muted-foreground sm:text-sm"
                  style={{ color: "hsl(var(--wa-text))", minHeight: "24px" }}
                  autoComplete="off"
                  enterKeyHint="send"
                  aria-label="Message input"
                />

                {/* Draw button */}
                <button
                  type="button"
                  onClick={() => setShowDrawing(true)}
                  className="shrink-0 p-1"
                  style={{ color: "hsl(var(--wa-text) / 0.45)" }}
                  aria-label="Draw"
                >
                  <Pencil className="h-5 w-5" />
                </button>
              </div>

              {/* Send / Voice button */}
              {text.trim() ? (
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={sendMessage.isPending}
                  className="h-11 w-11 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-95 disabled:opacity-50"
                  style={{ background: "hsl(var(--wa-online))" }}
                  aria-label="Send message"
                >
                  <Send className="h-5 w-5 text-white" />
                </button>
              ) : (
                <button
                  onClick={() =>
                    canVoice
                      ? setVoiceMode(true)
                      : setGateModal({ feature: "Voice Messages" })
                  }
                  disabled={sendMessage.isPending}
                  className="h-11 w-11 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-95 disabled:opacity-50"
                  style={{ background: "hsl(var(--wa-online))" }}
                  aria-label="Record voice message"
                >
                  <Mic className="h-5 w-5 text-white" />
                </button>
              )}
            </>
          )}
        </div>

        {/* ── Drawing Canvas ── */}
        {showDrawing && <DrawingCanvas onSend={handleDrawingUploadSend} onClose={() => setShowDrawing(false)} />}
        {previewDrawingUrl && (
          <div
            className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-4"
            onClick={() => setPreviewDrawingUrl(null)}
            role="dialog"
            aria-modal="true"
            aria-label="Drawing preview"
          >
            <button
              type="button"
              onClick={() => setPreviewDrawingUrl(null)}
              className="absolute right-4 top-4 rounded-full bg-black/40 p-2 text-white"
              aria-label="Close drawing preview"
            >
              <X className="h-5 w-5" />
            </button>
            <img
              src={previewDrawingUrl}
              alt="Drawing preview"
              className="max-h-[90vh] max-w-[92vw] rounded-2xl bg-white object-contain shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            />
          </div>
        )}

        {/* ── Upgrade Gate ── */}
        <UpgradeGateModal
          open={!!gateModal}
          onClose={() => setGateModal(null)}
          onUpgrade={() => { setGateModal(null); onUpgrade?.(); }}
          featureName={gateModal?.feature ?? ""}
          requiredPlan="dating"
        />
      </div>
    </SwipeBackWrapper>
  );
}




