"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { VoiceConversation } from "@elevenlabs/client";
import { Bot, Mic, MicOff, PhoneOff, Play, User, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import type { Agent } from "@/lib/types";
import { api, errorMessage } from "@/lib/api";
import { getSignedUrl } from "@/hooks/api";
import { cn, formatDuration } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Status = "idle" | "connecting" | "connected" | "disconnecting" | "ended";
interface Turn {
  id: number;
  role: "user" | "agent";
  text: string;
}

function friendlyError(err: unknown): string {
  const e = err as { name?: string; message?: string } | undefined;
  const msg = e?.message ?? "";
  if (e?.name === "NotAllowedError" || /permission denied|not allowed/i.test(msg)) return "Microphone access was denied. Allow the microphone for this site and try again.";
  if (e?.name === "NotFoundError" || /no audio input|requested device not found/i.test(msg)) return "No microphone found.";
  return errorMessage(err);
}

/** In-browser web call with an agent (ElevenLabs signed-URL WebSocket session). */
export function PreviewCallDialog({ agent, open, onOpenChange }: { agent: Agent | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const convRef = useRef<VoiceConversation | null>(null);
  const seq = useRef(0);
  const startedAt = useRef<number | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const [status, setStatus] = useState<Status>("idle");
  const [mode, setMode] = useState<"listening" | "speaking">("listening");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [micMuted, setMicMuted] = useState(false);
  const [speakerMuted, setSpeakerMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncedId, setSyncedId] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "connected") return;
    startedAt.current ??= Date.now();
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - (startedAt.current ?? Date.now())) / 1000)), 500);
    return () => clearInterval(t);
  }, [status]);
  useEffect(() => convRef.current?.setMicMuted(micMuted), [micMuted]);
  useEffect(() => convRef.current?.setVolume({ volume: speakerMuted ? 0 : 1 }), [speakerMuted]);
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [turns.length]);

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
    }
  }, []);

  // end the call when the dialog closes / unmounts
  useEffect(() => {
    if (!open) {
      void end();
      setStatus("idle");
      setTurns([]);
      setElapsed(0);
      setConversationId(null);
      setError(null);
      setSyncedId(null);
      setAutoSaved(false);
      startedAt.current = null;
    }
  }, [open, end]);
  useEffect(() => () => void end(), [end]);

  const start = useCallback(async () => {
    if (!agent || convRef.current) return;
    setError(null);
    setTurns([]);
    setStatus("connecting");
    try {
      const { signed_url } = await getSignedUrl(agent._id);
      const { VoiceConversation: VC } = await import("@elevenlabs/client");
      const placeholders = agent.config?.dynamic_variable_placeholders ?? {};
      const conv = await VC.startSession({
        signedUrl: signed_url,
        connectionType: "websocket",
        dynamicVariables: { ...placeholders, name: placeholders.name || "there", test_call: "true" },
        onConnect: ({ conversationId: cid }) => {
          setConversationId(cid);
          setStatus("connected");
        },
        onDisconnect: (details) => {
          convRef.current = null;
          setStatus("ended");
          if (details.reason === "error") setError(details.message || "The connection dropped.");
        },
        onMessage: ({ message, role }) => {
          if (message) setTurns((t) => [...t, { id: ++seq.current, role, text: message }]);
        },
        onError: (message) => setError(message || "Something went wrong during the call."),
        onModeChange: ({ mode: m }) => setMode(m),
        onStatusChange: ({ status: s }) => {
          if (s === "connected") setStatus("connected");
          else if (s === "disconnecting") setStatus("disconnecting");
        },
      });
      convRef.current = conv;
      setConversationId((cur) => cur ?? conv.getId());
    } catch (err) {
      convRef.current = null;
      setStatus("idle");
      const msg = friendlyError(err);
      setError(msg);
      toast.error(msg);
    }
  }, [agent]);

  const syncNow = useCallback(
    async (opts: { quiet?: boolean } = {}): Promise<boolean> => {
      if (!agent) return false;
      setSyncing(true);
      try {
        await api.post("/conversations/sync", { agentId: agent.elevenAgentId, sinceHours: 1 });
        if (conversationId) {
          const c = await api.get<{ _id: string; status: string; transcript?: unknown[] }>(`/conversations/${conversationId}`).catch(() => null);
          if (c) setSyncedId(c._id);
          const complete = Boolean(c && c.status === "done" && (c.transcript?.length ?? 0) > 0);
          if (!opts.quiet) toast.success(complete ? "Conversation saved" : "Call is still processing on ElevenLabs — try again in a moment");
          return complete;
        }
        if (!opts.quiet) toast.success("Conversations synced");
        return true;
      } catch (err) {
        if (!opts.quiet) toast.error(errorMessage(err));
        return false;
      } finally {
        setSyncing(false);
      }
    },
    [agent, conversationId]
  );

  // After the call ends, pull it into Conversations automatically (ElevenLabs finishes the
  // transcript/analysis a few seconds after hang-up). The post-call webhook does the same when it
  // can reach this server; syncing is idempotent.
  const [autoSaved, setAutoSaved] = useState(false);
  useEffect(() => {
    if (status !== "ended" || !conversationId || !open) return;
    let cancelled = false;
    let attempts = 0;
    const run = async () => {
      while (!cancelled && attempts < 12) {
        attempts++;
        await new Promise((r) => setTimeout(r, attempts === 1 ? 2500 : 5000));
        if (cancelled) return;
        const ok = await syncNow({ quiet: true });
        if (ok) {
          setAutoSaved(true);
          return;
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [status, conversationId, open, syncNow]);

  const live = status === "connected" || status === "connecting" || status === "disconnecting";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" className="max-h-[88svh]">
        <DialogHeader>
          <DialogTitle>Preview · {agent?.name ?? "Agent"}</DialogTitle>
          <DialogDescription>Talk to the agent in your browser. Uses your microphone; nothing is dialled.</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          <div className="flex items-center justify-between rounded-xl border border-border bg-muted/40 px-4 py-3">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "flex size-12 items-center justify-center rounded-full border-2 transition-colors",
                  status === "connected" && mode === "speaking" && "border-primary bg-accent-tint animate-pulse-ring",
                  status === "connected" && mode === "listening" && "border-emerald-500/60 bg-emerald-50 dark:bg-emerald-950/30",
                  status === "connecting" && "border-amber-400 bg-amber-50 dark:bg-amber-950/30",
                  (status === "idle" || status === "ended") && "border-border bg-card"
                )}
              >
                <Bot className={cn("size-5", status === "connected" ? "text-primary" : "text-muted-foreground")} />
              </div>
              <div>
                <div className="text-sm font-medium">
                  {status === "idle" && "Ready to start"}
                  {status === "connecting" && "Connecting…"}
                  {status === "connected" && (mode === "speaking" ? "Agent is speaking" : "Listening to you")}
                  {status === "disconnecting" && "Ending…"}
                  {status === "ended" && "Call ended"}
                </div>
                <div className="text-xs text-muted-foreground tabular-nums">{formatDuration(elapsed)}{conversationId ? ` · ${conversationId}` : ""}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {live ? (
                <>
                  <Button variant="outline" size="icon-sm" onClick={() => setMicMuted((m) => !m)} aria-label={micMuted ? "Unmute microphone" : "Mute microphone"}>
                    {micMuted ? <MicOff /> : <Mic />}
                  </Button>
                  <Button variant="outline" size="icon-sm" onClick={() => setSpeakerMuted((m) => !m)} aria-label={speakerMuted ? "Unmute speaker" : "Mute speaker"}>
                    {speakerMuted ? <VolumeX /> : <Volume2 />}
                  </Button>
                  <Button variant="destructive" size="sm" onClick={end} loading={status === "disconnecting"}>
                    <PhoneOff /> End
                  </Button>
                </>
              ) : (
                <Button size="sm" onClick={start} disabled={!agent}>
                  <Play /> {status === "ended" ? "Start again" : "Start web call"}
                </Button>
              )}
            </div>
          </div>

          {error ? <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</div> : null}

          <div ref={listRef} className="min-h-[220px] max-h-[40svh] overflow-y-auto rounded-xl border border-border bg-card p-3">
            {turns.length === 0 ? (
              <div className="flex h-[200px] flex-col items-center justify-center text-center text-sm text-muted-foreground">
                <Mic className="mb-2 size-5" />
                {status === "connected" ? "Say hello — the transcript appears here." : "Start the web call to hear the agent's first message."}
              </div>
            ) : (
              <ul className="space-y-2">
                {turns.map((t) => (
                  <li key={t.id} className={cn("flex gap-2", t.role === "user" ? "justify-end" : "justify-start")}>
                    {t.role === "agent" ? <Bot className="mt-1 size-4 shrink-0 text-primary" /> : null}
                    <div className={cn("max-w-[80%] rounded-2xl px-3 py-2 text-sm", t.role === "agent" ? "bg-accent-tint/60 text-foreground" : "bg-muted")}>{t.text}</div>
                    {t.role === "user" ? <User className="mt-1 size-4 shrink-0 text-muted-foreground" /> : null}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {status === "ended" ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
              <span className="text-muted-foreground">
                {autoSaved ? "Saved to Conversations with transcript and analysis." : syncing ? "Saving the call to Conversations…" : "Waiting for ElevenLabs to finish processing the call…"}
              </span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => void syncNow()} loading={syncing}>
                  {autoSaved ? "Refresh" : "Sync now"}
                </Button>
                {syncedId ? (
                  <Link href={`/conversations?id=${syncedId}`} className={buttonVariants({ variant: "soft", size: "sm" })}>
                    Open conversation
                  </Link>
                ) : null}
                <Badge variant="secondary">web call</Badge>
              </div>
            </div>
          ) : null}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
