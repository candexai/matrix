"use client";
import { Bot, FileText, User, Wrench } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import type { TranscriptTurn } from "@/lib/types";
import { cn, formatDuration } from "@/lib/utils";
import { toolCallName } from "./helpers";

function Turn({ turn, agentLabel }: { turn: TranscriptTurn; agentLabel: string }) {
  const isAgent = turn.role === "agent";
  const isUser = turn.role === "user";
  const tools = Array.isArray(turn.toolCalls) ? turn.toolCalls : [];
  const hasTime = typeof turn.timeInCallSecs === "number";

  if (!isAgent && !isUser) {
    return (
      <li className="flex justify-center">
        <span className="rounded-full bg-muted px-3 py-1 text-[11.5px] text-muted-foreground">
          {turn.role}: {turn.message}
        </span>
      </li>
    );
  }

  return (
    <li className={cn("flex gap-2.5", isUser && "flex-row-reverse")}>
      <div className={cn("mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full", isAgent ? "bg-accent-tint text-primary-hover" : "bg-muted text-muted-foreground")} aria-hidden>
        {isAgent ? <Bot className="size-4" strokeWidth={1.8} /> : <User className="size-4" strokeWidth={1.8} />}
      </div>
      <div className={cn("flex max-w-[78%] flex-col gap-1", isUser && "items-end")}>
        {turn.message ? (
          <div className={cn("whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-[14px] leading-relaxed", isAgent ? "rounded-tl-sm bg-accent-tint/50 text-foreground" : "rounded-tr-sm bg-muted text-foreground")}>{turn.message}</div>
        ) : null}
        {tools.length ? (
          <div className={cn("flex flex-wrap gap-1", isUser && "justify-end")}>
            {tools.map((t, i) => (
              <span key={i} className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/60 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                <Wrench className="size-3" /> {toolCallName(t)}
              </span>
            ))}
          </div>
        ) : null}
        <span className="px-1 text-[11px] text-muted-foreground">
          {isAgent ? agentLabel : "Caller"}
          {hasTime ? <> · {formatDuration(turn.timeInCallSecs)}</> : null}
        </span>
      </div>
    </li>
  );
}

export function Transcript({ turns, agentLabel = "Agent" }: { turns: TranscriptTurn[]; agentLabel?: string }) {
  if (!turns?.length) {
    return <EmptyState icon={FileText} title="Transcript not available yet" description="Transcripts arrive once the call ends and ElevenLabs finishes processing. Use “Refresh from ElevenLabs” if it has been a while." className="py-10" />;
  }
  return (
    <ol className="space-y-4">
      {turns.map((t, i) => (
        <Turn key={i} turn={t} agentLabel={agentLabel} />
      ))}
    </ol>
  );
}
