"use client";
import Link from "next/link";
import { useState } from "react";
import { AudioWaveform, Copy, Cpu, Ellipsis, Languages, MicVocal, Pencil, Phone, PlayCircle, RefreshCw, Trash2, Webhook } from "lucide-react";
import { toast } from "sonner";
import type { Agent, Catalog, Voice } from "@/lib/types";
import { cn, formatNumber, initials, relativeTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tip } from "@/components/ui/tooltip";
import { optionLabel, voiceName } from "./agent-utils";
import { PreviewCallDialog } from "./PreviewCallDialog";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-2 py-2.5">
      <div className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground">{label}</div>
      <div className="mt-0.5 truncate text-[14px] font-medium tabular-nums">{value}</div>
    </div>
  );
}

export function AgentCard({ agent, catalog, voices, onSync, onDelete, syncing }: { agent: Agent; catalog?: Catalog; voices?: Voice[]; onSync: (a: Agent) => void; onDelete: (a: Agent) => void; syncing?: boolean }) {
  const cfg = agent.config ?? ({} as Agent["config"]);
  const webhookOn = Boolean(agent.postCallWebhook?.webhookId);
  const [preview, setPreview] = useState(false);
  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(agent.elevenAgentId);
      toast.success("Agent ID copied");
    } catch {
      toast.error("Couldn't copy to clipboard");
    }
  };

  return (
    <Card className="flex flex-col transition-shadow hover:shadow-md animate-fade-up">
      <div className="flex items-start gap-3 p-5 pb-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent-tint font-heading text-[15px] text-primary-hover">{initials(agent.name)}</div>
        <div className="min-w-0 flex-1">
          <Link href={`/agents/${agent._id}`} className="block truncate font-heading text-[17px] leading-tight transition-colors hover:text-primary">
            {agent.name}
          </Link>
          <p className="mt-0.5 line-clamp-2 text-[13px] leading-5 text-muted-foreground">{agent.description || cfg.first_message || "No description"}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" aria-label="More actions" className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              <Ellipsis className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onSelect={() => onSync(agent)} disabled={syncing}>
              <RefreshCw className={cn(syncing && "animate-spin")} /> Sync from ElevenLabs
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={copyId}>
              <Copy /> Copy agent ID
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onSelect={() => onDelete(agent)}>
              <Trash2 /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex flex-wrap gap-1.5 px-5">
        <Badge variant="outline">
          <Languages /> {optionLabel(catalog?.languages, cfg.language, cfg.language || "—")}
        </Badge>
        <Badge variant="outline">
          <Cpu /> {optionLabel(catalog?.llmModels, cfg.llm, cfg.llm || "—")}
        </Badge>
        <Badge variant="outline">
          <AudioWaveform /> {optionLabel(catalog?.ttsModels, cfg.tts_model_id, cfg.tts_model_id || "—")}
        </Badge>
        <Tip label={cfg.voice_id ? `Voice ID ${cfg.voice_id}` : "No voice selected"}>
          <Badge variant="outline">
            <MicVocal /> {voiceName(voices, cfg.voice_id)}
          </Badge>
        </Tip>
        <Badge variant={webhookOn ? "success" : "secondary"}>
          <Webhook /> {webhookOn ? "Webhook on" : "Webhook off"}
        </Badge>
      </div>

      <div className="mx-5 mt-4 grid grid-cols-3 divide-x divide-border rounded-lg border border-border bg-muted/40 text-center">
        <Stat label="Calls" value={formatNumber(agent.callCount)} />
        <Stat label="Last call" value={relativeTime(agent.lastCallAt)} />
        <Stat label="Updated" value={relativeTime(agent.updatedAt)} />
      </div>

      <div className="mt-4 flex items-center gap-2 border-t border-border px-5 py-3">
        <Link href={`/agents/${agent._id}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "flex-1")}>
          <Pencil /> Edit
        </Link>
        <Tip label="Talk to the agent in your browser (web call)">
          <button type="button" onClick={() => setPreview(true)} className={cn(buttonVariants({ variant: "soft", size: "sm" }), "flex-1")}>
            <PlayCircle /> Preview
          </button>
        </Tip>
        <Tip label="Telephonic test: ring a real phone number">
          <Link href={`/test?agent=${agent._id}`} className={cn(buttonVariants({ variant: "default", size: "sm" }), "flex-1")}>
            <Phone /> AI Test
          </Link>
        </Tip>
      </div>
      <PreviewCallDialog agent={preview ? agent : null} open={preview} onOpenChange={setPreview} />
    </Card>
  );
}
