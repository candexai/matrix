"use client";
import { Database, Plus, Trash2 } from "lucide-react";
import { useZohoFields, useZohoStatus } from "@/hooks/api";
import type { DataCollectionField, EvaluationCriterion } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toSnake } from "../agent-utils";
import { AddButton, Chip, SectionCard, SubHeading } from "./primitives";
import type { SectionProps } from "./sections";

const NONE = "__none__";
const SAME = "__same__";

const SUGGESTED: DataCollectionField[] = [
  { key: "interested", type: "boolean", description: "Whether the lead expressed interest in the offering" },
  { key: "budget", type: "string", description: "Budget range the lead mentioned, if any" },
  { key: "timeline", type: "string", description: "When the lead plans to decide or buy" },
  { key: "callback_time", type: "string", description: "Preferred date/time for a follow-up call" },
  { key: "email", type: "string", description: "Email address the lead confirmed or provided" },
  { key: "objections", type: "string", description: "Main concerns or objections raised" },
];

export function DataSection({ cfg, set, catalog, errors }: SectionProps) {
  const zoho = useZohoStatus();
  const connected = Boolean(zoho.data?.connected);
  const zohoFields = useZohoFields(connected);
  const writable = (zohoFields.data ?? []).filter((f) => !f.read_only);

  const fields = cfg.data_collection;
  const updateField = (i: number, patch: Partial<DataCollectionField>) => set("data_collection", fields.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  const removeField = (i: number) => set("data_collection", fields.filter((_, j) => j !== i));
  const addField = (preset?: DataCollectionField) => set("data_collection", [...fields, preset ? { ...preset } : { key: "", type: "string", description: "" }]);
  const existingKeys = new Set(fields.map((f) => toSnake(f.key)));

  const criteria = cfg.evaluation_criteria;
  const updateCriterion = (i: number, patch: Partial<EvaluationCriterion>) => set("evaluation_criteria", criteria.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const removeCriterion = (i: number) => set("evaluation_criteria", criteria.filter((_, j) => j !== i));
  const addCriterion = () => set("evaluation_criteria", [...criteria, { id: "", name: "", conversation_goal_prompt: "" }]);

  return (
    <SectionCard id="data" title="Data collection & evaluation" description="What to extract from each call and how to judge it." icon={Database}>
      <div className="flex flex-col gap-3">
        <SubHeading
          title="Data collection"
          description="Collected values fill EMPTY lead fields and sync to Zoho after each call."
          action={
            connected ? (
              <Badge variant="success">Zoho connected</Badge>
            ) : (
              <Badge variant="secondary">Zoho not connected</Badge>
            )
          }
        />
        {fields.length ? (
          <div className="overflow-hidden rounded-lg border border-border">
            <div className="hidden grid-cols-[1fr_0.75fr_1.7fr_1.1fr_36px] gap-2 border-b border-border bg-muted/50 px-3 py-2 text-[11px] uppercase tracking-[0.06em] text-muted-foreground md:grid">
              <span>Key</span>
              <span>Type</span>
              <span>What to extract</span>
              <span>Zoho field</span>
              <span />
            </div>
            <div className="divide-y divide-border">
              {fields.map((f, i) => {
                const keyErr = errors[`data_collection.${i}.key`];
                const descErr = errors[`data_collection.${i}.description`];
                return (
                  <div key={i} className="grid gap-2 px-3 py-2.5 md:grid-cols-[1fr_0.75fr_1.7fr_1.1fr_36px] md:items-start">
                    <div>
                      <Input
                        value={f.key}
                        onChange={(e) => updateField(i, { key: e.target.value })}
                        onBlur={() => updateField(i, { key: toSnake(f.key) })}
                        placeholder="budget"
                        aria-label="Key"
                        className={`font-mono text-[13px] ${keyErr ? "border-destructive" : ""}`}
                      />
                      {keyErr ? <p className="mt-1 text-xs text-destructive">{keyErr}</p> : null}
                    </div>
                    <Select value={f.type} onValueChange={(v) => updateField(i, { type: v as DataCollectionField["type"] })}>
                      <SelectTrigger aria-label="Type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {catalog.dataCollectionTypes.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div>
                      <Input value={f.description} onChange={(e) => updateField(i, { description: e.target.value })} placeholder="The budget range the lead mentioned" aria-label="Description" className={descErr ? "border-destructive" : undefined} />
                      {descErr ? <p className="mt-1 text-xs text-destructive">{descErr}</p> : null}
                    </div>
                    {connected ? (
                      <Select value={f.zohoField || NONE} onValueChange={(v) => updateField(i, { zohoField: v === NONE ? undefined : v })}>
                        <SelectTrigger aria-label="Zoho field">
                          <SelectValue placeholder={zohoFields.isPending ? "Loading fields…" : "Map to Zoho…"} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>Don't sync</SelectItem>
                          {writable.map((z) => (
                            <SelectItem key={z.api_name} value={z.api_name} description={z.api_name}>
                              {z.field_label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input value={f.zohoField ?? ""} onChange={(e) => updateField(i, { zohoField: e.target.value || undefined })} placeholder="Zoho API name (optional)" aria-label="Zoho field" className="font-mono text-[13px]" />
                    )}
                    <Button type="button" variant="ghost" size="icon-sm" onClick={() => removeField(i)} aria-label="Remove field" className="justify-self-end md:justify-self-auto">
                      <Trash2 />
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">No fields yet. Add one below or pick a suggestion.</p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <AddButton onClick={() => addField()}>Add field</AddButton>
          <span className="text-xs text-muted-foreground">Suggested:</span>
          {SUGGESTED.filter((s) => !existingKeys.has(s.key)).map((s) => (
            <Chip key={s.key} onClick={() => addField(s)} title={s.description}>
              <Plus className="size-3" /> {s.key}
            </Chip>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <SubHeading title="Evaluation criteria" description="After each call the LLM marks each criterion success / failure / unknown with a rationale." />
        {criteria.length ? (
          <div className="flex flex-col gap-3">
            {criteria.map((c, i) => (
              <div key={i} className="grid gap-3 rounded-lg border border-border p-4 md:grid-cols-[1fr_2fr_36px]">
                <Field label="Name" error={errors[`evaluation_criteria.${i}.name`]}>
                  <Input value={c.name} onChange={(e) => updateCriterion(i, { name: e.target.value, id: toSnake(e.target.value) })} placeholder="Qualified lead" className={errors[`evaluation_criteria.${i}.name`] ? "border-destructive" : undefined} />
                  {c.id ? <span className="font-mono text-[11px] text-muted-foreground">id: {c.id}</span> : null}
                </Field>
                <Field label="Goal prompt" error={errors[`evaluation_criteria.${i}.conversation_goal_prompt`]}>
                  <Textarea rows={2} value={c.conversation_goal_prompt} onChange={(e) => updateCriterion(i, { conversation_goal_prompt: e.target.value })} placeholder="Did the caller confirm a budget and a timeline within the next quarter?" className={errors[`evaluation_criteria.${i}.conversation_goal_prompt`] ? "border-destructive" : undefined} />
                </Field>
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => removeCriterion(i)} aria-label="Remove criterion" className="md:mt-5">
                  <Trash2 />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">No criteria yet — e.g. “Qualified lead”, “Callback booked”.</p>
        )}
        <div>
          <AddButton onClick={addCriterion}>Add criterion</AddButton>
        </div>
      </div>

      <div className="max-w-sm">
        <Field label="Summary language" hint="optional" help="Language used for the post-call summary and evaluation rationale.">
          <Select value={cfg.summary_language || SAME} onValueChange={(v) => set("summary_language", v === SAME ? undefined : v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SAME}>Same as conversation</SelectItem>
              {catalog.languages.map((l) => (
                <SelectItem key={l.value} value={l.value} description={l.nativeName !== l.label ? l.nativeName : undefined}>
                  {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
    </SectionCard>
  );
}
