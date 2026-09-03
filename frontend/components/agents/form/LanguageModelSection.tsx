"use client";
import { useMemo } from "react";
import { Languages } from "lucide-react";
import type { CatalogOption } from "@/lib/types";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Chip, Grid2, NumberField, SectionCard, SliderField, SubHeading, SwitchRow } from "./primitives";
import type { SectionProps } from "./sections";

const NONE = "__default__";
const REASONING: CatalogOption[] = [
  { value: "none", label: "None", description: "Fastest — skip extended reasoning" },
  { value: "minimal", label: "Minimal" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High", description: "Slowest, most deliberate" },
];

export function LanguageModelSection({ cfg, set, catalog, errors }: SectionProps) {
  const groups = useMemo(() => {
    const order: string[] = [];
    const map = new Map<string, CatalogOption[]>();
    for (const m of catalog.llmModels) {
      const g = m.group ?? "Other";
      if (!map.has(g)) {
        map.set(g, []);
        order.push(g);
      }
      map.get(g)!.push(m);
    }
    return order.map((g) => ({ group: g, items: map.get(g)! }));
  }, [catalog.llmModels]);

  const toggleExtra = (code: string) => set("additional_languages", cfg.additional_languages.includes(code) ? cfg.additional_languages.filter((c) => c !== code) : [...cfg.additional_languages, code]);

  return (
    <SectionCard id="language-model" title="Language & model" description="What the agent speaks and the LLM that drives the conversation." icon={Languages}>
      <Grid2>
        <Field label="Primary language" error={errors.language}>
          <Select value={cfg.language} onValueChange={(v) => set("language", v)}>
            <SelectTrigger>
              <SelectValue placeholder="Select language" />
            </SelectTrigger>
            <SelectContent>
              {catalog.languages.map((l) => (
                <SelectItem key={l.value} value={l.value} description={l.nativeName !== l.label ? l.nativeName : undefined}>
                  {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="LLM" error={errors.llm}>
          <Select value={cfg.llm} onValueChange={(v) => set("llm", v)}>
            <SelectTrigger>
              <SelectValue placeholder="Select model" />
            </SelectTrigger>
            <SelectContent>
              {groups.map((g) => (
                <SelectGroup key={g.group}>
                  <SelectLabel>{g.group}</SelectLabel>
                  {g.items.map((m) => (
                    <SelectItem key={m.value} value={m.value} description={m.description}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </Grid2>

      {cfg.language === "hi" ? (
        <SwitchRow label="Hinglish mode" help="Let the agent mix Hindi and English naturally, the way most callers in India speak." checked={cfg.hinglish_mode} onCheckedChange={(v) => set("hinglish_mode", v)} />
      ) : null}

      <div className="flex flex-col gap-2">
        <SubHeading
          title="Additional languages"
          description={
            <>
              The agent can switch to these when the caller does — enable the <em>Language detection</em> tool below.
              {cfg.additional_languages.length ? ` ${cfg.additional_languages.length} selected.` : ""}
            </>
          }
        />
        <div className="flex flex-wrap gap-1.5">
          {catalog.languages
            .filter((l) => l.value !== cfg.language)
            .map((l) => (
              <Chip key={l.value} active={cfg.additional_languages.includes(l.value)} onClick={() => toggleExtra(l.value)} title={l.nativeName}>
                {l.label}
              </Chip>
            ))}
        </div>
      </div>

      {cfg.llm === "custom-llm" ? (
        <Grid2 className="rounded-lg border border-border bg-muted/30 p-4">
          <Field label="Custom LLM URL" error={errors.custom_llm_url} help="OpenAI-compatible chat-completions endpoint.">
            <Input value={cfg.custom_llm_url ?? ""} onChange={(e) => set("custom_llm_url", e.target.value)} placeholder="https://llm.example.com/v1" className={errors.custom_llm_url ? "border-destructive" : undefined} />
          </Field>
          <Field label="Model ID" hint="optional">
            <Input value={cfg.custom_llm_model_id ?? ""} onChange={(e) => set("custom_llm_model_id", e.target.value)} placeholder="my-finetuned-model" />
          </Field>
        </Grid2>
      ) : null}

      <div className="grid gap-5 md:grid-cols-[1.2fr_1fr_1fr]">
        <SliderField label="Temperature" hint="0 = on-script · 1 = creative" value={cfg.temperature} min={0} max={1} step={0.05} onChange={(v) => set("temperature", v)} help="Lower values keep answers predictable." />
        <NumberField label="Max tokens" hint="optional" value={cfg.max_tokens} onChange={(v) => set("max_tokens", v)} min={1} max={64000} placeholder="Model default" allowEmpty error={errors.max_tokens} help="Cap on tokens per LLM reply." />
        <Field label="Reasoning effort" hint="optional" help="Only applies to reasoning-capable models.">
          <Select value={cfg.reasoning_effort || NONE} onValueChange={(v) => set("reasoning_effort", v === NONE ? undefined : v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Model default</SelectItem>
              {REASONING.map((r) => (
                <SelectItem key={r.value} value={r.value} description={r.description}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
    </SectionCard>
  );
}
