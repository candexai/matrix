"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, AudioWaveform, Bot, Ear, LoaderCircle, Mic, MicOff, Phone, PhoneOff, RefreshCw, TriangleAlert, User, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api";
import type { Agent } from "@/lib/types";
import { cn, formatDuration } from "@/lib/utils";
import { CopyButton } from "@/components/agents/CopyButton";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Tip } from "@/components/ui/tooltip";
import type { useTestCall } from "./useTestCall";

type Call = ReturnType<typeof useTestCall>;

function statusText(status: Call["status"], mode: Call["mode"]): string {
  switch (status) {
    case "idle":
      return "Ready to call";
    case "connecting":
      return "Connecting…";
    case "connected":
      return mode === "speaking" ? "Agent is speaking" : "Listening to you";
    case "disconnecting":
      return "Ending call…";
    case "ended":
      return "Call ended";
  }
}

function Orb({ status, mode }: { status: Call["status"]; mode: Call["mode"] }) {
  const live = status === "connected";
  const speaking = live && mode === "speaking";
  const Icon = status === "connecting" ? LoaderCircle : status === "ended" ? PhoneOff : status === "idle" ? Phone : speaking ? AudioWaveform : Ear;
  return (
    <div className="relative flex size-48 items-center justify-center">
      {speaking ? <span className="absolute inset-4 rounded-full animate-pulse-ring" /> : null}
      {live && !speaking ? <span className="absolute inset-2 rounded-full border-2 border-dashed border-primary/40 [animation:spin_14s_linear_infinite]" /> : null}
      <div
        className={cn(
          "flex size-36 items-center justify-center rounded-full border-4 transition-all duration-300",
          status === "idle" && "border-border bg-muted/60 text-muted-foreground",
          status === "ended" && "border-border bg-muted/40 text-muted-foreground",
          status === "connecting" && "animate-pulse border-primary/40 bg-accent-tint text-primary-hover",
          status === "disconnecting" && "border-border bg-muted/60 text-muted-foreground",
          live && !speaking && "border-primary/60 bg-accent-tint text-primary-hover",
          speaking && "scale-105 border-primary brand-gradient text-white shadow-lg"
        )}
      >
        <Icon className={cn("size-12", status === "connecting" && "animate-spin")} strokeWidth={1.5} />
      </div>
    </div>
  );
}

export function CallPanel({ call, agent, dynamicVariables }: { call: Call; agent?: Agent; dynamicVariables: Record<string, string> }) {
  const { status, mode, transcript, conversationId, elapsed, speakerMuted, micMuted, lastError, endReason } = call;
  const inCall = status === "connecting" || status === "connected" || status === "disconnecting";
  const [starting, setStarting] = useState(false);
  const qc = useQueryClient();

  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [transcript.length, mode]);

  const syncMut = useMutation({
    mutationFn: () => api.post<{ scanned: number; upserted: number; skipped: number; errors: string[] }>("/conversations/sync", { agentId: agent?.elevenAgentId, sinceHours: 1 }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      qc.invalidateQueries({ queryKey: ["agents"] });
      if (r.upserted > 0) toast.success(`Synced ${r.upserted} conversation${r.upserted === 1 ? "" : "s"} from ElevenLabs`);
      else toast.info("Nothing new yet — ElevenLabs may still be processing the call. Try again in a few seconds.");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  // Auto-save the call once it ends: ElevenLabs finalises transcript/analysis a few seconds after
  // hang-up. Idempotent with the post-call webhook.
  const [autoSaved, setAutoSaved] = useState(false);
  useEffect(() => {
    if (status !== "ended" || !conversationId || !agent) {
      if (status !== "ended") setAutoSaved(false);
      return;
    }
    let cancelled = false;
    let attempts = 0;
    const run = async () => {
      while (!cancelled && attempts < 12) {
        attempts++;
        await new Promise((r) => setTimeout(r, attempts === 1 ? 2500 : 5000));
        if (cancelled) return;
        try {
          await api.post("/conversations/sync", { agentId: agent.elevenAgentId, sinceHours: 1 });
          const c = await api.get<{ status: string; transcript?: unknown[] }>(`/conversations/${conversationId}`).catch(() => null);
          if (c && c.status === "done" && (c.transcript?.length ?? 0) > 0) {
            qc.invalidateQueries({ queryKey: ["conversations"] });
            setAutoSaved(true);
            return;
          }
        } catch {
          /* retry */
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [status, conversationId, agent, qc]);

  const onStart = async () => {
    if (!agent) return;
    setStarting(true);
    try {
      await call.start(agent._id, dynamicVariables);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-border bg-card shadow-xs">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="flex items-center gap-2">
            <span className={cn("size-2 rounded-full", status === "connected" ? "bg-emerald-500" : status === "connecting" || status === "disconnecting" ? "bg-amber-500" : "bg-zinc-400")} />
            <span className="text-sm font-medium">{statusText(status, mode)}</span>
          </div>
          <span className={cn("font-mono text-sm tabular-nums", status === "connected" ? "text-foreground" : "text-muted-foreground")}>{formatDuration(elapsed)}</span>
        </div>

        <div className="flex flex-col items-center gap-5 px-5 py-8">
          <Orb status={status} mode={mode} />
          <div className="text-center">
            <div className="font-heading text-[20px]">{agent?.name ?? "Select an agent"}</div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {status === "idle" && "Talk to the agent in your browser exactly as a lead would on the phone."}
              {status === "connecting" && "Fetching a signed session and opening your microphone…"}
              {status === "connected" && (mode === "speaking" ? "Interrupt any time — the agent will stop and listen." : "Go ahead, say something.")}
              {status === "disconnecting" && "Hanging up…"}
              {status === "ended" && (endReason === "error" ? "The call ended because of an error." : endReason === "agent" ? "The agent ended the call." : "You ended the call.")}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {inCall ? (
              <>
                <Tip label={micMuted ? "Unmute microphone" : "Mute microphone"}>
                  <Button variant={micMuted ? "destructive" : "outline"} size="icon" onClick={call.toggleMic} aria-label="Toggle microphone" disabled={status !== "connected"}>
                    {micMuted ? <MicOff /> : <Mic />}
                  </Button>
                </Tip>
                <Button variant="destructive" size="lg" onClick={call.end} loading={status === "disconnecting"}>
                  {status !== "disconnecting" ? <PhoneOff /> : null} End call
                </Button>
                <Tip label={speakerMuted ? "Unmute agent audio" : "Mute agent audio"}>
                  <Button variant={speakerMuted ? "destructive" : "outline"} size="icon" onClick={call.toggleSpeaker} aria-label="Toggle speaker" disabled={status !== "connected"}>
                    {speakerMuted ? <VolumeX /> : <Volume2 />}
                  </Button>
                </Tip>
              </>
            ) : status === "ended" ? (
              <>
                <Button variant="outline" onClick={call.reset}>
                  <RefreshCw /> New call
                </Button>
                <Button onClick={onStart} loading={starting} disabled={!agent}>
                  {!starting ? <Phone /> : null} Call again
                </Button>
              </>
            ) : (
              <Button size="lg" onClick={onStart} loading={starting} disabled={!agent} className="min-w-40">
                {!starting ? <Phone /> : null} Start call
              </Button>
            )}
          </div>

          {lastError && status !== "connecting" ? (
            <div className="flex w-full max-w-md items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              <span>{lastError}</span>
            </div>
          ) : null}
        </div>
      </div>

      {status === "ended" && conversationId ? (
        <div className="rounded-xl border border-border bg-card p-5 shadow-xs animate-fade-up">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-medium">Conversation recorded in ElevenLabs</div>
              <div className="mt-1 inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 py-0.5 pl-2 pr-0.5 font-mono text-xs">
                {conversationId}
                <CopyButton value={conversationId} label="Copy conversation ID" size="xs" />
              </div>
              <p className="mt-2 max-w-md text-xs text-muted-foreground">{autoSaved ? "Saved to Conversations with transcript and analysis." : "Saving to Conversations automatically once ElevenLabs finishes processing (a few seconds)…"}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              <Button variant="outline" onClick={() => syncMut.mutate()} loading={syncMut.isPending} disabled={!agent}>
                {!syncMut.isPending ? <RefreshCw /> : null} Sync conversation now
              </Button>
              {syncMut.isSuccess || autoSaved ? (
                <Link href={`/conversations?id=${encodeURIComponent(conversationId)}`} className={cn(buttonVariants({ variant: "soft", size: "sm" }))}>
                  Open in Conversations <ArrowUpRight />
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex min-h-[260px] flex-col rounded-xl border border-border bg-card shadow-xs">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <span className="text-sm font-medium">Live transcript</span>
          <Badge variant="secondary">{transcript.length} turns</Badge>
        </div>
        <div ref={listRef} className="flex max-h-[420px] flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">
          {transcript.length === 0 ? (
            <p className="m-auto text-center text-sm text-muted-foreground">{inCall ? "Waiting for the first words…" : "Turns appear here as you and the agent speak."}</p>
          ) : (
            transcript.map((t) => (
              <div key={t.id} className={cn("flex items-end gap-2 animate-fade-up", t.role === "user" ? "flex-row-reverse" : "")}>
                <div className={cn("flex size-6 shrink-0 items-center justify-center rounded-full", t.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                  {t.role === "user" ? <User className="size-3.5" /> : <Bot className="size-3.5" />}
                </div>
                <div className={cn("max-w-[78%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed", t.role === "user" ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-muted")}>
                  {t.text}
                  <div className={cn("mt-1 text-[10px] tabular-nums", t.role === "user" ? "text-primary-foreground/70" : "text-muted-foreground")}>{new Date(t.at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", second: "2-digit" })}</div>
                </div>
              </div>
            ))
          )}
          {status === "connected" && mode === "speaking" ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="flex gap-0.5">
                <span className="size-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.2s]" />
                <span className="size-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.1s]" />
                <span className="size-1.5 animate-bounce rounded-full bg-primary" />
              </span>
              Agent speaking
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
