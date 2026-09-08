"use client";
import { useMemo, useState, type ReactNode } from "react";
import { Braces, Trash2, Webhook } from "lucide-react";
import { useCreateHttpTool, useUpdateHttpTool } from "@/hooks/api";
import type { HttpTool, HttpToolInput, ToolParam } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tip } from "@/components/ui/tooltip";
import { AddButton, KeyValueEditor, NumberField, SubHeading } from "./primitives";

/* ---------- constants (mirror backend toolsKb.routes.ts) ---------- */

export const METHODS: HttpTool["method"][] = ["GET", "POST", "PUT", "PATCH", "DELETE"];
export const METHOD_BADGE: Record<HttpTool["method"], NonNullable<BadgeProps["variant"]>> = { GET: "info", POST: "success", PUT: "warning", PATCH: "warning", DELETE: "destructive" };

const TOOL_NAME_RE = /^[A-Za-z_][A-Za-z0-9_-]*$/;
const PARAM_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const PATH_TOKEN_RE = /(\{[A-Za-z_][A-Za-z0-9_]*\})/g;

const PARAM_TYPES: { value: ToolParam["type"]; label: string }[] = [
  { value: "string", label: "String" },
  { value: "number", label: "Number" },
  { value: "integer", label: "Integer" },
  { value: "boolean", label: "Boolean" },
];
const LOCATIONS: { value: ToolParam["location"]; label: string; description: string }[] = [
  { value: "body", label: "Body", description: "JSON request body" },
  { value: "query", label: "Query", description: "?key=value in the URL" },
  { value: "path", label: "Path", description: "Replaces {name} in the URL" },
];

const LLM = "__llm__";
const CUSTOM = "__custom__";
/** Variables Matrix injects on every lead call (backend calls.service leadDynamicVariables). */
const DV_LEAD: { value: string; description: string }[] = [
  { value: "lead_id", description: "Matrix lead ID" },
  { value: "name", description: "Lead's full name" },
  { value: "first_name", description: "Lead's first name" },
  { value: "phone", description: "Lead's phone number" },
  { value: "email", description: "Lead's email" },
  { value: "company", description: "Lead's company" },
  { value: "city", description: "Lead's city" },
  { value: "lead_status", description: "Current CRM lead status" },
  { value: "zoho_lead_id", description: "Zoho CRM record ID" },
  { value: "lead_list_id", description: "Lead table the call was placed from" },
  { value: "agent_name", description: "This agent's display name" },
];
const DV_SYSTEM: { value: string; description: string }[] = [
  { value: "system__caller_id", description: "Phone number of the caller" },
  { value: "system__called_number", description: "Number that was dialled" },
  { value: "system__conversation_id", description: "ElevenLabs conversation ID" },
  { value: "system__agent_id", description: "ElevenLabs agent ID" },
  { value: "system__time_utc", description: "Call start time (UTC)" },
];
const DV_KNOWN = new Set([...DV_LEAD, ...DV_SYSTEM].map((d) => d.value));

/* ---------- draft state ---------- */

interface ParamDraft {
  key: number;
  name: string;
  type: ToolParam["type"];
  location: ToolParam["location"];
  required: boolean;
  description: string;
  dynamic_variable: string;
  customDv: boolean;
  constant_value?: string;
}
interface Draft {
  name: string;
  description: string;
  method: HttpTool["method"];
  url: string;
  headers: Record<string, string>;
  timeout: number;
  params: ParamDraft[];
}
type Errors = Record<string, string>;

let seq = 0;

function fromTool(t?: HttpTool): Draft {
  if (!t) return { name: "", description: "", method: "POST", url: "", headers: {}, timeout: 20, params: [] };
  return {
    name: t.name ?? "",
    description: t.description ?? "",
    method: METHODS.includes(t.method) ? t.method : "POST",
    url: t.url ?? "",
    headers: { ...(t.headers ?? {}) },
    timeout: t.response_timeout_secs ?? 20,
    params: (t.params ?? []).map((p) => {
      const dv = p.dynamic_variable ?? "";
      return {
        key: ++seq,
        name: p.name,
        type: p.type ?? "string",
        location: p.location ?? "query",
        required: p.location === "path" ? true : Boolean(p.required),
        description: p.description ?? "",
        dynamic_variable: dv,
        customDv: Boolean(dv) && !DV_KNOWN.has(dv),
        constant_value: p.constant_value === undefined || p.constant_value === null ? undefined : String(p.constant_value),
      };
    }),
  };
}

function isHttpUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}
const hasConstant = (p: ParamDraft) => p.constant_value !== undefined && p.constant_value !== "";

function validate(d: Draft): Errors {
  const e: Errors = {};
  const name = d.name.trim();
  if (!name) e.name = "Give the tool a name.";
  else if (name.length > 64) e.name = "64 characters max.";
  else if (!TOOL_NAME_RE.test(name)) e.name = "Use letters, digits, _ or - and start with a letter or _.";
  const desc = d.description.trim();
  if (!desc) e.description = "Tell the agent when to call this and what it does.";
  else if (desc.length > 1000) e.description = "1,000 characters max.";
  const url = d.url.trim();
  if (!url) e.url = "Enter the endpoint URL.";
  else if (!isHttpUrl(url)) e.url = "Enter a full URL starting with http:// or https://";
  if (!Number.isInteger(d.timeout) || d.timeout < 1 || d.timeout > 120) e.timeout = "Between 1 and 120 seconds.";
  const seen = new Set<string>();
  d.params.forEach((p, i) => {
    const n = p.name.trim();
    if (!n) e[`params.${i}.name`] = "Name required.";
    else if (n.length > 64) e[`params.${i}.name`] = "64 characters max.";
    else if (!PARAM_NAME_RE.test(n)) e[`params.${i}.name`] = "Letters, digits and underscores only.";
    else if (seen.has(n)) e[`params.${i}.name`] = "Duplicate name.";
    seen.add(n);
    if (p.location === "path" && n && !url.includes(`{${n}}`)) e[`params.${i}.path`] = `Add {${n}} to the URL path so it can be substituted.`;
    const dv = p.dynamic_variable.trim();
    if (p.customDv && !dv) e[`params.${i}.dynamic_variable`] = "Enter the variable name.";
    else if (dv.length > 64) e[`params.${i}.dynamic_variable`] = "64 characters max.";
    else if (dv && !PARAM_NAME_RE.test(dv)) e[`params.${i}.dynamic_variable`] = "Letters, digits and underscores only.";
    if (!dv && !hasConstant(p) && !p.description.trim()) e[`params.${i}.description`] = "Describe what the agent should collect.";
    else if (p.description.length > 300) e[`params.${i}.description`] = "300 characters max.";
  });
  return e;
}

function toInput(d: Draft): HttpToolInput {
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(d.headers)) if (k.trim()) headers[k.trim()] = v;
  return {
    name: d.name.trim(),
    description: d.description.trim(),
    url: d.url.trim(),
    method: d.method,
    headers,
    response_timeout_secs: Math.round(d.timeout),
    params: d.params.map((p) => {
      const dv = p.dynamic_variable.trim();
      return {
        name: p.name.trim(),
        type: p.type,
        location: p.location,
        required: p.location === "path" ? true : p.required,
        description: dv ? "" : p.description.trim(),
        dynamic_variable: dv || undefined,
        constant_value: !dv && hasConstant(p) ? p.constant_value : undefined,
      };
    }),
  };
}

/* ---------- component ---------- */

export function HttpToolDialog({ open, onOpenChange, tool, onSaved }: { open: boolean; onOpenChange: (open: boolean) => void; tool?: HttpTool; onSaved: (tool: HttpTool) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl">
        <ToolForm tool={tool} onSaved={onSaved} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function ToolForm({ tool, onSaved, onClose }: { tool?: HttpTool; onSaved: (tool: HttpTool) => void; onClose: () => void }) {
  const [d, setD] = useState<Draft>(() => fromTool(tool));
  const [submitted, setSubmitted] = useState(false);
  const errors = useMemo<Errors>(() => (submitted ? validate(d) : {}), [d, submitted]);
  const create = useCreateHttpTool();
  const update = useUpdateHttpTool();
  const saving = create.isPending || update.isPending;

  const patch = (p: Partial<Draft>) => setD((c) => ({ ...c, ...p }));
  const patchParam = (key: number, p: Partial<ParamDraft>) => setD((c) => ({ ...c, params: c.params.map((x) => (x.key === key ? { ...x, ...p } : x)) }));
  const removeParam = (key: number) => setD((c) => ({ ...c, params: c.params.filter((x) => x.key !== key) }));
  const addParam = () => setD((c) => ({ ...c, params: [...c.params, { key: ++seq, name: "", type: "string", location: c.method === "GET" || c.method === "DELETE" ? "query" : "body", required: true, description: "", dynamic_variable: "", customDv: false }] }));

  const submit = async () => {
    setSubmitted(true);
    const errs = validate(d);
    if (Object.keys(errs).length) return;
    try {
      const saved = tool ? await update.mutateAsync({ id: tool.id, ...toInput(d) }) : await create.mutateAsync(toInput(d));
      onSaved(saved);
      onClose();
    } catch {
      /* toasted by the mutation hook */
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{tool ? "Edit HTTP tool" : "New HTTP tool"}</DialogTitle>
        <DialogDescription>The agent calls this endpoint mid-call whenever it decides the tool applies. Stored in your ElevenLabs workspace and reusable by every agent.</DialogDescription>
      </DialogHeader>
      <DialogBody>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="flex flex-col gap-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name" hint="snake_case" htmlFor="tool-name" error={errors.name} help="How the LLM refers to it, e.g. check_availability.">
                <Input
                  id="tool-name"
                  value={d.name}
                  onChange={(e) => patch({ name: e.target.value })}
                  onBlur={() => patch({ name: d.name.trim().replace(/\s+/g, "_") })}
                  placeholder="check_availability"
                  maxLength={64}
                  spellCheck={false}
                  className={cn("font-mono text-[13px]", errors.name && "border-destructive")}
                />
              </Field>
              <Field label="Method & URL" htmlFor="tool-url" error={errors.url} help="Path parameters go in braces, e.g. /leads/{lead_id}">
                <div className="flex gap-2">
                  <Select value={d.method} onValueChange={(v) => patch({ method: v as HttpTool["method"] })}>
                    <SelectTrigger aria-label="Method" className="w-[108px] shrink-0 font-mono text-[12.5px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {METHODS.map((m) => (
                        <SelectItem key={m} value={m} className="font-mono text-[12.5px]">
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input id="tool-url" value={d.url} onChange={(e) => patch({ url: e.target.value })} placeholder="https://api.yourcompany.com/v1/availability" spellCheck={false} className={cn("font-mono text-[13px]", errors.url && "border-destructive")} />
                </div>
              </Field>
            </div>

            <Field
              label="Description"
              htmlFor="tool-desc"
              error={errors.description}
              help={
                <span className="flex items-center justify-between gap-4">
                  <span>Explain to the agent WHEN to call this and what it does — the LLM reads this to decide.</span>
                  <span className="shrink-0 tabular-nums">{d.description.length.toLocaleString()}/1,000</span>
                </span>
              }
            >
              <Textarea
                id="tool-desc"
                rows={3}
                value={d.description}
                onChange={(e) => patch({ description: e.target.value })}
                maxLength={1000}
                placeholder="Check whether a demo slot is free. Call this after the lead proposes a date and time, before confirming anything."
                className={errors.description ? "border-destructive" : undefined}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_150px]">
              <div className="flex flex-col gap-1.5">
                <Label hint="optional">Headers</Label>
                <KeyValueEditor value={d.headers} onChange={(h) => patch({ headers: h })} keyPlaceholder="Authorization" valuePlaceholder="Bearer …" addLabel="Add header" emptyText="No headers — add Authorization if your API needs a key." />
              </div>
              <NumberField label="Timeout" value={d.timeout} onChange={(v) => patch({ timeout: v ?? 20 })} min={1} max={120} suffix="sec" error={errors.timeout} help="Wait before giving up." />
            </div>

            <div className="flex flex-col gap-3">
              <SubHeading title="Parameters" description="Each value is either collected by the agent from the conversation or filled from the call context." action={<AddButton onClick={addParam}>Add parameter</AddButton>} />
              {d.params.length ? (
                <div className="flex flex-col gap-2">
                  {d.params.map((p, i) => (
                    <ParamCard key={p.key} p={p} index={i} errors={errors} onChange={(patchP) => patchParam(p.key, patchP)} onRemove={() => removeParam(p.key)} />
                  ))}
                </div>
              ) : (
                <p className="rounded-lg border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">No parameters — the agent will call the URL as-is.</p>
              )}
            </div>
          </div>

          <aside className="flex flex-col gap-3 lg:sticky lg:top-0 lg:self-start">
            <RequestPreview d={d} />
            <div className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2.5 text-xs leading-5 text-muted-foreground">
              <div className="mb-1 flex items-center gap-1.5 font-medium text-foreground">
                <Webhook className="size-3.5 text-primary" /> How it works
              </div>
              The agent reads the description to decide when to call the tool, gathers the parameters from the conversation, sends the request and speaks from the response. Keep responses small and JSON.
            </div>
          </aside>
        </div>
      </DialogBody>
      <DialogFooter>
        <span className="mr-auto text-xs text-muted-foreground">{submitted && Object.keys(errors).length ? <span className="text-destructive">{Object.keys(errors).length} issue{Object.keys(errors).length === 1 ? "" : "s"} to fix</span> : "Saved to your ElevenLabs workspace."}</span>
        <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button type="button" onClick={submit} loading={saving}>
          {tool ? "Save changes" : "Create tool"}
        </Button>
      </DialogFooter>
    </>
  );
}

/* ---------- parameter card ---------- */

function Mini({ children }: { children: ReactNode }) {
  return <span className="mb-1 block text-[11px] uppercase tracking-[0.06em] text-muted-foreground">{children}</span>;
}

function ParamCard({ p, index, errors, onChange, onRemove }: { p: ParamDraft; index: number; errors: Errors; onChange: (patch: Partial<ParamDraft>) => void; onRemove: () => void }) {
  const nameErr = errors[`params.${index}.name`];
  const descErr = errors[`params.${index}.description`];
  const dvErr = errors[`params.${index}.dynamic_variable`];
  const pathErr = errors[`params.${index}.path`];
  const isPath = p.location === "path";
  const dv = p.dynamic_variable.trim();
  const dvValue = p.customDv ? CUSTOM : p.dynamic_variable || LLM;
  const setDv = (v: string) => {
    if (v === LLM) onChange({ dynamic_variable: "", customDv: false });
    else if (v === CUSTOM) onChange({ dynamic_variable: "", customDv: true });
    else onChange({ dynamic_variable: v, customDv: false });
  };
  const requiredSwitch = <Switch checked={isPath || p.required} onCheckedChange={(v) => onChange({ required: v })} disabled={isPath} aria-label="Required" />;

  return (
    <div className="flex flex-col gap-2.5 rounded-lg border border-border bg-muted/20 p-3">
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto_auto] sm:items-start">
        <div>
          <Mini>Name</Mini>
          <Input
            value={p.name}
            onChange={(e) => onChange({ name: e.target.value })}
            onBlur={() => onChange({ name: p.name.trim().replace(/[^A-Za-z0-9_]/g, "_") })}
            placeholder="preferred_date"
            aria-label="Parameter name"
            maxLength={64}
            spellCheck={false}
            className={cn("font-mono text-[13px]", nameErr && "border-destructive")}
          />
          {nameErr ? <p className="mt-1 text-xs text-destructive">{nameErr}</p> : null}
        </div>
        <div>
          <Mini>Type</Mini>
          <Select value={p.type} onValueChange={(v) => onChange({ type: v as ToolParam["type"] })}>
            <SelectTrigger aria-label="Type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PARAM_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Mini>Location</Mini>
          <Select value={p.location} onValueChange={(v) => onChange({ location: v as ToolParam["location"], ...(v === "path" ? { required: true } : {}) })}>
            <SelectTrigger aria-label="Location">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LOCATIONS.map((l) => (
                <SelectItem key={l.value} value={l.value} description={l.description}>
                  {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Mini>Required</Mini>
          <div className="flex h-9 items-center px-0.5">
            {isPath ? (
              <Tip label="Path parameters are always required">
                <span className="inline-flex">{requiredSwitch}</span>
              </Tip>
            ) : (
              requiredSwitch
            )}
          </div>
        </div>
        <div className="sm:pt-[18px]">
          <Button type="button" variant="ghost" size="icon-sm" onClick={onRemove} aria-label="Remove parameter" className="text-muted-foreground hover:text-destructive">
            <Trash2 />
          </Button>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,230px)] sm:items-start">
        <div>
          <Mini>{dv ? "Value" : hasConstant(p) ? "Constant value" : "What the agent should collect"}</Mini>
          {dv ? (
            <div className="flex min-h-9 items-center gap-1.5 rounded-md border border-dashed border-primary/40 bg-accent-tint/20 px-3 py-1.5 text-xs text-muted-foreground">
              <Braces className="size-3.5 shrink-0 text-primary" />
              <span>
                Filled with <code className="font-mono text-primary">{`{{${dv}}}`}</code> from the call context — the agent won&apos;t ask for it.
              </span>
            </div>
          ) : hasConstant(p) ? (
            <div className="flex min-h-9 items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-xs">
              <code className="font-mono">{p.constant_value}</code>
              <button type="button" className="ml-auto text-muted-foreground hover:text-foreground" onClick={() => onChange({ constant_value: undefined })}>
                Let the agent collect it instead
              </button>
            </div>
          ) : (
            <>
              <Input value={p.description} onChange={(e) => onChange({ description: e.target.value })} placeholder="The date the lead proposed, as YYYY-MM-DD" aria-label="Description" maxLength={300} className={descErr ? "border-destructive" : undefined} />
              {descErr ? <p className="mt-1 text-xs text-destructive">{descErr}</p> : null}
            </>
          )}
        </div>
        <div>
          <Mini>Value source</Mini>
          <div className="flex flex-col gap-1.5">
            <Select value={dvValue} onValueChange={setDv}>
              <SelectTrigger aria-label="Fill from dynamic variable" className={cn(dv && "font-mono text-[12.5px]")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={LLM} description="The LLM extracts it from the conversation">
                  Ask the agent
                </SelectItem>
                <SelectGroup>
                  <SelectLabel>Dynamic variable · from the lead</SelectLabel>
                  {DV_LEAD.map((v) => (
                    <SelectItem key={v.value} value={v.value} description={v.description}>
                      {v.value}
                    </SelectItem>
                  ))}
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel>Dynamic variable · ElevenLabs system</SelectLabel>
                  {DV_SYSTEM.map((v) => (
                    <SelectItem key={v.value} value={v.value} description={v.description}>
                      {v.value}
                    </SelectItem>
                  ))}
                </SelectGroup>
                <SelectItem value={CUSTOM} description="Any variable you pass, e.g. zoho_industry">
                  Custom variable…
                </SelectItem>
              </SelectContent>
            </Select>
            {p.customDv ? <Input value={p.dynamic_variable} onChange={(e) => onChange({ dynamic_variable: e.target.value })} placeholder="zoho_industry" aria-label="Custom variable name" spellCheck={false} maxLength={64} className={cn("font-mono text-[13px]", dvErr && "border-destructive")} /> : null}
            {dvErr ? <p className="text-xs text-destructive">{dvErr}</p> : null}
          </div>
        </div>
      </div>
      {pathErr ? <p className="text-xs text-destructive">{pathErr}</p> : null}
    </div>
  );
}

/* ---------- live request preview ---------- */

function valueHint(p: ParamDraft, json: boolean): ReactNode {
  const dv = p.dynamic_variable.trim();
  if (dv) return <span className="text-primary">{json ? `"{{${dv}}}"` : `{{${dv}}}`}</span>;
  if (hasConstant(p)) return <span>{json && p.type === "string" ? JSON.stringify(p.constant_value) : p.constant_value}</span>;
  return <span className="text-muted-foreground">{json && p.type === "string" ? `"<${p.type}>"` : `<${p.type}>`}</span>;
}

function RequestPreview({ d }: { d: Draft }) {
  const url = d.url.trim() || "https://api.example.com/v1/endpoint";
  const pathNames = new Set(d.params.filter((p) => p.location === "path").map((p) => p.name.trim()).filter(Boolean));
  const query = d.params.filter((p) => p.location === "query" && p.name.trim());
  const body = d.params.filter((p) => p.location === "body" && p.name.trim());
  const headers = Object.entries(d.headers).filter(([k]) => k.trim());
  const parts = url.split(PATH_TOKEN_RE);
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-muted/40">
      <div className="flex items-center justify-between border-b border-border px-3 py-2 text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
        <span>Request preview</span>
        <span className="normal-case tracking-normal tabular-nums">{d.timeout}s timeout</span>
      </div>
      <pre className="whitespace-pre-wrap break-all px-3 py-3 font-mono text-[12px] leading-5">
        <span className="font-semibold text-primary-hover">{d.method}</span>{" "}
        {parts.map((part, i) => {
          const m = /^\{([A-Za-z_][A-Za-z0-9_]*)\}$/.exec(part);
          if (!m) return <span key={i}>{part}</span>;
          const known = pathNames.has(m[1]);
          return (
            <span key={i} className={known ? "text-primary" : "text-destructive underline decoration-dotted"} title={known ? "Path parameter" : "No path parameter with this name"}>
              {part}
            </span>
          );
        })}
        {query.length ? (
          <span>
            ?
            {query.map((p, i) => (
              <span key={p.key}>
                {i ? "&" : ""}
                {p.name.trim()}={valueHint(p, false)}
              </span>
            ))}
          </span>
        ) : null}
        {headers.length ? (
          <>
            {"\n"}
            {headers.map(([k, v]) => `${k}: ${v}`).join("\n")}
          </>
        ) : null}
        {body.length ? (
          <>
            {"\n"}
            <span className="text-muted-foreground">Content-Type: application/json</span>
            {"\n\n{\n"}
            {body.map((p, i) => (
              <span key={p.key}>
                {"  "}
                <span>&quot;{p.name.trim()}&quot;</span>: {valueHint(p, true)}
                {i < body.length - 1 ? "," : ""}
                {"\n"}
              </span>
            ))}
            {"}"}
          </>
        ) : null}
      </pre>
      <div className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
        <span className="font-mono text-primary">{"{{var}}"}</span> filled from the call context · <span className="font-mono">&lt;type&gt;</span> collected by the agent
      </div>
    </div>
  );
}
