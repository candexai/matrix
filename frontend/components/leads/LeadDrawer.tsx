"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X, PhoneCall, MoreHorizontal, ExternalLink, Trash2, ChevronDown, ChevronRight, Check, XCircle, Copy, Clock, Building2, RotateCcw, Save, ArrowUpRight, Sparkles, Table2 } from "lucide-react";
import { toast } from "sonner";
import type { Conversation, Lead } from "@/lib/types";
import { useLead, useLeadConversations, useLeadLists, useUpdateLead, useZohoFields } from "@/hooks/api";
import { cn, formatDateTime, formatDuration, initials, relativeTime } from "@/lib/utils";
import { errorMessage } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Tip } from "@/components/ui/tooltip";
import { callStatusVariant, displayValue, extractionProviderLabel, isEmptyValue, outcomeLabel, outcomeVariant, sourceLabel, STANDARD_KEYS, STANDARD_TO_ZOHO, statusVariant, zohoLeadUrl, type StandardKey } from "./leadUtils";
import { StatusPicker } from "./StatusPicker";

export interface LeadDrawerProps {
  leadId: string | null;
  onClose: () => void;
  statuses: string[];
  zohoConnected: boolean;
  accountsUrl?: string | null;
  onCall: (lead: Lead) => void;
  onDelete: (lead: Lead) => void;
}

const FIELD_LABELS: Record<StandardKey, string> = {
  firstName: "First name",
  lastName: "Last name",
  phone: "Phone",
  mobile: "Mobile",
  email: "Email",
  company: "Company",
  title: "Title",
  leadStatus: "Status",
  leadSource: "Lead source",
  city: "City",
  state: "State",
  country: "Country",
  industry: "Industry",
  website: "Website",
  rating: "Rating",
  description: "Description",
};

export function LeadDrawer({ leadId, onClose, statuses, zohoConnected, accountsUrl, onCall, onDelete }: LeadDrawerProps) {
  const lead = useLead(leadId ?? undefined);
  const open = Boolean(leadId);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        <style href="lead-sheet-anim" precedence="default">{`@keyframes lead-sheet-in{from{transform:translateX(32px);opacity:0}to{transform:translateX(0);opacity:1}}`}</style>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[1px] animate-fade-in" />
        <DialogPrimitive.Content
          className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[620px] flex-col border-l border-border bg-card shadow-2xl outline-none animate-[lead-sheet-in_.25s_ease-out_both]"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogPrimitive.Title className="sr-only">{lead.data?.fullName ?? "Lead"}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">Lead details, calls and activity</DialogPrimitive.Description>
          {lead.isLoading || !leadId ? (
            <DrawerSkeleton onClose={onClose} />
          ) : lead.error || !lead.data ? (
            <div className="flex flex-1 flex-col">
              <div className="flex items-center justify-end px-4 py-3">
                <DialogPrimitive.Close className="rounded-md p-1.5 text-muted-foreground hover:bg-muted">
                  <X className="size-4" />
                </DialogPrimitive.Close>
              </div>
              <EmptyState icon={XCircle} title="Lead not found" description={lead.error ? errorMessage(lead.error) : "This lead may have been deleted."} action={<Button variant="outline" onClick={onClose}>Close</Button>} />
            </div>
          ) : (
            <DrawerBody key={lead.data._id} lead={lead.data} statuses={statuses} zohoConnected={zohoConnected} accountsUrl={accountsUrl} onCall={onCall} onDelete={onDelete} />
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function DrawerSkeleton({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-start gap-3 border-b border-border px-6 py-5">
        <Skeleton className="size-11 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <button type="button" onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted">
          <X className="size-4" />
        </button>
      </div>
      <div className="space-y-3 px-6 py-5">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

function DrawerBody({ lead, statuses, zohoConnected, accountsUrl, onCall, onDelete }: { lead: Lead; statuses: string[]; zohoConnected: boolean; accountsUrl?: string | null; onCall: (l: Lead) => void; onDelete: (l: Lead) => void }) {
  const zohoUrl = lead.zohoId ? zohoLeadUrl(lead.zohoId, accountsUrl) : null;
  const phone = lead.phone || lead.mobile;
  return (
    <>
      <div className="flex items-start gap-3 border-b border-border px-6 py-5">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent-tint font-heading text-[15px] text-primary-hover">{initials(lead.fullName)}</span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-heading text-[20px] leading-tight">{lead.fullName || "Unnamed lead"}</h2>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted-foreground">
            {lead.company ? (
              <span className="inline-flex items-center gap-1">
                <Building2 className="size-3.5" />
                {lead.company}
                {lead.title ? ` · ${lead.title}` : ""}
              </span>
            ) : lead.title ? (
              <span>{lead.title}</span>
            ) : null}
            {phone ? <span className="font-mono">{phone}</span> : null}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge variant={statusVariant(lead.leadStatus)}>{lead.leadStatus || "No status"}</Badge>
            <Badge variant={lead.source === "zoho" ? "soft" : "outline"}>{sourceLabel(lead.source)}</Badge>
            {lead.callCount ? (
              <Badge variant="secondary">
                {lead.callCount} call{lead.callCount === 1 ? "" : "s"}
              </Badge>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Tip label={phone ? `Call ${phone}` : "No phone number"}>
            <span className="inline-flex">
              <Button size="sm" onClick={() => onCall(lead)} disabled={!phone}>
                <PhoneCall /> Call now
              </Button>
            </span>
          </Tip>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="More">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {zohoUrl ? (
                <DropdownMenuItem asChild>
                  <a href={zohoUrl} target="_blank" rel="noreferrer">
                    <ExternalLink /> Open in Zoho
                  </a>
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem disabled>
                  <ExternalLink /> Not linked to Zoho
                </DropdownMenuItem>
              )}
              {phone ? (
                <DropdownMenuItem
                  onSelect={() => {
                    navigator.clipboard?.writeText(phone).then(() => toast.success("Phone copied"));
                  }}
                >
                  <Copy /> Copy phone
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onSelect={() => onDelete(lead)}>
                <Trash2 /> Delete lead
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DialogPrimitive.Close className="rounded-md p-1.5 text-muted-foreground hover:bg-muted" aria-label="Close">
            <X className="size-4" />
          </DialogPrimitive.Close>
        </div>
      </div>

      <Tabs defaultValue="details" className="flex min-h-0 flex-1 flex-col">
        <div className="border-b border-border px-6 pt-3">
          <TabsList className="h-9 bg-transparent p-0">
            <TabsTrigger value="details" className="rounded-none border-b-2 border-transparent px-3 py-2 data-[state=active]:border data-[state=active]:border-x-0 data-[state=active]:border-t-0 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">
              Details
            </TabsTrigger>
            <TabsTrigger value="calls" className="rounded-none border-b-2 border-transparent px-3 py-2 data-[state=active]:border data-[state=active]:border-x-0 data-[state=active]:border-t-0 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">
              Calls{lead.callCount ? <span className="ml-1 rounded-full bg-muted px-1.5 text-[11px]">{lead.callCount}</span> : null}
            </TabsTrigger>
            <TabsTrigger value="activity" className="rounded-none border-b-2 border-transparent px-3 py-2 data-[state=active]:border data-[state=active]:border-x-0 data-[state=active]:border-t-0 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">
              Activity
            </TabsTrigger>
          </TabsList>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <TabsContent value="details" className="mt-0 px-6 py-5">
            <DetailsTab lead={lead} statuses={statuses} zohoConnected={zohoConnected} />
          </TabsContent>
          <TabsContent value="calls" className="mt-0 px-6 py-5">
            <CallsTab leadId={lead._id} />
          </TabsContent>
          <TabsContent value="activity" className="mt-0 px-6 py-5">
            <ActivityTab lead={lead} zohoUrl={zohoUrl} />
          </TabsContent>
        </div>
      </Tabs>
    </>
  );
}

// ---------------- Details ----------------

type FormState = Record<StandardKey, string>;
const formFromLead = (lead: Lead): FormState => Object.fromEntries(STANDARD_KEYS.map((k) => [k, (lead[k] as string | undefined) ?? ""])) as FormState;

function DetailsTab({ lead, statuses, zohoConnected }: { lead: Lead; statuses: string[]; zohoConnected: boolean }) {
  const update = useUpdateLead();
  const zohoFields = useZohoFields(zohoConnected);
  const initial = useMemo(() => formFromLead(lead), [lead]);
  const [form, setForm] = useState<FormState>(initial);
  const [pushToZoho, setPushToZoho] = useState(Boolean(lead.zohoId));
  const [showAll, setShowAll] = useState(false);

  const statusOptions = useMemo(() => {
    const pick = zohoFields.data?.find((f) => f.api_name === "Lead_Status")?.pick_list_values?.map((p) => p.display_value) ?? [];
    return Array.from(new Set([...pick, ...statuses]));
  }, [zohoFields.data, statuses]);

  const dirty = STANDARD_KEYS.filter((k) => (form[k] ?? "") !== (initial[k] ?? ""));
  const set = (k: StandardKey) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = () => {
    const fields: Record<string, unknown> = {};
    for (const k of dirty) fields[STANDARD_TO_ZOHO[k]] = form[k].trim();
    update.mutate({ id: lead._id, fields, pushToZoho: pushToZoho && Boolean(lead.zohoId) });
  };

  const allFields = useMemo(() => Object.entries(lead.fields ?? {}).sort(([a], [b]) => a.localeCompare(b)), [lead.fields]);
  const emptyCount = allFields.filter(([, v]) => isEmptyValue(v)).length;

  const text = (k: StandardKey, extra?: React.InputHTMLAttributes<HTMLInputElement>) => (
    <Field key={k} label={FIELD_LABELS[k]}>
      <Input value={form[k]} onChange={set(k)} className={cn(dirty.includes(k) && "border-primary/60")} {...extra} />
    </Field>
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-x-3 gap-y-4">
        {text("firstName")}
        {text("lastName")}
        {text("phone", { inputMode: "tel" })}
        {text("mobile", { inputMode: "tel" })}
        {text("email", { type: "email" })}
        {text("company")}
        {text("title")}
        <Field label="Status">
          <StatusPicker value={form.leadStatus} onChange={(v) => setForm((f) => ({ ...f, leadStatus: v }))} options={statusOptions} />
        </Field>
        {text("leadSource")}
        {text("rating")}
        {text("city")}
        {text("state")}
        {text("country")}
        {text("industry")}
        {text("website", { placeholder: "https://" })}
        <Field label="Description" className="col-span-2">
          <Textarea value={form.description} onChange={set("description")} className={cn("min-h-[72px]", dirty.includes("description") && "border-primary/60")} />
        </Field>
      </div>

      <div className="sticky bottom-0 -mx-6 flex items-center justify-between gap-3 border-t border-border bg-card/95 px-6 py-3 backdrop-blur">
        <label className="flex items-center gap-2 text-[13px]">
          <Switch checked={pushToZoho && Boolean(lead.zohoId)} onCheckedChange={setPushToZoho} disabled={!lead.zohoId} />
          <span className={cn(!lead.zohoId && "text-muted-foreground")}>Push to Zoho</span>
          {!lead.zohoId ? <span className="text-xs text-muted-foreground">(not linked)</span> : null}
        </label>
        <div className="flex items-center gap-2">
          {dirty.length ? (
            <span className="text-xs text-muted-foreground">
              {dirty.length} change{dirty.length === 1 ? "" : "s"}
            </span>
          ) : null}
          <Button variant="ghost" size="sm" onClick={() => setForm(initial)} disabled={!dirty.length || update.isPending}>
            <RotateCcw /> Reset
          </Button>
          <Button size="sm" onClick={save} loading={update.isPending} disabled={!dirty.length}>
            <Save /> Save
          </Button>
        </div>
      </div>

      <div>
        <button type="button" onClick={() => setShowAll((s) => !s)} className="flex w-full items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-left text-sm hover:bg-muted/60">
          {showAll ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronRight className="size-4 text-muted-foreground" />}
          <span className="font-medium">All Zoho fields</span>
          <span className="text-xs text-muted-foreground">
            {allFields.length} field{allFields.length === 1 ? "" : "s"}
            {emptyCount ? ` · ${emptyCount} empty` : ""}
          </span>
        </button>
        {showAll ? (
          allFields.length ? (
            <div className="mt-2 overflow-hidden rounded-lg border border-border">
              <ul className="divide-y divide-border">
                {allFields.map(([k, v]) => {
                  const empty = isEmptyValue(v);
                  return (
                    <li key={k} className="grid grid-cols-[minmax(0,180px)_1fr] items-start gap-3 px-3 py-2 text-[13px]">
                      <span className="truncate font-mono text-[11.5px] text-muted-foreground" title={k}>
                        {k}
                      </span>
                      <span className="flex min-w-0 items-start gap-2">
                        <span className={cn("min-w-0 break-words", empty && "text-muted-foreground")}>{displayValue(v)}</span>
                        {empty ? (
                          <Badge variant="outline" className="shrink-0 text-muted-foreground">
                            Empty
                          </Badge>
                        ) : null}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">No raw Zoho fields stored for this lead yet. Sync from Zoho to populate them.</p>
          )
        ) : null}
      </div>
    </div>
  );
}

// ---------------- Calls ----------------

function CallsTab({ leadId }: { leadId: string }) {
  const convs = useLeadConversations(leadId);
  if (convs.isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
    );
  }
  if (convs.error) return <EmptyState icon={XCircle} title="Could not load calls" description={errorMessage(convs.error)} className="py-10" />;
  if (!convs.data?.length) return <EmptyState icon={PhoneCall} title="No calls yet" description="Use “Call now” to have the attached agent dial this lead. Calls and collected answers will show up here." className="py-10" />;
  return (
    <ul className="space-y-3">
      {convs.data.map((c) => (
        <CallItem key={c._id} c={c} />
      ))}
    </ul>
  );
}

function CallItem({ c }: { c: Conversation }) {
  const finished = c.status === "done" || c.status === "failed";
  const pushed = Boolean(c.zohoSync?.pushedAt);
  const zohoErr = c.zohoSync?.error;
  return (
    <li>
      <Link href={`/conversations?id=${c._id}`} className="block rounded-lg border border-border p-3.5 transition-colors hover:border-primary/40 hover:bg-muted/30">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-sm font-medium">{formatDateTime(c.startedAt ?? c.createdAt)}</span>
              {finished ? <Badge variant={outcomeVariant(c.callSuccessful)}>{outcomeLabel(c.callSuccessful)}</Badge> : <Badge variant={callStatusVariant(c.status)}>{c.status.replace("_", " ")}</Badge>}
              {c.direction ? <Badge variant="outline">{c.direction}</Badge> : null}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
              {c.agentName ? <span>{c.agentName}</span> : null}
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3" />
                {formatDuration(c.durationSecs)}
              </span>
              {c.batchCallId ? <span>batch</span> : null}
            </div>
          </div>
          <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" />
        </div>
        {c.summary ? <p className="mt-2 line-clamp-2 text-[13px] text-muted-foreground">{c.summary}</p> : null}
        {c.zohoSync ? (
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            {c.zohoSync.updatedFields?.length ? (
              <span>
                <span className="text-muted-foreground">Fields updated:</span> {c.zohoSync.updatedFields.join(", ")}
              </span>
            ) : (
              <span className="text-muted-foreground">No fields updated</span>
            )}
            {c.zohoSync.skippedFields?.length ? <span className="text-muted-foreground">{c.zohoSync.skippedFields.length} skipped (already filled)</span> : null}
            <span className={cn("inline-flex items-center gap-1", pushed ? "text-emerald-700 dark:text-emerald-300" : "text-muted-foreground")}>
              {pushed ? <Check className="size-3.5" /> : <XCircle className="size-3.5" />}
              Zoho {pushed ? "pushed" : zohoErr ? "failed" : "not pushed"}
            </span>
            {zohoErr ? (
              <span className="truncate text-destructive" title={zohoErr}>
                {zohoErr}
              </span>
            ) : null}
          </div>
        ) : null}
        {c.extraction ? <ExtractionLine extraction={c.extraction} /> : null}
      </Link>
    </li>
  );
}

function ExtractionLine({ extraction }: { extraction: NonNullable<Conversation["extraction"]> }) {
  const provider = extractionProviderLabel(extraction.provider);
  const keys = Object.keys(extraction.extracted ?? {});
  return (
    <div className="mt-1.5 flex items-start gap-1.5 text-xs">
      <Sparkles className="mt-0.5 size-3 shrink-0 text-muted-foreground" />
      {keys.length ? (
        <span className="min-w-0 break-words">
          <span className="text-muted-foreground">Extracted by {provider}:</span> {keys.join(", ")}
        </span>
      ) : extraction.error ? (
        <span className="min-w-0 truncate text-muted-foreground" title={extraction.error}>
          {provider} extraction failed — {extraction.error}
        </span>
      ) : extraction.skipped ? (
        <span className="min-w-0 truncate text-muted-foreground" title={extraction.skipped}>
          {provider} extraction skipped — {extraction.skipped}
        </span>
      ) : (
        <span className="text-muted-foreground">{provider}: nothing extracted</span>
      )}
    </div>
  );
}

// ---------------- Activity ----------------

function ActivityTab({ lead, zohoUrl }: { lead: Lead; zohoUrl: string | null }) {
  const lists = useLeadLists();
  const memberOf = useMemo(() => {
    const ids = new Set(lead.listIds ?? []);
    return (lists.data?.items ?? []).filter((l) => ids.has(l._id));
  }, [lists.data, lead.listIds]);
  const unknownLists = (lead.listIds?.length ?? 0) - memberOf.length;
  const rows: { label: string; value: React.ReactNode }[] = [
    {
      label: "Lists",
      value: lists.isLoading ? (
        <Skeleton className="h-4 w-40" />
      ) : memberOf.length || unknownLists > 0 ? (
        <span className="flex flex-wrap items-center gap-1.5">
          {memberOf.map((l) => (
            <Link key={l._id} href={`/leads/${l._id}`} className="inline-flex">
              <Badge variant={l.source === "zoho" ? "soft" : "outline"} className="hover:underline">
                <Table2 /> {l.name}
              </Badge>
            </Link>
          ))}
          {unknownLists > 0 ? <span className="text-xs text-muted-foreground">+{unknownLists} unknown</span> : null}
        </span>
      ) : (
        <span className="text-muted-foreground">
          Only in{" "}
          <Link href="/leads/all" className="text-foreground hover:underline">
            All leads
          </Link>
        </span>
      ),
    },
    { label: "Created", value: <Stamp date={lead.createdAt} /> },
    { label: "Updated", value: <Stamp date={lead.updatedAt} /> },
    { label: "Synced from Zoho", value: lead.syncedAt ? <Stamp date={lead.syncedAt} /> : <span className="text-muted-foreground">Never</span> },
    {
      label: "Zoho ID",
      value: lead.zohoId ? (
        <span className="inline-flex items-center gap-2">
          <span className="font-mono text-[12.5px]">{lead.zohoId}</span>
          {zohoUrl ? (
            <a href={zohoUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
              <ExternalLink className="size-3.5" />
            </a>
          ) : null}
        </span>
      ) : (
        <span className="text-muted-foreground">Not linked</span>
      ),
    },
    { label: "Source", value: sourceLabel(lead.source) },
    { label: "Calls", value: lead.callCount ?? 0 },
    {
      label: "Last call",
      value: lead.lastCallAt ? (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <Stamp date={lead.lastCallAt} />
          {lead.lastCallOutcome ? <Badge variant={outcomeVariant(lead.lastCallOutcome)}>{outcomeLabel(lead.lastCallOutcome)}</Badge> : null}
          {lead.lastCallStatus && lead.lastCallStatus !== "done" ? <Badge variant={callStatusVariant(lead.lastCallStatus)}>{lead.lastCallStatus.replace("_", " ")}</Badge> : null}
        </span>
      ) : (
        <span className="text-muted-foreground">Never called</span>
      ),
    },
    { label: "Last agent", value: lead.lastAgentId ? <span className="font-mono text-[12.5px]">{lead.lastAgentId}</span> : <span className="text-muted-foreground">—</span> },
    { label: "Tags", value: lead.tags?.length ? lead.tags.map((t) => <Badge key={t} variant="outline" className="mr-1">{t}</Badge>) : <span className="text-muted-foreground">—</span> },
  ];
  return (
    <div className="space-y-5">
      <dl className="divide-y divide-border rounded-lg border border-border">
        {rows.map((r) => (
          <div key={r.label} className="grid grid-cols-[140px_1fr] gap-3 px-3 py-2.5 text-[13px]">
            <dt className="text-muted-foreground">{r.label}</dt>
            <dd className="min-w-0 break-words">{r.value}</dd>
          </div>
        ))}
      </dl>
      {lead.lastCallSummary ? (
        <div>
          <div className="mb-1.5 text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Last call summary</div>
          <p className="rounded-lg border border-border bg-muted/30 p-3 text-[13px] leading-relaxed">{lead.lastCallSummary}</p>
        </div>
      ) : null}
    </div>
  );
}

function Stamp({ date }: { date?: string }) {
  if (!date) return <span className="text-muted-foreground">—</span>;
  return (
    <span>
      {formatDateTime(date)} <span className="text-muted-foreground">· {relativeTime(date)}</span>
    </span>
  );
}
