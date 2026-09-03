"use client";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, CircleCheck, CircleX, Info, PhoneOutgoing, Plus, RefreshCw, RotateCcw, TriangleAlert } from "lucide-react";
import { useConversation, usePhoneNumbers, useRefreshConversation, useTestCall } from "@/hooks/api";
import { errorMessage } from "@/lib/api";
import type { Agent, Conversation, TestCallResult } from "@/lib/types";
import { cn, formatDuration, titleCase } from "@/lib/utils";
import { CopyButton } from "@/components/agents/CopyButton";
import { Transcript } from "@/components/conversations/Transcript";
import { formatValue } from "@/components/conversations/helpers";
import { parseDialNumber, providerMeta, type BadgeVariant } from "@/components/phone-numbers/phone-utils";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const LIVE: ReadonlySet<string> = new Set(["initiated", "in_progress", "processing"]);
const isLiveStatus = (s?: string): boolean => Boolean(s && LIVE.has(s));

function statusMeta(s?: Conversation["status"]): { label: string; variant: BadgeVariant; dot: string } {
  switch (s) {
    case "initiated":
      return { label: "Ringing", variant: "warning", dot: "bg-amber-500 animate-pulse" };
    case "in_progress":
      return { label: "In progress", variant: "info", dot: "bg-emerald-500 animate-pulse" };
    case "processing":
      return { label: "Processing", variant: "warning", dot: "bg-amber-500" };
    case "done":
      return { label: "Completed", variant: "success", dot: "bg-emerald-500" };
    case "failed":
      return { label: "Failed", variant: "destructive", dot: "bg-red-500" };
    default:
      return { label: "Placed", variant: "secondary", dot: "bg-zinc-400" };
  }
}

function Notice({ tone = "info", children }: { tone?: "info" | "warning"; children: ReactNode }) {
  const Icon = tone === "warning" ? TriangleAlert : Info;
  return (
    <div className={cn("flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs leading-5", tone === "warning" ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200" : "border-border bg-muted/40 text-muted-foreground")}>
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function Row({ label, value, mono, copy }: { label: string; value?: string | null; mono?: boolean; copy?: boolean }) {
  const v = value && value.trim() ? value : "—";
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 flex items-center gap-1">
        <span className={cn("min-w-0 truncate", mono && v !== "—" && "font-mono text-[12.5px]")} title={v}>
          {v}
        </span>
        {copy && v !== "—" ? <CopyButton value={v} label={`Copy ${label}`} size="xs" /> : null}
      </dd>
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h4 className="mb-2.5 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{children}</h4>;
}

/** Live status of a placed test call: polls Matrix every 5s while the call is ringing / in progress / processing. */
function PhoneCallStatus({ result, agent, onReset }: { result: TestCallResult; agent?: Agent; onReset: () => void }) {
  const convId = result.conversation?._id;
  const conv = useConversation(convId);
  const refresh = useRefreshConversation();
  const c: Conversation | null = conv.data ?? result.conversation ?? null;
  const status = c?.status;
  const live = isLiveStatus(status);

  const { refetch } = conv;
  useEffect(() => {
    if (!convId || !live) return;
    const t = setInterval(() => void refetch(), 5000);
    return () => clearInterval(t);
  }, [convId, live, refetch]);

  const [placedAt] = useState(() => Date.now());
  const [now, setNow] = useState(placedAt);
  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [live]);
  const elapsed = Math.floor((now - placedAt) / 1000);

  const meta = statusMeta(status);
  const pm = providerMeta(result.provider);
  const finished = status === "done" || status === "failed";
  const duration = typeof c?.durationSecs === "number" && c.durationSecs > 0 ? c.durationSecs : live ? elapsed : undefined;
  const data = Object.entries(c?.dataCollection ?? {});

  return (
    <div className="rounded-xl border border-border bg-card shadow-xs animate-fade-up">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("size-2 rounded-full", meta.dot)} />
          <span className="text-sm font-medium">{meta.label}</span>
          {c?.callSuccessful === "success" ? (
            <Badge variant="success">
              <CircleCheck /> Successful
            </Badge>
          ) : c?.callSuccessful === "failure" ? (
            <Badge variant="destructive">
              <CircleX /> Unsuccessful
            </Badge>
          ) : null}
        </div>
        <span className={cn("font-mono text-sm tabular-nums", live ? "text-foreground" : "text-muted-foreground")}>{formatDuration(duration)}</span>
      </div>

      <div className="space-y-4 px-5 py-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-mono">{result.from}</span>
          <ArrowRight className="size-4 text-muted-foreground" />
          <span className="font-mono">{result.to}</span>
          <Badge variant={pm.variant}>{pm.label}</Badge>
          <span className="text-muted-foreground">· {result.agent.name}</span>
        </div>

        <dl className="grid gap-x-6 gap-y-3 text-[13px] sm:grid-cols-2">
          <Row label="Conversation ID" value={result.conversationId} mono copy />
          {result.callSid ? <Row label="Call SID" value={result.callSid} mono copy /> : null}
          {c?.terminationReason ? <Row label="Ended because" value={titleCase(c.terminationReason)} /> : null}
          {c?.summaryTitle ? <Row label="Title" value={c.summaryTitle} /> : null}
        </dl>

        {!convId ? <Notice tone="warning">ElevenLabs accepted the call but didn't return a conversation id{result.message ? ` (${result.message})` : ""}. It should show up in Conversations within a minute.</Notice> : null}

        {live ? (
          <p className="text-xs text-muted-foreground">
            {status === "initiated" ? "Ringing your phone — pick up to talk to the agent. This card refreshes every 5 seconds." : status === "in_progress" ? "Call in progress. The transcript and summary arrive once you hang up." : "Call ended — ElevenLabs is generating the transcript and summary."}
          </p>
        ) : null}
        {live && elapsed > 45 ? <Notice>Still {meta.label.toLowerCase()}? If this agent's post-call webhook is off, ElevenLabs won't push the result — use “Refresh from ElevenLabs” after you hang up.</Notice> : null}
        {conv.isError ? <Notice tone="warning">{errorMessage(conv.error)}</Notice> : null}

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => (convId ? refresh.mutate(convId) : undefined)} loading={refresh.isPending} disabled={!convId}>
            {!refresh.isPending ? <RefreshCw /> : null} Refresh from ElevenLabs
          </Button>
          {convId ? (
            <Link href={`/conversations?id=${encodeURIComponent(convId)}`} className={buttonVariants({ variant: "soft", size: "sm" })}>
              Open in Conversations <ArrowUpRight />
            </Link>
          ) : null}
          <Button variant="ghost" size="sm" onClick={onReset} className="ml-auto">
            <RotateCcw /> New call
          </Button>
        </div>
      </div>

      {finished && c ? (
        <div className="space-y-6 border-t border-border px-5 py-5">
          <section>
            <SectionTitle>Summary</SectionTitle>
            {c.summary ? <p className="text-[14px] leading-relaxed text-foreground/90">{c.summary}</p> : <p className="text-sm italic text-muted-foreground">No summary yet — ElevenLabs generates it shortly after the call ends. Refresh in a moment.</p>}
          </section>
          {data.length ? (
            <section>
              <SectionTitle>Collected data</SectionTitle>
              <div className="overflow-hidden rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[38%]">Field</TableHead>
                      <TableHead>Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.map(([key, entry]) => (
                      <TableRow key={key}>
                        <TableCell className="align-top font-mono text-[12.5px]">{key}</TableCell>
                        <TableCell className="align-top">
                          <div className="break-words text-[13.5px]">{formatValue(entry?.value)}</div>
                          {entry?.rationale ? <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{entry.rationale}</div> : null}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>
          ) : null}
          <section>
            <SectionTitle>Transcript</SectionTitle>
            <Transcript turns={c.transcript ?? []} agentLabel={agent?.name ?? result.agent.name} />
          </section>
        </div>
      ) : null}
    </div>
  );
}

export function PhoneCallPanel({ agent, dynamicVariables, className }: { agent?: Agent; dynamicVariables: Record<string, string>; className?: string }) {
  const numbers = usePhoneNumbers();
  const call = useTestCall();
  const outbound = useMemo(() => (numbers.data ?? []).filter((n) => n.supports_outbound !== false), [numbers.data]);

  // Default "from": the number assigned to the selected agent, else the first outbound number.
  // A manual pick is remembered per agent so switching agents re-applies the default.
  const agentKey = agent?._id;
  const defaultId = useMemo(() => {
    const assigned = agent ? outbound.find((n) => n.assigned_agent?.agent_id === agent.elevenAgentId) : undefined;
    return (assigned ?? outbound[0])?.phone_number_id ?? "";
  }, [outbound, agent]);
  const [pick, setPick] = useState<{ agentKey?: string; id: string } | null>(null);
  const picked = pick && pick.agentKey === agentKey && outbound.some((n) => n.phone_number_id === pick.id) ? pick.id : null;
  const phoneNumberId = picked ?? defaultId;
  const from = outbound.find((n) => n.phone_number_id === phoneNumberId);

  const [to, setTo] = useState("");
  const [touched, setTouched] = useState(false);
  const parsed = parseDialNumber(to);
  const [result, setResult] = useState<TestCallResult | null>(null);

  let toHelp: string | undefined;
  let toError: string | undefined;
  if (!to.trim()) toHelp = "International format with country code, e.g. +91 98765 43210. Spaces and dashes are fine.";
  else if (parsed.ok) toHelp = `Dialling ${parsed.value}${parsed.assumedCountry ? " — assumed +91; add a country code to change it" : ""}.`;
  else if (touched) toError = parsed.reason;
  else toHelp = "Needs a + country code, then 7–15 digits.";

  const place = () => {
    setTouched(true);
    if (!agent || !from || !parsed.ok) return;
    const vars: Record<string, string> = {};
    for (const [k, v] of Object.entries(dynamicVariables)) if (k.trim() && String(v).trim()) vars[k.trim()] = String(v);
    call.mutate({ agentId: agent._id, to_number: parsed.value, phoneNumberId: from.phone_number_id, dynamic_variables: vars }, { onSuccess: (r) => setResult(r) });
  };

  const fromMeta = from ? providerMeta(from.provider) : null;

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="rounded-xl border border-border bg-card shadow-xs">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="flex items-center gap-2">
            <PhoneOutgoing className="size-4 text-primary" strokeWidth={1.8} />
            <span className="text-sm font-medium">Call my phone</span>
          </div>
          {fromMeta ? <Badge variant={fromMeta.variant}>{fromMeta.label}</Badge> : null}
        </div>

        <div className="space-y-4 px-5 py-5">
          <p className="text-sm text-muted-foreground">{agent ? <>The agent rings a real phone from one of your numbers, exactly as a lead would receive it.</> : "Pick an agent on the left to place a call."}</p>

          {!agent ? (
            <Notice tone="warning">
              No agent selected.{" "}
              <Link href="/agents/new" className="inline-flex items-center gap-0.5 font-medium text-primary hover:underline">
                <Plus className="size-3" /> Create one
              </Link>{" "}
              or choose one on the left.
            </Notice>
          ) : null}

          {numbers.isPending ? (
            <div className="space-y-4">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          ) : numbers.isError ? (
            <Notice tone="warning">
              Couldn't load your phone numbers: {errorMessage(numbers.error)}{" "}
              <button type="button" onClick={() => numbers.refetch()} className="font-medium underline underline-offset-2">
                Retry
              </button>
            </Notice>
          ) : !outbound.length ? (
            <Notice tone="warning">
              No outbound-capable number in your ElevenLabs workspace yet.{" "}
              <Link href="/phone-numbers" className="font-medium text-primary hover:underline">
                Add a number in Phone Numbers
              </Link>{" "}
              — import a Twilio number or connect a SIP trunk.
            </Notice>
          ) : (
            <>
              <Field label="Call from" htmlFor="phone-call-from" help={from?.assigned_agent ? `Assigned to ${from.assigned_agent.agent_name}${agent && from.assigned_agent.agent_id === agent.elevenAgentId ? " — this agent" : ""}.` : "Not assigned to an agent — fine for outbound tests."}>
                <Select value={phoneNumberId} onValueChange={(id) => setPick({ agentKey, id })} disabled={call.isPending}>
                  <SelectTrigger id="phone-call-from">
                    <SelectValue placeholder="Choose a number" />
                  </SelectTrigger>
                  <SelectContent>
                    {outbound.map((n) => (
                      <SelectItem key={n.phone_number_id} value={n.phone_number_id} description={`${n.phone_number} · ${providerLabelOf(n.provider)}${n.assigned_agent ? ` · ${n.assigned_agent.agent_name}` : ""}`}>
                        {n.label || n.phone_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Call to" hint="E.164" htmlFor="phone-call-to" error={toError} help={toError ? undefined : toHelp}>
                <Input
                  id="phone-call-to"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="+91 98765 43210"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  onBlur={() => setTouched(true)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      place();
                    }
                  }}
                  disabled={call.isPending}
                  className={cn("font-mono text-[14px]", toError && "border-destructive")}
                />
              </Field>

              <div className="flex flex-col gap-2 pt-1">
                <Button size="lg" onClick={place} loading={call.isPending} disabled={!agent || !from || !to.trim()} className="w-full sm:w-auto sm:min-w-48 sm:self-start">
                  {!call.isPending ? <PhoneOutgoing /> : null} {call.isPending ? "Placing call…" : "Call my phone"}
                </Button>
                <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <Info className="mt-0.5 size-3.5 shrink-0" />
                  Free ElevenLabs plans have limited call minutes; test calls count against your balance.
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {result ? <PhoneCallStatus key={result.conversationId ?? `${result.to}-${result.callSid ?? ""}`} result={result} agent={agent} onReset={() => setResult(null)} /> : null}
    </div>
  );
}

const providerLabelOf = (p?: string | null) => providerMeta(p).label;
