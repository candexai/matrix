/**
 * AI agent generation for a lead table: from the user's instructions, an optional website, and the
 * table's columns (what to collect), an LLM drafts a complete voice agent — name, first message,
 * a structured system prompt with a conversation flow, and the data-collection fields — which is
 * then created on ElevenLabs and attached to the table.
 */
import axios from "axios";
import { LeadList } from "../models/LeadList";
import { Lead } from "../models/Lead";
import { Agent, AgentDoc } from "../models/Agent";
import { defaultOpenAICaller, OpenAICaller, openAiConfigured } from "./extraction.service";
import { getIntegration, fetchLeadFields } from "./zoho/zohoClient";
import { getLeadList, setBinding } from "./leads.service";
import { createAgent } from "./agent.service";
import { elevenlabs } from "./elevenlabs/client";
import { HttpError } from "../utils/http";
import { LANGUAGES } from "../constants/catalog";

let caller: OpenAICaller = defaultOpenAICaller;
export function setGeneratorCaller(fn?: OpenAICaller) {
  caller = fn ?? defaultOpenAICaller;
}

export interface GenerateInput {
  instructions: string;
  websiteUrl?: string;
  language?: string;
  tone?: string;
  agentName?: string;
  companyName?: string;
  /** Zoho api_names to collect; defaults to the table's empty-capable columns */
  fields?: string[];
}

export interface AgentDraft {
  name: string;
  description: string;
  first_message: string;
  system_prompt: string;
  language: string;
  fields: { zohoField: string; label: string; description: string; askAs: string }[];
  evaluation_criteria: { id: string; name: string; conversation_goal_prompt: string }[];
  updateLeadStatusTo?: string;
  website?: { url: string; title?: string; chars: number };
  model: string;
}

const NON_COLLECTABLE = new Set(["First_Name", "Last_Name", "Full_Name", "Phone", "Mobile", "Email", "Lead_Status", "Lead_Source", "Owner", "Created_By", "Modified_By", "Created_Time", "Modified_Time", "Email_Opt_Out", "Record_Image", "Layout", "Tag", "Salutation", "Converted__s", "Locked__s"]);

/** Fetch a web page and reduce it to readable text (max ~8k chars). */
export async function fetchWebsiteText(url: string): Promise<{ url: string; title?: string; text: string }> {
  const u = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  const { data } = await axios.get<string>(u, { timeout: 15000, responseType: "text", maxContentLength: 3_000_000, headers: { "User-Agent": "Mozilla/5.0 (compatible; MatrixAgentBuilder/1.0)", Accept: "text/html,*/*" } });
  const html = String(data);
  const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim();
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(br|p|div|li|h[1-6]|tr|section|article)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim()
    .slice(0, 8000);
  return { url: u, title, text };
}

function languageName(code: string): string {
  return LANGUAGES.find((l) => l.value === code)?.label ?? code;
}

export function buildGeneratorPrompt(input: {
  instructions: string;
  language: string;
  tone?: string;
  companyName?: string;
  agentName?: string;
  list: { name: string; recordCount: number; columns: string[] };
  fields: { api_name: string; label: string; data_type: string; picklist?: string[]; filledShare: number }[];
  known: string[];
  website?: { url: string; title?: string; text: string };
}): { system: string; user: string } {
  const system = [
    "You are an expert designer of outbound AI voice-agent scripts for sales and lead qualification (ElevenLabs Conversational AI).",
    "You will receive: the business's instructions, an optional summary of their website, and a CRM lead table with (a) the columns already available for every lead (these are passed to the agent as dynamic variables like {{name}}, {{company}}) and (b) the EMPTY columns the agent must collect during the call.",
    "Produce ONE agent as strict JSON:",
    '{"name":"","description":"","first_message":"","system_prompt":"","fields":[{"zohoField":"api_name","label":"","description":"what to extract (for post-call extraction)","askAs":"the exact natural question the agent should ask"}],"evaluation_criteria":[{"id":"snake","name":"","conversation_goal_prompt":""}],"updateLeadStatusTo":""}',
    "REQUIREMENTS FOR system_prompt (write it as the agent's instructions, in second person, using clear sections with headings and numbered steps):",
    "1. IDENTITY & CONTEXT — who the agent is (use the agent name), which company it represents, what the company offers (from the website/instructions), and the purpose of the call.",
    "2. AVAILABLE DATA — list the dynamic variables it already knows ({{name}}, {{company}}, and every zoho_<field> variable listed) and tell it to USE them naturally and never ask for information it already has.",
    "3. CONVERSATION FLOW — a numbered, step-by-step flow: greeting + identity check, permission to talk, value statement, then ONE question per empty column in a logical order (use the askAs phrasing), confirmation of key answers, objection handling with 2–3 likely objections and responses, a clear close (next step / follow-up), and a polite exit path if the lead is not interested or busy.",
    "4. DATA TO COLLECT — for each empty column: the column label, what a valid answer looks like (respect data types/picklist options), and instructions to confirm ambiguous answers (numbers, dates).",
    "5. STYLE RULES — the tone requested, 1–2 sentences per turn, never interrupt, no jargon, don't invent facts, stay in the requested language, handle voicemail/wrong number gracefully, end the call politely when done.",
    "6. DO NOT — read the column list aloud, ask more than one question at a time, promise things not in the instructions.",
    "first_message must greet using {{name}} and state who is calling and why in one or two short sentences, ending with a question. description is a one-line internal summary. evaluation_criteria: 2–3 outcomes worth tracking (e.g. interested, all_fields_collected). updateLeadStatusTo: pick the most sensible Lead Status value from the provided picklist for a completed call, or empty string.",
    "Keep the whole system_prompt under 900 words. Output JSON only.",
  ].join("\n");

  const fieldLines = input.fields.map((f) => `- ${f.api_name} ("${f.label}", ${f.data_type}${f.picklist?.length ? `, one of: ${f.picklist.slice(0, 20).join(" | ")}` : ""}) — currently filled for ${Math.round(f.filledShare * 100)}% of leads`).join("\n");
  const user = [
    `Business instructions:\n${input.instructions.trim()}`,
    input.companyName ? `Company name: ${input.companyName}` : "",
    input.agentName ? `Preferred agent name: ${input.agentName}` : "",
    `Language: ${languageName(input.language)} (${input.language})`,
    input.tone ? `Tone: ${input.tone}` : "",
    input.website ? `Website (${input.website.url}${input.website.title ? ` — ${input.website.title}` : ""}):\n${input.website.text.slice(0, 6000)}` : "",
    `Lead table: "${input.list.name}" (${input.list.recordCount} leads).`,
    `Data ALREADY AVAILABLE per lead (dynamic variables): ${["{{name}}", "{{first_name}}", "{{company}}", "{{phone}}", ...input.known.map((k) => `{{zoho_${k.toLowerCase()}}}`)].join(", ")}`,
    `EMPTY columns the agent must collect (${input.fields.length}):\n${fieldLines || "(none — focus on qualification and next steps)"}`,
  ]
    .filter(Boolean)
    .join("\n\n");
  return { system, user };
}

async function collectContext(workspaceId: string, listId: string, wanted?: string[]) {
  const list = await getLeadList(workspaceId, listId);
  const integ = await getIntegration(workspaceId);
  const meta = integ?.status === "connected" ? await fetchLeadFields(integ).catch(() => integ.fieldsCache ?? []) : integ?.fieldsCache ?? [];
  const metaByName = new Map(meta.map((m) => [m.api_name, m]));

  // which columns are empty-capable and how filled they are, from the leads in this table
  const filter: Record<string, unknown> = { workspaceId };
  if (listId !== "all") filter.listIds = listId;
  const leads = await Lead.find(filter, { fields: 1 }).limit(500);
  const candidateNames = wanted?.length ? wanted : (list.columns.length ? list.columns : meta.filter((m) => !m.read_only).map((m) => m.api_name)).filter((c) => !NON_COLLECTABLE.has(c));
  const fields = candidateNames
    .filter((c) => !NON_COLLECTABLE.has(c))
    .map((c) => {
      const m = metaByName.get(c);
      if (m && (m.read_only || ["lookup", "ownerlookup", "formula", "fileupload", "imageupload", "subform"].includes(m.data_type))) return null;
      const filled = leads.filter((l) => l.fields?.[c] !== null && l.fields?.[c] !== undefined && String(l.fields?.[c]).trim() !== "").length;
      return { api_name: c, label: m?.field_label ?? c.replace(/_/g, " "), data_type: m?.data_type ?? "text", picklist: m?.pick_list_values?.map((p) => p.display_value), filledShare: leads.length ? filled / leads.length : 0 };
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x))
    .sort((a, b) => a.filledShare - b.filledShare)
    .slice(0, 12);
  const known = Array.from(new Set(leads.flatMap((l) => Object.entries(l.fields ?? {}).filter(([k, v]) => !NON_COLLECTABLE.has(k) && v !== null && v !== undefined && String(v).trim() !== "" && typeof v !== "object").map(([k]) => k)))).slice(0, 15);
  const statusOptions = metaByName.get("Lead_Status")?.pick_list_values?.map((p) => p.display_value) ?? [];
  return { list, fields, known, statusOptions };
}

export async function generateDraft(workspaceId: string, listId: string, input: GenerateInput): Promise<AgentDraft> {
  if (!input.instructions?.trim()) throw new HttpError(400, "Describe what the agent should do", "VALIDATION_ERROR");
  if (!openAiConfigured()) throw new HttpError(400, "OPENAI_API_KEY is not configured — add it to backend/.env to generate agents with AI", "OPENAI_NOT_CONFIGURED");
  const model = process.env.OPENAI_GENERATOR_MODEL || process.env.OPENAI_MODEL || "gpt-4.1-mini";
  const language = input.language || "en";
  const { list, fields, known, statusOptions } = await collectContext(workspaceId, listId, input.fields);

  let website: { url: string; title?: string; text: string } | undefined;
  if (input.websiteUrl?.trim()) {
    try {
      website = await fetchWebsiteText(input.websiteUrl.trim());
    } catch (err) {
      console.warn("[agent-gen] website fetch failed:", (err as Error).message);
    }
  }

  const { system, user } = buildGeneratorPrompt({ instructions: input.instructions, language, tone: input.tone, companyName: input.companyName, agentName: input.agentName, list: { name: list.name, recordCount: list.recordCount, columns: list.columns }, fields, known, website });
  const content = await caller([{ role: "system", content: system }, { role: "user", content: `${user}\n\nLead Status options: ${statusOptions.join(" | ") || "(unknown)"}` }], model);
  let parsed: Record<string, any> = {};
  try {
    parsed = JSON.parse(content);
  } catch {
    const m = content.match(/\{[\s\S]*\}/);
    if (m) parsed = JSON.parse(m[0]);
  }
  const allowed = new Map(fields.map((f) => [f.api_name, f]));
  const draftFields = (Array.isArray(parsed.fields) ? parsed.fields : [])
    .map((f: any) => ({ zohoField: String(f.zohoField ?? ""), label: String(f.label ?? allowed.get(f.zohoField)?.label ?? f.zohoField ?? ""), description: String(f.description ?? "").slice(0, 200), askAs: String(f.askAs ?? "").slice(0, 200) }))
    .filter((f: { zohoField: string }) => allowed.has(f.zohoField));
  // make sure every candidate column is covered
  for (const f of fields) if (!draftFields.some((d: { zohoField: string }) => d.zohoField === f.api_name)) draftFields.push({ zohoField: f.api_name, label: f.label, description: `${f.label} of the lead`, askAs: `Could you tell me your ${f.label.toLowerCase()}?` });

  return {
    name: String(parsed.name || input.agentName || `${list.name} Agent`).slice(0, 80),
    description: String(parsed.description || "").slice(0, 300),
    first_message: String(parsed.first_message || `Hi {{name}}, this is ${parsed.name || "our assistant"}. Do you have a quick moment?`).slice(0, 500),
    system_prompt: String(parsed.system_prompt || "").slice(0, 12000),
    language,
    fields: draftFields,
    evaluation_criteria: (Array.isArray(parsed.evaluation_criteria) ? parsed.evaluation_criteria : []).slice(0, 4).map((c: any) => ({ id: String(c.id || c.name || "goal").toLowerCase().replace(/[^a-z0-9]+/g, "_"), name: String(c.name || c.id || "Goal"), conversation_goal_prompt: String(c.conversation_goal_prompt || "") })),
    updateLeadStatusTo: statusOptions.includes(String(parsed.updateLeadStatusTo)) ? String(parsed.updateLeadStatusTo) : undefined,
    website: website ? { url: website.url, title: website.title, chars: website.text.length } : undefined,
    model,
  };
}

/** Pick a default voice for the language: prefers premade voices whose verified languages include it. */
async function pickVoice(language: string, preferred?: string): Promise<string> {
  if (preferred) return preferred;
  const voices = await elevenlabs.listVoices();
  const lang = language.toLowerCase().split("-")[0];
  const match = voices.find((v) => (v.verified_languages ?? []).some((l) => l.language?.toLowerCase().startsWith(lang)) && v.category === "premade") ?? voices.find((v) => v.category === "premade") ?? voices[0];
  if (!match) throw new HttpError(400, "No voices available in your ElevenLabs workspace", "NO_VOICE");
  return match.voice_id;
}

export async function createAgentFromDraft(workspaceId: string, listId: string, draft: AgentDraft, opts: { voiceId?: string; phoneNumberId?: string; llm?: string; ttsModelId?: string }): Promise<{ agent: AgentDoc; binding: unknown }> {
  if (!draft.system_prompt?.trim()) throw new HttpError(400, "System prompt is empty", "VALIDATION_ERROR");
  const voice_id = await pickVoice(draft.language, opts.voiceId);
  const agent = await createAgent(workspaceId, {
    name: draft.name,
    description: draft.description || `Generated for lead table "${listId}"`,
    config: {
      voice_id,
      language: draft.language,
      first_message: draft.first_message,
      system_prompt: draft.system_prompt,
      ...(opts.llm ? { llm: opts.llm } : {}),
      ...(opts.ttsModelId ? { tts_model_id: opts.ttsModelId } : {}),
      evaluation_criteria: draft.evaluation_criteria,
      data_collection: draft.fields.map((f) => ({ key: f.zohoField.toLowerCase().replace(/[^a-z0-9]+/g, "_"), type: "string" as const, description: f.description || f.label, zohoField: f.zohoField })),
      dynamic_variable_placeholders: { name: "there", agent_name: draft.name },
    },
  });
  const binding = await setBinding(workspaceId, {
    listId: listId === "all" ? null : listId,
    agentId: String(agent._id),
    phoneNumberId: opts.phoneNumberId,
    fields: draft.fields.map((f) => ({ zohoField: f.zohoField, label: f.label, description: f.description })),
    onlyFillEmpty: true,
    pushToZoho: true,
    updateLeadStatusTo: draft.updateLeadStatusTo,
  });
  const fresh = (await Agent.findById(agent._id)) ?? agent;
  return { agent: fresh, binding };
}
