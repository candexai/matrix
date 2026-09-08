/**
 * Post-call pipeline: store the conversation, match it to a lead, fill empty lead fields from
 * ElevenLabs data-collection results, and push those fields back to Zoho CRM.
 */
import { Types } from "mongoose";
import { Agent, AgentDoc } from "../models/Agent";
import { Conversation, ConversationDoc, TranscriptTurn } from "../models/Conversation";
import { Lead, LeadDoc } from "../models/Lead";
import { LeadAgentBinding } from "../models/LeadAgentBinding";
import { WorkspaceSettings } from "../models/WorkspaceSettings";
import { RemoteConversation } from "./elevenlabs/client";
import { getIntegration, updateLead as zohoUpdateLead, fetchLeadFields } from "./zoho/zohoClient";
import { extractFieldsFromTranscript, openAiConfigured, ExtractField, isMeaningfulValue } from "./extraction.service";
import type { ZohoFieldMeta } from "../models/ZohoIntegration";
import { decrypt } from "../utils/crypto";
import { normalizePhone, phoneKey } from "../utils/phone";
import { env } from "../config/env";
import { analyzeConversation } from "./insights.service";

const NOT_MEANINGFUL = new Set(["", "n/a", "na", "none", "null", "undefined", "not provided", "unknown", "-", "not mentioned", "not specified", "no answer", "n.a."]);

export function isMeaningful(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === "boolean") return true;
  if (typeof v === "number") return Number.isFinite(v);
  const s = String(v).trim().toLowerCase();
  return s.length > 0 && !NOT_MEANINGFUL.has(s);
}

export function normKey(k: string): string {
  return String(k).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function isEmptyValue(v: unknown): boolean {
  return v === null || v === undefined || (typeof v === "string" && v.trim() === "") || (Array.isArray(v) && v.length === 0);
}

/** All HMAC secrets that could have signed a payload for this agent. */
export async function collectWebhookSecrets(elevenAgentId?: string): Promise<string[]> {
  const secrets = new Set<string>();
  if (process.env.ELEVENLABS_WEBHOOK_SECRET) secrets.add(process.env.ELEVENLABS_WEBHOOK_SECRET);
  const settingsDocs = await WorkspaceSettings.find({ "elevenWebhook.secretEnc": { $exists: true, $ne: null } });
  for (const s of settingsDocs) {
    try {
      if (s.elevenWebhook?.secretEnc) secrets.add(decrypt(s.elevenWebhook.secretEnc));
    } catch {
      /* ignore */
    }
  }
  if (elevenAgentId) {
    const agent = await Agent.findOne({ elevenAgentId });
    if (agent?.postCallWebhook?.secretEnc) {
      try {
        secrets.add(decrypt(agent.postCallWebhook.secretEnc));
      } catch {
        /* ignore */
      }
    }
  }
  return Array.from(secrets);
}

function normalizeTranscript(items: RemoteConversation["transcript"] | undefined): TranscriptTurn[] {
  return (items ?? [])
    .map((t) => ({
      role: t.role === "agent" ? "agent" : t.role === "user" ? "user" : t.role,
      message: (t.message ?? "").toString(),
      timeInCallSecs: t.time_in_call_secs,
      toolCalls: t.tool_calls && t.tool_calls.length ? t.tool_calls : undefined,
    }))
    .filter((t) => t.message || (t.toolCalls && t.toolCalls.length));
}

function mapStatus(remoteStatus: string | undefined): ConversationDoc["status"] {
  switch (remoteStatus) {
    case "done":
      return "done";
    case "failed":
      return "failed";
    case "processing":
      return "processing";
    case "in-progress":
    case "in_progress":
      return "in_progress";
    case "initiated":
      return "initiated";
    default:
      return "done";
  }
}

/** Upsert a Conversation document from a full remote conversation (webhook `data` or GET /conversations/:id). */
export async function upsertConversationFromRemote(workspaceId: string, remote: RemoteConversation): Promise<ConversationDoc> {
  const dyn = (remote.conversation_initiation_client_data?.dynamic_variables ?? {}) as Record<string, unknown>;
  const phoneCall = remote.metadata?.phone_call ?? null;
  const externalNumber = phoneCall?.external_number ? normalizePhone(phoneCall.external_number) ?? phoneCall.external_number : (dyn.phone as string | undefined);
  const direction = (phoneCall?.direction as "inbound" | "outbound" | undefined) ?? (dyn.lead_id ? "outbound" : undefined);
  const startedAt = remote.metadata?.start_time_unix_secs ? new Date(remote.metadata.start_time_unix_secs * 1000) : undefined;
  const durationSecs = remote.metadata?.call_duration_secs;
  const analysis = remote.analysis ?? undefined;

  const agentDoc = await Agent.findOne({ elevenAgentId: remote.agent_id });
  const isTestCall = String(dyn.test_call ?? "") === "true";
  const dynName = typeof dyn.name === "string" && dyn.name.trim() && dyn.name.trim().toLowerCase() !== "there" ? dyn.name.trim() : "";

  const update: Partial<ConversationDoc> = {
    workspaceId,
    channel: "voice",
    elevenAgentId: remote.agent_id,
    agentName: remote.agent_name ?? agentDoc?.name,
    agentRef: agentDoc?._id,
    phone: externalNumber ?? undefined,
    direction,
    status: mapStatus(remote.status),
    callSuccessful: analysis?.call_successful,
    transcript: normalizeTranscript(remote.transcript),
    summary: analysis?.transcript_summary,
    summaryTitle: analysis?.call_summary_title,
    durationSecs,
    startedAt,
    endedAt: startedAt && durationSecs ? new Date(startedAt.getTime() + durationSecs * 1000) : undefined,
    terminationReason: remote.metadata?.termination_reason,
    dataCollection: analysis?.data_collection_results as ConversationDoc["dataCollection"],
    evaluation: analysis?.evaluation_criteria_results as ConversationDoc["evaluation"],
    dynamicVariables: dyn,
    hasAudio: Boolean(remote.has_audio),
    batchCallId: remote.metadata?.batch_call?.batch_call_id ?? undefined,
    raw: { metadata: remote.metadata, analysis: remote.analysis },
  };
  if (!phoneCall && !externalNumber) {
    // Browser (web) session – no phone number involved.
    update.leadName = dynName ? `${dynName} (web test)` : isTestCall ? "Web test call" : "Web call";
    update.direction = update.direction ?? "outbound";
  } else if (isTestCall && dynName) {
    update.leadName = `${dynName} (test call)`;
  }

  const conv = await Conversation.findOneAndUpdate(
    { elevenConversationId: remote.conversation_id },
    { $set: update, $setOnInsert: { elevenConversationId: remote.conversation_id } },
    { upsert: true, new: true }
  );

  // ---- match to a lead ----
  let lead: LeadDoc | null = null;
  if (conv.leadId) lead = await Lead.findById(conv.leadId);
  if (!lead && typeof dyn.lead_id === "string" && Types.ObjectId.isValid(dyn.lead_id)) lead = await Lead.findById(dyn.lead_id);
  if (!lead && externalNumber) {
    const key = phoneKey(externalNumber);
    if (key) lead = await Lead.findOne({ workspaceId, phoneKey: key });
  }
  if (lead) {
    conv.leadId = lead._id;
    conv.leadName = lead.fullName;
    await conv.save();

    if (conv.status === "done" || conv.status === "failed") {
      const priorCounted = lead.lastCallAt && conv.startedAt && lead.lastCallAt.getTime() === conv.startedAt.getTime();
      if (!priorCounted) lead.callCount = (lead.callCount ?? 0) + 1;
      lead.lastCallAt = conv.startedAt ?? new Date();
      lead.lastCallStatus = conv.status;
      lead.lastCallOutcome = conv.callSuccessful;
      lead.lastCallSummary = conv.summary;
      lead.lastAgentId = remote.agent_id;
      await lead.save();
      if (conv.status === "done") await applyCollectedDataToLead(conv, lead, agentDoc);
    }
  }

  if (agentDoc && (conv.status === "done" || conv.status === "failed")) {
    await Agent.updateOne({ _id: agentDoc._id }, { $set: { lastCallAt: conv.startedAt ?? new Date() } });
  }

  // Conversation Insights (tags, sentiment, loss risk) — once per completed call with a transcript.
  if (conv.status === "done" && (conv.transcript?.length ?? 0) > 0 && !conv.insights?.tags?.length) {
    try {
      await analyzeConversation(conv);
    } catch (err) {
      console.warn("[insights] analysis failed:", (err as Error).message);
    }
  }
  return conv;
}

interface FieldPlan {
  collectionKey: string;
  zohoField: string;
  label: string;
}

/** Binding for the list the call was placed from (dynamic variable lead_list_id), else the lead's lists, else the workspace default. */
async function resolveBinding(workspaceId: string, lead: LeadDoc, listIdHint?: string) {
  if (listIdHint) {
    const b = await LeadAgentBinding.findOne({ workspaceId, listId: listIdHint, active: true });
    if (b) return b;
  }
  for (const listId of lead.listIds ?? []) {
    const b = await LeadAgentBinding.findOne({ workspaceId, listId, active: true });
    if (b) return b;
  }
  return LeadAgentBinding.findOne({ workspaceId, listId: null, active: true });
}

/** Which collected keys map to which Zoho fields for this call. */
async function buildFieldPlan(workspaceId: string, agentDoc: AgentDoc | null, lead: LeadDoc, listIdHint?: string): Promise<{ plan: FieldPlan[]; onlyFillEmpty: boolean; pushToZoho: boolean; updateLeadStatusTo?: string; bindingFields: string[] }> {
  const plan: FieldPlan[] = [];
  const seen = new Set<string>();
  const binding = await resolveBinding(workspaceId, lead, listIdHint);
  if (binding && agentDoc && binding.elevenAgentId === agentDoc.elevenAgentId) {
    for (const f of binding.fields) {
      if (f.zohoField && f.collectionKey && !seen.has(f.collectionKey)) {
        plan.push({ collectionKey: f.collectionKey, zohoField: f.zohoField, label: f.label });
        seen.add(f.collectionKey);
      }
    }
  }
  for (const f of agentDoc?.config?.data_collection ?? []) {
    if (f.zohoField && !seen.has(f.key)) {
      plan.push({ collectionKey: f.key, zohoField: f.zohoField, label: f.key });
      seen.add(f.key);
    }
  }
  return {
    plan,
    onlyFillEmpty: binding?.onlyFillEmpty ?? true,
    pushToZoho: binding?.pushToZoho ?? true,
    updateLeadStatusTo: binding?.updateLeadStatusTo || undefined,
    bindingFields: (binding?.fields ?? []).map((f) => f.zohoField),
  };
}

/** Fields we never auto-fill from a transcript. */
const EXTRACTION_DENYLIST = new Set(["Lead_Status", "Lead_Source", "Email_Opt_Out", "Converted_Account", "Converted_Contact", "Converted_Deal", "Full_Name", "Record_Image", "Tag", "Owner", "Layout", "Unsubscribed_Mode", "Unsubscribed_Time", "Salutation", "Phone", "Mobile", "Last_Activity_Time", "Created_Time", "Modified_Time", "id"]);
const EXTRACTABLE_TYPES = new Set(["text", "textarea", "email", "phone", "website", "integer", "bigint", "double", "currency", "percent", "decimal", "boolean", "picklist", "multiselectpicklist", "date", "datetime"]);

/** Data types for standard Zoho lead fields, used when Zoho field metadata is unavailable (manual leads). */
const STANDARD_FIELD_TYPES: Record<string, string> = {
  Email: "email",
  Secondary_Email: "email",
  Website: "website",
  Annual_Revenue: "currency",
  No_of_Employees: "integer",
  Skype_ID: "text",
  Description: "textarea",
  Street: "text",
  City: "text",
  State: "text",
  Zip_Code: "text",
  Country: "text",
  Company: "text",
  Designation: "text",
  Industry: "picklist",
  Rating: "picklist",
  Fax: "phone",
};

/** Empty, writable lead fields that OpenAI may fill from the transcript (binding/list columns first). */
async function candidateFieldsForExtraction(lead: LeadDoc, alreadyFilled: Set<string>, priority: string[]): Promise<ExtractField[]> {
  const integ = await getIntegration(lead.workspaceId);
  let meta: ZohoFieldMeta[] = [];
  if (integ?.status === "connected") meta = await fetchLeadFields(integ).catch(() => integ.fieldsCache ?? []);
  const metaByName = new Map(meta.map((m) => [m.api_name, m]));
  const names = new Set<string>([...priority, ...Object.keys(lead.fields ?? {}), ...meta.filter((m) => !m.read_only).map((m) => m.api_name)]);
  const out: ExtractField[] = [];
  for (const name of names) {
    if (EXTRACTION_DENYLIST.has(name) || alreadyFilled.has(name)) continue;
    if (!isEmptyValue(lead.fields?.[name])) continue;
    const m = metaByName.get(name);
    if (m && (m.read_only || !EXTRACTABLE_TYPES.has(m.data_type))) continue;
    if (!m && meta.length) continue; // unknown field while Zoho meta is available → not writable
    out.push({ api_name: name, label: m?.field_label ?? name.replace(/_/g, " "), data_type: m?.data_type ?? STANDARD_FIELD_TYPES[name] ?? "text", pick_list_values: m?.pick_list_values?.map((p) => p.display_value) });
  }
  // priority fields first, cap prompt size
  out.sort((a, b) => (priority.indexOf(a.api_name) === -1 ? 1 : 0) - (priority.indexOf(b.api_name) === -1 ? 1 : 0));
  return out.slice(0, 40);
}

const STANDARD_LOCAL: Record<string, keyof LeadDoc> = {
  First_Name: "firstName",
  Last_Name: "lastName",
  Email: "email",
  Phone: "phone",
  Mobile: "mobile",
  Company: "company",
  Designation: "title",
  Lead_Status: "leadStatus",
  Lead_Source: "leadSource",
  City: "city",
  State: "state",
  Country: "country",
  Industry: "industry",
  Website: "website",
  Description: "description",
  Rating: "rating",
  Annual_Revenue: "annualRevenue",
};

/**
 * Fill empty lead fields with values the agent collected, then push them to Zoho.
 * Only fields that are empty on the lead are written (unless the binding says otherwise).
 */
export async function applyCollectedDataToLead(conv: ConversationDoc, lead: LeadDoc, agentDoc: AgentDoc | null): Promise<void> {
  const results = conv.dataCollection ?? {};
  const listIdHint = typeof conv.dynamicVariables?.lead_list_id === "string" ? (conv.dynamicVariables.lead_list_id as string) : undefined;
  const { plan, onlyFillEmpty, pushToZoho, updateLeadStatusTo, bindingFields } = await buildFieldPlan(lead.workspaceId, agentDoc, lead, listIdHint);
  // Fallback: map collected keys to Zoho fields by normalised name (e.g. "budget" → "Budget", "lead_status" → "Lead_Status")
  const planned = new Set(plan.map((p) => p.collectionKey));
  const leadFieldByNorm = new Map(Object.keys(lead.fields ?? {}).map((k) => [normKey(k), k]));
  for (const key of Object.keys(results)) {
    if (planned.has(key)) continue;
    const zohoField = leadFieldByNorm.get(normKey(key));
    if (zohoField) {
      plan.push({ collectionKey: key, zohoField, label: zohoField });
      planned.add(key);
    }
  }
  const updates: Record<string, unknown> = {};
  const skipped: string[] = [];

  for (const item of plan) {
    const r = results[item.collectionKey];
    const value = r && typeof r === "object" && "value" in r ? (r as { value: unknown }).value : undefined;
    if (!isMeaningful(value)) {
      skipped.push(`${item.zohoField}: no value collected`);
      continue;
    }
    const current = lead.fields?.[item.zohoField];
    if (onlyFillEmpty && !isEmptyValue(current)) {
      skipped.push(`${item.zohoField}: already set`);
      continue;
    }
    updates[item.zohoField] = value;
  }
  // ---- OpenAI: fill remaining empty fields from the transcript ----
  const candidates = await candidateFieldsForExtraction(lead, new Set(Object.keys(updates)), bindingFields);
  if (candidates.length && conv.transcript?.length) {
    try {
      const known: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(lead.fields ?? {})) {
        if (!isEmptyValue(v) && typeof v !== "object" && !["id", "Modified_Time", "Created_Time"].includes(k)) known[k] = v;
      }
      for (const [k, v] of Object.entries(updates)) known[k] = v;
      const res = await extractFieldsFromTranscript({ transcript: conv.transcript, fields: candidates, lead: { name: lead.fullName, phone: lead.phone, company: lead.company }, known, summary: conv.summary });
      const extracted: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(res.values)) {
        if (!isMeaningfulValue(v)) continue;
        if (onlyFillEmpty && !isEmptyValue(lead.fields?.[k])) continue;
        updates[k] = v;
        extracted[k] = v;
      }
      conv.extraction = { provider: "openai", model: res.model, at: new Date(), candidateFields: candidates.map((c) => c.api_name), extracted, skipped: res.skipped };
    } catch (err) {
      conv.extraction = { provider: "openai", at: new Date(), candidateFields: candidates.map((c) => c.api_name), extracted: {}, error: (err as Error).message };
      console.warn("[post-call] OpenAI extraction failed:", (err as Error).message);
    }
  } else {
    conv.extraction = { provider: "openai", at: new Date(), candidateFields: [], extracted: {}, skipped: !candidates.length ? "no empty fields to fill" : "no transcript", model: undefined };
  }
  if (!openAiConfigured() && candidates.length) conv.extraction = { ...(conv.extraction ?? { provider: "openai", at: new Date(), candidateFields: [], extracted: {} }), skipped: "OPENAI_API_KEY not configured" };

  if (updateLeadStatusTo) {
    // Lead status is always advanced after a completed call (it is a workflow field, not collected data).
    updates.Lead_Status = updateLeadStatusTo;
  }

  conv.zohoSync = { ...(conv.zohoSync ?? {}), attemptedAt: new Date(), updatedFields: Object.keys(updates), skippedFields: skipped };

  if (Object.keys(updates).length === 0) {
    await conv.save();
    return;
  }

  lead.fields = { ...(lead.fields ?? {}), ...updates };
  lead.markModified("fields");
  for (const [zohoKey, localKey] of Object.entries(STANDARD_LOCAL)) {
    if (zohoKey in updates) (lead as any)[localKey] = updates[zohoKey];
  }
  if (updates.First_Name || updates.Last_Name) lead.fullName = `${lead.firstName ?? ""} ${lead.lastName ?? ""}`.trim() || lead.fullName;
  await lead.save();

  if (pushToZoho && lead.zohoId) {
    const integ = await getIntegration(lead.workspaceId);
    if (integ && integ.status === "connected") {
      try {
        const res = await zohoUpdateLead(integ, lead.zohoId, updates);
        if (res.ok) conv.zohoSync.pushedAt = new Date();
        else conv.zohoSync.error = res.message;
      } catch (err) {
        conv.zohoSync.error = (err as Error).message;
      }
    } else {
      conv.zohoSync.error = "Zoho not connected";
    }
  }
  await conv.save();
}

/**
 * Re-run the lead-fill pipeline for completed calls that have not been extracted yet
 * (e.g. OPENAI_API_KEY was missing at the time, or the call was pulled in by a sync).
 */
export async function reprocessPendingExtractions(workspaceId: string, opts: { sinceHours?: number; max?: number } = {}): Promise<{ scanned: number; processed: number; errors: string[] }> {
  const since = new Date(Date.now() - (opts.sinceHours ?? 24 * 7) * 3600 * 1000);
  const convs = await Conversation.find({
    workspaceId,
    status: "done",
    leadId: { $exists: true, $ne: null },
    createdAt: { $gte: since },
    $or: [{ extraction: { $exists: false } }, { "extraction.skipped": "OPENAI_API_KEY not configured" }, { "extraction.error": { $exists: true } }],
  })
    .sort({ createdAt: -1 })
    .limit(opts.max ?? 50);
  let processed = 0;
  const errors: string[] = [];
  for (const conv of convs) {
    try {
      const lead = await Lead.findById(conv.leadId);
      if (!lead) continue;
      const agentDoc = conv.elevenAgentId ? await Agent.findOne({ elevenAgentId: conv.elevenAgentId }) : null;
      await applyCollectedDataToLead(conv, lead, agentDoc);
      processed++;
    } catch (err) {
      errors.push(`${conv.elevenConversationId}: ${(err as Error).message}`);
    }
  }
  return { scanned: convs.length, processed, errors };
}

/** Entry point for the ElevenLabs post-call webhook. */
export async function processPostCallEvent(payload: { type: string; event_timestamp?: number; data: any }): Promise<{ handled: string }> {
  const type = payload.type;
  const data = payload.data ?? {};
  const owner = data.agent_id ? await Agent.findOne({ elevenAgentId: data.agent_id }, { workspaceId: 1 }) : null;
  const workspaceId = owner?.workspaceId ?? env.DEFAULT_WORKSPACE_ID;

  if (type === "post_call_transcription") {
    const remote: RemoteConversation = {
      agent_id: data.agent_id,
      agent_name: data.agent_name,
      conversation_id: data.conversation_id,
      status: data.status ?? "done",
      transcript: data.transcript ?? [],
      metadata: data.metadata ?? {},
      analysis: data.analysis ?? null,
      conversation_initiation_client_data: data.conversation_initiation_client_data ?? null,
      has_audio: Boolean(data.has_audio),
    };
    await upsertConversationFromRemote(workspaceId, remote);
    return { handled: "post_call_transcription" };
  }
  if (type === "post_call_audio") {
    await Conversation.updateOne({ elevenConversationId: data.conversation_id }, { $set: { hasAudio: true } });
    return { handled: "post_call_audio" };
  }
  if (type === "call_initiation_failure") {
    await Conversation.updateOne(
      { elevenConversationId: data.conversation_id },
      { $set: { status: "failed", terminationReason: data.failure_reason || data.reason || "call_initiation_failure", raw: data } },
      { upsert: false }
    );
    return { handled: "call_initiation_failure" };
  }
  return { handled: `ignored:${type}` };
}
