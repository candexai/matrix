/**
 * Translates our AgentFormConfig <-> ElevenLabs conversation_config / platform_settings.
 */
import type { AgentFormConfig, DataCollectionField, EvaluationCriterion, HumanTransferRule } from "../../models/Agent";
import { DEFAULT_LLM, DEFAULT_TTS_MODEL } from "../../constants/catalog";
import type { RemoteAgent } from "./client";

export const DEFAULT_SYSTEM_PROMPT = `You are a friendly, professional voice assistant making outbound calls on behalf of the business.
Goals:
1. Confirm you are speaking with {{name}}.
2. Briefly explain why you are calling and ask if now is a good time.
3. Ask the qualification questions naturally, one at a time, and capture the answers.
4. Be concise (1–2 sentences per turn), never interrupt, and politely end the call when done.
If the person is not interested or asks you to stop, thank them and end the call.`;

export const DEFAULT_AGENT_CONFIG: AgentFormConfig = {
  first_message: "Hi {{name}}, this is {{agent_name}} calling from Matrix. Do you have a quick moment?",
  system_prompt: DEFAULT_SYSTEM_PROMPT,
  language: "en",
  additional_languages: [],
  hinglish_mode: false,

  llm: DEFAULT_LLM,
  temperature: 0.3,
  max_tokens: undefined,
  reasoning_effort: undefined,

  voice_id: "",
  tts_model_id: DEFAULT_TTS_MODEL,
  stability: 0.5,
  similarity_boost: 0.8,
  speed: 1.0,
  optimize_streaming_latency: 3,
  agent_output_audio_format: "pcm_16000",
  expressive_mode: undefined,

  asr_provider: "elevenlabs",
  asr_quality: "high",
  user_input_audio_format: "pcm_16000",
  asr_keywords: [],

  turn_mode: "turn",
  turn_timeout: 7,
  silence_end_call_timeout: -1,
  turn_eagerness: "normal",
  disable_first_message_interruptions: false,

  max_duration_seconds: 600,
  max_conversation_duration_message: undefined,

  built_in_tools: ["end_call"],
  voicemail_message: "",
  enable_human_transfer: false,
  human_transfer_rules: [],
  tool_ids: [],
  knowledge_base_ids: [],

  data_collection: [],
  evaluation_criteria: [],
  summary_language: undefined,

  record_voice: true,
  retention_days: -1,
  agent_concurrency_limit: -1,
  daily_limit: 100000,

  post_call_webhook_enabled: true,
  post_call_webhook_events: ["transcript"],
  dynamic_variable_placeholders: { name: "there", agent_name: "Matrix Assistant" },
};

export function withDefaults(partial: Partial<AgentFormConfig> | undefined): AgentFormConfig {
  const merged: AgentFormConfig = { ...DEFAULT_AGENT_CONFIG, ...(partial ?? {}) } as AgentFormConfig;
  merged.additional_languages = (merged.additional_languages ?? []).filter((l) => l && l !== merged.language);
  merged.built_in_tools = Array.from(new Set(merged.built_in_tools ?? []));
  merged.human_transfer_rules = (merged.human_transfer_rules ?? []).filter((r) => r?.phone_number && r?.condition);
  if (merged.enable_human_transfer && !merged.built_in_tools.includes("transfer_to_number")) merged.built_in_tools.push("transfer_to_number");
  if (!merged.enable_human_transfer) merged.built_in_tools = merged.built_in_tools.filter((t) => t !== "transfer_to_number");
  merged.data_collection = (merged.data_collection ?? []).filter((f) => f?.key).map((f) => ({ ...f, key: toSnake(f.key) }));
  merged.evaluation_criteria = (merged.evaluation_criteria ?? []).filter((c) => c?.name && c?.conversation_goal_prompt).map((c) => ({ ...c, id: c.id || toSnake(c.name) }));
  merged.dynamic_variable_placeholders = merged.dynamic_variable_placeholders ?? {};
  return merged;
}

export function toSnake(s: string): string {
  return String(s)
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase() || "field";
}

const ALL_TOOL_KEYS = ["end_call", "language_detection", "voicemail_detection", "skip_turn", "play_keypad_touch_tone", "transfer_to_number"] as const;

function buildBuiltInTools(cfg: AgentFormConfig, includeNulls: boolean): Record<string, unknown> {
  const enabled = new Set(cfg.built_in_tools);
  const out: Record<string, unknown> = {};
  const tool = (name: string, params: Record<string, unknown>, description?: string) => ({
    type: "system",
    name,
    description: description ?? "",
    params,
  });

  for (const key of ALL_TOOL_KEYS) {
    let value: unknown = null;
    if (enabled.has(key)) {
      switch (key) {
        case "end_call":
          value = tool("end_call", { system_tool_type: "end_call" }, "End the call when the conversation is complete or the user asks to hang up.");
          break;
        case "language_detection":
          value = tool("language_detection", { system_tool_type: "language_detection" }, "Switch to the language the user is speaking.");
          break;
        case "voicemail_detection":
          value = tool(
            "voicemail_detection",
            { system_tool_type: "voicemail_detection", voicemail_message: cfg.voicemail_message?.trim() || null },
            "Use when you reach a voicemail / answering machine instead of a person."
          );
          break;
        case "skip_turn":
          value = tool("skip_turn", { system_tool_type: "skip_turn" }, "Stay silent when the user asks for a moment.");
          break;
        case "play_keypad_touch_tone":
          value = tool("play_keypad_touch_tone", { system_tool_type: "play_keypad_touch_tone" }, "Play DTMF tones to navigate phone menus.");
          break;
        case "transfer_to_number":
          if (cfg.human_transfer_rules.length) {
            value = tool(
              "transfer_to_number",
              {
                system_tool_type: "transfer_to_number",
                transfers: cfg.human_transfer_rules.map((r: HumanTransferRule) => ({
                  transfer_destination: { type: "phone", phone_number: r.phone_number },
                  phone_number: r.phone_number,
                  condition: r.condition,
                  transfer_type: r.transfer_type || "conference",
                })),
              },
              "Transfer the call to a human when the conditions are met."
            );
          }
          break;
      }
    }
    if (value !== null) out[key] = value;
    else if (includeNulls) out[key] = null;
  }
  return out;
}

export type KnowledgeLookup = Map<string, { name: string; type: string }>;

export function buildConversationConfig(cfg: AgentFormConfig, mode: "create" | "update" = "create", kb: KnowledgeLookup = new Map()): Record<string, unknown> {
  const prompt: Record<string, unknown> = {
    prompt: cfg.system_prompt,
    llm: cfg.llm,
    temperature: cfg.temperature,
    tool_ids: cfg.tool_ids ?? [],
    built_in_tools: buildBuiltInTools(cfg, mode === "update"),
    knowledge_base: (cfg.knowledge_base_ids ?? []).map((id, i) => {
      const meta = kb.get(id);
      return { id, type: meta?.type ?? "file", name: meta?.name ?? `Document ${i + 1}`, usage_mode: "auto" };
    }),
  };
  if (cfg.max_tokens && cfg.max_tokens > 0) prompt.max_tokens = cfg.max_tokens;
  if (cfg.reasoning_effort) prompt.reasoning_effort = cfg.reasoning_effort;
  if (cfg.llm === "custom-llm" && cfg.custom_llm_url) {
    prompt.custom_llm = { url: cfg.custom_llm_url, model_id: cfg.custom_llm_model_id || null };
  }

  const agent: Record<string, unknown> = {
    first_message: cfg.first_message,
    language: cfg.language,
    disable_first_message_interruptions: cfg.disable_first_message_interruptions,
    dynamic_variables: { dynamic_variable_placeholders: cfg.dynamic_variable_placeholders ?? {} },
    prompt,
  };
  if (cfg.language === "hi") agent.hinglish_mode = Boolean(cfg.hinglish_mode);
  if (cfg.max_conversation_duration_message) agent.max_conversation_duration_message = cfg.max_conversation_duration_message;

  const tts: Record<string, unknown> = {
    voice_id: cfg.voice_id,
    model_id: cfg.tts_model_id,
    stability: cfg.stability,
    similarity_boost: cfg.similarity_boost,
    speed: cfg.speed,
    optimize_streaming_latency: cfg.optimize_streaming_latency,
    agent_output_audio_format: cfg.agent_output_audio_format,
  };
  if (cfg.tts_model_id === "eleven_v3_conversational") tts.expressive_mode = cfg.expressive_mode ?? true;

  const language_presets: Record<string, unknown> = {};
  for (const lang of cfg.additional_languages ?? []) {
    language_presets[lang] = { overrides: { agent: { language: lang } } };
  }

  return {
    agent,
    tts,
    asr: {
      provider: cfg.asr_provider,
      quality: cfg.asr_quality || "high",
      user_input_audio_format: cfg.user_input_audio_format,
      keywords: cfg.asr_keywords ?? [],
    },
    turn: {
      mode: cfg.turn_mode,
      turn_timeout: cfg.turn_timeout,
      silence_end_call_timeout: cfg.silence_end_call_timeout,
      turn_eagerness: cfg.turn_eagerness,
    },
    conversation: {
      max_duration_seconds: cfg.max_duration_seconds,
      text_only: false,
    },
    language_presets,
  };
}

export function buildPlatformSettings(cfg: AgentFormConfig, webhook?: { webhookId: string; events: string[] } | null): Record<string, unknown> {
  const data_collection: Record<string, unknown> = {};
  for (const f of cfg.data_collection ?? []) {
    data_collection[f.key] = { type: f.type || "string", description: f.description || f.key };
  }
  const ps: Record<string, unknown> = {
    data_collection,
    evaluation: {
      criteria: (cfg.evaluation_criteria ?? []).map((c: EvaluationCriterion) => ({
        id: c.id,
        name: c.name,
        type: "prompt",
        conversation_goal_prompt: c.conversation_goal_prompt,
      })),
    },
    privacy: { record_voice: cfg.record_voice, retention_days: cfg.retention_days },
    call_limits: { agent_concurrency_limit: cfg.agent_concurrency_limit, daily_limit: cfg.daily_limit },
  };
  if (cfg.summary_language) ps.summary_language = cfg.summary_language;
  if (webhook) {
    ps.workspace_overrides = { webhooks: { post_call_webhook_id: webhook.webhookId, events: webhook.events } };
  }
  return ps;
}

/** Hydrate a form from a remote ElevenLabs agent (import / sync). */
export function formFromRemote(remote: RemoteAgent, existing?: Partial<AgentFormConfig>): AgentFormConfig {
  const cc = remote.conversation_config ?? {};
  const ag = cc.agent ?? {};
  const pr = typeof ag.prompt === "string" ? { prompt: ag.prompt } : ag.prompt ?? {};
  const tts = cc.tts ?? {};
  const asr = cc.asr ?? {};
  const turn = cc.turn ?? {};
  const conv = cc.conversation ?? {};
  const ps = remote.platform_settings ?? {};
  const bit = pr.built_in_tools ?? {};

  const built_in_tools = ALL_TOOL_KEYS.filter((k) => bit[k]);
  const transferParams = bit.transfer_to_number?.params ?? {};
  const human_transfer_rules: HumanTransferRule[] = (transferParams.transfers ?? []).map((t: any) => ({
    condition: t.condition ?? "",
    phone_number: t.transfer_destination?.phone_number ?? t.phone_number ?? "",
    transfer_type: t.transfer_type ?? "conference",
  }));

  const dc = ps.data_collection ?? {};
  const prevDc = new Map((existing?.data_collection ?? []).map((f) => [f.key, f]));
  const data_collection: DataCollectionField[] = Object.entries(dc).map(([key, v]: [string, any]) => ({
    key,
    type: (v?.type as DataCollectionField["type"]) ?? "string",
    description: v?.description ?? "",
    zohoField: prevDc.get(key)?.zohoField,
  }));

  const evaluation_criteria: EvaluationCriterion[] = (ps.evaluation?.criteria ?? []).map((c: any) => ({
    id: c.id,
    name: c.name,
    conversation_goal_prompt: c.conversation_goal_prompt ?? "",
  }));

  return withDefaults({
    ...existing,
    first_message: ag.first_message ?? "",
    system_prompt: pr.prompt ?? "",
    language: ag.language ?? "en",
    additional_languages: Object.keys(cc.language_presets ?? {}),
    hinglish_mode: Boolean(ag.hinglish_mode),
    llm: pr.llm ?? DEFAULT_LLM,
    custom_llm_url: pr.custom_llm?.url,
    custom_llm_model_id: pr.custom_llm?.model_id ?? undefined,
    temperature: typeof pr.temperature === "number" ? pr.temperature : 0.3,
    max_tokens: typeof pr.max_tokens === "number" && pr.max_tokens > 0 ? pr.max_tokens : undefined,
    reasoning_effort: pr.reasoning_effort ?? undefined,
    voice_id: tts.voice_id ?? "",
    tts_model_id: tts.model_id ?? DEFAULT_TTS_MODEL,
    stability: typeof tts.stability === "number" ? tts.stability : 0.5,
    similarity_boost: typeof tts.similarity_boost === "number" ? tts.similarity_boost : 0.8,
    speed: typeof tts.speed === "number" ? tts.speed : 1,
    optimize_streaming_latency: typeof tts.optimize_streaming_latency === "number" ? tts.optimize_streaming_latency : 3,
    agent_output_audio_format: tts.agent_output_audio_format ?? "pcm_16000",
    expressive_mode: tts.expressive_mode,
    asr_provider: asr.provider ?? "elevenlabs",
    asr_quality: asr.quality ?? "high",
    user_input_audio_format: asr.user_input_audio_format ?? "pcm_16000",
    asr_keywords: asr.keywords ?? [],
    turn_mode: turn.mode ?? "turn",
    turn_timeout: typeof turn.turn_timeout === "number" ? turn.turn_timeout : 7,
    silence_end_call_timeout: typeof turn.silence_end_call_timeout === "number" ? turn.silence_end_call_timeout : -1,
    turn_eagerness: turn.turn_eagerness ?? "normal",
    disable_first_message_interruptions: Boolean(ag.disable_first_message_interruptions),
    max_duration_seconds: typeof conv.max_duration_seconds === "number" ? conv.max_duration_seconds : 600,
    max_conversation_duration_message: ag.max_conversation_duration_message ?? undefined,
    built_in_tools,
    voicemail_message: bit.voicemail_detection?.params?.voicemail_message ?? "",
    enable_human_transfer: human_transfer_rules.length > 0,
    human_transfer_rules,
    tool_ids: pr.tool_ids ?? [],
    knowledge_base_ids: (pr.knowledge_base ?? []).map((k: any) => k.id).filter(Boolean),
    data_collection,
    evaluation_criteria,
    summary_language: ps.summary_language ?? undefined,
    record_voice: ps.privacy?.record_voice ?? true,
    retention_days: typeof ps.privacy?.retention_days === "number" ? ps.privacy.retention_days : -1,
    agent_concurrency_limit: typeof ps.call_limits?.agent_concurrency_limit === "number" ? ps.call_limits.agent_concurrency_limit : -1,
    daily_limit: typeof ps.call_limits?.daily_limit === "number" ? ps.call_limits.daily_limit : 100000,
    // Imported agents default to webhooks ON so transcripts flow into Matrix; only an explicit false disables it.
    post_call_webhook_enabled: existing?.post_call_webhook_enabled ?? true,
    post_call_webhook_events: ps.workspace_overrides?.webhooks?.events ?? existing?.post_call_webhook_events ?? ["transcript"],
    dynamic_variable_placeholders: ag.dynamic_variables?.dynamic_variable_placeholders ?? {},
  });
}
