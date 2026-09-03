"use client";
import { useQuery } from "@tanstack/react-query";
import { Shield, TriangleAlert, Webhook } from "lucide-react";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { CopyButton } from "../CopyButton";
import { CheckRow, NumberField, SectionCard, SubHeading, SwitchRow } from "./primitives";
import type { SectionProps } from "./sections";

interface Providers {
  direct: { configured: boolean; baseUrl?: string };
  pythonService: { configured: boolean; url?: string | null };
  postCallWebhookUrl: string;
}

export function PrivacySection({ cfg, set, catalog, errors }: SectionProps) {
  const providers = useQuery({ queryKey: ["agent-providers"], queryFn: () => api.get<Providers>("/agents/providers"), staleTime: 5 * 60_000, retry: 0 });
  const url = providers.data?.postCallWebhookUrl ?? "";
  const insecure = Boolean(url) && !url.startsWith("https://");

  const toggleEvent = (ev: string, on: boolean) => set("post_call_webhook_events", on ? Array.from(new Set([...cfg.post_call_webhook_events, ev])) : cfg.post_call_webhook_events.filter((x) => x !== ev));

  return (
    <SectionCard id="privacy" title="Privacy, limits & webhook" description="Recording, retention, usage caps and what ElevenLabs sends back after each call." icon={Shield}>
      <SwitchRow label="Record calls" help="Store audio in ElevenLabs so you can listen back from Conversations." checked={cfg.record_voice} onCheckedChange={(v) => set("record_voice", v)} />

      <div className="grid gap-5 md:grid-cols-3">
        <NumberField label="Retention" value={cfg.retention_days} onChange={(v) => set("retention_days", v ?? -1)} min={-1} max={3650} suffix="days" error={errors.retention_days} help={cfg.retention_days < 0 ? "-1 = keep transcripts & audio forever." : `Deleted after ${cfg.retention_days} day${cfg.retention_days === 1 ? "" : "s"}.`} />
        <NumberField label="Concurrency limit" value={cfg.agent_concurrency_limit} onChange={(v) => set("agent_concurrency_limit", v ?? -1)} min={-1} max={1000} suffix="calls" error={errors.agent_concurrency_limit} help={cfg.agent_concurrency_limit < 0 ? "-1 = use the workspace limit." : "Simultaneous calls for this agent."} />
        <NumberField label="Daily limit" value={cfg.daily_limit} onChange={(v) => set("daily_limit", v ?? 100000)} min={0} max={10_000_000} suffix="calls/day" error={errors.daily_limit} help="Hard cap on calls per day." />
      </div>

      <div className="flex flex-col gap-3">
        <SubHeading title="Post-call webhook" description="Delivers the transcript, summary, collected data and evaluation to Matrix as soon as the call ends." />
        <SwitchRow
          label={
            <span className="inline-flex items-center gap-1.5">
              <Webhook className="size-3.5 text-primary" /> Send post-call events to Matrix
            </span>
          }
          help="Turning this off means conversations only appear after a manual sync."
          checked={cfg.post_call_webhook_enabled}
          onCheckedChange={(v) => set("post_call_webhook_enabled", v)}
        />
        {cfg.post_call_webhook_enabled ? (
          <>
            <div className="grid gap-2 md:grid-cols-2">
              {catalog.webhookEvents.map((ev) => (
                <CheckRow key={ev.value} checked={cfg.post_call_webhook_events.includes(ev.value)} onCheckedChange={(v) => toggleEvent(ev.value, v)} label={ev.label} description={ev.description} />
              ))}
            </div>
            {errors.post_call_webhook_events ? <p className="text-xs text-destructive">{errors.post_call_webhook_events}</p> : null}
          </>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <Label>Webhook URL</Label>
          {providers.isPending ? (
            <Skeleton className="h-9 w-full" />
          ) : (
            <div className="flex items-center gap-2">
              <Input readOnly value={url || "Unavailable — is the backend running?"} className="font-mono text-[13px]" onFocus={(e) => e.currentTarget.select()} />
              {url ? <CopyButton value={url} label="Copy webhook URL" className="border border-border bg-card size-9" /> : null}
            </div>
          )}
          <p className="text-xs text-muted-foreground">Registered automatically in your ElevenLabs workspace when you save with the webhook enabled.</p>
          {insecure ? (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              <span>
                ElevenLabs can only deliver webhooks to a public <strong>https</strong> URL. Run <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/50">ngrok http 5001</code> and set <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/50">PUBLIC_BACKEND_URL</code> in <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/50">backend/.env</code>, then restart the backend.
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </SectionCard>
  );
}
