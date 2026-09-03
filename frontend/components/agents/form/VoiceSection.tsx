"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { MicVocal, Pause, Play, RefreshCw, Search, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { useVoices } from "@/hooks/api";
import { errorMessage } from "@/lib/api";
import type { Voice } from "@/lib/types";
import { cn, titleCase } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tip } from "@/components/ui/tooltip";
import { LATENCY_LABEL, LATENCY_OPTIONS, QUALITY_LABEL, optionLabel, primaryCode, shortId, ttsIncompatibleReason } from "../agent-utils";
import { Chip, Grid2, RadioCards, SectionCard, SliderField, SubHeading, SwitchRow } from "./primitives";
import type { SectionProps } from "./sections";

const LABEL_KEYS = ["accent", "age", "gender", "use_case", "descriptive"] as const;
function voiceMeta(v: Voice): string[] {
  return LABEL_KEYS.map((k) => v.labels?.[k])
    .filter((x): x is string => Boolean(x))
    .map((x) => titleCase(x));
}

function PreviewButton({ playing, disabled, onClick }: { playing: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <Tip label={disabled ? "No preview available" : playing ? "Pause preview" : "Play preview"}>
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        aria-label={playing ? "Pause preview" : "Play preview"}
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-40",
          playing ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:border-primary hover:text-primary"
        )}
      >
        {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5 translate-x-px" />}
      </button>
    </Tip>
  );
}

function VoicePicker({ value, onChange, error, language, languageLabel }: { value: string; onChange: (id: string) => void; error?: string; language: string; languageLabel: string }) {
  const voices = useVoices();
  const list = useMemo(() => voices.data ?? [], [voices.data]);
  const [q, setQ] = useState("");
  const [gender, setGender] = useState("");
  const [accent, setAccent] = useState("");
  const [category, setCategory] = useState("");
  const [langOnly, setLangOnly] = useState(false);
  const [manual, setManual] = useState(false);
  const primary = primaryCode(language);

  const facets = useMemo(() => {
    const count = (key: (v: Voice) => string | undefined) => {
      const m = new Map<string, number>();
      for (const v of list) {
        const k = key(v);
        if (k) m.set(k, (m.get(k) ?? 0) + 1);
      }
      return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
    };
    return {
      genders: count((v) => v.labels?.gender),
      accents: count((v) => v.labels?.accent).slice(0, 8),
      categories: count((v) => v.category),
      hasLanguages: list.some((v) => v.languages?.length),
    };
  }, [list]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return list.filter((v) => {
      if (gender && v.labels?.gender !== gender) return false;
      if (accent && v.labels?.accent !== accent) return false;
      if (category && v.category !== category) return false;
      if (langOnly && !(v.languages ?? []).some((l) => primaryCode(l) === primary)) return false;
      if (!needle) return true;
      const hay = [v.name, v.description, v.category, ...Object.values(v.labels ?? {}), ...(v.languages ?? [])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [list, q, gender, accent, category, langOnly, primary]);

  const selected = list.find((v) => v.voice_id === value);
  const anyFilter = Boolean(gender || accent || category || langOnly);

  // one shared <audio>, one preview at a time
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  useEffect(
    () => () => {
      audioRef.current?.pause();
      audioRef.current = null;
    },
    []
  );
  const togglePreview = (v: Voice) => {
    if (!v.preview_url) return;
    if (!audioRef.current) {
      const a = new Audio();
      a.addEventListener("ended", () => setPlaying(null));
      a.addEventListener("error", () => {
        setPlaying(null);
        toast.error("Couldn't play the voice preview");
      });
      audioRef.current = a;
    }
    const a = audioRef.current;
    if (playing === v.voice_id) {
      a.pause();
      setPlaying(null);
      return;
    }
    a.src = v.preview_url;
    a.play()
      .then(() => setPlaying(v.voice_id))
      .catch(() => {
        setPlaying(null);
        toast.error("Couldn't play the voice preview");
      });
  };

  return (
    <div className={cn("overflow-hidden rounded-lg border", error ? "border-destructive" : "border-border")}>
      {/* selected summary */}
      <div className="flex items-center gap-3 border-b border-border bg-muted/30 px-4 py-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-tint text-primary-hover">
          <MicVocal className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          {selected ? (
            <>
              <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                {selected.name}
                <span className="font-mono text-[11px] font-normal text-muted-foreground">{selected.voice_id}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {voiceMeta(selected).map((m) => (
                  <Badge key={m} variant="secondary">
                    {m}
                  </Badge>
                ))}
                {selected.category ? <Badge variant="outline">{titleCase(selected.category)}</Badge> : null}
              </div>
            </>
          ) : value ? (
            <>
              <div className="text-sm font-medium">Custom voice ID</div>
              <div className="font-mono text-xs text-muted-foreground">{value}</div>
            </>
          ) : (
            <>
              <div className="text-sm font-medium">No voice selected</div>
              <div className="text-xs text-muted-foreground">Pick a voice from the list — required.</div>
            </>
          )}
        </div>
        {selected ? <PreviewButton playing={playing === selected.voice_id} disabled={!selected.preview_url} onClick={() => togglePreview(selected)} /> : null}
      </div>

      {/* filters */}
      <div className="flex flex-col gap-2 border-b border-border px-4 py-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, accent, use case…" className="pl-8" />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip
            active={!anyFilter}
            onClick={() => {
              setGender("");
              setAccent("");
              setCategory("");
              setLangOnly(false);
            }}
          >
            All
          </Chip>
          {facets.hasLanguages ? (
            <Chip active={langOnly} onClick={() => setLangOnly((x) => !x)} title={`Only voices verified for ${languageLabel}`}>
              Speaks {languageLabel}
            </Chip>
          ) : null}
          {facets.genders.length ? <span className="mx-1 h-5 w-px bg-border" /> : null}
          {facets.genders.map((g) => (
            <Chip key={g} active={gender === g} onClick={() => setGender(gender === g ? "" : g)}>
              {titleCase(g)}
            </Chip>
          ))}
          {facets.accents.length ? <span className="mx-1 h-5 w-px bg-border" /> : null}
          {facets.accents.map((a) => (
            <Chip key={a} active={accent === a} onClick={() => setAccent(accent === a ? "" : a)}>
              {titleCase(a)}
            </Chip>
          ))}
          {facets.categories.length > 1 ? <span className="mx-1 h-5 w-px bg-border" /> : null}
          {facets.categories.length > 1
            ? facets.categories.map((c) => (
                <Chip key={c} active={category === c} onClick={() => setCategory(category === c ? "" : c)}>
                  {titleCase(c)}
                </Chip>
              ))
            : null}
        </div>
      </div>

      {/* list */}
      <div className="max-h-[380px] overflow-y-auto" role="radiogroup" aria-label="Voices">
        {voices.isPending ? (
          <div className="divide-y divide-border">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="size-4 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3 w-56" />
                </div>
                <Skeleton className="size-8 rounded-full" />
              </div>
            ))}
          </div>
        ) : voices.isError ? (
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
            <TriangleAlert className="size-5 text-warning" />
            <p className="text-sm">Couldn't load voices from ElevenLabs.</p>
            <p className="text-xs text-muted-foreground">{errorMessage(voices.error)}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => voices.refetch()}>
                <RefreshCw /> Retry
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setManual(true)}>
                Enter a voice ID instead
              </Button>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">{list.length ? "No voices match these filters." : "Your ElevenLabs library has no voices yet."}</div>
        ) : (
          filtered.map((v) => {
            const isSel = v.voice_id === value;
            const langs = (v.languages ?? []).slice(0, 4).join(" · ");
            const extra = (v.languages ?? []).length - 4;
            return (
              <div
                key={v.voice_id}
                role="radio"
                aria-checked={isSel}
                tabIndex={0}
                onClick={() => onChange(v.voice_id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onChange(v.voice_id);
                  }
                }}
                className={cn("flex cursor-pointer items-center gap-3 border-b border-border px-4 py-2.5 transition-colors last:border-0 hover:bg-muted/40 focus-visible:bg-muted/60 focus-visible:outline-none", isSel && "bg-accent-tint/30 hover:bg-accent-tint/40")}
              >
                <span className={cn("flex size-4 shrink-0 items-center justify-center rounded-full border", isSel ? "border-primary" : "border-zinc-400")}>{isSel ? <span className="size-2 rounded-full bg-primary" /> : null}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{v.name}</span>
                    {v.category && v.category !== "premade" ? (
                      <Badge variant="secondary" className="text-[10px]">
                        {titleCase(v.category)}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] text-muted-foreground">
                    <span>{voiceMeta(v).join(" · ") || v.description || "—"}</span>
                    {langs ? (
                      <span className="font-mono uppercase">
                        · {langs}
                        {extra > 0 ? ` +${extra}` : ""}
                      </span>
                    ) : null}
                  </div>
                </div>
                <PreviewButton playing={playing === v.voice_id} disabled={!v.preview_url} onClick={() => togglePreview(v)} />
              </div>
            );
          })
        )}
      </div>

      <div className="flex items-center justify-between border-t border-border bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
        <span>
          {voices.data ? `${filtered.length} of ${list.length} voices` : ""}
        </span>
        <button type="button" className="underline-offset-2 hover:text-foreground hover:underline" onClick={() => setManual((m) => !m)}>
          {manual ? "Hide manual entry" : "Enter a voice ID manually"}
        </button>
      </div>
      {manual ? (
        <div className="border-t border-border px-4 py-3">
          <Field label="Voice ID" help="Paste an ElevenLabs voice_id — useful for shared-library or cloned voices not listed above.">
            <Input value={value} onChange={(e) => onChange(e.target.value.trim())} className="font-mono text-[13px]" placeholder="21m00Tcm4TlvDq8ikWAM" />
          </Field>
        </div>
      ) : null}
      {error ? <p className="border-t border-border px-4 py-2 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

export function VoiceSection({ cfg, set, catalog, errors }: SectionProps) {
  const isV3 = cfg.tts_model_id === "eleven_v3_conversational";
  const languageLabel = optionLabel(catalog.languages, cfg.language, cfg.language);
  const ttsOptions = catalog.ttsModels.map((m) => ({
    value: m.value,
    label: m.label,
    description: m.description,
    disabledReason: ttsIncompatibleReason(m, cfg.language, catalog.languages),
    badges: (
      <>
        <Badge variant={m.latency === "lowest" ? "success" : m.latency === "low" ? "info" : "secondary"}>{LATENCY_LABEL[m.latency]}</Badge>
        <Badge variant={m.quality === "highest" ? "violet" : "secondary"}>{QUALITY_LABEL[m.quality]}</Badge>
        {m.value === catalog.defaultTtsModel ? <Badge variant="soft">Default</Badge> : null}
      </>
    ),
  }));

  return (
    <SectionCard id="voice" title="Voice & text-to-speech" description="The voice callers hear and how it's rendered." icon={MicVocal}>
      <div className="flex flex-col gap-3">
        <SubHeading title="Voice" description="From your ElevenLabs voice library. Preview before you pick." />
        <VoicePicker value={cfg.voice_id} onChange={(id) => set("voice_id", id)} error={errors.voice_id} language={cfg.language} languageLabel={languageLabel} />
      </div>

      <div className="flex flex-col gap-3">
        <SubHeading title="Speech model" description={`Availability depends on the primary language (currently ${languageLabel}).`} />
        <RadioCards options={ttsOptions} value={cfg.tts_model_id} onChange={(v) => set("tts_model_id", v)} />
        {errors.tts_model_id ? <p className="text-xs text-destructive">{errors.tts_model_id}</p> : null}
      </div>

      {isV3 ? (
        <SwitchRow label="Expressive mode" help="Lets Eleven v3 act on emotion and emphasis cues in the text (e.g. audio tags like [laughs], [whispers])." checked={cfg.expressive_mode ?? true} onCheckedChange={(v) => set("expressive_mode", v)} />
      ) : null}

      <div className="grid gap-5 md:grid-cols-3">
        <SliderField label="Stability" value={cfg.stability} min={0} max={1} step={0.05} onChange={(v) => set("stability", v)} help="Higher = more consistent; lower = more expressive." />
        <SliderField label="Similarity boost" value={cfg.similarity_boost} min={0} max={1} step={0.05} onChange={(v) => set("similarity_boost", v)} help="How closely to track the original voice." />
        <SliderField label="Speed" value={cfg.speed} min={0.7} max={1.2} step={0.05} onChange={(v) => set("speed", v)} format={(v) => `${v.toFixed(2)}×`} help="1.00× is natural pace." />
      </div>

      <Grid2>
        <Field label="Streaming latency optimization" help="Higher levels trade a little quality for faster first audio.">
          <Select value={String(cfg.optimize_streaming_latency)} onValueChange={(v) => set("optimize_streaming_latency", Number(v))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LATENCY_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={String(o.value)} description={o.description}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Output audio format" help="Use 8 kHz μ-law for Twilio, 16 kHz PCM for web calls.">
          <Select value={cfg.agent_output_audio_format} onValueChange={(v) => set("agent_output_audio_format", v)}>
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
    </SectionCard>
  );
}
