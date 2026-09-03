import { Database, Ear, Languages, MicVocal, Shield, User, Wrench, type LucideIcon } from "lucide-react";
import type { AgentFormConfig, Catalog } from "@/lib/types";

export type SetCfg = <K extends keyof AgentFormConfig>(key: K, value: AgentFormConfig[K]) => void;
export type FormErrors = Record<string, string>;

export interface SectionProps {
  cfg: AgentFormConfig;
  set: SetCfg;
  catalog: Catalog;
  errors: FormErrors;
}

export interface SectionDef {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
}

export const SECTIONS: SectionDef[] = [
  { id: "identity", label: "Identity", description: "Name, greeting and system prompt", icon: User },
  { id: "language-model", label: "Language & model", description: "Languages, LLM and generation settings", icon: Languages },
  { id: "voice", label: "Voice & TTS", description: "Voice, speech model and audio output", icon: MicVocal },
  { id: "speech", label: "Speech & turn-taking", description: "Recognition, interruptions and timing", icon: Ear },
  { id: "tools", label: "Tools & transfer", description: "Built-in tools, human handoff, knowledge", icon: Wrench },
  { id: "data", label: "Data & evaluation", description: "Extract fields and score calls", icon: Database },
  { id: "privacy", label: "Privacy, limits & webhook", description: "Recording, retention, limits and post-call events", icon: Shield },
];

const FIELD_SECTION: Record<string, string> = {
  name: "identity",
  description: "identity",
  first_message: "identity",
  system_prompt: "identity",
  dynamic_variable_placeholders: "identity",
  language: "language-model",
  additional_languages: "language-model",
  llm: "language-model",
  custom_llm_url: "language-model",
  custom_llm_model_id: "language-model",
  temperature: "language-model",
  max_tokens: "language-model",
  voice_id: "voice",
  tts_model_id: "voice",
  turn_timeout: "speech",
  silence_end_call_timeout: "speech",
  max_duration_seconds: "speech",
  human_transfer_rules: "tools",
  voicemail_message: "tools",
  data_collection: "data",
  evaluation_criteria: "data",
  retention_days: "privacy",
  agent_concurrency_limit: "privacy",
  daily_limit: "privacy",
  post_call_webhook_events: "privacy",
};

/** Maps an error key (or its dotted prefix) to the section that owns it. */
export function sectionForError(key: string): string {
  return FIELD_SECTION[key.split(".")[0]] ?? "identity";
}
