"use client";
import Link from "next/link";
import type { Agent } from "@/lib/types";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const NO_AGENT = "__none__";

/**
 * Picks an ElevenLabs agent id (values are `elevenAgentId`). `current` lets a
 * number that is assigned to an agent not imported into Matrix still show its
 * name instead of silently looking unassigned.
 */
export function AgentSelect({
  agents,
  loading,
  value,
  onChange,
  id,
  noneLabel = "Assign later",
  current,
  compact,
  disabled,
  className,
}: {
  agents?: Agent[];
  loading?: boolean;
  /** elevenAgentId or "" for none */
  value: string;
  onChange: (elevenAgentId: string) => void;
  id?: string;
  noneLabel?: string;
  current?: { agent_id: string; agent_name: string } | null;
  compact?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  if (loading) return <Skeleton className={cn("w-full", compact ? "h-8" : "h-9", className)} />;
  const list = agents ?? [];
  const orphan = current && !list.some((a) => a.elevenAgentId === current.agent_id) ? current : null;

  if (!list.length && !orphan) {
    return (
      <div className={cn("flex items-center rounded-md border border-dashed border-border bg-muted/40 px-3 text-xs text-muted-foreground", compact ? "h-8" : "h-9", className)}>
        <span className="truncate">
          No agents yet —{" "}
          <Link href="/agents/new" className="font-medium text-primary hover:underline">
            create one
          </Link>
        </span>
      </div>
    );
  }

  return (
    <Select value={value || NO_AGENT} onValueChange={(v) => onChange(v === NO_AGENT ? "" : v)} disabled={disabled}>
      <SelectTrigger id={id} className={cn(compact && "h-8 text-[13px]", className)}>
        <SelectValue placeholder={noneLabel} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_AGENT}>
          <span className="text-muted-foreground">{noneLabel}</span>
        </SelectItem>
        {orphan ? (
          <SelectItem value={orphan.agent_id} description="Assigned in ElevenLabs · not imported into Matrix">
            {orphan.agent_name}
          </SelectItem>
        ) : null}
        {list.length ? <SelectSeparator /> : null}
        {list.map((a) => (
          <SelectItem key={a._id} value={a.elevenAgentId} description={a.description || a.elevenAgentId}>
            {a.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
