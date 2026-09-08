"use client";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import type { Agent, PhoneNumber } from "@/lib/types";
import { Field } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/api";
import { ElevenLabsRequiredNotice, isElevenNotConfigured } from "@/components/integrations/ElevenLabsRequired";

export const AUTO_PHONE = "__auto__";

export function AgentPicker({
  agents,
  loading,
  error,
  value,
  onChange,
  label = "Voice agent",
  hint,
  boundAgentId,
  boundLabel = "attached",
}: {
  agents?: Agent[];
  loading?: boolean;
  /** The agents query error — a missing ElevenLabs key renders a connect notice instead of "no agents". */
  error?: unknown;
  value: string;
  onChange: (v: string) => void;
  label?: string;
  hint?: string;
  boundAgentId?: string;
  /** Suffix shown next to the agent that is currently attached (e.g. "attached to Hot leads"). */
  boundLabel?: string;
}) {
  const selected = agents?.find((a) => a._id === value);
  return (
    <Field label={label} hint={hint}>
      {loading ? (
        <Skeleton className="h-9 w-full" />
      ) : isElevenNotConfigured(error) ? (
        <ElevenLabsRequiredNotice>in Integrations to load your voice agents.</ElevenLabsRequiredNotice>
      ) : error ? (
        <div className="flex items-start gap-2 rounded-md border border-dashed border-border bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-warning" />
          <span>Could not load agents: {errorMessage(error)}</span>
        </div>
      ) : !agents?.length ? (
        <div className="flex items-start gap-2 rounded-md border border-dashed border-border bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-warning" />
          <span>
            No voice agents yet.{" "}
            <Link href="/agents/new" className="font-medium text-primary hover:underline">
              Create one
            </Link>{" "}
            to start calling leads.
          </span>
        </div>
      ) : (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger>
            <SelectValue placeholder="Choose an agent" />
          </SelectTrigger>
          <SelectContent>
            {agents.map((a) => (
              <SelectItem key={a._id} value={a._id} description={describeAgent(a)}>
                {a.name}
                {boundAgentId === a._id ? ` · ${boundLabel}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {selected ? <p className="text-xs text-muted-foreground">{describeAgent(selected)}</p> : null}
    </Field>
  );
}

export function describeAgent(a: Agent): string {
  const parts: string[] = [];
  if (a.config?.language) parts.push(a.config.language.toUpperCase());
  if (a.config?.llm) parts.push(a.config.llm);
  if (a.config?.voice_id) parts.push(`voice ${a.config.voice_id.slice(0, 8)}…`);
  if (typeof a.callCount === "number") parts.push(`${a.callCount} call${a.callCount === 1 ? "" : "s"}`);
  return parts.join(" · ");
}

export function PhonePicker({
  numbers,
  loading,
  error,
  value,
  onChange,
  label = "Outbound number",
  allowAuto = true,
  hint,
}: {
  numbers?: PhoneNumber[];
  loading?: boolean;
  error?: unknown;
  value: string;
  onChange: (v: string) => void;
  label?: string;
  allowAuto?: boolean;
  hint?: string;
}) {
  const outbound = (numbers ?? []).filter((n) => n.supports_outbound !== false);
  return (
    <Field label={label} hint={hint}>
      {loading ? (
        <Skeleton className="h-9 w-full" />
      ) : isElevenNotConfigured(error) ? (
        <ElevenLabsRequiredNotice>in Integrations to load your phone numbers.</ElevenLabsRequiredNotice>
      ) : error ? (
        <div className="flex items-start gap-2 rounded-md border border-dashed border-border bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-warning" />
          <span>Could not load phone numbers from ElevenLabs: {errorMessage(error)}</span>
        </div>
      ) : !outbound.length ? (
        <div className="flex items-start gap-2 rounded-md border border-dashed border-border bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-warning" />
          <span>No outbound numbers found. Import a Twilio/SIP number in ElevenLabs, then refresh.</span>
        </div>
      ) : (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger>
            <SelectValue placeholder="Choose a number" />
          </SelectTrigger>
          <SelectContent>
            {allowAuto ? (
              <SelectItem value={AUTO_PHONE} description="Uses the number assigned to the agent, or the first outbound number">
                Automatic
              </SelectItem>
            ) : null}
            {outbound.map((n) => (
              <SelectItem key={n.phone_number_id} value={n.phone_number_id} description={[n.provider ? providerLabel(n.provider) : null, n.assigned_agent?.agent_name ? `assigned to ${n.assigned_agent.agent_name}` : null].filter(Boolean).join(" · ") || undefined}>
                {n.label ? `${n.label} · ${n.phone_number}` : n.phone_number}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </Field>
  );
}

export function providerLabel(p?: string): string {
  if (!p) return "";
  if (p === "sip_trunk") return "SIP trunk";
  return p.charAt(0).toUpperCase() + p.slice(1);
}
