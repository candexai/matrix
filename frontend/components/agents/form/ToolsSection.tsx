"use client";
import { PhoneForwarded, Trash2, Wrench } from "lucide-react";
import type { HumanTransferRule } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { uniq } from "../agent-utils";
import { AddButton, CheckRow, Grid2, SectionCard, SubHeading, SwitchRow, TagInput } from "./primitives";
import type { SectionProps } from "./sections";

const TRANSFER_TYPES: { value: HumanTransferRule["transfer_type"]; label: string; description: string }[] = [
  { value: "conference", label: "Conference (warm)", description: "Agent stays on until the human joins" },
  { value: "sip_refer", label: "SIP REFER", description: "Hands the call to your SIP trunk" },
  { value: "blind", label: "Blind transfer", description: "Immediate handoff, no introduction" },
];

export function ToolsSection({ cfg, set, catalog, errors }: SectionProps) {
  const has = (t: string) => cfg.built_in_tools.includes(t);
  const toggleTool = (t: string, on: boolean) => {
    set("built_in_tools", on ? uniq([...cfg.built_in_tools, t]) : cfg.built_in_tools.filter((x) => x !== t));
    if (t === "transfer_to_number") set("enable_human_transfer", on);
  };
  const setTransfer = (on: boolean) => {
    set("enable_human_transfer", on);
    set("built_in_tools", on ? uniq([...cfg.built_in_tools, "transfer_to_number"]) : cfg.built_in_tools.filter((x) => x !== "transfer_to_number"));
    if (on && cfg.human_transfer_rules.length === 0) set("human_transfer_rules", [{ condition: "", phone_number: "", transfer_type: "conference" }]);
  };

  const rules = cfg.human_transfer_rules;
  const updateRule = (i: number, patch: Partial<HumanTransferRule>) => set("human_transfer_rules", rules.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const removeRule = (i: number) => set("human_transfer_rules", rules.filter((_, j) => j !== i));
  const addRule = () => set("human_transfer_rules", [...rules, { condition: "", phone_number: "", transfer_type: "conference" }]);

  return (
    <SectionCard id="tools" title="Tools & transfer" description="What the agent is allowed to do beyond talking." icon={Wrench}>
      <div className="flex flex-col gap-3">
        <SubHeading title="Built-in tools" description="System tools ElevenLabs runs for you — no code required." />
        <div className="grid gap-2 md:grid-cols-2">
          {catalog.builtInTools.map((t) => (
            <CheckRow key={t.value} checked={has(t.value)} onCheckedChange={(v) => toggleTool(t.value, v)} label={t.label} description={t.description} />
          ))}
        </div>
        {has("voicemail_detection") ? (
          <Field label="Voicemail message" help="Left on the answering machine when voicemail is detected. Leave empty to hang up silently." error={errors.voicemail_message}>
            <Textarea rows={2} value={cfg.voicemail_message ?? ""} onChange={(e) => set("voicemail_message", e.target.value)} placeholder="Hi {{name}}, this is {{agent_name}} from Matrix. Sorry we missed you — we'll try again soon." />
          </Field>
        ) : null}
      </div>

      <div className="flex flex-col gap-3">
        <SwitchRow
          label={
            <span className="inline-flex items-center gap-1.5">
              <PhoneForwarded className="size-3.5 text-primary" /> Human transfer
            </span>
          }
          help="Let the agent hand the call to a person when a rule matches. Enables the Transfer to human tool."
          checked={cfg.enable_human_transfer}
          onCheckedChange={setTransfer}
        />
        {cfg.enable_human_transfer ? (
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-4">
            {errors.human_transfer_rules ? <p className="text-xs text-destructive">{errors.human_transfer_rules}</p> : null}
            {rules.map((r, i) => (
              <div key={i} className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-medium">Rule {i + 1}</span>
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => removeRule(i)} aria-label="Remove rule">
                    <Trash2 />
                  </Button>
                </div>
                <Field label="When to transfer" error={errors[`human_transfer_rules.${i}.condition`]} help="Plain language — the LLM decides when this applies.">
                  <Textarea rows={2} value={r.condition} onChange={(e) => updateRule(i, { condition: e.target.value })} placeholder="The caller asks to speak with a sales representative or has a pricing question we can't answer." className={errors[`human_transfer_rules.${i}.condition`] ? "border-destructive" : undefined} />
                </Field>
                <Grid2>
                  <Field label="Phone number" hint="E.164" error={errors[`human_transfer_rules.${i}.phone_number`]}>
                    <Input value={r.phone_number} onChange={(e) => updateRule(i, { phone_number: e.target.value.replace(/[^\d+]/g, "") })} placeholder="+14155552671" className={`font-mono ${errors[`human_transfer_rules.${i}.phone_number`] ? "border-destructive" : ""}`} />
                  </Field>
                  <Field label="Transfer type">
                    <Select value={r.transfer_type || "conference"} onValueChange={(v) => updateRule(i, { transfer_type: v as HumanTransferRule["transfer_type"] })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TRANSFER_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value} description={t.description}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </Grid2>
              </div>
            ))}
            <div>
              <AddButton onClick={addRule}>Add transfer rule</AddButton>
            </div>
          </div>
        ) : null}
      </div>

      <Grid2>
        <Field label="Custom tool IDs" hint="optional" help="Server/client tools created in the ElevenLabs dashboard (Tools → copy ID). Press Enter after each.">
          <TagInput value={cfg.tool_ids} onChange={(v) => set("tool_ids", v)} placeholder="tool_01j…" mono ariaLabel="Tool IDs" />
        </Field>
        <Field label="Knowledge base document IDs" hint="optional" help="Documents uploaded under Knowledge Base in ElevenLabs. Attached with usage mode “auto”.">
          <TagInput value={cfg.knowledge_base_ids} onChange={(v) => set("knowledge_base_ids", v)} placeholder="doc_01j…" mono ariaLabel="Knowledge base IDs" />
        </Field>
      </Grid2>
    </SectionCard>
  );
}
