"use client";
import { Braces, User } from "lucide-react";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DYNAMIC_VARIABLES } from "../agent-utils";
import { Chip, Grid2, KeyValueEditor, SectionCard, SubHeading } from "./primitives";
import type { SectionProps } from "./sections";

export function IdentitySection({
  cfg,
  set,
  errors,
  name,
  description,
  onNameChange,
  onDescriptionChange,
}: SectionProps & { name: string; description: string; onNameChange: (v: string) => void; onDescriptionChange: (v: string) => void }) {
  const insertVar = (v: string) => {
    const cur = cfg.first_message;
    set("first_message", `${cur}${cur && !/\s$/.test(cur) ? " " : ""}{{${v}}}`);
  };

  return (
    <SectionCard id="identity" title="Identity" description="How the agent introduces itself and the instructions it follows." icon={User}>
      <Grid2>
        <Field label="Agent name" htmlFor="agent-name" error={errors.name}>
          <Input id="agent-name" value={name} onChange={(e) => onNameChange(e.target.value)} placeholder="e.g. Lead Qualifier – Riya" maxLength={120} className={errors.name ? "border-destructive" : undefined} />
        </Field>
        <Field label="Description" hint="optional" htmlFor="agent-desc" help="Internal note shown on the agents list.">
          <Input id="agent-desc" value={description} onChange={(e) => onDescriptionChange(e.target.value)} placeholder="Qualifies inbound Zoho leads for the sales team" maxLength={500} />
        </Field>
      </Grid2>

      <Field label="First message" htmlFor="first-message" error={errors.first_message} help="Leave empty to let the caller speak first. Variables are filled per lead automatically.">
        <Textarea id="first-message" rows={3} value={cfg.first_message} onChange={(e) => set("first_message", e.target.value)} placeholder="Hi {{name}}, this is {{agent_name}} calling from Matrix. Do you have a quick moment?" />
      </Field>

      <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Braces className="size-3.5" /> Dynamic variables — click to insert into the first message
        </div>
        <div className="flex flex-wrap gap-1.5">
          {DYNAMIC_VARIABLES.map((v) => (
            <Chip key={v.name} onClick={() => insertVar(v.name)} className="font-mono" title={v.description}>
              {`{{${v.name}}}`}
            </Chip>
          ))}
          <Chip onClick={() => insertVar("zoho_Lead_Status")} className="font-mono" title="Any Zoho field, prefixed with zoho_">
            {"{{zoho_<field>}}"}
          </Chip>
        </div>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          When a lead is called, Matrix passes <code className="rounded bg-muted px-1">name</code>, <code className="rounded bg-muted px-1">first_name</code>, <code className="rounded bg-muted px-1">company</code>, <code className="rounded bg-muted px-1">agent_name</code>,{" "}
          <code className="rounded bg-muted px-1">lead_status</code> and every Zoho field as <code className="rounded bg-muted px-1">zoho_&lt;api_name&gt;</code>. They work in the first message and the system prompt.
        </p>
      </div>

      <Field
        label="System prompt"
        htmlFor="system-prompt"
        error={errors.system_prompt}
        help={
          <span className="flex items-center justify-between gap-4">
            <span>Persona, goals, qualification questions and guardrails. Markdown is fine.</span>
            <span className="shrink-0 tabular-nums">{cfg.system_prompt.length.toLocaleString()} chars</span>
          </span>
        }
      >
        <Textarea
          id="system-prompt"
          rows={14}
          value={cfg.system_prompt}
          onChange={(e) => set("system_prompt", e.target.value)}
          spellCheck={false}
          placeholder="You are a friendly, professional voice assistant…"
          className={`min-h-[300px] font-mono text-[13px] leading-relaxed ${errors.system_prompt ? "border-destructive" : ""}`}
        />
      </Field>

      <div className="flex flex-col gap-3">
        <SubHeading title="Variable placeholders" description="Fallback values used when a variable isn't supplied — e.g. browser test calls or leads with missing fields." />
        <KeyValueEditor value={cfg.dynamic_variable_placeholders} onChange={(v) => set("dynamic_variable_placeholders", v)} keyPlaceholder="variable (e.g. name)" valuePlaceholder="fallback value (e.g. there)" addLabel="Add placeholder" />
      </div>
    </SectionCard>
  );
}
