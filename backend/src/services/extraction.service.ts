/**
 * OpenAI-based extraction of CRM lead fields from a call transcript.
 * Only fields that the caller clearly stated are returned; values are coerced to the Zoho data type.
 */
import axios from "axios";
import type { TranscriptTurn } from "../models/Conversation";
import { normalizePhone } from "../utils/phone";

export interface ExtractField {
  api_name: string;
  label: string;
  data_type: string;
  pick_list_values?: string[];
  description?: string;
}

export interface ExtractionInput {
  transcript: TranscriptTurn[];
  /** Empty fields to fill */
  fields: ExtractField[];
  lead?: { name?: string; phone?: string; company?: string };
  /** Fields already filled on the lead (label → value), given to the model as context; they are never overwritten */
  known?: Record<string, unknown>;
  summary?: string;
}

export interface ExtractionResult {
  values: Record<string, unknown>;
  model: string;
  skipped?: string;
  raw?: Record<string, unknown>;
}

export type OpenAICaller = (messages: { role: "system" | "user"; content: string }[], model: string) => Promise<string>;

const NOT_MEANINGFUL = new Set(["", "n/a", "na", "none", "null", "undefined", "not provided", "unknown", "-", "—", "not mentioned", "not specified", "no", "nil"]);
const NUMERIC_TYPES = new Set(["integer", "bigint", "double", "currency", "percent", "decimal"]);

export function openAiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export const defaultOpenAICaller: OpenAICaller = async (messages, model) => {
  const { data } = await axios.post(
    `${(process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "")}/chat/completions`,
    { model, temperature: 0, response_format: { type: "json_object" }, messages },
    { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" }, timeout: 60000 }
  );
  return data?.choices?.[0]?.message?.content ?? "{}";
};

let activeCaller: OpenAICaller = defaultOpenAICaller;
/** Override the OpenAI transport (tests / alternative providers). Pass undefined to restore the default. */
export function setOpenAICaller(fn?: OpenAICaller) {
  activeCaller = fn ?? defaultOpenAICaller;
}

export function transcriptToText(turns: TranscriptTurn[]): string {
  return turns
    .filter((t) => t.message?.trim())
    .map((t) => `${t.role === "agent" ? "AGENT" : "CALLER"}: ${t.message.trim()}`)
    .join("\n");
}

function buildPrompt(input: ExtractionInput): { system: string; user: string } {
  const numeric = input.fields.filter((f) => NUMERIC_TYPES.has(f.data_type)).map((f) => f.api_name);
  const knownEntries = Object.entries(input.known ?? {}).filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== "");
  const lines = [
    "You are the post-call data assistant for a CRM (Zoho CRM Leads). An AI voice agent just finished a phone call with a lead.",
    `The lead record currently has ${knownEntries.length} filled column(s) and ${input.fields.length} empty column(s). Your only job is to fill the EMPTY columns from what the caller said on the call.`,
    "Return a JSON object whose keys are EXACTLY the API names of the empty columns listed below (and nothing else). Use an empty string \"\" for any column the caller did not clearly state or confirm.",
    "Only fill a column when the caller explicitly provided or confirmed the information. Never guess, never infer from context, never reuse the already-filled columns, and never copy the agent's suggestions unless the caller agreed to them.",
    "LANGUAGE: whatever language the call was in (Hindi, Hinglish, English or other), write every value in English using Roman/Latin script only. Translate meaning; transliterate proper nouns (e.g. \"राकेश\" -> \"Rakesh\").",
    "Keep values short and factual (no sentences). Dates as YYYY-MM-DD. Yes/no columns as true or false. Picklist columns must use one of the allowed options exactly.",
  ];
  if (numeric.length) {
    lines.push(
      `These fields are numbers: ${numeric.join(", ")}. Write plain digits only, no units or commas.`,
      "Convert spoken amounts: thousand/k = ×1,000; lakh/lac = ×100,000; crore = ×10,000,000; million/m = ×1,000,000. Example: \"10 lakh\" -> 1000000, \"20k\" -> 20000, \"2.5 crore\" -> 25000000."
    );
  }
  const fieldList = input.fields
    .map((f) => {
      const opts = f.pick_list_values?.length ? ` — must be one of: ${f.pick_list_values.slice(0, 40).join(" | ")}` : "";
      const desc = f.description ? ` — ${f.description}` : "";
      return `- ${f.api_name} (${f.label}, ${f.data_type})${desc}${opts}`;
    })
    .join("\n");
  const ctx = [input.lead?.name ? `Caller on record: ${input.lead.name}` : "", input.lead?.company ? `Company on record: ${input.lead.company}` : "", input.lead?.phone ? `Phone on record: ${input.lead.phone}` : ""].filter(Boolean).join("\n");
  const known = knownEntries.length ? ["Already filled columns (context only, do not output these):", ...knownEntries.slice(0, 60).map(([k, v]) => `- ${k}: ${String(v).slice(0, 200)}`)].join("\n") : "";
  const user = [ctx, known, input.summary ? `Call summary: ${input.summary}` : "", `Empty columns to fill (${input.fields.length}):`, fieldList, "", "Transcript:", transcriptToText(input.transcript)].filter((x) => x !== "").join("\n");
  return { system: lines.join("\n"), user };
}

export function isMeaningfulValue(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === "boolean") return true;
  if (typeof v === "number") return Number.isFinite(v);
  if (Array.isArray(v)) return v.length > 0;
  return !NOT_MEANINGFUL.has(String(v).trim().toLowerCase());
}

/** Coerce an extracted value to the Zoho data type; returns undefined when it cannot be used. */
export function coerceValue(field: ExtractField, raw: unknown): unknown {
  if (!isMeaningfulValue(raw)) return undefined;
  const s = typeof raw === "string" ? raw.trim() : raw;
  switch (field.data_type) {
    case "integer":
    case "bigint": {
      const n = typeof s === "number" ? s : parseInt(String(s).replace(/[^\d-]/g, ""), 10);
      return Number.isFinite(n) ? Math.trunc(n) : undefined;
    }
    case "double":
    case "currency":
    case "percent":
    case "decimal": {
      const n = typeof s === "number" ? s : parseFloat(String(s).replace(/[^\d.-]/g, ""));
      return Number.isFinite(n) ? n : undefined;
    }
    case "boolean": {
      if (typeof s === "boolean") return s;
      const t = String(s).toLowerCase();
      if (["true", "yes", "y", "haan", "ha", "1"].includes(t)) return true;
      if (["false", "no", "n", "nahi", "0"].includes(t)) return false;
      return undefined;
    }
    case "email": {
      const t = String(s).replace(/\s+at\s+/gi, "@").replace(/\s+dot\s+/gi, ".").replace(/\s+/g, "").toLowerCase();
      return /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(t) ? t : undefined;
    }
    case "phone":
      return normalizePhone(String(s)) ?? undefined;
    case "picklist": {
      const opts = field.pick_list_values ?? [];
      if (!opts.length) return String(s);
      const t = String(s).toLowerCase();
      const exact = opts.find((o) => o.toLowerCase() === t);
      if (exact) return exact;
      const partial = opts.find((o) => o.toLowerCase().includes(t) || t.includes(o.toLowerCase()));
      return partial;
    }
    case "multiselectpicklist": {
      const opts = field.pick_list_values ?? [];
      const arr = Array.isArray(s) ? s.map(String) : String(s).split(/[,;|]/).map((x) => x.trim());
      const matched = arr.map((x) => opts.find((o) => o.toLowerCase() === x.toLowerCase()) ?? (opts.length ? undefined : x)).filter(Boolean);
      return matched.length ? matched : undefined;
    }
    case "date": {
      const d = new Date(String(s));
      return Number.isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10);
    }
    case "datetime": {
      const d = new Date(String(s));
      return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
    }
    case "website": {
      const t = String(s).replace(/\s+dot\s+/gi, ".").replace(/\s+/g, "").toLowerCase();
      return t.includes(".") ? (t.startsWith("http") ? t : `https://${t}`) : undefined;
    }
    default:
      return typeof s === "string" ? s.slice(0, 2000) : String(s);
  }
}

export async function extractFieldsFromTranscript(input: ExtractionInput, call: OpenAICaller = activeCaller): Promise<ExtractionResult> {
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
  if (!input.fields.length) return { values: {}, model, skipped: "no candidate fields" };
  const callerTurns = input.transcript.filter((t) => t.role !== "agent" && t.message?.trim());
  if (!callerTurns.length) return { values: {}, model, skipped: "caller said nothing" };
  if (!openAiConfigured()) return { values: {}, model, skipped: "OPENAI_API_KEY not configured" };

  const { system, user } = buildPrompt(input);
  const content = await call(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    model
  );
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(content);
  } catch {
    const m = content.match(/\{[\s\S]*\}/);
    if (m) parsed = JSON.parse(m[0]);
  }
  const values: Record<string, unknown> = {};
  for (const f of input.fields) {
    const v = coerceValue(f, parsed[f.api_name]);
    if (v !== undefined) values[f.api_name] = v;
  }
  return { values, model, raw: parsed };
}
