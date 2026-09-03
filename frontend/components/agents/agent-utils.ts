import type { CatalogOption, LanguageOption, TtsModelOption, Voice } from "@/lib/types";

/** Variables Matrix injects automatically when a lead is called. */
export const DYNAMIC_VARIABLES: { name: string; description: string }[] = [
  { name: "name", description: "Lead's full name" },
  { name: "first_name", description: "Lead's first name" },
  { name: "company", description: "Lead's company" },
  { name: "agent_name", description: "This agent's display name" },
  { name: "lead_status", description: "Current CRM lead status" },
];

export function primaryCode(language: string): string {
  return (language || "en").toLowerCase().split("-")[0];
}

/** Mirrors backend `ttsModelSupportsLanguage`. */
export function ttsModelSupportsLanguage(model: TtsModelOption | undefined, language: string): boolean {
  if (!model) return true;
  const primary = primaryCode(language);
  if (model.languages === "*") return true;
  if (model.languages === "non-en") return primary !== "en";
  return model.languages.includes(primary);
}

export function ttsIncompatibleReason(model: TtsModelOption, language: string, languages: LanguageOption[]): string | undefined {
  if (ttsModelSupportsLanguage(model, language)) return undefined;
  const current = optionLabel(languages, language, language);
  if (model.languages === "non-en") return `${model.label} is only available when the primary language is not English.`;
  if (Array.isArray(model.languages)) {
    const names = model.languages.map((c) => optionLabel(languages, c, c)).join(", ");
    return `${model.label} only supports ${names}. Current primary language: ${current}.`;
  }
  return `${model.label} does not support ${current}.`;
}

export function optionLabel(options: readonly CatalogOption[] | undefined, value: string | null | undefined, fallback = "—"): string {
  if (!value) return fallback;
  return options?.find((o) => o.value === value)?.label ?? value;
}

export function shortId(id: string, n = 10): string {
  return id.length > n + 2 ? `${id.slice(0, n)}…` : id;
}

export function voiceName(voices: Voice[] | undefined, id?: string): string {
  if (!id) return "No voice";
  return voices?.find((v) => v.voice_id === id)?.name ?? shortId(id);
}

/** Same normalisation the backend applies to data-collection keys. */
export function toSnake(s: string): string {
  return String(s)
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

export const E164 = /^\+[1-9]\d{6,14}$/;

export const uniq = <T,>(list: T[]): T[] => Array.from(new Set(list));

export const LATENCY_OPTIONS: { value: number; label: string; description?: string }[] = [
  { value: 0, label: "0 · Default", description: "No latency optimization, best quality" },
  { value: 1, label: "1 · Normal", description: "~50% of max improvement" },
  { value: 2, label: "2 · Strong", description: "~75% of max improvement" },
  { value: 3, label: "3 · Max", description: "Max latency optimization" },
  { value: 4, label: "4 · Max + no normalizer", description: "Max optimization, text normalizer off (numbers/dates read literally)" },
];

export const LATENCY_LABEL: Record<TtsModelOption["latency"], string> = { lowest: "Lowest latency", low: "Low latency", medium: "Medium latency" };
export const QUALITY_LABEL: Record<TtsModelOption["quality"], string> = { good: "Good quality", high: "High quality", highest: "Highest quality" };

export function formatUnix(secs?: number): string {
  if (!secs) return "—";
  return new Date(secs * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function providerLabel(p?: string): string {
  if (!p) return "";
  if (p === "direct") return "Direct API";
  if (p === "python" || p === "pythonService") return "Python service";
  return p;
}
