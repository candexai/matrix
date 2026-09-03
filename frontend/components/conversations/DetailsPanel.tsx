"use client";
import { Copy } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tip } from "@/components/ui/tooltip";
import type { Conversation } from "@/lib/types";
import { cn, formatDateTime, formatDuration, titleCase } from "@/lib/utils";
import { channelMeta } from "./channels";
import { copyText, formatValue } from "./helpers";

function Row({ label, value, mono, copy }: { label: string; value?: string | null; mono?: boolean; copy?: boolean }) {
  const v = value && value.trim() ? value : "—";
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 flex items-center gap-1.5">
        <span className={cn("min-w-0 truncate text-[13.5px]", mono && v !== "—" && "font-mono text-[12.5px]")} title={v}>
          {v}
        </span>
        {copy && v !== "—" ? (
          <Tip label="Copy">
            <button type="button" onClick={() => copyText(v)} className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`Copy ${label}`}>
              <Copy className="size-3.5" />
            </button>
          </Tip>
        ) : null}
      </dd>
    </div>
  );
}

export function DetailsPanel({ c }: { c: Conversation }) {
  const vars = Object.entries(c.dynamicVariables ?? {});
  return (
    <div className="space-y-7">
      <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
        <Row label="ElevenLabs conversation ID" value={c.elevenConversationId} mono copy />
        <Row label="Agent ID" value={c.elevenAgentId} mono copy />
        <Row label="Termination reason" value={titleCase(c.terminationReason)} />
        <Row label="Batch call ID" value={c.batchCallId} mono copy />
        <Row label="Channel" value={channelMeta(c.channel).label} />
        <Row label="Direction" value={titleCase(c.direction)} />
        <Row label="Started" value={formatDateTime(c.startedAt || c.createdAt)} />
        <Row label="Ended" value={c.endedAt ? formatDateTime(c.endedAt) : undefined} />
        <Row label="Duration" value={formatDuration(c.durationSecs)} />
        <Row label="Status" value={titleCase(c.status)} />
        <Row label="Lead ID" value={c.leadId} mono copy />
        <Row label="Internal ID" value={c._id} mono copy />
      </dl>

      <section>
        <h4 className="mb-2.5 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Dynamic variables</h4>
        {vars.length ? (
          <div className="overflow-hidden rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[38%]">Variable</TableHead>
                  <TableHead>Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vars.map(([k, v]) => (
                  <TableRow key={k}>
                    <TableCell className="font-mono text-[12.5px]">{k}</TableCell>
                    <TableCell className="break-words text-[13.5px]">{formatValue(v)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No dynamic variables were passed to this call.</p>
        )}
      </section>
    </div>
  );
}
