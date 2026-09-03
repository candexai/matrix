"use client";
import Link from "next/link";
import { AudioWaveform, Phone, Settings2, Unplug, ArrowUpRight, Layers, Sparkles } from "lucide-react";
import type { LeadAgentBinding, PhoneNumber } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { providerLabel } from "./AgentPhonePickers";

export interface BindingBannerProps {
  binding?: LeadAgentBinding | null;
  loading?: boolean;
  phone?: PhoneNumber;
  phonesLoading?: boolean;
  /** "default" = the workspace-wide binding; "list" = the binding of one lead table. */
  scope?: "default" | "list";
  listName?: string;
  onConfigure: () => void;
  onDetach: () => void;
  /** List scope only: open the default-agent dialog (shown when the list inherits the default). */
  onManageDefault?: () => void;
  /** Opens the "Generate agent with AI" wizard (second CTA when nothing is attached). */
  onGenerate?: () => void;
  /** Marks the bound agent as AI-generated. */
  aiGenerated?: boolean;
}

export function BindingBanner({ binding, loading, phone, phonesLoading, scope = "default", listName, onConfigure, onDetach, onManageDefault, onGenerate, aiGenerated }: BindingBannerProps) {
  if (loading) {
    return (
      <div className="px-7 pb-4">
        <Skeleton className="h-[74px] w-full rounded-xl" />
      </div>
    );
  }

  const isList = scope === "list";
  const name = listName || "this list";

  if (!binding) {
    return (
      <div className="px-7 pb-4">
        <div className="group flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-3 transition-colors hover:border-primary/50 hover:bg-accent-tint/30">
          <button type="button" onClick={onConfigure} className="flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline-none">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground group-hover:text-primary">
              <AudioWaveform className="size-4" strokeWidth={1.7} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{isList ? `No voice agent attached to ${name}` : "No default voice agent"}</span>
              <span className="block text-[13px] text-muted-foreground">
                {isList ? "Attach one to call leads from this table and fill in missing details automatically." : "Used by every table without its own agent. Attach one to start calling leads and filling in missing details."}
                {onGenerate ? " Or let AI write one from your table's columns." : ""}
              </span>
            </span>
          </button>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {onGenerate ? (
              <Button variant="secondary" size="sm" onClick={onGenerate}>
                <Sparkles /> Generate with AI
              </Button>
            ) : null}
            <Button size="sm" onClick={onConfigure}>
              <AudioWaveform /> {isList ? "Attach agent" : "Attach default agent"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const agentName = binding.agent?.name ?? "Voice agent";
  const agentHref = `/agents/${binding.agent?._id ?? binding.agentId}`;

  if (isList && binding.inherited) {
    return (
      <div className="px-7 pb-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl border border-border bg-muted/30 px-4 py-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground">
            <Layers className="size-4" strokeWidth={1.7} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-1.5 text-sm">
              <span className="text-muted-foreground">Using default agent</span>
              <Link href={agentHref} className="inline-flex items-center gap-1 font-heading text-[15px] leading-tight hover:underline">
                {agentName}
                <ArrowUpRight className="size-3.5 text-muted-foreground" />
              </Link>
              {!binding.active ? <Badge variant="warning">Paused</Badge> : null}
            </div>
            <div className="text-[13px] text-muted-foreground">
              Attach a list-specific agent to override it for {name}.
              {binding.fields.length ? ` Currently collects ${binding.fields.length} field${binding.fields.length === 1 ? "" : "s"}.` : ""}
            </div>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {onGenerate ? (
              <Button variant="secondary" size="sm" onClick={onGenerate}>
                <Sparkles /> Generate with AI
              </Button>
            ) : null}
            <Button size="sm" onClick={onConfigure}>
              <AudioWaveform /> Attach for this list
            </Button>
            {onManageDefault ? (
              <Button variant="outline" size="sm" onClick={onManageDefault}>
                <Settings2 /> Manage default
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-7 pb-4">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-xl border border-primary/30 bg-accent-tint/40 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <AudioWaveform className="size-4" strokeWidth={1.8} />
          </span>
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">{isList ? `Agent for ${name}` : "Default voice agent"}</div>
            <div className="flex items-center gap-1.5">
              <Link href={agentHref} className="truncate font-heading text-[16px] leading-tight hover:underline">
                {agentName}
              </Link>
              <ArrowUpRight className="size-3.5 text-muted-foreground" />
              {aiGenerated ? (
                <Badge variant="violet" title="Generated with AI">
                  <Sparkles /> AI
                </Badge>
              ) : null}
              {!binding.active ? <Badge variant="warning">Paused</Badge> : null}
            </div>
            <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
              <Phone className="size-3.5" />
              {phonesLoading ? (
                <Skeleton className="h-3.5 w-32" />
              ) : phone ? (
                <span className="truncate">
                  {phone.label ? `${phone.label} · ` : ""}
                  <span className="font-mono">{phone.phone_number}</span>
                  {phone.provider ? ` · ${providerLabel(phone.provider)}` : ""}
                </span>
              ) : binding.phoneNumberId ? (
                <span className="font-mono">{binding.phoneNumberId}</span>
              ) : (
                <span>Automatic number</span>
              )}
            </div>
          </div>
        </div>

        <div className="hidden h-8 w-px bg-primary/20 sm:block" />

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          {!isList ? <div className="text-[13px] text-muted-foreground">Used by every list without its own agent.</div> : null}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Collects</span>
            {binding.fields.length ? (
              binding.fields.map((f) => (
                <Badge key={f.zohoField} variant="outline" className="bg-card">
                  {f.label}
                </Badge>
              ))
            ) : (
              <span className="text-xs text-muted-foreground">no fields yet</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {binding.onlyFillEmpty ? <Badge variant="soft">Only fill empty fields</Badge> : <Badge variant="warning">Overwrites existing values</Badge>}
            {binding.pushToZoho ? <Badge variant="soft">Push to Zoho</Badge> : <Badge variant="secondary">Local only</Badge>}
            {binding.updateLeadStatusTo ? <Badge variant="soft">Set status → {binding.updateLeadStatusTo}</Badge> : null}
          </div>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" onClick={onConfigure}>
            <Settings2 /> Configure
          </Button>
          <Button variant="ghost" size="sm" onClick={onDetach} className="text-muted-foreground hover:text-destructive">
            <Unplug /> Detach
          </Button>
        </div>
      </div>
    </div>
  );
}
