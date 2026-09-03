/**
 * Option catalogs for the agent builder. LLM + TTS enums come straight from the
 * ElevenLabs OpenAPI spec (components.schemas.LLM / TTSConversationalModel).
 */

export interface CatalogOption {
  value: string;
  label: string;
  group?: string;
  description?: string;
}

export const LLM_MODELS: CatalogOption[] = [
  // OpenAI
  { value: "gpt-5.4-mini", label: "GPT-5.4 Mini", group: "OpenAI", description: "Fast, cost-efficient, great default" },
  { value: "gpt-5.4-nano", label: "GPT-5.4 Nano", group: "OpenAI", description: "Lowest latency OpenAI model" },
  { value: "gpt-5.4", label: "GPT-5.4", group: "OpenAI", description: "Highest quality OpenAI" },
  { value: "gpt-5.5", label: "GPT-5.5", group: "OpenAI" },
  { value: "gpt-5.2", label: "GPT-5.2", group: "OpenAI" },
  { value: "gpt-5.1", label: "GPT-5.1", group: "OpenAI" },
  { value: "gpt-5", label: "GPT-5", group: "OpenAI" },
  { value: "gpt-5-mini", label: "GPT-5 Mini", group: "OpenAI" },
  { value: "gpt-5-nano", label: "GPT-5 Nano", group: "OpenAI" },
  { value: "gpt-4.1", label: "GPT-4.1", group: "OpenAI" },
  { value: "gpt-4.1-mini", label: "GPT-4.1 Mini", group: "OpenAI" },
  { value: "gpt-4.1-nano", label: "GPT-4.1 Nano", group: "OpenAI" },
  { value: "gpt-4o", label: "GPT-4o", group: "OpenAI" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini", group: "OpenAI" },
  // Google
  { value: "gemini-3.6-flash", label: "Gemini 3.6 Flash", group: "Google", description: "Fast multilingual" },
  { value: "gemini-3.7-flash", label: "Gemini 3.7 Flash", group: "Google" },
  { value: "gemini-3.5-flash", label: "Gemini 3.5 Flash", group: "Google" },
  { value: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash Lite", group: "Google", description: "Cheapest Gemini" },
  { value: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash Lite", group: "Google" },
  { value: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro (preview)", group: "Google" },
  { value: "gemini-3-flash-preview", label: "Gemini 3 Flash (preview)", group: "Google" },
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash", group: "Google" },
  { value: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite", group: "Google" },
  { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash", group: "Google" },
  { value: "gemini-2.0-flash-lite", label: "Gemini 2.0 Flash Lite", group: "Google" },
  // Anthropic
  { value: "claude-sonnet-5", label: "Claude Sonnet 5", group: "Anthropic" },
  { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", group: "Anthropic" },
  { value: "claude-sonnet-4-5", label: "Claude Sonnet 4.5", group: "Anthropic" },
  { value: "claude-haiku-4-5", label: "Claude Haiku 4.5", group: "Anthropic", description: "Fast Anthropic model" },
  { value: "claude-opus-4-8", label: "Claude Opus 4.8", group: "Anthropic" },
  { value: "claude-opus-4-7", label: "Claude Opus 4.7", group: "Anthropic" },
  { value: "claude-sonnet-4", label: "Claude Sonnet 4", group: "Anthropic" },
  { value: "claude-3-7-sonnet", label: "Claude 3.7 Sonnet", group: "Anthropic" },
  { value: "claude-3-5-sonnet", label: "Claude 3.5 Sonnet", group: "Anthropic" },
  // Open-weight / others
  { value: "qwen36-35b-a3b", label: "Qwen 3.6 35B-A3B", group: "Open models" },
  { value: "qwen35-397b-a17b", label: "Qwen 3.5 397B-A17B", group: "Open models" },
  { value: "qwen3-30b-a3b", label: "Qwen3 30B-A3B", group: "Open models" },
  { value: "qwen3-4b", label: "Qwen3 4B", group: "Open models" },
  { value: "gpt-oss-120b", label: "GPT-OSS 120B", group: "Open models" },
  { value: "gpt-oss-20b", label: "GPT-OSS 20B", group: "Open models" },
  { value: "glm-45-air-fp8", label: "GLM-4.5 Air", group: "Open models" },
  { value: "grok-beta", label: "Grok (beta)", group: "xAI" },
  { value: "custom-llm", label: "Custom LLM (bring your own endpoint)", group: "Custom" },
];

export const DEFAULT_LLM = "gpt-5.4-mini";

export interface TtsModelOption extends CatalogOption {
  /** Language codes this model supports; "*" = all, "non-en" = any primary language except English. */
  languages: "*" | "non-en" | string[];
  latency: "lowest" | "low" | "medium";
  quality: "good" | "high" | "highest";
}

export const TTS_MODELS: TtsModelOption[] = [
  // Mirrors the per-language allowlist enforced by the Python ElevenLabs service.
  { value: "eleven_v3_conversational", label: "Eleven v3 Conversational", description: "Expressive mode, 70+ languages, best quality (default)", languages: "*", latency: "medium", quality: "highest" },
  { value: "eleven_flash_v2", label: "Eleven Flash v2", description: "Ultra-low latency · English only", languages: ["en"], latency: "lowest", quality: "good" },
  { value: "eleven_turbo_v2", label: "Eleven Turbo v2", description: "Low latency, higher quality · English only", languages: ["en"], latency: "low", quality: "high" },
  { value: "eleven_flash_v2_5", label: "Eleven Flash v2.5", description: "Ultra-low latency · non-English primary languages", languages: "non-en", latency: "lowest", quality: "good" },
  { value: "eleven_turbo_v2_5", label: "Eleven Turbo v2.5", description: "Low latency, higher quality · non-English primary languages", languages: "non-en", latency: "low", quality: "high" },
];

export const DEFAULT_TTS_MODEL = "eleven_v3_conversational";

export interface LanguageOption extends CatalogOption {
  nativeName: string;
}

/** ElevenLabs Conversational AI supported languages (ISO-639-1). */
export const LANGUAGES: LanguageOption[] = [
  { value: "en", label: "English", nativeName: "English" },
  { value: "hi", label: "Hindi", nativeName: "हिन्दी" },
  { value: "es", label: "Spanish", nativeName: "Español" },
  { value: "fr", label: "French", nativeName: "Français" },
  { value: "de", label: "German", nativeName: "Deutsch" },
  { value: "it", label: "Italian", nativeName: "Italiano" },
  { value: "pt", label: "Portuguese", nativeName: "Português" },
  { value: "pt-br", label: "Portuguese (Brazil)", nativeName: "Português (Brasil)" },
  { value: "ar", label: "Arabic", nativeName: "العربية" },
  { value: "zh", label: "Chinese (Mandarin)", nativeName: "中文" },
  { value: "ja", label: "Japanese", nativeName: "日本語" },
  { value: "ko", label: "Korean", nativeName: "한국어" },
  { value: "nl", label: "Dutch", nativeName: "Nederlands" },
  { value: "tr", label: "Turkish", nativeName: "Türkçe" },
  { value: "pl", label: "Polish", nativeName: "Polski" },
  { value: "sv", label: "Swedish", nativeName: "Svenska" },
  { value: "id", label: "Indonesian", nativeName: "Bahasa Indonesia" },
  { value: "fil", label: "Filipino", nativeName: "Filipino" },
  { value: "ms", label: "Malay", nativeName: "Bahasa Melayu" },
  { value: "ta", label: "Tamil", nativeName: "தமிழ்" },
  { value: "vi", label: "Vietnamese", nativeName: "Tiếng Việt" },
  { value: "ru", label: "Russian", nativeName: "Русский" },
  { value: "uk", label: "Ukrainian", nativeName: "Українська" },
  { value: "el", label: "Greek", nativeName: "Ελληνικά" },
  { value: "cs", label: "Czech", nativeName: "Čeština" },
  { value: "fi", label: "Finnish", nativeName: "Suomi" },
  { value: "ro", label: "Romanian", nativeName: "Română" },
  { value: "da", label: "Danish", nativeName: "Dansk" },
  { value: "bg", label: "Bulgarian", nativeName: "Български" },
  { value: "hr", label: "Croatian", nativeName: "Hrvatski" },
  { value: "sk", label: "Slovak", nativeName: "Slovenčina" },
  { value: "hu", label: "Hungarian", nativeName: "Magyar" },
  { value: "no", label: "Norwegian", nativeName: "Norsk" },
];

export const ASR_PROVIDERS: CatalogOption[] = [
  { value: "elevenlabs", label: "ElevenLabs (default)" },
  { value: "scribe_realtime", label: "Scribe Realtime" },
];

export const TURN_MODES: CatalogOption[] = [
  { value: "turn", label: "Turn-based", description: "Agent waits for the user to finish speaking" },
  { value: "silence", label: "Silence-based", description: "Agent responds after a silence threshold" },
];

export const TURN_EAGERNESS: CatalogOption[] = [
  { value: "patient", label: "Patient", description: "Waits longer before replying" },
  { value: "normal", label: "Normal" },
  { value: "eager", label: "Eager", description: "Jumps in quickly" },
];

export const AUDIO_FORMATS: CatalogOption[] = [
  { value: "pcm_16000", label: "PCM 16 kHz" },
  { value: "pcm_8000", label: "PCM 8 kHz (telephony)" },
  { value: "pcm_22050", label: "PCM 22.05 kHz" },
  { value: "pcm_24000", label: "PCM 24 kHz" },
  { value: "pcm_44100", label: "PCM 44.1 kHz" },
  { value: "ulaw_8000", label: "μ-law 8 kHz (Twilio)" },
];

export const BUILT_IN_TOOLS: CatalogOption[] = [
  { value: "end_call", label: "End call", description: "Let the agent hang up when the conversation is complete" },
  { value: "language_detection", label: "Language detection", description: "Switch language when the caller changes language" },
  { value: "voicemail_detection", label: "Voicemail detection", description: "Detect answering machines and leave a message" },
  { value: "skip_turn", label: "Skip turn", description: "Let the agent stay silent when the user asks for a moment" },
  { value: "transfer_to_number", label: "Transfer to human", description: "Warm/blind transfer to a phone number" },
  { value: "play_keypad_touch_tone", label: "Keypad tones (DTMF)", description: "Navigate IVR menus" },
];

export const DATA_COLLECTION_TYPES: CatalogOption[] = [
  { value: "string", label: "Text" },
  { value: "number", label: "Number" },
  { value: "integer", label: "Integer" },
  { value: "boolean", label: "Yes / No" },
];

export const WEBHOOK_EVENTS: CatalogOption[] = [
  { value: "transcript", label: "Transcript (post-call)" },
  { value: "audio", label: "Audio recording" },
  { value: "call_initiation_failure", label: "Call initiation failure" },
  { value: "answering_machine_detection", label: "Answering-machine detection" },
];

export function ttsModelSupportsLanguage(modelId: string, language: string): boolean {
  const m = TTS_MODELS.find((x) => x.value === modelId);
  if (!m) return true;
  const primary = language.toLowerCase().split("-")[0];
  if (m.languages === "*") return true;
  if (m.languages === "non-en") return primary !== "en";
  return m.languages.includes(primary);
}
