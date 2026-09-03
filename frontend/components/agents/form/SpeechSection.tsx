"use client";
import { Ear } from "lucide-react";
import type { AgentFormConfig } from "@/lib/types";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Grid2, NumberField, RadioCards, SectionCard, SubHeading, SwitchRow, TagInput } from "./primitives";
import type { SectionProps } from "./sections";

export function SpeechSection({ cfg, set, catalog, errors }: SectionProps) {
  const minutes = cfg.max_duration_seconds > 0 ? (cfg.max_duration_seconds / 60).toFixed(cfg.max_duration_seconds % 60 ? 1 : 0) : "0";
  return (
    <SectionCard id="speech" title="Speech recognition & turn-taking" description="How the agent hears the caller and decides when to speak." icon={Ear}>
      <Grid2>
        <Field label="ASR provider">
          <Select value={cfg.asr_provider} onValueChange={(v) => set("asr_provider", v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {catalog.asrProviders.map((p) => (
                <SelectItem key={p.value} value={p.value} description={p.description}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Input audio format" help="Match your telephony provider — Twilio sends 8 kHz μ-law.">
          <Select value={cfg.user_input_audio_format} onValueChange={(v) => set("user_input_audio_format", v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {catalog.audioFormats.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </Grid2>

      <Field label="Keyword boosting" hint="optional" help="Product names, brands or jargon the recogniser should favour. Press Enter after each keyword.">
        <TagInput value={cfg.asr_keywords} onChange={(v) => set("asr_keywords", v)} placeholder="e.g. CandexAI, Matrix, Zoho" ariaLabel="ASR keywords" />
      </Field>

      <div className="flex flex-col gap-3">
        <SubHeading title="Turn-taking" description="When the agent decides the caller has finished speaking." />
        <RadioCards
          options={catalog.turnModes.map((m) => ({ value: m.value as AgentFormConfig["turn_mode"], label: m.label, description: m.description }))}
          value={cfg.turn_mode}
          onChange={(v) => set("turn_mode", v)}
        />
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        <NumberField label="Turn timeout" value={cfg.turn_timeout} onChange={(v) => set("turn_timeout", v ?? 7)} min={1} max={30} suffix="sec" error={errors.turn_timeout} help="Silence before the agent assumes it's their turn (1–30 s)." />
        <NumberField
          label="End call on silence"
          value={cfg.silence_end_call_timeout}
          onChange={(v) => set("silence_end_call_timeout", v ?? -1)}
          min={-1}
          max={3600}
          suffix="sec"
          error={errors.silence_end_call_timeout}
          help={cfg.silence_end_call_timeout < 0 ? "-1 = never hang up on silence." : `Hangs up after ${cfg.silence_end_call_timeout}s of silence.`}
        />
        <Field label="Eagerness" help="How quickly the agent jumps in after a pause.">
          <Select value={cfg.turn_eagerness} onValueChange={(v) => set("turn_eagerness", v as AgentFormConfig["turn_eagerness"])}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {catalog.turnEagerness.map((e) => (
                <SelectItem key={e.value} value={e.value} description={e.description}>
                  {e.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <SwitchRow
        label="Don't allow interruptions during the first message"
        help="The greeting always plays to the end, even if the caller starts talking."
        checked={cfg.disable_first_message_interruptions}
        onCheckedChange={(v) => set("disable_first_message_interruptions", v)}
      />

      <Grid2>
        <NumberField label="Max call duration" value={cfg.max_duration_seconds} onChange={(v) => set("max_duration_seconds", v ?? 600)} min={30} max={7200} suffix="sec" error={errors.max_duration_seconds} help={`≈ ${minutes} minutes. The call is ended automatically after this.`} />
        <Field label="Time's-up message" hint="optional" help="Said right before the agent hangs up for hitting the limit.">
          <Input value={cfg.max_conversation_duration_message ?? ""} onChange={(e) => set("max_conversation_duration_message", e.target.value)} placeholder="I have to wrap up now — thanks for your time!" />
        </Field>
      </Grid2>
    </SectionCard>
  );
}
