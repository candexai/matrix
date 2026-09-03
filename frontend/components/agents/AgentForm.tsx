"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { useCatalog, useCreateAgent, useUpdateAgent } from "@/hooks/api";
import { errorMessage } from "@/lib/api";
import type { Agent, AgentFormConfig, Catalog } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { E164, toSnake, ttsIncompatibleReason, ttsModelSupportsLanguage, uniq } from "./agent-utils";
import { ConfirmDialog } from "./ConfirmDialog";
import { DataSection } from "./form/DataSection";
import { IdentitySection } from "./form/IdentitySection";
import { LanguageModelSection } from "./form/LanguageModelSection";
import { PrivacySection } from "./form/PrivacySection";
import { SECTIONS, sectionForError, type FormErrors, type SetCfg } from "./form/sections";
import { SpeechSection } from "./form/SpeechSection";
import { ToolsSection } from "./form/ToolsSection";
import { VoiceSection } from "./form/VoiceSection";

/* ---------- validation & payload ---------- */

function validate(name: string, cfg: AgentFormConfig, catalog: Catalog): FormErrors {
  const e: FormErrors = {};
  if (!name.trim()) e.name = "Give the agent a name.";
  if (!cfg.voice_id?.trim()) e.voice_id = "Select a voice.";
  if (!cfg.system_prompt?.trim()) e.system_prompt = "The system prompt is required.";
  const model = catalog.ttsModels.find((m) => m.value === cfg.tts_model_id);
  if (model && !ttsModelSupportsLanguage(model, cfg.language)) e.tts_model_id = ttsIncompatibleReason(model, cfg.language, catalog.languages) ?? "This model isn't available for the selected language.";
  if (cfg.llm === "custom-llm") {
    const u = cfg.custom_llm_url?.trim() ?? "";
    if (!u) e.custom_llm_url = "Enter the endpoint URL.";
    else if (!/^https?:\/\//i.test(u)) e.custom_llm_url = "Must start with http:// or https://";
  }
  if (cfg.max_tokens !== undefined && cfg.max_tokens < 1) e.max_tokens = "Leave empty or enter a positive number.";
  if (!(cfg.turn_timeout >= 1 && cfg.turn_timeout <= 30)) e.turn_timeout = "Between 1 and 30 seconds.";
  if (!(cfg.silence_end_call_timeout === -1 || cfg.silence_end_call_timeout >= 1)) e.silence_end_call_timeout = "Use -1 (never) or at least 1 second.";
  if (!(cfg.max_duration_seconds >= 30)) e.max_duration_seconds = "At least 30 seconds.";
  if (cfg.enable_human_transfer) {
    if (!cfg.human_transfer_rules.length) e.human_transfer_rules = "Add at least one transfer rule, or turn off human transfer.";
    cfg.human_transfer_rules.forEach((r, i) => {
      if (!r.condition.trim()) e[`human_transfer_rules.${i}.condition`] = "Describe when to transfer.";
      if (!E164.test(r.phone_number.trim())) e[`human_transfer_rules.${i}.phone_number`] = "Use E.164 format, e.g. +14155552671.";
    });
  }
  const seen = new Set<string>();
  cfg.data_collection.forEach((f, i) => {
    const k = toSnake(f.key);
    if (!k) e[`data_collection.${i}.key`] = "Key required.";
    else if (seen.has(k)) e[`data_collection.${i}.key`] = "Duplicate key.";
    seen.add(k);
    if (!f.description.trim()) e[`data_collection.${i}.description`] = "Describe what to extract.";
  });
  cfg.evaluation_criteria.forEach((c, i) => {
    if (!c.name.trim()) e[`evaluation_criteria.${i}.name`] = "Name required.";
    if (!c.conversation_goal_prompt.trim()) e[`evaluation_criteria.${i}.conversation_goal_prompt`] = "Prompt required.";
  });
  if (cfg.post_call_webhook_enabled && !cfg.post_call_webhook_events.length) e.post_call_webhook_events = "Select at least one event.";
  if (!(cfg.retention_days === -1 || cfg.retention_days >= 0)) e.retention_days = "Use -1 (forever) or a positive number.";
  if (!(cfg.agent_concurrency_limit === -1 || cfg.agent_concurrency_limit >= 1)) e.agent_concurrency_limit = "Use -1 (unlimited) or at least 1.";
  if (!(cfg.daily_limit >= 0)) e.daily_limit = "Must be 0 or more.";
  return e;
}

/** Cleared optional fields are sent as null so PATCH merges override the stored value. */
type ConfigPayload = { [K in keyof AgentFormConfig]?: AgentFormConfig[K] | null };

function buildPayload(cfg: AgentFormConfig): ConfigPayload {
  const trimList = (l: string[]) => uniq(l.map((s) => s.trim()).filter(Boolean));
  const isV3 = cfg.tts_model_id === "eleven_v3_conversational";
  const custom = cfg.llm === "custom-llm";
  const placeholders: Record<string, string> = {};
  for (const [k, v] of Object.entries(cfg.dynamic_variable_placeholders ?? {})) if (k.trim()) placeholders[k.trim()] = v;
  return {
    ...cfg,
    first_message: cfg.first_message.trim(),
    system_prompt: cfg.system_prompt.trim(),
    additional_languages: cfg.additional_languages.filter((l) => l && l !== cfg.language),
    hinglish_mode: cfg.language === "hi" ? Boolean(cfg.hinglish_mode) : false,
    custom_llm_url: custom ? cfg.custom_llm_url?.trim() || null : null,
    custom_llm_model_id: custom ? cfg.custom_llm_model_id?.trim() || null : null,
    max_tokens: cfg.max_tokens && cfg.max_tokens > 0 ? Math.round(cfg.max_tokens) : null,
    reasoning_effort: cfg.reasoning_effort || null,
    expressive_mode: isV3 ? (cfg.expressive_mode ?? true) : null,
    asr_keywords: trimList(cfg.asr_keywords),
    max_conversation_duration_message: cfg.max_conversation_duration_message?.trim() || null,
    voicemail_message: cfg.built_in_tools.includes("voicemail_detection") ? (cfg.voicemail_message ?? "").trim() : "",
    human_transfer_rules: cfg.enable_human_transfer ? cfg.human_transfer_rules.map((r) => ({ condition: r.condition.trim(), phone_number: r.phone_number.trim(), transfer_type: r.transfer_type || "conference" })) : [],
    tool_ids: trimList(cfg.tool_ids),
    knowledge_base_ids: trimList(cfg.knowledge_base_ids),
    data_collection: cfg.data_collection
      .filter((f) => toSnake(f.key))
      .map((f) => ({ key: toSnake(f.key), type: f.type || "string", description: f.description.trim(), zohoField: f.zohoField?.trim() || undefined })),
    evaluation_criteria: cfg.evaluation_criteria
      .filter((c) => c.name.trim() && c.conversation_goal_prompt.trim())
      .map((c) => ({ id: c.id || toSnake(c.name), name: c.name.trim(), conversation_goal_prompt: c.conversation_goal_prompt.trim() })),
    summary_language: cfg.summary_language || null,
    post_call_webhook_events: cfg.post_call_webhook_enabled ? cfg.post_call_webhook_events : [],
    dynamic_variable_placeholders: placeholders,
  };
}

function mergeConfig(defaults: AgentFormConfig, partial?: Partial<AgentFormConfig>): AgentFormConfig {
  const merged = { ...defaults, ...(partial ?? {}) } as AgentFormConfig;
  // normalise nullable optionals coming back from the API
  const nullable = ["custom_llm_url", "custom_llm_model_id", "max_tokens", "reasoning_effort", "expressive_mode", "max_conversation_duration_message", "summary_language", "voicemail_message"] as const;
  const rec = merged as unknown as Record<string, unknown>;
  for (const k of nullable) if (rec[k] === null) rec[k] = undefined;
  merged.additional_languages ??= [];
  merged.asr_keywords ??= [];
  merged.built_in_tools ??= [];
  merged.human_transfer_rules ??= [];
  merged.tool_ids ??= [];
  merged.knowledge_base_ids ??= [];
  merged.data_collection ??= [];
  merged.evaluation_criteria ??= [];
  merged.post_call_webhook_events ??= [];
  merged.dynamic_variable_placeholders ??= {};
  return merged;
}

/* ---------- component ---------- */

export function AgentForm({ initial, mode }: { initial?: Agent; mode: "create" | "edit" }) {
  const catalog = useCatalog();
  if (catalog.isPending) return <FormSkeleton />;
  if (!catalog.isSuccess) {
    return (
      <EmptyState
        icon={TriangleAlert}
        title="Couldn't load the agent catalog"
        description={errorMessage(catalog.error)}
        action={
          <Button variant="outline" onClick={() => catalog.refetch()}>
            Retry
          </Button>
        }
      />
    );
  }
  return <AgentFormInner catalog={catalog.data} initial={initial} mode={mode} />;
}

function AgentFormInner({ catalog, initial, mode }: { catalog: Catalog; initial?: Agent; mode: "create" | "edit" }) {
  const router = useRouter();
  const initialCfg = useMemo(() => mergeConfig(catalog.defaults, initial?.config), [catalog.defaults, initial?.config]);
  const [cfg, setCfg] = useState<AgentFormConfig>(initialCfg);
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const baseline = useMemo(() => JSON.stringify({ name: initial?.name ?? "", description: initial?.description ?? "", cfg: initialCfg }), [initial?.name, initial?.description, initialCfg]);
  const dirty = useMemo(() => JSON.stringify({ name, description, cfg }) !== baseline, [name, description, cfg, baseline]);

  const set: SetCfg = useCallback((key, value) => setCfg((c) => ({ ...c, [key]: value })), []);

  const create = useCreateAgent();
  const update = useUpdateAgent(initial?._id ?? "");
  const saving = create.isPending || update.isPending;

  // keep the TTS model compatible with the primary language
  useEffect(() => {
    const model = catalog.ttsModels.find((m) => m.value === cfg.tts_model_id);
    if (model && !ttsModelSupportsLanguage(model, cfg.language) && cfg.tts_model_id !== catalog.defaultTtsModel) {
      set("tts_model_id", catalog.defaultTtsModel);
      const fallback = catalog.ttsModels.find((m) => m.value === catalog.defaultTtsModel);
      toast.info(`${model.label} doesn't support this language — switched to ${fallback?.label ?? catalog.defaultTtsModel}.`);
    }
  }, [cfg.language, cfg.tts_model_id, catalog, set]);

  // live re-validation once the user has tried to submit
  useEffect(() => {
    if (submitted) setErrors(validate(name, cfg, catalog));
  }, [submitted, name, cfg, catalog]);

  // warn on navigation with unsaved changes
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  // scroll-spy for the section nav
  const [active, setActive] = useState(SECTIONS[0].id);
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const els = SECTIONS.map((s) => document.getElementById(s.id)).filter((x): x is HTMLElement => Boolean(x));
    if (!els.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-20% 0px -65% 0px", threshold: 0 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const jumpTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setActive(id);
  };

  const errorSections = useMemo(() => new Set(Object.keys(errors).map(sectionForError)), [errors]);
  const issueCount = Object.keys(errors).length;

  const onSubmit = async () => {
    setSubmitted(true);
    const errs = validate(name, cfg, catalog);
    setErrors(errs);
    const keys = Object.keys(errs);
    if (keys.length) {
      toast.error(keys.length === 1 ? errs[keys[0]] : `Fix ${keys.length} issues before saving.`);
      jumpTo(sectionForError(keys[0]));
      return;
    }
    const payload = { name: name.trim(), description: description.trim(), config: buildPayload(cfg) as unknown as Partial<AgentFormConfig> };
    try {
      if (mode === "create") {
        const a = await create.mutateAsync(payload);
        router.push(`/agents/${a._id}`);
      } else {
        await update.mutateAsync(payload);
      }
    } catch {
      /* toasted by the mutation hook */
    }
  };

  const cancel = () => {
    if (dirty) setCancelOpen(true);
    else router.push("/agents");
  };

  return (
    <div ref={rootRef} className="flex flex-1 flex-col">
      <div className="px-7 pb-6">
        <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
          <nav className="hidden lg:block" aria-label="Sections">
            <div className="sticky top-[88px] flex flex-col gap-0.5">
              <div className="mb-1.5 px-3 text-[11.5px] uppercase tracking-[0.09em] text-muted-foreground">Configuration</div>
              {SECTIONS.map((s) => {
                const Icon = s.icon;
                const isActive = active === s.id;
                const hasErr = errorSections.has(s.id);
                return (
                  <a
                    key={s.id}
                    href={`#${s.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      jumpTo(s.id);
                    }}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg border px-3 py-2 text-[13.5px] transition-colors",
                      isActive ? "border-border bg-card font-medium text-foreground shadow-xs" : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon className={cn("size-4 shrink-0", isActive ? "text-primary" : "")} strokeWidth={1.7} />
                    <span className="truncate">{s.label}</span>
                    {hasErr ? <span className="ml-auto size-1.5 shrink-0 rounded-full bg-destructive" aria-label="Has errors" /> : null}
                  </a>
                );
              })}
            </div>
          </nav>

          <div className="flex min-w-0 max-w-5xl flex-col gap-6">
            <IdentitySection cfg={cfg} set={set} catalog={catalog} errors={errors} name={name} description={description} onNameChange={setName} onDescriptionChange={setDescription} />
            <LanguageModelSection cfg={cfg} set={set} catalog={catalog} errors={errors} />
            <VoiceSection cfg={cfg} set={set} catalog={catalog} errors={errors} />
            <SpeechSection cfg={cfg} set={set} catalog={catalog} errors={errors} />
            <ToolsSection cfg={cfg} set={set} catalog={catalog} errors={errors} />
            <DataSection cfg={cfg} set={set} catalog={catalog} errors={errors} />
            <PrivacySection cfg={cfg} set={set} catalog={catalog} errors={errors} />
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 z-20 mt-auto flex items-center justify-between gap-4 border-t border-border bg-background/85 px-7 py-3 backdrop-blur">
        <div className="min-w-0 text-sm text-muted-foreground">
          {issueCount > 0 ? (
            <button type="button" className="inline-flex items-center gap-1.5 text-destructive hover:underline" onClick={() => jumpTo(sectionForError(Object.keys(errors)[0]))}>
              <TriangleAlert className="size-4" />
              {issueCount} {issueCount === 1 ? "issue" : "issues"} to fix
            </button>
          ) : dirty ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-primary" /> Unsaved changes
            </span>
          ) : mode === "edit" ? (
            "All changes saved"
          ) : (
            "Everything maps 1:1 to ElevenLabs Conversational AI."
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" onClick={cancel} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={onSubmit} loading={saving} disabled={mode === "edit" && !dirty && !saving}>
            {mode === "create" ? "Create agent" : "Save changes"}
          </Button>
        </div>
      </div>

      <ConfirmDialog open={cancelOpen} onOpenChange={setCancelOpen} title="Discard unsaved changes?" description="Your edits to this agent will be lost." confirmLabel="Discard" destructive onConfirm={() => router.push("/agents")} />
    </div>
  );
}

function FormSkeleton() {
  return (
    <div className="px-7 pb-8">
      <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
        <div className="hidden flex-col gap-2 lg:flex">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
        <div className="flex max-w-5xl flex-col gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-6">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="mt-2 h-3 w-72" />
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <Skeleton className="h-9" />
                <Skeleton className="h-9" />
                <Skeleton className="h-24 md:col-span-2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
