"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Search, Trash2, X, Link2, Layers } from "lucide-react";
import type { ZohoFieldMeta } from "@/lib/types";
import { useAgents, useLeadBinding, useLeadList, usePhoneNumbers, useSetLeadBinding, useZohoFields } from "@/hooks/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { AgentPicker, AUTO_PHONE, PhonePicker } from "./AgentPhonePickers";
import { StatusPicker } from "./StatusPicker";
import { isRealListId, NON_COLLECTABLE_COLUMNS } from "./leadUtils";

interface FieldSel {
  zohoField: string;
  label: string;
  dataType: string;
  description: string;
}

const SKIP_TYPES = new Set(["subform", "fileupload", "imageupload", "profileimage", "lookup", "ownerlookup", "multiselectlookup", "userlookup", "consent_lookup", "formula", "rollup_summary", "autonumber"]);
const SKIP_FIELDS = new Set(["Owner", "Created_By", "Modified_By", "Created_Time", "Modified_Time", "Last_Activity_Time", "Record_Image", "Tag", "Layout", "Full_Name", "id"]);

function defaultInstruction(label: string, meta?: ZohoFieldMeta): string {
  const pick = meta?.pick_list_values?.length ? ` One of: ${meta.pick_list_values.map((p) => p.display_value).join(", ")}.` : "";
  return `${label} of the lead.${pick}`;
}

function StepHeading({ n, title, hint }: { n: number; title: string; hint?: string }) {
  return (
    <div className="mb-3 flex items-center gap-2.5">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-tint font-heading text-[13px] text-primary-hover">{n}</span>
      <h4 className="font-heading text-[16px] leading-none">{title}</h4>
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </div>
  );
}

export interface AttachAgentDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Table to bind. `null` / `undefined` / `"all"` = the workspace default binding. */
  listId?: string | null;
  listName?: string;
  zohoConnected: boolean;
}

/**
 * Attach / configure the voice agent for one lead table, or the workspace default.
 * Fetches the current binding itself: a list without its own binding gets the default one flagged `inherited`,
 * in which case saving creates a list-specific copy instead of editing the default.
 */
export function AttachAgentDialog({ open, onOpenChange, listId, listName, zohoConnected }: AttachAgentDialogProps) {
  const scopedId = isRealListId(listId) ? listId : null;
  const bindingQ = useLeadBinding(scopedId);
  const listQ = useLeadList(scopedId ?? undefined);
  const agents = useAgents();
  const phones = usePhoneNumbers();
  const zohoFields = useZohoFields(zohoConnected && open);
  const save = useSetLeadBinding();

  const binding = bindingQ.data ?? null;
  const list = listQ.data ?? null;
  const inherited = Boolean(scopedId && binding?.inherited);
  const own = binding && !inherited ? binding : null;
  const scopeName = scopedId ? listName ?? list?.name ?? "this list" : null;
  const isZohoView = list?.source === "zoho";

  const [agentId, setAgentId] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState(AUTO_PHONE);
  const [fields, setFields] = useState<FieldSel[]>([]);
  const [prechecked, setPrechecked] = useState(false);
  const [search, setSearch] = useState("");
  const [onlyFillEmpty, setOnlyFillEmpty] = useState(true);
  const [pushToZoho, setPushToZoho] = useState(true);
  const [statusAfter, setStatusAfter] = useState("");

  useEffect(() => {
    if (!open) return;
    setAgentId(binding?.agentId ?? binding?.agent?._id ?? "");
    setPhoneNumberId(binding?.phoneNumberId ?? AUTO_PHONE);
    let initial: FieldSel[];
    let pre = false;
    if (binding) {
      initial = binding.fields?.map((f) => ({ zohoField: f.zohoField, label: f.label, dataType: f.dataType, description: f.description })) ?? [];
    } else if (isZohoView && list?.resolvedColumns?.length) {
      // No binding yet: pre-check the view's fillable columns as a sensible default.
      initial = list.resolvedColumns
        .filter((c) => !NON_COLLECTABLE_COLUMNS.has(c.api_name) && !SKIP_FIELDS.has(c.api_name) && !SKIP_TYPES.has(c.data_type))
        .map((c) => ({ zohoField: c.api_name, label: c.label, dataType: c.data_type, description: defaultInstruction(c.label) }));
      pre = initial.length > 0;
    } else {
      initial = zohoConnected ? [] : [{ zohoField: "", label: "", dataType: "text", description: "" }];
    }
    setFields(initial);
    setPrechecked(pre);
    setOnlyFillEmpty(binding?.onlyFillEmpty ?? true);
    setPushToZoho(binding?.pushToZoho ?? true);
    setStatusAfter(binding?.updateLeadStatusTo ?? "");
    setSearch("");
  }, [open, binding, list, isZohoView, zohoConnected]);

  const writable = useMemo(() => (zohoFields.data ?? []).filter((f) => !f.read_only && !SKIP_TYPES.has(f.data_type) && !SKIP_FIELDS.has(f.api_name)), [zohoFields.data]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return writable;
    return writable.filter((f) => f.field_label.toLowerCase().includes(q) || f.api_name.toLowerCase().includes(q));
  }, [writable, search]);
  const statusOptions = useMemo(() => zohoFields.data?.find((f) => f.api_name === "Lead_Status")?.pick_list_values?.map((p) => p.display_value) ?? [], [zohoFields.data]);
  const viewColumnSet = useMemo(() => new Set(list?.resolvedColumns?.map((c) => c.api_name) ?? []), [list?.resolvedColumns]);

  const selectedSet = useMemo(() => new Set(fields.map((f) => f.zohoField)), [fields]);
  const toggleField = (meta: ZohoFieldMeta) => {
    setFields((prev) => {
      if (prev.some((f) => f.zohoField === meta.api_name)) return prev.filter((f) => f.zohoField !== meta.api_name);
      return [...prev, { zohoField: meta.api_name, label: meta.field_label, dataType: meta.data_type, description: defaultInstruction(meta.field_label, meta) }];
    });
  };
  const updateField = (i: number, patch: Partial<FieldSel>) => setFields((prev) => prev.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  const removeField = (i: number) => setFields((prev) => prev.filter((_, idx) => idx !== i));

  const validFields = fields.filter((f) => f.zohoField.trim());
  const canSave = Boolean(agentId) && !save.isPending && !bindingQ.isLoading;

  const submit = () => {
    save.mutate(
      {
        listId: scopedId,
        agentId,
        phoneNumberId: phoneNumberId === AUTO_PHONE ? undefined : phoneNumberId,
        fields: validFields.map((f) => ({ zohoField: f.zohoField.trim(), label: f.label.trim() || undefined, dataType: f.dataType || undefined, description: f.description.trim() || undefined })),
        onlyFillEmpty,
        pushToZoho,
        updateLeadStatusTo: statusAfter.trim() || undefined,
      },
      { onSuccess: () => onOpenChange(false) }
    );
  };

  const title = scopeName ? (own ? `Configure agent for ${scopeName}` : `Attach voice agent to ${scopeName}`) : own ? "Configure default voice agent" : "Default voice agent";
  const description = scopeName
    ? "The agent calls leads from this table, collects the fields below, and writes them back to empty Zoho fields after each call."
    : "Used by every table that has no agent of its own. It collects the fields below and writes them back to empty Zoho fields after each call.";
  const saveLabel = own ? "Save changes" : inherited ? "Attach for this list" : "Attach agent";
  const boundLabel = inherited || !scopedId ? "default agent" : `attached to ${scopeName}`;
  const fieldsHint = !zohoConnected ? "Zoho not connected — define fields manually" : prechecked ? "Pre-selected from this view's columns" : "Writable Zoho Lead fields";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-7">
          {inherited && binding ? (
            <div className="flex items-start gap-2.5 rounded-lg border border-primary/30 bg-accent-tint/40 px-3.5 py-3 text-sm">
              <Layers className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>
                <span className="font-medium">Starts from the default agent{binding.agent?.name ? ` “${binding.agent.name}”` : ""}.</span>{" "}
                <span className="text-muted-foreground">Saving creates a separate setup for {scopeName}; the default stays unchanged for other tables.</span>
              </span>
            </div>
          ) : null}

          <section>
            <StepHeading n={1} title="Agent" />
            {bindingQ.isLoading ? <Skeleton className="h-9 w-full" /> : <AgentPicker agents={agents.data} loading={agents.isLoading} value={agentId} onChange={setAgentId} boundAgentId={binding?.agentId} boundLabel={boundLabel} />}
          </section>

          <section>
            <StepHeading n={2} title="Outbound number" hint="ElevenLabs phone number the agent calls from" />
            <PhonePicker numbers={phones.data} loading={phones.isLoading} error={phones.error} value={phoneNumberId} onChange={setPhoneNumberId} />
          </section>

          <section>
            <StepHeading n={3} title="Fields to collect during the call" hint={fieldsHint} />
            {zohoConnected ? (
              <div className="space-y-3">
                {fields.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {fields.map((f, i) => (
                      <Badge key={f.zohoField} variant="soft" className="gap-1 pr-1">
                        {f.label || f.zohoField}
                        <button type="button" onClick={() => removeField(i)} className="rounded-full p-0.5 hover:bg-primary/20" aria-label={`Remove ${f.label}`}>
                          <X className="size-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Nothing selected yet — pick the fields the agent should ask about.</p>
                )}
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search fields by label or api_name…" className="pl-8" />
                </div>
                <div className="max-h-72 overflow-y-auto rounded-lg border border-border">
                  {zohoFields.isLoading ? (
                    <div className="space-y-2 p-3">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <Skeleton key={i} className="h-8 w-full" />
                      ))}
                    </div>
                  ) : zohoFields.error ? (
                    <div className="p-4 text-sm text-muted-foreground">Could not load Zoho field metadata. Re-sync from the Integrations page and try again.</div>
                  ) : !filtered.length ? (
                    <div className="p-4 text-sm text-muted-foreground">No fields match “{search}”.</div>
                  ) : (
                    <ul className="divide-y divide-border">
                      {filtered.map((meta) => {
                        const idx = fields.findIndex((f) => f.zohoField === meta.api_name);
                        const checked = idx >= 0;
                        return (
                          <li key={meta.api_name} className={cn("px-3 py-2", checked && "bg-accent-tint/30")}>
                            <label className="flex cursor-pointer items-center gap-3">
                              <Checkbox checked={checked} onCheckedChange={() => toggleField(meta)} />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm">{meta.field_label}</span>
                                <span className="block truncate font-mono text-[11px] text-muted-foreground">{meta.api_name}</span>
                              </span>
                              {isZohoView && viewColumnSet.has(meta.api_name) ? <Badge variant="outline">in view</Badge> : null}
                              <Badge variant="outline" className="shrink-0 font-mono text-[10px]">
                                {meta.data_type}
                              </Badge>
                              {meta.custom_field ? <Badge variant="violet">custom</Badge> : null}
                            </label>
                            {checked ? (
                              <div className="mt-2 pl-7">
                                <Field label="Instruction for the agent" className="gap-1">
                                  <Textarea value={fields[idx].description} onChange={(e) => updateField(idx, { description: e.target.value })} className="min-h-[56px] text-[13px]" />
                                </Field>
                              </div>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
                {selectedSet.size > filtered.filter((f) => selectedSet.has(f.api_name)).length && search ? <p className="text-xs text-muted-foreground">Some selected fields are hidden by the search filter.</p> : null}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-start gap-2 rounded-md border border-dashed border-border bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground">
                  <Link2 className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span>
                    <Link href="/integrations" className="font-medium text-primary hover:underline">
                      Connect Zoho CRM
                    </Link>{" "}
                    to pick fields from your CRM. Until then, enter the Zoho api_name for each field.
                  </span>
                </div>
                <div className="space-y-2">
                  {fields.map((f, i) => (
                    <div key={i} className="rounded-lg border border-border p-3">
                      <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
                        <Field label="Zoho api_name" className="gap-1">
                          <Input value={f.zohoField} onChange={(e) => updateField(i, { zohoField: e.target.value.replace(/\s+/g, "_") })} placeholder="Budget" className="font-mono text-[13px]" />
                        </Field>
                        <Field label="Label" className="gap-1">
                          <Input value={f.label} onChange={(e) => updateField(i, { label: e.target.value, description: f.description || (e.target.value ? defaultInstruction(e.target.value) : "") })} placeholder="Budget" />
                        </Field>
                        <div className="flex items-end">
                          <Button type="button" variant="ghost" size="icon" onClick={() => removeField(i)} aria-label="Remove field">
                            <Trash2 className="text-muted-foreground" />
                          </Button>
                        </div>
                      </div>
                      <Field label="Instruction for the agent" className="mt-2 gap-1">
                        <Textarea value={f.description} onChange={(e) => updateField(i, { description: e.target.value })} placeholder="What should the agent ask? e.g. Approximate budget for this purchase, in INR." className="min-h-[56px] text-[13px]" />
                      </Field>
                    </div>
                  ))}
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => setFields((p) => [...p, { zohoField: "", label: "", dataType: "text", description: "" }])}>
                  <Plus /> Add field
                </Button>
              </div>
            )}
          </section>

          <section>
            <StepHeading n={4} title="After the call" />
            <div className="divide-y divide-border rounded-lg border border-border px-4">
              <Field inline label="Only fill fields that are empty" help="Never overwrite values that already exist in Zoho.">
                <Switch checked={onlyFillEmpty} onCheckedChange={setOnlyFillEmpty} />
              </Field>
              <Field inline label="Push updates to Zoho" help="Write collected answers back to the CRM record.">
                <Switch checked={pushToZoho} onCheckedChange={setPushToZoho} />
              </Field>
              <Field inline label="Set Lead Status after call" help="Optional. Applied when the call completes successfully." className="items-center">
                <div className="w-56">
                  <StatusPicker value={statusAfter} onChange={setStatusAfter} options={statusOptions} placeholder="Don't change" noneLabel="Don't change" />
                </div>
              </Field>
            </div>
          </section>
        </DialogBody>
        <DialogFooter className="justify-between">
          <span className="text-xs text-muted-foreground">
            {validFields.length} field{validFields.length === 1 ? "" : "s"} · data collection schema is synced to the agent
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={submit} loading={save.isPending} disabled={!canSave}>
              {saveLabel}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
