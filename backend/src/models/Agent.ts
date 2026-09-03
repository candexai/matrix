import { Schema, model, Document, Types } from "mongoose";

export interface HumanTransferRule {
  condition: string;
  phone_number: string;
  transfer_type: "sip_refer" | "conference" | "blind";
}

export interface DataCollectionField {
  key: string;
  type: "string" | "number" | "integer" | "boolean";
  description: string;
  /** Zoho Leads api_name this field maps to (optional) */
  zohoField?: string;
}

export interface EvaluationCriterion {
  id: string;
  name: string;
  conversation_goal_prompt: string;
}

/** The form-level config we own. It is compiled into ElevenLabs conversation_config + platform_settings. */
export interface AgentFormConfig {
  // Identity
  first_message: string;
  system_prompt: string;
  language: string;
  additional_languages: string[];
  hinglish_mode: boolean;
  // LLM
  llm: string;
  custom_llm_url?: string;
  custom_llm_model_id?: string;
  temperature: number;
  max_tokens?: number;
  reasoning_effort?: string;
  // Voice / TTS
  voice_id: string;
  tts_model_id: string;
  stability: number;
  similarity_boost: number;
  speed: number;
  optimize_streaming_latency: number;
  agent_output_audio_format: string;
  expressive_mode?: boolean;
  // ASR
  asr_provider: string;
  asr_quality: string;
  user_input_audio_format: string;
  asr_keywords: string[];
  // Turn taking
  turn_mode: "turn" | "silence";
  turn_timeout: number;
  silence_end_call_timeout: number;
  turn_eagerness: "patient" | "normal" | "eager";
  disable_first_message_interruptions: boolean;
  // Conversation
  max_duration_seconds: number;
  max_conversation_duration_message?: string;
  // Tools
  built_in_tools: string[];
  voicemail_message?: string;
  enable_human_transfer: boolean;
  human_transfer_rules: HumanTransferRule[];
  tool_ids: string[];
  knowledge_base_ids: string[];
  // Analysis
  data_collection: DataCollectionField[];
  evaluation_criteria: EvaluationCriterion[];
  summary_language?: string;
  // Privacy / limits
  record_voice: boolean;
  retention_days: number;
  agent_concurrency_limit: number;
  daily_limit: number;
  // Webhook
  post_call_webhook_enabled: boolean;
  post_call_webhook_events: string[];
  dynamic_variable_placeholders: Record<string, string>;
}

export interface AgentDoc extends Document {
  _id: Types.ObjectId;
  workspaceId: string;
  elevenAgentId: string;
  name: string;
  description?: string;
  config: AgentFormConfig;
  postCallWebhook?: {
    webhookId?: string;
    secretEnc?: string;
    url?: string;
    events?: string[];
  };
  /** Provider used for the last write: "python-service" | "direct" */
  lastProvider?: string;
  remoteSnapshot?: Record<string, unknown>;
  lastSyncedAt?: Date;
  callCount: number;
  lastCallAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AgentSchema = new Schema<AgentDoc>(
  {
    workspaceId: { type: String, required: true, index: true, default: "default" },
    elevenAgentId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String },
    config: { type: Schema.Types.Mixed, required: true },
    postCallWebhook: {
      webhookId: String,
      secretEnc: String,
      url: String,
      events: [String],
    },
    lastProvider: String,
    remoteSnapshot: { type: Schema.Types.Mixed },
    lastSyncedAt: Date,
    callCount: { type: Number, default: 0 },
    lastCallAt: Date,
  },
  { timestamps: true, minimize: false }
);

AgentSchema.index({ workspaceId: 1, createdAt: -1 });

export const Agent = model<AgentDoc>("Agent", AgentSchema);
