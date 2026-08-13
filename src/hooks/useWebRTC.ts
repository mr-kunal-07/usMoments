import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { dashboardPath } from "@/app/router/paths";
import { sendPushRequest } from "@/hooks/usePushNotifications";

export type CallType = "voice" | "video";
export type CallState = "idle" | "calling" | "ringing" | "connected" | "ended";
type RejectReason = "busy" | "unavailable" | "declined" | "error";

export interface WebRTCSession {
  callState: CallState;
  callType: CallType;
  incomingCallType: CallType;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  startCall: (type: CallType) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: (reason?: RejectReason) => void;
  hangUp: () => void;
  isMuted: boolean;
  isSpeaker: boolean;
  toggleMute: () => void;
  toggleSpeaker: () => void;
  flipCamera: () => Promise<void>;
  isFrontCamera: boolean;
  connectedAt: number | null;
  partnerOnline?: boolean;
  callError: string | null;
  clearCallError: () => void;
}

interface UseWebRTCProps {
  coupleId: string | null;
  myUserId: string | null;
  partnerUserId: string | null;
  partnerOnline?: boolean;
  enabled?: boolean;
}

interface SignalPayload {
  type: "offer" | "answer" | "ice" | "call-request" | "call-accept" | "call-reject" | "call-end";
  from: string;
  callType?: CallType;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  reason?: RejectReason;
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
];

function isMatchingFacingDevice(label: string, facing: "user" | "environment"): boolean {
  const normalized = label.toLowerCase();

  if (facing === "environment") {
    return /(back|rear|environment|world)/.test(normalized);
  }

  return /(front|user|facetime|selfie)/.test(normalized);
}

function trackMatchesFacing(track: MediaStreamTrack, facing: "user" | "environment"): boolean {
  const label = track.label?.toLowerCase() ?? "";
  const facingMode = track.getSettings().facingMode;

  if (typeof facingMode === "string") {
    if (facing === "environment" && facingMode === "environment") return true;
    if (facing === "user" && facingMode === "user") return true;
  }

  return label ? isMatchingFacingDevice(label, facing) : false;
}

function getCallErrorMessage(error: unknown, action: "start" | "accept" | "media"): string {
  if (!(error instanceof Error)) {
    return action === "accept"
      ? "Could not answer the call. Please try again."
      : "Could not start the call. Please try again.";
  }

  if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
    return action === "accept"
      ? "Microphone or camera permission was denied. Allow access to answer the call."
      : "Microphone or camera permission was denied. Allow access to start the call.";
  }
  if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
    return "No microphone or camera was found on this device.";
  }
  if (error.name === "NotReadableError" || error.name === "TrackStartError") {
    return "Your microphone or camera is already in use by another app.";
  }
  if (error.name === "OverconstrainedError") {
    return "This camera is not available on your device.";
  }
  if (error.name === "AbortError") {
    return "The call setup was interrupted. Please try again.";
  }
  return error.message || "Something went wrong while setting up the call.";
}

export function useWebRTC({
  coupleId,
  myUserId,
  partnerUserId,
  partnerOnline,
  enabled = true,
}: UseWebRTCProps): WebRTCSession {
  const [callState, setCallState] = useState<CallState>("idle");
  const [callType, setCallType] = useState<CallType>("voice");
  const [incomingCallType, setIncomingCallType] = useState<CallType>("voice");
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false); // false = earphone (default), true = loudspeaker
  const [connectedAt, setConnectedAt] = useState<number | null>(null);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [callError, setCallError] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const channelReadyRef = useRef(false);
  const channelReadyPromiseRef = useRef<Promise<void> | null>(null);
  const channelReadyResolveRef = useRef<(() => void) | null>(null);
  const channelReadyRejectRef = useRef<((error: Error) => void) | null>(null);
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);
  const pendingOffer = useRef<RTCSessionDescriptionInit | null>(null);
  const hangUpRef = useRef<() => void>(() => {});
  const disconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unansweredTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callStateRef = useRef<CallState>("idle");
  const facingModeRef = useRef<"user" | "environment">("user");
  const isFlippingRef = useRef(false);
  const setupAttemptRef = useRef(0);

  const channelName = coupleId ? `call:${coupleId}` : null;

  const setCallStateSafe = useCallback((next: CallState) => {
    callStateRef.current = next;
    setCallState(next);
  }, []);

  const stopDisconnectTimer = useCallback(() => {
    if (disconnectTimerRef.current) {
      clearTimeout(disconnectTimerRef.current);
      disconnectTimerRef.current = null;
    }
  }, []);

  const stopUnansweredTimer = useCallback(() => {
    if (unansweredTimerRef.current) {
      clearTimeout(unansweredTimerRef.current);
      unansweredTimerRef.current = null;
    }
  }, []);

  const sendSignal = useCallback(async (payload: SignalPayload) => {
    const channel = channelRef.current;
    if (!channel) return "error" as const;

    try {
      return await channel.send({ type: "broadcast", event: "signal", payload });
    } catch (error) {
      console.warn("Call signal failed:", error);
      return "error" as const;
    }
  }, []);

  const sendRequiredSignal = useCallback(async (payload: SignalPayload) => {
    const status = await sendSignal(payload);
    if (status !== "ok") {
      throw new Error("The call connection is unavailable. Please try again.");
    }
  }, [sendSignal]);

  const resetChannelReadyPromise = useCallback(() => {
    channelReadyPromiseRef.current = new Promise<void>((resolve, reject) => {
      channelReadyResolveRef.current = resolve;
      channelReadyRejectRef.current = reject;
    });
  }, []);

  const cleanup = useCallback(() => {
    setupAttemptRef.current += 1;
    stopDisconnectTimer();
    stopUnansweredTimer();

    if (pcRef.current) {
      pcRef.current.onicecandidate = null;
      pcRef.current.ontrack = null;
      pcRef.current.onconnectionstatechange = null;
      pcRef.current.oniceconnectionstatechange = null;
      pcRef.current.close();
    }
    pcRef.current = null;

    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;

    pendingCandidates.current = [];
    pendingOffer.current = null;
    facingModeRef.current = "user";
    isFlippingRef.current = false;

    setLocalStream(null);
    setRemoteStream(null);
    setIsMuted(false);
    setIsSpeaker(false);
    setConnectedAt(null);
    setIsFrontCamera(true);
  }, [stopDisconnectTimer, stopUnansweredTimer]);

  const flushPendingIce = useCallback(async (pc: RTCPeerConnection) => {
    for (const candidate of pendingCandidates.current) {
      try {
        await pc.addIceCandidate(candidate);
      } catch (error) {
        console.warn("ICE add failed:", error);
      }
    }
    pendingCandidates.current = [];
  }, []);

  const createPC = useCallback(() => {
    const pc = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
      bundlePolicy: "max-bundle",
      iceCandidatePoolSize: 4,
    });

    const markConnected = () => {
      stopDisconnectTimer();
      stopUnansweredTimer();
      setCallError(null);
      if (callStateRef.current !== "connected") {
        setCallStateSafe("connected");
        setConnectedAt(Date.now());
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && myUserId) {
        void sendSignal({ type: "ice", from: myUserId, candidate: event.candidate.toJSON() });
      }
    };

    pc.ontrack = (event) => {
      const stream = event.streams?.[0];
      if (stream) {
        setRemoteStream(stream);
        return;
      }
      setRemoteStream((previous) => {
        const next = previous ? new MediaStream(previous.getTracks()) : new MediaStream();
        next.addTrack(event.track);
        return next;
      });
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        markConnected();
      }

      if (pc.connectionState === "disconnected") {
        stopDisconnectTimer();
        disconnectTimerRef.current = setTimeout(() => {
          if (pc.connectionState === "disconnected") {
            hangUpRef.current();
          }
        }, 8_000);
      }

      if (pc.connectionState === "failed" || pc.connectionState === "closed") {
        hangUpRef.current();
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
        markConnected();
      }
    };

    pcRef.current = pc;
    return pc;
  }, [myUserId, sendSignal, setCallStateSafe, stopDisconnectTimer, stopUnansweredTimer]);

  const acquireVideoTrackForFacing = useCallback(
    async (
      facing: "user" | "environment",
      currentTrack?: MediaStreamTrack,
    ): Promise<MediaStreamTrack> => {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Calling is not supported in this browser.");
      }

      const videoDevices = navigator.mediaDevices.enumerateDevices
        ? (await navigator.mediaDevices.enumerateDevices()).filter(
            (device) => device.kind === "videoinput",
          )
        : [];

      const currentDeviceId = currentTrack?.getSettings().deviceId;
      const matchingDevices = videoDevices.filter(
        (device) =>
          device.deviceId !== currentDeviceId && isMatchingFacingDevice(device.label, facing),
      );

      const attemptConstraints: Array<MediaTrackConstraints | boolean> = [];

      for (const device of matchingDevices) {
        attemptConstraints.push({
          deviceId: { exact: device.deviceId },
          width: { ideal: 640, max: 960 },
          height: { ideal: 360, max: 540 },
          frameRate: { ideal: 24, max: 30 },
        });
      }

      attemptConstraints.push(
        {
          facingMode: { exact: facing },
          width: { ideal: 640, max: 960 },
          height: { ideal: 360, max: 540 },
          frameRate: { ideal: 24, max: 30 },
        },
        {
          facingMode: facing,
          width: { ideal: 640, max: 960 },
          height: { ideal: 360, max: 540 },
          frameRate: { ideal: 24, max: 30 },
        },
      );

      if (videoDevices.length > 1) {
        const alternateDevices = videoDevices.filter((device) => device.deviceId !== currentDeviceId);
        for (const device of alternateDevices) {
          attemptConstraints.push({
            deviceId: { exact: device.deviceId },
            width: { ideal: 640, max: 960 },
            height: { ideal: 360, max: 540 },
            frameRate: { ideal: 24, max: 30 },
          });
        }
      }
      if (facing === "user") {
        attemptConstraints.push(true);
      }

      let lastError: unknown = null;

      for (const constraints of attemptConstraints) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: constraints,
            audio: false,
          });
          const track = stream.getVideoTracks()[0];
          if (track) {
            if (!trackMatchesFacing(track, facing) && facing === "environment") {
              lastError = new Error("Back camera is not available on this device.");
              stream.getTracks().forEach((candidate) => candidate.stop());
              continue;
            }
            return track;
          }
          stream.getTracks().forEach((candidate) => candidate.stop());
        } catch (error) {
          lastError = error;
        }
      }

      throw lastError instanceof Error ? lastError : new Error("Could not access the camera.");
    },
    [],
  );

  const acquireMedia = useCallback(async (type: CallType) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Calling is not supported in this browser.");
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: type === "video"
        ? {
            facingMode: "user",
            width: { ideal: 640, max: 960 },
            height: { ideal: 360, max: 540 },
            frameRate: { ideal: 24, max: 30 },
          }
        : false,
    });

    stream.getAudioTracks().forEach((track) => {
      track.contentHint = "speech";
    });
    stream.getVideoTracks().forEach((track) => {
      track.contentHint = "motion";
    });

    facingModeRef.current = "user";
    setIsFrontCamera(true);
    return stream;
  }, []);

  const activateLocalStream = useCallback((stream: MediaStream) => {
    localStreamRef.current = stream;
    setLocalStream(stream);
  }, []);

  const ensureChannelReady = useCallback(async () => {
    if (channelReadyRef.current) return;

    const startedAt = Date.now();
    while (!channelReadyPromiseRef.current) {
      if (Date.now() - startedAt > 1_500) {
        throw new Error("Call connection is still starting. Please try again.");
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    await Promise.race([
      channelReadyPromiseRef.current,
      new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error("Call signaling is not ready yet.")), 8_000),
      ),
    ]);
  }, []);

  const sendCallPush = useCallback(async (type: CallType) => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) return;

      const response = await sendPushRequest(session.access_token, {
        title: type === "video" ? "Incoming Video Call" : "Incoming Voice Call",
        body: type === "video" ? "Open usMoments to answer the video call." : "Open usMoments to answer the voice call.",
        url: dashboardPath("chat"),
        tag: `usmoment-incoming-call-${type}`,
        requireInteraction: true,
        renotify: true,
        vibrate: [300, 150, 300, 150, 500],
        actions: [
          { action: "accept-call", title: "Accept" },
          { action: "decline-call", title: "Decline" },
        ],
        data: {
          url: dashboardPath("chat"),
          notificationKind: "incoming-call",
          callType: type,
        },
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        console.warn("Failed to send call push:", response.status, errorText);
      }
    } catch (error) {
      console.warn("Failed to send call push:", error);
    }
  }, []);

  const sendMissedCallPush = useCallback(async (type: CallType) => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) return;

      const response = await sendPushRequest(session.access_token, {
        title: type === "video" ? "Missed Video Call" : "Missed Voice Call",
        body: type === "video" ? "You missed a video call on usMoments." : "You missed a voice call on usMoments.",
        url: `${dashboardPath("chat")}?callAction=missed`,
        tag: `usmoment-missed-call-${type}`,
        renotify: true,
        vibrate: [180, 120, 180],
        data: {
          url: `${dashboardPath("chat")}?callAction=missed`,
          notificationKind: "missed-call",
          callType: type,
        },
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        console.warn("Failed to send missed call push:", response.status, errorText);
      }
    } catch (error) {
      console.warn("Failed to send missed call push:", error);
    }
  }, []);

  const startCall = useCallback(
    async (type: CallType) => {
      if (!enabled) return;

      if (!coupleId || !myUserId || !partnerUserId) {
        setCallError("A partner is required before you can place a call.");
        return;
      }

      if (callStateRef.current !== "idle") {
        setCallError("You are already in a call.");
        return;
      }

      try {
        setCallError(null);
        setCallType(type);
        setIncomingCallType(type);
        setCallStateSafe("calling");

        const attemptId = setupAttemptRef.current + 1;
        setupAttemptRef.current = attemptId;
        const [channelResult, mediaResult] = await Promise.allSettled([
          ensureChannelReady(),
          acquireMedia(type),
        ]);

        if (attemptId !== setupAttemptRef.current) {
          if (mediaResult.status === "fulfilled") {
            mediaResult.value.getTracks().forEach((track) => track.stop());
          }
          return;
        }
        if (channelResult.status === "rejected") throw channelResult.reason;
        if (mediaResult.status === "rejected") throw mediaResult.reason;

        const stream = mediaResult.value;
        activateLocalStream(stream);
        const pc = createPC();
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        void sendCallPush(type);
        unansweredTimerRef.current = setTimeout(() => {
          if (callStateRef.current === "calling") {
            void sendMissedCallPush(type);
            hangUpRef.current();
          }
        }, 30_000);

        const [offer] = await Promise.all([
          pc.createOffer(),
          sendRequiredSignal({ type: "call-request", from: myUserId, callType: type }),
        ]);
        await pc.setLocalDescription(offer);
        await sendRequiredSignal({ type: "offer", from: myUserId, sdp: offer, callType: type });
      } catch (error) {
        console.error("startCall failed:", error);
        cleanup();
        setCallStateSafe("idle");
        setCallError(getCallErrorMessage(error, "start"));
      }
    },
    [
      acquireMedia,
      activateLocalStream,
      cleanup,
      coupleId,
      createPC,
      enabled,
      ensureChannelReady,
      myUserId,
      partnerUserId,
      sendCallPush,
      sendMissedCallPush,
      sendRequiredSignal,
      setCallStateSafe,
    ],
  );

  const acceptCall = useCallback(async () => {
    if (!enabled || !myUserId) return;
    if (callStateRef.current !== "ringing") return;

    try {
      setCallError(null);
      setCallType(incomingCallType);
      setCallStateSafe("calling");

      const attemptId = setupAttemptRef.current + 1;
      setupAttemptRef.current = attemptId;
      const [channelResult, mediaResult] = await Promise.allSettled([
        ensureChannelReady(),
        acquireMedia(incomingCallType),
      ]);

      if (attemptId !== setupAttemptRef.current) {
        if (mediaResult.status === "fulfilled") {
          mediaResult.value.getTracks().forEach((track) => track.stop());
        }
        return;
      }
      if (channelResult.status === "rejected") throw channelResult.reason;
      if (mediaResult.status === "rejected") throw mediaResult.reason;

      const stream = mediaResult.value;
      activateLocalStream(stream);
      const pc = createPC();
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      await sendRequiredSignal({ type: "call-accept", from: myUserId, callType: incomingCallType });

      if (pendingOffer.current) {
        await pc.setRemoteDescription(pendingOffer.current);
        pendingOffer.current = null;

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await sendRequiredSignal({ type: "answer", from: myUserId, sdp: answer, callType: incomingCallType });
        await flushPendingIce(pc);
      }
    } catch (error) {
      console.error("acceptCall failed:", error);
      cleanup();
      setCallStateSafe("ringing");
      setCallError(getCallErrorMessage(error, "accept"));
    }
  }, [acquireMedia, activateLocalStream, cleanup, createPC, enabled, ensureChannelReady, flushPendingIce, incomingCallType, myUserId, sendRequiredSignal, setCallStateSafe]);

  const rejectCall = useCallback(
    (reason: RejectReason = "declined") => {
      if (!enabled) return;
      if (myUserId) {
        void sendSignal({ type: "call-reject", from: myUserId, reason });
      }
      cleanup();
      setCallStateSafe("idle");
    },
    [cleanup, enabled, myUserId, sendSignal, setCallStateSafe],
  );

  const hangUp = useCallback(() => {
    if (!enabled) return;
    if (myUserId && callStateRef.current !== "idle") {
      void sendSignal({ type: "call-end", from: myUserId });
    }
    cleanup();
    setCallStateSafe("idle");
  }, [cleanup, enabled, myUserId, sendSignal, setCallStateSafe]);

  useEffect(() => {
    hangUpRef.current = hangUp;
  }, [hangUp]);

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;

    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) return;

    audioTrack.enabled = !audioTrack.enabled;
    setIsMuted(!audioTrack.enabled);
  }, []);

  const toggleSpeaker = useCallback(() => {
    setIsSpeaker((previous) => !previous);
  }, []);

  const flipCamera = useCallback(async () => {
    if (isFlippingRef.current) return;
    isFlippingRef.current = true;

    const stream = localStreamRef.current;
    if (!stream) {
      isFlippingRef.current = false;
      return;
    }

    const oldVideoTrack = stream.getVideoTracks()[0];
    if (!oldVideoTrack) {
      isFlippingRef.current = false;
      return;
    }

    const newFacing = facingModeRef.current === "user" ? "environment" : "user";
    const audioTracks = stream.getAudioTracks();

    const applyVideoTrack = async (nextTrack: MediaStreamTrack, nextFacing: "user" | "environment") => {
      const sender = pcRef.current?.getSenders().find((candidate) => candidate.track?.kind === "video");
      if (sender) {
        await sender.replaceTrack(nextTrack);
      }

      stream.removeTrack(oldVideoTrack);
      stream.addTrack(nextTrack);

      const updatedStream = new MediaStream([...audioTracks, nextTrack]);
      localStreamRef.current = updatedStream;
      setLocalStream(updatedStream);
      facingModeRef.current = nextFacing;
      setIsFrontCamera(nextFacing === "user");
    };

    try {
      const nextTrack = await acquireVideoTrackForFacing(newFacing, oldVideoTrack);
      await applyVideoTrack(nextTrack, newFacing);
      oldVideoTrack.stop();
    } catch (error) {
      console.warn("Camera flip failed with active track, retrying after release:", error);

      try {
        oldVideoTrack.stop();
        const nextTrack = await acquireVideoTrackForFacing(newFacing);
        await applyVideoTrack(nextTrack, newFacing);
      } catch (retryError) {
        console.warn("Camera flip retry failed:", retryError);

        try {
          const restoredTrack = await acquireVideoTrackForFacing(facingModeRef.current);
          await applyVideoTrack(restoredTrack, facingModeRef.current);
        } catch (restoreError) {
          console.warn("Camera restore failed:", restoreError);
          setCallError("Could not switch cameras on this device.");
        }
      }
    } finally {
      isFlippingRef.current = false;
    }
  }, [acquireVideoTrackForFacing]);

  const clearCallError = useCallback(() => {
    setCallError(null);
  }, []);

  useEffect(() => {
    if (!enabled || !channelName || !myUserId) return;

    channelReadyRef.current = false;
    resetChannelReadyPromise();

    const channel = supabase.channel(channelName, {
      config: { broadcast: { self: false } },
    });

    channel.on("broadcast", { event: "signal" }, async ({ payload }: { payload: SignalPayload }) => {
      if (payload.from === myUserId) return;
      if (partnerUserId && payload.from !== partnerUserId) return;

      switch (payload.type) {
        case "call-request":
          if (callStateRef.current !== "idle") {
            void sendSignal({ type: "call-reject", from: myUserId, reason: "busy" });
            return;
          }
          setCallError(null);
          setIncomingCallType(payload.callType ?? "voice");
          setCallType(payload.callType ?? "voice");
          setCallStateSafe("ringing");
          return;

        case "call-accept":
          stopUnansweredTimer();
          setCallError(null);
          if (callStateRef.current !== "idle") {
            setCallStateSafe("calling");
          }
          return;

        case "call-reject":
          cleanup();
          setCallStateSafe("idle");
          setCallError(
            payload.reason === "busy"
              ? "Your partner is already on another call."
              : payload.reason === "unavailable"
                ? "Your partner could not receive the call."
                : payload.reason === "error"
                  ? "The call could not be completed."
                  : "Your partner declined the call.",
          );
          return;

        case "call-end":
          cleanup();
          setCallStateSafe("idle");
          return;

        case "offer":
          if (!payload.sdp) return;

          if (callStateRef.current === "idle") {
            setCallType(payload.callType ?? "voice");
            setIncomingCallType(payload.callType ?? "voice");
            setCallStateSafe("ringing");
          }

          if (pcRef.current && pcRef.current.signalingState !== "closed") {
            try {
              await pcRef.current.setRemoteDescription(payload.sdp);

              if (pcRef.current.signalingState === "have-remote-offer") {
                const answer = await pcRef.current.createAnswer();
                await pcRef.current.setLocalDescription(answer);
                await sendRequiredSignal({
                  type: "answer",
                  from: myUserId,
                  sdp: answer,
                  callType: payload.callType ?? "voice",
                });
              }

              await flushPendingIce(pcRef.current);
            } catch (error) {
              console.error("Error handling offer:", error);
              rejectCall("error");
              setCallError("Could not connect this call.");
            }
          } else {
            pendingOffer.current = payload.sdp;
          }
          return;

        case "answer":
          if (!payload.sdp || !pcRef.current) return;
          try {
            await pcRef.current.setRemoteDescription(payload.sdp);
            await flushPendingIce(pcRef.current);
          } catch (error) {
            console.error("Error handling answer:", error);
            hangUp();
            setCallError("The call connection could not be completed.");
          }
          return;

        case "ice":
          if (!payload.candidate) return;

          if (pcRef.current?.remoteDescription) {
            try {
              await pcRef.current.addIceCandidate(payload.candidate);
            } catch (error) {
              console.warn("ICE add failed:", error);
            }
          } else {
            pendingCandidates.current.push(payload.candidate);
          }
          return;
      }
    });

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        channelReadyRef.current = true;
        channelReadyResolveRef.current?.();
        channelReadyResolveRef.current = null;
        channelReadyRejectRef.current = null;
      }
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        channelReadyRef.current = false;
        channelReadyRejectRef.current?.(new Error(`Call channel status: ${status}`));
        channelReadyResolveRef.current = null;
        channelReadyRejectRef.current = null;
        if (status !== "CLOSED") {
          resetChannelReadyPromise();
        }
      }
    });

    channelRef.current = channel;

    return () => {
      channelReadyRef.current = false;
      channelReadyRejectRef.current?.(new Error("Call channel closed."));
      channelReadyResolveRef.current = null;
      channelReadyRejectRef.current = null;
      channelReadyPromiseRef.current = null;
      cleanup();
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [
    channelName,
    cleanup,
    enabled,
    flushPendingIce,
    hangUp,
    myUserId,
    partnerUserId,
    rejectCall,
    resetChannelReadyPromise,
    sendSignal,
    sendRequiredSignal,
    setCallStateSafe,
    stopUnansweredTimer,
  ]);

  return {
    callState,
    callType,
    incomingCallType,
    localStream,
    remoteStream,
    startCall,
    acceptCall,
    rejectCall,
    hangUp,
    isMuted,
    isSpeaker,
    toggleMute,
    toggleSpeaker,
    flipCamera,
    isFrontCamera,
    connectedAt,
    partnerOnline,
    callError,
    clearCallError,
  };
}
