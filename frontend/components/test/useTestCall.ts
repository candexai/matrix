"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { VoiceConversation } from "@elevenlabs/client";
import { getSignedUrl } from "@/hooks/api";
import { errorMessage } from "@/lib/api";

export type CallStatus = "idle" | "connecting" | "connected" | "disconnecting" | "ended";
export type CallMode = "listening" | "speaking";
export interface TranscriptItem {
  id: number;
  role: "user" | "agent";
  text: string;
  at: number;
}

function friendlyStartError(err: unknown): string {
  const e = err as { name?: string; message?: string } | undefined;
  const msg = e?.message ?? "";
  if (e?.name === "NotAllowedError" || /permission denied|not allowed/i.test(msg)) return "Microphone access was denied. Allow the microphone for this site in your browser and try again.";
  if (e?.name === "NotFoundError" || /no audio input|requested device not found/i.test(msg)) return "No microphone found. Plug one in or check your input settings.";
  if (e?.name === "NotReadableError") return "The microphone is busy in another app.";
  return errorMessage(err);
}

export function useTestCall() {
  const convRef = useRef<VoiceConversation | null>(null);
  const seq = useRef(0);
  const startedAt = useRef<number | null>(null);

  const [status, setStatus] = useState<CallStatus>("idle");
  const [mode, setMode] = useState<CallMode>("listening");
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [speakerMuted, setSpeakerMuted] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [endReason, setEndReason] = useState<"user" | "agent" | "error" | null>(null);

  // timer
  useEffect(() => {
    if (status !== "connected") return;
    startedAt.current ??= Date.now();
    const tick = () => setElapsed(Math.floor((Date.now() - (startedAt.current ?? Date.now())) / 1000));
    tick();
    const t = setInterval(tick, 500);
    return () => clearInterval(t);
  }, [status]);

  // apply mute states to the live session
  useEffect(() => {
    convRef.current?.setVolume({ volume: speakerMuted ? 0 : 1 });
  }, [speakerMuted]);
  useEffect(() => {
    convRef.current?.setMicMuted(micMuted);
  }, [micMuted]);

  // end the session if the page unmounts mid-call
  useEffect(
    () => () => {
      convRef.current?.endSession().catch(() => undefined);
      convRef.current = null;
    },
    []
  );

  const reset = useCallback(() => {
    setStatus("idle");
    setMode("listening");
    setTranscript([]);
    setConversationId(null);
    setElapsed(0);
    setSpeakerMuted(false);
    setMicMuted(false);
    setLastError(null);
    setEndReason(null);
    startedAt.current = null;
  }, []);

  const start = useCallback(
    async (agentId: string, dynamicVariables: Record<string, string>) => {
      if (convRef.current) return;
      reset();
      setStatus("connecting");
      try {
        const { signed_url } = await getSignedUrl(agentId);
        const { VoiceConversation: VC } = await import("@elevenlabs/client");
        const vars: Record<string, string> = {};
        for (const [k, v] of Object.entries(dynamicVariables)) if (k.trim() && String(v).trim()) vars[k.trim()] = String(v);

        const conv = await VC.startSession({
          signedUrl: signed_url,
          connectionType: "websocket",
          dynamicVariables: vars,
          onConnect: ({ conversationId: cid }) => {
            setConversationId(cid);
            setStatus("connected");
          },
          onDisconnect: (details) => {
            convRef.current = null;
            setStatus("ended");
            if (details.reason === "error") {
              setLastError(details.message || "The connection dropped.");
              setEndReason("error");
            } else {
              setEndReason(details.reason);
            }
          },
          onMessage: ({ message, role }) => {
            if (!message) return;
            setTranscript((t) => [...t, { id: ++seq.current, role, text: message, at: Date.now() }]);
          },
          onError: (message) => setLastError(message || "Something went wrong during the call."),
          onStatusChange: ({ status: s }) => {
            if (s === "connected") setStatus("connected");
            else if (s === "connecting") setStatus("connecting");
            else if (s === "disconnecting") setStatus("disconnecting");
          },
          onModeChange: ({ mode: m }) => setMode(m),
        });
        convRef.current = conv;
        setConversationId((cur) => cur ?? conv.getId());
      } catch (err) {
        convRef.current = null;
        setStatus("idle");
        const msg = friendlyStartError(err);
        setLastError(msg);
        throw new Error(msg);
      }
    },
    [reset]
  );

  const end = useCallback(async () => {
    const c = convRef.current;
    if (!c) return;
    setStatus("disconnecting");
    try {
      await c.endSession();
    } catch {
      /* ignore */
    } finally {
      convRef.current = null;
      setStatus("ended");
      setEndReason((r) => r ?? "user");
    }
  }, []);

  return {
    status,
    mode,
    transcript,
    conversationId,
    elapsed,
    speakerMuted,
    micMuted,
    lastError,
    endReason,
    start,
    end,
    reset,
    toggleSpeaker: () => setSpeakerMuted((m) => !m),
    toggleMic: () => setMicMuted((m) => !m),
  };
}
