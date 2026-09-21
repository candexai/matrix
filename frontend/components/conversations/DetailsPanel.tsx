"use client";
import { Copy } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tip } from "@/components/ui/tooltip";
import type { Conversation } from "@/lib/types";
import { cn, formatDateTime, formatDuration, titleCase } from "@/lib/utils";
import { channelMeta } from "./channels";
import { copyText, formatPhone, formatValue, isLive } from "./helpers";

/** Variables injected by the voice engine. Only the routing ones below are ever shown — never the raw set. */
const SYSTEM_PREFIX = "system__";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h4 className="mb-3 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{children}</h4>;
}

function Row({ label, value, mono, copy }: { label: string; value?: string | null; mono?: boolean; copy?: boolean | string }) {
  const v = value && value.trim() ? value : "—";
  const copyValue = typeof copy === "string" ? copy : v;
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 flex min-w-0 items-center gap-1.5">
        <span className={cn("min-w-0 truncate text-[13.5px]", mono && v !== "—" && "font-mono text-[12.5px]")} title={v}>
          {v}
        </span>
        {copy && v !== "—" ? (
          <Tip label="Copy">
            <button type="button" onClick={() => copyText(copyValue)} className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`Copy ${label}`}>
              <Copy className="size-3.5" />
            </button>
          </Tip>
        ) : null}
      </dd>
    </div>
  );
}

/** A system variable as a trimmed string, or undefined when missing / empty / not a scalar. */
function systemVar(vars: Record<string, unknown>, key: string): string | undefined {
  const v = vars[`${SYSTEM_PREFIX}${key}`];
  if (typeof v === "number") return String(v);
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t ? t : undefined;
}

function lineTypeLabel(raw?: string): string | undefined {
  if (!raw) return undefined;
  switch (raw.toLowerCase()) {
    case "sip_trunk":
    case "sip":
      return "SIP trunk";
    case "twilio":
      return "Twilio";
    case "web":
    case "websocket":
    case "webrtc":
      return "Web";
    default:
      // Unknown transport: show it prettified, but never leak a vendor name into the white-labelled UI.
      return /eleven/i.test(raw) ? undefined : titleCase(raw);
  }
}

export function DetailsPanel({ c }: { c: Conversation }) {
  const all = c.dynamicVariables ?? {};
  const vars = Object.entries(all).filter(([k]) => !k.toLowerCase().startsWith(SYSTEM_PREFIX));

  const from = systemVar(all, "caller_id");
  const to = systemVar(all, "called_number");
  const lineType = lineTypeLabel(systemVar(all, "channel"));
  const callSid = systemVar(all, "call_sid");
  const timeZone = systemVar(all, "timezone");
  const hasRouting = Boolean(from || to || lineType || callSid || timeZone);

  return (
    <div className="@container space-y-8">
      <section>
        <SectionTitle>Call</SectionTitle>
        <dl className="grid grid-cols-1 gap-x-8 gap-y-4 @md:grid-cols-2">
          <Row label="Conversation ID" value={c.elevenConversationId} mono copy />
          <Row label="Agent ID" value={c.elevenAgentId} mono copy />
          <Row label="Direction" value={titleCase(c.direction)} />
          <Row label="Channel" value={channelMeta(c.channel).label} />
          <Row label="Status" value={titleCase(c.status)} />
          <Row label="Started" value={formatDateTime(c.startedAt || c.createdAt)} />
          <Row label="Ended" value={c.endedAt ? formatDateTime(c.endedAt) : isLive(c.status) ? "In progress" : undefined} />
          <Row label="Duration" value={formatDuration(c.durationSecs)} />
          <Row label="Ended because" value={titleCase(c.terminationReason)} />
          {c.batchCallId ? <Row label="Batch call ID" value={c.batchCallId} mono copy /> : null}
          <Row label="Internal ID" value={c._id} mono copy />
        </dl>
      </section>

      {hasRouting ? (
        <section>
          <SectionTitle>Routing</SectionTitle>
          <dl className="grid grid-cols-1 gap-x-8 gap-y-4 @md:grid-cols-2">
            {from ? <Row label="From number" value={formatPhone(from)} copy={from} /> : null}
            {to ? <Row label="To number" value={formatPhone(to)} copy={to} /> : null}
            {lineType ? <Row label="Line type" value={lineType} /> : null}
            {callSid ? <Row label="Carrier call ID" value={callSid} mono copy /> : null}
            {timeZone ? <Row label="Caller time zone" value={timeZone} /> : null}
          </dl>
        </section>
      ) : null}

      <section>
        <SectionTitle>Variables passed to the agent</SectionTitle>
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
                    <TableCell className="break-all align-top font-mono text-[12.5px]">{k}</TableCell>
                    <TableCell className="break-words align-top text-[13.5px] [overflow-wrap:anywhere]">{formatValue(v)}</TableCell>
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
