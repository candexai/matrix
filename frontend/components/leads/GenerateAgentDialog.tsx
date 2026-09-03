"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Database, ExternalLink, Globe, KeyRound, Layers, Loader2, MicVocal, Pause, PhoneOutgoing, Play, Plus, RefreshCw, Search, Sparkles, Table2, Tag, Trash2, TriangleAlert } from "lucide-react";
import type { Agent, AgentDraft, CatalogOption, LeadAgentBinding, Voice } from "@/lib/types";
import { useCatalog, useGenerateAgent, useLeadList, usePhoneNumbers, useVoices, useZohoFields } from "@/hooks/api";
import type { ApiError } from "@/lib/api";
import { cn, titleCase } from "@/lib/utils";
import { optionLabel, primaryCode, ttsModelSupportsLanguage } from "@/components/agents/agent-utils";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Tip } from "@/components/ui/tooltip";
import { AUTO_PHONE, PhonePicker } from "./AgentPhonePickers";
import { StatusPicker } from "./StatusPicker";
import { isRealListId } from "./leadUtils";

// ---------- constants ----------

/** Identity / status / audit columns the agent must never try to collect (mirrors the backend list). */
const EXCLUDED_COLUMNS = new Set(["First_Name", "Last_Name", "Full_Name", "Phone", "Mobile", "Email", "Lead_Status", "Lead_Source", "Owner", "Created_By", "Modified_By", "Created_Time", "Modified_Time"]);
/** Zoho data types the backend drops from generation anyway — hidden so the checklist is honest. */
const UNSUPPORTED_TYPES = new Set(["lookup", "ownerlookup", "multiselectlookup", "userlookup", "consent_lookup", "formula", "rollup_summary", "autonumber", "fileupload", "imageupload", "profileimage", "subform"]);
/** The backend keeps at most this many columns (the emptiest ones first). */
const MAX_FIELDS = 12;

const TONES: { value: string; description: string }[] = [
  { value: "Friendly & warm", description: "Conversational, upbeat, human" },
  { value: "Professional", description: "Polite, concise, businesslike" },
  { value: "Energetic sales", description: "Enthusiastic and persuasive, still respectful" },
  { value: "Calm & reassuring", description: "Patient, low-pressure, slow" },
];
const CUSTOM_TONE = "__custom__";
const INSTRUCTIONS_PLACEHOLDER = "Call new leads from our real-estate campaign, confirm interest in 2/3 BHK flats in Faridabad, capture budget, preferred location and timeline, and book a site visit.";
const FALLBACK_LANGUAGES = [{ value: "en", label: "English", nativeName: "English" }];

type Step = 1 | 2 | 3;
type Phase = "draft" | "create" | null;

interface DescribeForm {
  instructions: string;
  websiteUrl: string;
  companyName: string;
  agentName: string;
  language: string;
  tone: string;
  toneCustom: string;
}
const EMPTY_FORM: DescribeForm = { instructions: "", websiteUrl: "", companyName: "", agentName: "", language: "en", tone: TONES[0].value, toneCustom: "" };

// ---------- helpers ----------

function hostOf(url: string): string {
  try {
    return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

const VOICE_LABEL_KEYS = ["accent", "gender", "age", "use_case", "descriptive"] as const;
function voiceMeta(v: Voice): string {
  return VOICE_LABEL_KEYS.map((k) => v.labels?.[k])
    .filter((x): x is string => Boolean(x))
    .map((x) => titleCase(x))
    .join(" · ");
}

/** Headings inside the generated prompt — ALL-CAPS lines ("CONVERSATION FLOW", "3. DATA TO COLLECT:") or markdown headings. */
function promptSections(prompt: string): { title: string; line: number }[] {
  const out: { title: string; line: number }[] = [];
  prompt.split("\n").forEach((raw, i) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    const text = trimmed
      .replace(/^[#*\d.)\s-]+/, "")
      .replace(/[:*\s]+$/, "")
      .replace(/^[*_]+|[*_]+$/g, "")
      .trim();
    if (text.length < 3 || text.length > 60) return;
    const isMarkdown = /^#{1,4}\s/.test(trimmed);
    const isCaps = text === text.toUpperCase() && /[A-Z]/.test(text) && !/[.!?]$/.test(text);
    if (isMarkdown || isCaps) out.push({ title: text, line: i });
  });
  return out;
}

// ---------- small presentational pieces ----------

function Stepper({ step, done, className }: { step: Step; done: boolean; className?: string }) {
  const steps: { n: Step; label: string }[] = [
    { n: 1, label: "Describe" },
    { n: 2, label: "Review draft" },
    { n: 3, label: "Create" },
  ];
  return (
    <ol className={cn("flex flex-wrap items-center gap-2 text-[13px]", className)} aria-label="Progress">
      {steps.map((s, i) => {
        const complete = done || step > s.n;
        const active = !done && step === s.n;
        return (
          <li key={s.n} className="flex items-center gap-2" aria-current={active ? "step" : undefined}>
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full border font-heading text-[12px] transition-colors",
                complete ? "border-primary bg-primary text-primary-foreground" : active ? "border-primary bg-accent-tint text-primary-hover" : "border-border text-muted-foreground"
              )}
            >
              {complete ? <Check className="size-3.5" strokeWidth={2.5} /> : s.n}
            </span>
            <span className={cn(active ? "font-medium text-foreground" : complete ? "text-foreground" : "text-muted-foreground")}>{s.label}</span>
            {i < steps.length - 1 ? <span className={cn("mx-1 h-px w-8 transition-colors", complete ? "bg-primary" : "bg-border")} aria-hidden /> : null}
          </li>
        );
      })}
    </ol>
  );
}

function GeneratingPanel({ captions }: { captions: string[] }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 2400);
    return () => clearInterval(t);
  }, []);
  const idx = Math.min(tick, captions.length - 1);
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-6 text-center" role="status" aria-live="polite">
      <span className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground animate-pulse-ring">
        <Sparkles className="size-6" />
      </span>
      <div>
        <div key={idx} className="font-heading text-[22px] leading-tight animate-fade-in">
          {captions[idx]}
        </div>
        <p className="mt-1.5 text-sm text-muted-foreground">Drafting the agent with AI — usually 10–30 seconds.</p>
      </div>
      <ol className="flex flex-col items-start gap-1.5 text-[13px]">
        {captions.map((c, i) => (
          <li key={c} className={cn("flex items-center gap-2", i < idx ? "text-muted-foreground" : i === idx ? "text-foreground" : "text-muted-foreground/60")}>
            {i < idx ? <Check className="size-3.5 text-primary" /> : i === idx ? <Loader2 className="size-3.5 animate-spin text-primary" /> : <span className="size-3.5 rounded-full border border-border" aria-hidden />}
            {c}
          </li>
        ))}
      </ol>
    </div>
  );
}

function ErrorBox({ error, onRetry, title = "Generation failed" }: { error: ApiError; onRetry?: () => void; title?: string }) {
  const notConfigured = error.code === "OPENAI_NOT_CONFIGURED";
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-3 rounded-lg border px-4 py-3 text-sm animate-fade-in",
        notConfigured ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200" : "border-destructive/40 bg-destructive/5"
      )}
    >
      {notConfigured ? <KeyRound className="mt-0.5 size-4 shrink-0" /> : <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />}
      <div className="min-w-0 flex-1">
        <div className="font-medium">{notConfigured ? "OpenAI is not configured on the backend" : title}</div>
        <p className="mt-0.5 text-[13px] opacity-90">{error.message}</p>
        {notConfigured ? (
          <p className="mt-2 text-[13px]">
            Add <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs dark:bg-amber-900/50">OPENAI_API_KEY</code> to <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs dark:bg-amber-900/50">backend/.env</code> and restart the backend, then try again.
          </p>
        ) : null}
      </div>
      {onRetry && !notConfigured ? (
        <Button size="sm" variant="outline" onClick={onRetry}>
          <RefreshCw /> Retry
        </Button>
      ) : null}
    </div>
  );
}

function PreviewButton({ playing, disabled, onClick }: { playing: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <Tip label={disabled ? "No preview available" : playing ? "Pause preview" : "Play preview"}>
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        aria-label={playing ? "Pause preview" : "Play preview"}
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-md border transition-colors disabled:cursor-not-allowed disabled:opacity-40",
          playing ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:border-primary hover:text-primary"
        )}
      >
        {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
      </button>
    </Tip>
  );
}

function SectionHeading({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-2.5 flex items-center justify-between gap-3">
      <div className="flex items-baseline gap-2">
        <h4 className="font-heading text-[16px] leading-none">{title}</h4>
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </div>
      {action}
    </div>
  );
}

// ---------- dialog ----------

export interface GenerateAgentDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Lead table id. `"all"` generates the workspace default agent. */
  listId: string;
  listName?: string;
  zohoConnected?: boolean;
}

/**
 * Three-step wizard: describe the call → review the AI draft → pick voice/model/number and create.
 * Step 1 is a dry run (`dryRun: true`) that returns an editable draft; step 3 posts the edited draft,
 * which creates the agent on ElevenLabs and attaches it to the table (queries are invalidated by the hook).
 */
export function GenerateAgentDialog({ open, onOpenChange, listId, listName, zohoConnected = false }: GenerateAgentDialogProps) {
  const isAll = !isRealListId(listId);
  const list = useLeadList(open ? listId : undefined);
  const catalog = useCatalog();
  const voices = useVoices();
  const phones = usePhoneNumbers();
  const zohoFields = useZohoFields(open && zohoConnected);
  const gen = useGenerateAgent(listId);

  const tableName = listName ?? list.data?.name ?? (isAll ? "All leads" : "this table");
  const languages = catalog.data?.languages?.length ? catalog.data.languages : FALLBACK_LANGUAGES;

  const [step, setStep] = useState<Step>(1);
  const [phase, setPhase] = useState<Phase>(null);
  const [form, setForm] = useState<DescribeForm>(EMPTY_FORM);
  const [checked, setChecked] = useState<Set<string>>(() => new Set());
  const [columnSearch, setColumnSearch] = useState("");
  const [draft, setDraft] = useState<AgentDraft | null>(null);
  const [draftError, setDraftError] = useState<ApiError | null>(null);
  const [createError, setCreateError] = useState<ApiError | null>(null);
  const [voiceId, setVoiceId] = useState("");
  const [llm, setLlm] = useState("");
  const [tts, setTts] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState(AUTO_PHONE);
  const [created, setCreated] = useState<{ agent: Agent; binding?: LeadAgentBinding } | null>(null);
  const seeded = useRef(false);
  const promptRef = useRef<HTMLTextAreaElement | null>(null);

  const generating = phase === "draft" && gen.isPending;
  const creating = phase === "create" && gen.isPending;

  // Fresh wizard every time it opens.
  useEffect(() => {
    if (!open) return;
    setStep(1);
    setPhase(null);
    setForm(EMPTY_FORM);
    setChecked(new Set());
    setColumnSearch("");
    setDraft(null);
    setDraftError(null);
    setCreateError(null);
    setVoiceId("");
    setLlm("");
    setTts("");
    setPhoneNumberId(AUTO_PHONE);
    setCreated(null);
    seeded.current = false;
  }, [open]);

  // ---- step 1: collectable columns (view columns pre-checked) ----
  const collectable = useMemo(
    () => (list.data?.resolvedColumns ?? []).filter((c) => !EXCLUDED_COLUMNS.has(c.api_name) && !UNSUPPORTED_TYPES.has((c.data_type || "").toLowerCase())),
    [list.data?.resolvedColumns]
  );
  useEffect(() => {
    if (!open || seeded.current || !list.data) return;
    seeded.current = true;
    setChecked(new Set(collectable.filter((c) => c.inView).map((c) => c.api_name)));
  }, [open, list.data, collectable]);
  const visibleColumns = useMemo(() => {
    const q = columnSearch.trim().toLowerCase();
    if (!q) return collectable;
    return collectable.filter((c) => c.label.toLowerCase().includes(q) || c.api_name.toLowerCase().includes(q));
  }, [collectable, columnSearch]);
  const toggleColumn = (name: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  const effectiveTone = form.tone === CUSTOM_TONE ? form.toneCustom.trim() : form.tone;
  const canGenerate = form.instructions.trim().length >= 10 && !gen.isPending;
  const captions = useMemo(
    () => [form.websiteUrl.trim() ? "Reading website…" : null, "Studying your table…", "Writing the conversation flow…", "Drafting a question for each field…"].filter((c): c is string => Boolean(c)),
    [form.websiteUrl]
  );

  const runGenerate = () => {
    if (!canGenerate) return;
    setPhase("draft");
    setDraftError(null);
    gen.mutate(
      {
        instructions: form.instructions.trim(),
        websiteUrl: form.websiteUrl.trim() || undefined,
        language: form.language,
        tone: effectiveTone || undefined,
        agentName: form.agentName.trim() || undefined,
        companyName: form.companyName.trim() || undefined,
        fields: checked.size ? Array.from(checked) : undefined,
        dryRun: true,
      },
      {
        onSuccess: (r) => {
          setDraft(r.draft);
          setStep(2);
          setPhase(null);
        },
        onError: (e) => {
          setDraftError(e as unknown as ApiError);
          setStep(1);
          setPhase(null);
        },
      }
    );
  };

  // ---- step 2: draft editing ----
  const patchDraft = (p: Partial<AgentDraft>) => setDraft((d) => (d ? { ...d, ...p } : d));
  const patchField = (i: number, p: Partial<AgentDraft["fields"][number]>) => setDraft((d) => (d ? { ...d, fields: d.fields.map((f, idx) => (idx === i ? { ...f, ...p } : f)) } : d));
  const removeField = (i: number) => setDraft((d) => (d ? { ...d, fields: d.fields.filter((_, idx) => idx !== i) } : d));
  const patchCriterion = (i: number, p: Partial<AgentDraft["evaluation_criteria"][number]>) =>
    setDraft((d) => (d ? { ...d, evaluation_criteria: d.evaluation_criteria.map((c, idx) => (idx === i ? { ...c, ...p } : c)) } : d));
  const removeCriterion = (i: number) => setDraft((d) => (d ? { ...d, evaluation_criteria: d.evaluation_criteria.filter((_, idx) => idx !== i) } : d));
  const addCriterion = () => setDraft((d) => (d ? { ...d, evaluation_criteria: [...d.evaluation_criteria, { id: `goal_${d.evaluation_criteria.length + 1}`, name: "", conversation_goal_prompt: "" }] } : d));

  const sections = useMemo(() => promptSections(draft?.system_prompt ?? ""), [draft?.system_prompt]);
  const scrollToLine = (line: number) => {
    const ta = promptRef.current;
    if (!ta) return;
    const style = getComputedStyle(ta);
    const lineHeight = parseFloat(style.lineHeight) || 20;
    const charWidth = (parseFloat(style.fontSize) || 12.5) * 0.6;
    const cols = Math.max(20, Math.floor((ta.clientWidth - 24) / charWidth));
    const lines = ta.value.split("\n");
    let rows = 0;
    let offset = 0;
    for (let i = 0; i < line && i < lines.length; i++) {
      rows += Math.max(1, Math.ceil(lines[i].length / cols));
      offset += lines[i].length + 1;
    }
    ta.focus({ preventScroll: true });
    ta.setSelectionRange(offset, offset + (lines[line]?.length ?? 0));
    ta.scrollTop = Math.max(0, rows * lineHeight - 8);
  };
  const statusOptions = useMemo(() => zohoFields.data?.find((f) => f.api_name === "Lead_Status")?.pick_list_values?.map((p) => p.display_value) ?? [], [zohoFields.data]);
  const languageLabel = optionLabel(languages, draft?.language ?? form.language, draft?.language ?? form.language);
  const canContinue = Boolean(draft?.name.trim() && draft?.system_prompt.trim() && draft?.first_message.trim());

  // ---- step 3: voice / models / number ----
  const lang = primaryCode(draft?.language ?? form.language);
  const sortedVoices = useMemo(() => {
    const matches = (v: Voice) => (v.languages ?? []).some((l) => primaryCode(l) === lang);
    return [...(voices.data ?? [])].map((v) => ({ v, match: matches(v) })).sort((a, b) => Number(b.match) - Number(a.match) || a.v.name.localeCompare(b.v.name));
  }, [voices.data, lang]);
  const selectedVoice = useMemo(() => voices.data?.find((v) => v.voice_id === voiceId), [voices.data, voiceId]);
  useEffect(() => {
    if (step !== 3 || voiceId || !sortedVoices.length) return;
    setVoiceId(sortedVoices[0].v.voice_id);
  }, [step, voiceId, sortedVoices]);

  const ttsModels = catalog.data?.ttsModels ?? [];
  const compatibleTts = useMemo(() => ttsModels.filter((m) => ttsModelSupportsLanguage(m, lang)), [ttsModels, lang]);
  // Seed LLM / TTS defaults on entering step 3 (the on-open reset clears them, and the catalog is usually cached already).
  useEffect(() => {
    if (step !== 3 || !catalog.data) return;
    const { defaultLlm, defaultTtsModel, ttsModels: models } = catalog.data;
    setLlm((v) => v || defaultLlm);
    setTts((v) => {
      const find = (id: string) => models.find((m) => m.value === id);
      if (v && ttsModelSupportsLanguage(find(v), lang)) return v;
      if (ttsModelSupportsLanguage(find(defaultTtsModel), lang)) return defaultTtsModel;
      return models.find((m) => ttsModelSupportsLanguage(m, lang))?.value ?? "";
    });
  }, [step, catalog.data, lang]);
  const llmGroups = useMemo(() => {
    const groups = new Map<string, CatalogOption[]>();
    for (const o of catalog.data?.llmModels ?? []) {
      const g = o.group ?? "Models";
      groups.set(g, [...(groups.get(g) ?? []), o]);
    }
    return Array.from(groups.entries());
  }, [catalog.data?.llmModels]);

  // one shared <audio>, one preview at a time
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const stopAudio = () => {
    audioRef.current?.pause();
    setPlaying(false);
  };
  useEffect(() => {
    if (!open) {
      audioRef.current?.pause();
      setPlaying(false);
    }
  }, [open]);
  useEffect(
    () => () => {
      audioRef.current?.pause();
      audioRef.current = null;
    },
    []
  );
  const togglePreview = () => {
    if (!selectedVoice?.preview_url) return;
    if (!audioRef.current) {
      const a = new Audio();
      a.addEventListener("ended", () => setPlaying(false));
      a.addEventListener("error", () => {
        setPlaying(false);
        toast.error("Couldn't play the voice preview");
      });
      audioRef.current = a;
    }
    const a = audioRef.current;
    if (playing) {
      a.pause();
      setPlaying(false);
      return;
    }
    a.src = selectedVoice.preview_url;
    a.play()
      .then(() => setPlaying(true))
      .catch(() => {
        setPlaying(false);
        toast.error("Couldn't play the voice preview");
      });
  };

  const runCreate = () => {
    if (!draft || creating) return;
    stopAudio();
    setPhase("create");
    setCreateError(null);
    gen.mutate(
      { draft, voiceId: voiceId || undefined, phoneNumberId: phoneNumberId === AUTO_PHONE ? undefined : phoneNumberId, llm: llm || undefined, ttsModelId: tts || undefined },
      {
        onSuccess: (r) => {
          setPhase(null);
          if (r.agent) setCreated({ agent: r.agent, binding: r.binding });
          else setCreateError({ code: "NO_AGENT", message: "The backend returned no agent. Check the ElevenLabs configuration and try again." });
        },
        onError: (e) => {
          setCreateError(e as unknown as ApiError);
          setPhase(null);
        },
      }
    );
  };

  const handleOpenChange = (o: boolean) => {
    if (!o && creating) return; // don't lose the result mid-flight
    onOpenChange(o);
  };

  const fieldCount = draft?.fields.length ?? 0;
  const footerHint = created
    ? `Attached to ${isAll ? "every table without its own agent" : tableName}`
    : generating
      ? "Dry run — nothing is created yet"
      : step === 1
        ? `${checked.size} column${checked.size === 1 ? "" : "s"} to collect · dry run, nothing is created yet`
        : step === 2
          ? "Edit anything — the agent is only created in the next step"
          : "Creates the agent on ElevenLabs and attaches it — takes a few seconds";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="xl">
        <DialogHeader className="pr-12">
          <div className="flex items-center gap-2.5">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Sparkles className="size-4" />
            </span>
            <DialogTitle>Generate agent with AI</DialogTitle>
          </div>
          <DialogDescription>{isAll ? "Describe the call, review the draft, then create it as the default agent for every table." : `Describe the call, review the draft, then create and attach it to ${tableName}.`}</DialogDescription>
          <Stepper step={step} done={Boolean(created)} className="mt-2" />
        </DialogHeader>

        <DialogBody>
          {created ? (
            <DoneState created={created} tableName={tableName} isAll={isAll} />
          ) : generating ? (
            <GeneratingPanel captions={captions} />
          ) : step === 1 ? (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
              <div className="space-y-5">
                <Field label="What should this agent do?" hint="required" help="The goal of the call, what to confirm, and what to book or promise. Be specific — this drives the whole script.">
                  <Textarea rows={5} value={form.instructions} onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value }))} placeholder={INSTRUCTIONS_PLACEHOLDER} autoFocus className="text-[14px] leading-relaxed" />
                </Field>
                <Field label="Website URL" hint="optional" help="We read the page to learn about your business, offers and tone.">
                  <div className="relative">
                    <Globe className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input value={form.websiteUrl} onChange={(e) => setForm((f) => ({ ...f, websiteUrl: e.target.value }))} placeholder="https://yourcompany.com" inputMode="url" className="pl-8" />
                  </div>
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Company name" hint="optional">
                    <Input value={form.companyName} onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))} placeholder="Acme Realty" />
                  </Field>
                  <Field label="Agent name" hint="optional" help="The persona the agent introduces itself as.">
                    <Input value={form.agentName} onChange={(e) => setForm((f) => ({ ...f, agentName: e.target.value }))} placeholder="Riya" />
                  </Field>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Language">
                    <Select value={form.language} onValueChange={(v) => setForm((f) => ({ ...f, language: v }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Language" />
                      </SelectTrigger>
                      <SelectContent>
                        {languages.map((l) => (
                          <SelectItem key={l.value} value={l.value} description={l.nativeName && l.nativeName !== l.label ? l.nativeName : undefined}>
                            {l.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Tone">
                    <Select value={form.tone} onValueChange={(v) => setForm((f) => ({ ...f, tone: v }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Tone" />
                      </SelectTrigger>
                      <SelectContent>
                        {TONES.map((t) => (
                          <SelectItem key={t.value} value={t.value} description={t.description}>
                            {t.value}
                          </SelectItem>
                        ))}
                        <SelectSeparator />
                        <SelectItem value={CUSTOM_TONE}>Custom…</SelectItem>
                      </SelectContent>
                    </Select>
                    {form.tone === CUSTOM_TONE ? <Input value={form.toneCustom} onChange={(e) => setForm((f) => ({ ...f, toneCustom: e.target.value }))} placeholder="e.g. Witty but respectful, short sentences" autoFocus className="mt-1.5" /> : null}
                  </Field>
                </div>
                {draftError ? <ErrorBox error={draftError} onRetry={runGenerate} /> : null}
              </div>

              <aside className="flex flex-col gap-3 rounded-xl border border-border bg-muted/30 p-4">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-heading text-[15px] leading-none">Columns to collect</h4>
                    <span className="text-xs tabular-nums text-muted-foreground">{checked.size} selected</span>
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">The agent will ask for these when they are empty on a lead.</p>
                </div>
                {list.isLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-9 w-full" />
                    ))}
                  </div>
                ) : !collectable.length ? (
                  <p className="rounded-md border border-dashed border-border bg-card px-3 py-2.5 text-[13px] text-muted-foreground">No collectable columns on this table — the agent will focus on qualification and next steps.</p>
                ) : (
                  <>
                    {collectable.length > 6 ? (
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input value={columnSearch} onChange={(e) => setColumnSearch(e.target.value)} placeholder="Filter columns…" className="h-8 pl-7 text-[13px]" />
                      </div>
                    ) : null}
                    <ul className="max-h-[300px] divide-y divide-border overflow-y-auto rounded-lg border border-border bg-card">
                      {visibleColumns.length ? (
                        visibleColumns.map((c) => {
                          const on = checked.has(c.api_name);
                          return (
                            <li key={c.api_name}>
                              <label className={cn("flex cursor-pointer items-center gap-2.5 px-3 py-2 transition-colors hover:bg-muted/50", on && "bg-accent-tint/30 hover:bg-accent-tint/40")}>
                                <Checkbox checked={on} onCheckedChange={() => toggleColumn(c.api_name)} />
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-[13px]">{c.label}</span>
                                  <span className="block truncate font-mono text-[11px] text-muted-foreground">{c.api_name}</span>
                                </span>
                                {c.inView ? <Badge variant="outline">in view</Badge> : null}
                              </label>
                            </li>
                          );
                        })
                      ) : (
                        <li className="px-3 py-3 text-[13px] text-muted-foreground">No columns match “{columnSearch.trim()}”.</li>
                      )}
                    </ul>
                    <div className="flex items-center justify-between text-xs">
                      <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => setChecked(new Set(collectable.filter((c) => c.inView).map((c) => c.api_name)))}>
                        View columns
                      </button>
                      <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => setChecked(new Set())}>
                        Clear
                      </button>
                    </div>
                    {checked.size > MAX_FIELDS ? <p className="text-xs text-amber-700 dark:text-amber-300">The AI keeps the {MAX_FIELDS} emptiest columns.</p> : !checked.size ? <p className="text-xs text-muted-foreground">Nothing selected — the AI picks from the table's own columns.</p> : null}
                  </>
                )}
              </aside>
            </div>
          ) : step === 2 && draft ? (
            <div className="space-y-7">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="violet">
                  <Sparkles /> {draft.model}
                </Badge>
                <Badge variant="outline">{languageLabel}</Badge>
                {draft.website ? (
                  <Badge variant="outline">
                    <Globe /> Read {draft.website.chars.toLocaleString()} chars from {hostOf(draft.website.url)}
                  </Badge>
                ) : form.websiteUrl.trim() ? (
                  <Badge variant="warning">
                    <Globe /> Website could not be read
                  </Badge>
                ) : null}
                <Badge variant="outline">
                  <Database /> {fieldCount} field{fieldCount === 1 ? "" : "s"}
                </Badge>
              </div>

              <section className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Agent name">
                    <Input value={draft.name} onChange={(e) => patchDraft({ name: e.target.value })} />
                  </Field>
                  <Field label="Description" hint="internal">
                    <Input value={draft.description} onChange={(e) => patchDraft({ description: e.target.value })} placeholder="One-line summary of what this agent does" />
                  </Field>
                </div>
                <Field label="First message" help="Said as soon as the lead picks up. {{name}} is replaced with the lead's name.">
                  <Textarea rows={2} value={draft.first_message} onChange={(e) => patchDraft({ first_message: e.target.value })} className="text-[14px]" />
                </Field>
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_210px]">
                  <Field label="System prompt" hint={`${draft.system_prompt.length.toLocaleString()} chars`}>
                    <Textarea ref={promptRef} rows={18} value={draft.system_prompt} onChange={(e) => patchDraft({ system_prompt: e.target.value })} className="min-h-[360px] font-mono text-[12.5px] leading-relaxed" spellCheck={false} />
                  </Field>
                  <aside className="lg:pt-6">
                    <div className="sticky top-0 rounded-lg border border-border bg-muted/30 p-3">
                      <div className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Sections</div>
                      {sections.length ? (
                        <ol className="mt-2 space-y-0.5">
                          {sections.map((s) => (
                            <li key={`${s.line}-${s.title}`}>
                              <button type="button" onClick={() => scrollToLine(s.line)} className="w-full truncate rounded-md px-2 py-1 text-left text-[13px] transition-colors hover:bg-card hover:text-primary" title={s.title}>
                                {titleCase(s.title.toLowerCase())}
                              </button>
                            </li>
                          ))}
                        </ol>
                      ) : (
                        <p className="mt-2 text-xs text-muted-foreground">No headings found. Lines like IDENTITY or CONVERSATION FLOW show up here.</p>
                      )}
                    </div>
                  </aside>
                </div>
              </section>

              <section>
                <SectionHeading title="Fields to collect" hint={`${fieldCount} field${fieldCount === 1 ? "" : "s"} · written back to empty Zoho fields`} />
                {draft.fields.length ? (
                  <div className="overflow-hidden rounded-lg border border-border">
                    <table className="w-full text-[13px]">
                      <thead className="bg-muted/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 font-medium">Field</th>
                          <th className="px-3 py-2 font-medium">Ask as</th>
                          <th className="px-3 py-2 font-medium">What to extract</th>
                          <th className="w-10 px-1 py-2" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {draft.fields.map((f, i) => (
                          <tr key={f.zohoField} className="align-top">
                            <td className="w-[180px] px-3 py-2.5">
                              <div className="font-medium">{f.label}</div>
                              <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">{f.zohoField}</div>
                            </td>
                            <td className="px-3 py-2">
                              <Textarea rows={2} value={f.askAs} onChange={(e) => patchField(i, { askAs: e.target.value })} placeholder="The exact question the agent asks" className="min-h-[56px] text-[13px]" />
                            </td>
                            <td className="px-3 py-2">
                              <Textarea rows={2} value={f.description} onChange={(e) => patchField(i, { description: e.target.value })} placeholder="What a valid answer looks like" className="min-h-[56px] text-[13px]" />
                            </td>
                            <td className="px-1 py-2">
                              <Tip label="Remove field">
                                <Button type="button" variant="ghost" size="icon-sm" onClick={() => removeField(i)} aria-label={`Remove ${f.label}`}>
                                  <Trash2 className="text-muted-foreground" />
                                </Button>
                              </Tip>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-2.5 text-[13px] text-muted-foreground">No fields — the agent will qualify the lead without collecting data. Go back and select columns to change that.</p>
                )}
              </section>

              <section>
                <SectionHeading
                  title="Evaluation criteria"
                  hint="Outcomes ElevenLabs grades after every call"
                  action={
                    <Button type="button" variant="outline" size="sm" onClick={addCriterion} disabled={draft.evaluation_criteria.length >= 4}>
                      <Plus /> Add criterion
                    </Button>
                  }
                />
                {draft.evaluation_criteria.length ? (
                  <div className="space-y-2">
                    {draft.evaluation_criteria.map((c, i) => (
                      <div key={`${c.id}-${i}`} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-[200px_minmax(0,1fr)_auto]">
                        <Field label="Name" className="gap-1">
                          <Input value={c.name} onChange={(e) => patchCriterion(i, { name: e.target.value, id: c.id || e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "_") })} placeholder="Interested" />
                        </Field>
                        <Field label="Goal" className="gap-1">
                          <Textarea rows={2} value={c.conversation_goal_prompt} onChange={(e) => patchCriterion(i, { conversation_goal_prompt: e.target.value })} placeholder="Did the lead confirm interest in a site visit?" className="min-h-[36px] text-[13px]" />
                        </Field>
                        <div className="flex items-end">
                          <Button type="button" variant="ghost" size="icon-sm" onClick={() => removeCriterion(i)} aria-label={`Remove ${c.name || "criterion"}`}>
                            <Trash2 className="text-muted-foreground" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-2.5 text-[13px] text-muted-foreground">No criteria yet — add one or two outcomes worth tracking, like “Interested” or “All fields collected”.</p>
                )}
              </section>

              <section className="max-w-sm">
                <Field label="Set Lead Status after call" help="Applied when a call completes successfully. Leave it on “Don't change” to keep the status.">
                  <StatusPicker value={draft.updateLeadStatusTo ?? ""} onChange={(v) => patchDraft({ updateLeadStatusTo: v || undefined })} options={statusOptions} placeholder="Don't change" noneLabel="Don't change" />
                </Field>
              </section>
            </div>
          ) : step === 3 && draft ? (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
              <div className="space-y-5">
                <Field label="Voice" help={voices.error ? "Could not load voices — the backend will pick a default premade voice." : `Voices verified for ${languageLabel} are listed first.`}>
                  {voices.isLoading ? (
                    <Skeleton className="h-9 w-full" />
                  ) : !sortedVoices.length ? (
                    <div className="flex items-start gap-2 rounded-md border border-dashed border-border bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground">
                      <MicVocal className="mt-0.5 size-4 shrink-0 text-primary" />
                      <span>No voices returned by ElevenLabs. The backend will pick a default premade voice for {languageLabel}.</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Select
                        value={voiceId}
                        onValueChange={(v) => {
                          stopAudio();
                          setVoiceId(v);
                        }}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Choose a voice" />
                        </SelectTrigger>
                        <SelectContent>
                          {sortedVoices.map(({ v, match }) => (
                            <SelectItem key={v.voice_id} value={v.voice_id} description={[voiceMeta(v), match ? `Verified for ${languageLabel}` : null].filter(Boolean).join(" · ") || undefined}>
                              {v.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <PreviewButton playing={playing} disabled={!selectedVoice?.preview_url} onClick={togglePreview} />
                    </div>
                  )}
                  {selectedVoice ? (
                    <div className="flex flex-wrap items-center gap-1">
                      {voiceMeta(selectedVoice)
                        .split(" · ")
                        .filter(Boolean)
                        .map((m) => (
                          <Badge key={m} variant="secondary">
                            {m}
                          </Badge>
                        ))}
                      {selectedVoice.category ? <Badge variant="outline">{titleCase(selectedVoice.category)}</Badge> : null}
                      <span className="ml-1 font-mono text-[11px] text-muted-foreground">{selectedVoice.voice_id}</span>
                    </div>
                  ) : null}
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="LLM">
                    {catalog.isLoading ? (
                      <Skeleton className="h-9 w-full" />
                    ) : (
                      <Select value={llm} onValueChange={setLlm}>
                        <SelectTrigger>
                          <SelectValue placeholder="Model" />
                        </SelectTrigger>
                        <SelectContent>
                          {llmGroups.map(([group, options]) => (
                            <SelectGroup key={group}>
                              <SelectLabel>{group}</SelectLabel>
                              {options.map((o) => (
                                <SelectItem key={o.value} value={o.value} description={o.description}>
                                  {o.label}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </Field>
                  <Field label="TTS model" help={compatibleTts.length < ttsModels.length ? `Showing models that support ${languageLabel}.` : undefined}>
                    {catalog.isLoading ? (
                      <Skeleton className="h-9 w-full" />
                    ) : (
                      <Select value={tts} onValueChange={setTts}>
                        <SelectTrigger>
                          <SelectValue placeholder="Model" />
                        </SelectTrigger>
                        <SelectContent>
                          {compatibleTts.map((m) => (
                            <SelectItem key={m.value} value={m.value} description={[m.description, `${m.latency} latency`, `${m.quality} quality`].filter(Boolean).join(" · ")}>
                              {m.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </Field>
                </div>

                <PhonePicker numbers={phones.data} loading={phones.isLoading} error={phones.error} value={phoneNumberId} onChange={setPhoneNumberId} hint="optional" />

                {createError ? <ErrorBox error={createError} title="Couldn't create the agent" onRetry={runCreate} /> : null}
              </div>

              <aside className="h-fit rounded-xl border border-primary/30 bg-accent-tint/30 p-4">
                <h4 className="font-heading text-[15px] leading-none">What happens next</h4>
                <ul className="mt-3.5 space-y-3 text-[13px] leading-snug">
                  <li className="flex items-start gap-2.5">
                    <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span>
                      Creates <span className="font-medium">{draft.name || "the agent"}</span> on ElevenLabs with the reviewed prompt, first message and voice.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    {isAll ? <Layers className="mt-0.5 size-4 shrink-0 text-primary" /> : <Table2 className="mt-0.5 size-4 shrink-0 text-primary" />}
                    <span>
                      {isAll ? (
                        <>
                          Attaches it as the <span className="font-medium">default agent</span> for every table without its own.
                        </>
                      ) : (
                        <>
                          Attaches it to <span className="font-medium">{tableName}</span>.
                        </>
                      )}
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Database className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span>
                      Configures data collection for <span className="font-medium">{fieldCount} field{fieldCount === 1 ? "" : "s"}</span>
                      {fieldCount ? ", filling only empty Zoho fields after each call." : "."}
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Tag className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span>
                      {draft.updateLeadStatusTo ? (
                        <>
                          Sets Lead Status → <span className="font-medium">{draft.updateLeadStatusTo}</span> after each completed call.
                        </>
                      ) : (
                        "Leaves Lead Status unchanged after calls."
                      )}
                    </span>
                  </li>
                </ul>
              </aside>
            </div>
          ) : null}
        </DialogBody>

        <DialogFooter className="justify-between">
          <span className="min-w-0 truncate text-xs text-muted-foreground">{footerHint}</span>
          <div className="flex shrink-0 gap-2">
            {created ? (
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            ) : generating ? (
              <Button loading disabled>
                Generating…
              </Button>
            ) : step === 1 ? (
              <>
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button onClick={runGenerate} disabled={!canGenerate}>
                  <Sparkles /> Generate draft
                </Button>
              </>
            ) : step === 2 ? (
              <>
                <Button variant="outline" onClick={() => setStep(1)}>
                  <ArrowLeft /> Back
                </Button>
                <Button variant="outline" onClick={runGenerate} disabled={!canGenerate}>
                  <RefreshCw /> Regenerate
                </Button>
                <Button onClick={() => setStep(3)} disabled={!canContinue}>
                  Continue <ArrowRight />
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setStep(2)} disabled={creating}>
                  <ArrowLeft /> Back
                </Button>
                <Button onClick={runCreate} loading={creating} disabled={creating || voices.isLoading || catalog.isLoading}>
                  <Sparkles /> Create & attach agent
                </Button>
              </>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DoneState({ created, tableName, isAll }: { created: { agent: Agent; binding?: LeadAgentBinding }; tableName: string; isAll: boolean }) {
  const fields = created.binding?.fields.length ?? created.agent.config?.data_collection?.length ?? 0;
  return (
    <div className="flex min-h-[380px] flex-col items-center justify-center gap-6 text-center animate-fade-up">
      <span className="flex size-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300">
        <CheckCircle2 className="size-7" />
      </span>
      <div className="max-w-md">
        <h3 className="font-heading text-2xl leading-tight">“{created.agent.name}” is ready</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Created on ElevenLabs and attached {isAll ? "as the default agent" : `to ${tableName}`}. Calls {isAll ? "from every table without its own agent" : "from this table"} now use it
          {fields ? ` and collect ${fields} field${fields === 1 ? "" : "s"}` : ""}.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Link href={`/agents/${created.agent._id}`} className={buttonVariants()}>
          <ExternalLink /> Open agent
        </Link>
        <Link href="/agents" className={buttonVariants({ variant: "outline" })}>
          <MicVocal /> Preview call
        </Link>
        <Link href={`/test?agent=${encodeURIComponent(created.agent._id)}`} className={buttonVariants({ variant: "outline" })}>
          <PhoneOutgoing /> Test on phone
        </Link>
      </div>
      <p className="text-xs text-muted-foreground">Preview call opens the Agents page — use Preview on the agent's card for an in-browser web call.</p>
    </div>
  );
}
