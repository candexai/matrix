/**
 * "Who is this?" for the conversation view: the linked lead (or an anonymous caller built from
 * the phone number), relationship stats, details learned across calls and the call history.
 */
import { Types } from "mongoose";
import { Conversation, ConversationDoc } from "../models/Conversation";
import { Lead, LeadDoc } from "../models/Lead";
import { LeadList } from "../models/LeadList";
import { ZohoIntegration, ZohoFieldMeta } from "../models/ZohoIntegration";
import { HttpError } from "../utils/http";
import { normalizePhone, phoneKey } from "../utils/phone";
import { isMeaningfulValue } from "./extraction.service";
import { createManualLead } from "./leads.service";

const HISTORY_LIMIT = 12;
const RELATED_LIMIT = 200;
const MAX_CRM_FIELDS = 24;
const MAX_CAPTURED = 20;

/** CRM fields already shown as first-class profile attributes. */
const CORE_FIELDS = new Set(["First_Name", "Last_Name", "Full_Name", "Email", "Phone", "Mobile", "Company", "Designation", "Lead_Status", "Lead_Source", "City", "State", "Country", "Industry", "Website", "Description", "Rating"]);
/** CRM bookkeeping that says nothing about the person. */
const SYSTEM_FIELDS = new Set(["id", "Owner", "Created_By", "Modified_By", "Created_Time", "Modified_Time", "Last_Activity_Time", "Tag", "Record_Image", "Layout", "Locked__s", "Record_Status__s", "Unsubscribed_Mode", "Unsubscribed_Time", "Change_Log_Time__s", "Last_Enriched_Time__s", "Enrich_Status__s", "Data_Processing_Basis_Details", "Converted__s", "Converted_Date_Time", "Lead_Conversion_Time", "Visitor_Score", "Email_Opt_Out"]);

/** A person's name: "name", "full_name", "student_name", "parent_name"… but not a company / school / agent name. */
const NAME_KEY = /^(?!.*(company|business|organi[sz]ation|school|college|institute|agent|product|course|brand))(.*[_\s-])?(full[_\s-]?)?name$/i;
const FIRST_NAME_KEY = /^first_?name$/i;
const LAST_NAME_KEY = /^last_?name$/i;
const EMAIL_KEY = /e-?mail/i;
const COMPANY_KEY = /^(company|company_?name|organi[sz]ation|business_?name)$/i;
const EMAIL_VALUE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export interface ConversationProfile {
  conversationId: string;
  kind: "lead" | "caller" | "web";
  displayName: string;
  phone: string | null;
  lead: null | {
    _id: string;
    fullName: string;
    firstName?: string;
    lastName?: string;
    company?: string;
    title?: string;
    email?: string;
    phone?: string;
    mobile?: string;
    leadStatus?: string;
    leadSource?: string;
    rating?: string;
    industry?: string;
    website?: string;
    city?: string;
    state?: string;
    country?: string;
    description?: string;
    source: "zoho" | "manual" | "csv";
    zohoId?: string;
    tags: string[];
    listNames: string[];
    createdAt: string;
    syncedAt?: string;
    fields: { apiName: string; label: string; value: string }[];
    emptyFieldCount: number;
  };
  stats: { totalCalls: number; connectedCalls: number; totalTalkSecs: number; firstCallAt: string | null; lastCallAt: string | null; successCount: number; failedCount: number };
  captured: { key: string; label: string; value: string; source: "agent" | "ai"; conversationId: string; at: string | null; thisCall: boolean }[];
  updatedCrmFields: { apiName: string; label: string }[];
  history: { _id: string; startedAt: string | null; durationSecs: number; status: string; callSuccessful?: string; title?: string; agentName?: string; direction?: string; sentiment?: "positive" | "neutral" | "negative"; current: boolean }[];
  suggestedLead: { fullName?: string; email?: string; company?: string };
}

type RelatedConv = Pick<ConversationDoc, "_id" | "startedAt" | "createdAt" | "durationSecs" | "status" | "callSuccessful" | "summaryTitle" | "agentName" | "direction" | "dataCollection" | "extraction" | "leadId" | "phone"> & { insights?: { sentiment?: "positive" | "neutral" | "negative" } };

const RELATED_SELECT = "startedAt createdAt durationSecs status callSuccessful summaryTitle agentName direction dataCollection extraction leadId phone insights.sentiment";

function humanize(key: string): string {
  const s = key.replace(/__c$|__s$/i, "").replace(/[_\-.]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : key;
}

/** Human-readable value for a CRM / collected field; "" when there is nothing worth showing. */
function formatFieldValue(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  if (typeof v === "string") {
    const s = v.trim();
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) return s.slice(0, 10);
    return s;
  }
  if (Array.isArray(v)) return v.map(formatFieldValue).filter(Boolean).join(", ");
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (typeof o.name === "string") return o.name;
    if (typeof o.display_value === "string") return o.display_value;
    return "";
  }
  return "";
}

function when(c: { startedAt?: Date; createdAt?: Date }): Date | null {
  return c.startedAt ?? c.createdAt ?? null;
}

async function relatedConversations(workspaceId: string, conv: ConversationDoc): Promise<RelatedConv[]> {
  const or: Record<string, unknown>[] = [{ _id: conv._id }];
  if (conv.leadId) or.push({ leadId: conv.leadId });
  const key = phoneKey(conv.phone);
  if (key) or.push({ phone: { $regex: `${key}$` } }); // key is digits only → safe in a regex
  const rows = await Conversation.find({ workspaceId, $or: or }).select(RELATED_SELECT).sort({ startedAt: -1, createdAt: -1 }).limit(RELATED_LIMIT).lean<RelatedConv[]>();
  // A shared number must not pull in calls that belong to a different lead.
  return rows.filter((r) => String(r._id) === String(conv._id) || !r.leadId || !conv.leadId || String(r.leadId) === String(conv.leadId));
}

function buildCaptured(related: RelatedConv[], currentId: string, labels: Map<string, string>): ConversationProfile["captured"] {
  const out: ConversationProfile["captured"] = [];
  const seen = new Set<string>();
  const push = (key: string, raw: unknown, source: "agent" | "ai", c: RelatedConv) => {
    const norm = key.toLowerCase();
    if (seen.has(norm) || !isMeaningfulValue(raw)) return;
    const value = formatFieldValue(raw);
    if (!value) return;
    seen.add(norm);
    out.push({ key, label: labels.get(key) ?? humanize(key), value, source, conversationId: String(c._id), at: when(c)?.toISOString() ?? null, thisCall: String(c._id) === currentId });
  };
  for (const c of related) {
    for (const [k, v] of Object.entries(c.dataCollection ?? {})) push(k, (v as { value?: unknown })?.value, "agent", c);
    for (const [k, v] of Object.entries(c.extraction?.extracted ?? {})) push(k, v, "ai", c);
    if (out.length >= MAX_CAPTURED) break;
  }
  return out.slice(0, MAX_CAPTURED);
}

function suggestLead(captured: ConversationProfile["captured"]): ConversationProfile["suggestedLead"] {
  const find = (re: RegExp) => captured.find((c) => re.test(c.key))?.value;
  const full = find(NAME_KEY) ?? [find(FIRST_NAME_KEY), find(LAST_NAME_KEY)].filter(Boolean).join(" ").trim();
  const email = captured.find((c) => EMAIL_KEY.test(c.key) && EMAIL_VALUE.test(c.value))?.value;
  return { fullName: full || undefined, email, company: find(COMPANY_KEY) };
}

async function leadView(workspaceId: string, lead: LeadDoc, fieldMeta: ZohoFieldMeta[]): Promise<NonNullable<ConversationProfile["lead"]>> {
  const labels = new Map(fieldMeta.map((f) => [f.api_name, f.field_label]));
  const raw = (lead.fields ?? {}) as Record<string, unknown>;
  const fields: { apiName: string; label: string; value: string }[] = [];
  for (const [apiName, v] of Object.entries(raw)) {
    if (CORE_FIELDS.has(apiName) || SYSTEM_FIELDS.has(apiName) || apiName.startsWith("$")) continue;
    const value = formatFieldValue(v);
    if (!value || (typeof v === "boolean" && !v)) continue;
    fields.push({ apiName, label: labels.get(apiName) ?? humanize(apiName), value });
  }
  fields.sort((a, b) => a.label.localeCompare(b.label));
  const emptyFieldCount = fieldMeta.filter((f) => !f.read_only && !SYSTEM_FIELDS.has(f.api_name) && !formatFieldValue(raw[f.api_name])).length;
  const lists = lead.listIds?.length ? await LeadList.find({ workspaceId, _id: { $in: lead.listIds.filter((id) => Types.ObjectId.isValid(id)) } }).select("name").lean() : [];
  const pick = (s?: string) => (s && s.trim() ? s.trim() : undefined);
  return {
    _id: String(lead._id),
    fullName: lead.fullName,
    firstName: pick(lead.firstName),
    lastName: pick(lead.lastName),
    company: pick(lead.company),
    title: pick(lead.title),
    email: pick(lead.email),
    phone: pick(lead.phone),
    mobile: pick(lead.mobile),
    leadStatus: pick(lead.leadStatus),
    leadSource: pick(lead.leadSource),
    rating: pick(lead.rating),
    industry: pick(lead.industry),
    website: pick(lead.website),
    city: pick(lead.city),
    state: pick(lead.state),
    country: pick(lead.country),
    description: pick(lead.description),
    source: lead.source,
    zohoId: lead.zohoId,
    tags: lead.tags ?? [],
    listNames: lists.map((l) => String((l as { name?: string }).name ?? "")).filter(Boolean),
    createdAt: lead.createdAt.toISOString(),
    syncedAt: lead.syncedAt?.toISOString(),
    fields: fields.slice(0, MAX_CRM_FIELDS),
    emptyFieldCount,
  };
}

export async function getConversationProfile(workspaceId: string, conv: ConversationDoc): Promise<ConversationProfile> {
  const [lead, integ, related] = await Promise.all([
    conv.leadId ? Lead.findOne({ workspaceId, _id: conv.leadId }) : Promise.resolve(null),
    ZohoIntegration.findOne({ workspaceId }).select("fieldsCache").lean<{ fieldsCache?: ZohoFieldMeta[] } | null>(),
    relatedConversations(workspaceId, conv),
  ]);
  const fieldMeta = Array.isArray(integ?.fieldsCache) ? integ!.fieldsCache! : [];
  const labels = new Map(fieldMeta.map((f) => [f.api_name, f.field_label]));
  const currentId = String(conv._id);

  const times = related.map(when).filter((d): d is Date => Boolean(d)).map((d) => d.getTime());
  const stats: ConversationProfile["stats"] = {
    totalCalls: related.length,
    connectedCalls: related.filter((c) => (c.durationSecs ?? 0) > 0).length,
    totalTalkSecs: related.reduce((s, c) => s + (c.durationSecs ?? 0), 0),
    firstCallAt: times.length ? new Date(Math.min(...times)).toISOString() : null,
    lastCallAt: times.length ? new Date(Math.max(...times)).toISOString() : null,
    successCount: related.filter((c) => c.callSuccessful === "success").length,
    failedCount: related.filter((c) => c.status === "failed" || c.callSuccessful === "failure").length,
  };

  const captured = buildCaptured(related, currentId, labels);
  const suggestedLead = suggestLead(captured);
  const phone = normalizePhone(conv.phone) ?? conv.phone ?? null;
  const kind: ConversationProfile["kind"] = lead ? "lead" : phone ? "caller" : "web";
  const displayName = lead?.fullName?.trim() || (kind === "caller" ? suggestedLead.fullName || phone! : conv.leadName?.trim() || suggestedLead.fullName || "Web call");

  return {
    conversationId: currentId,
    kind,
    displayName,
    phone,
    lead: lead ? await leadView(workspaceId, lead, fieldMeta) : null,
    stats,
    captured,
    updatedCrmFields: (conv.zohoSync?.updatedFields ?? []).map((apiName) => ({ apiName, label: labels.get(apiName) ?? humanize(apiName) })),
    history: related.slice(0, HISTORY_LIMIT).map((c) => ({
      _id: String(c._id),
      startedAt: when(c)?.toISOString() ?? null,
      durationSecs: c.durationSecs ?? 0,
      status: c.status,
      callSuccessful: c.callSuccessful,
      title: c.summaryTitle,
      agentName: c.agentName,
      direction: c.direction,
      sentiment: c.insights?.sentiment,
      current: String(c._id) === currentId,
    })),
    suggestedLead,
  };
}

/** Turn an anonymous caller into a lead (or link to the existing lead with that number) and attach every call from the same number. */
export async function createLeadFromConversation(workspaceId: string, conv: ConversationDoc, input: { fullName: string; company?: string; email?: string; pushToZoho?: boolean }) {
  if (conv.leadId) throw new HttpError(409, "This conversation is already linked to a lead", "ALREADY_LINKED");
  const fullName = input.fullName?.trim();
  if (!fullName) throw new HttpError(400, "Name is required", "VALIDATION_ERROR");

  const phone = normalizePhone(conv.phone) ?? undefined;
  const key = phoneKey(phone);
  let lead = key ? await Lead.findOne({ workspaceId, phoneKey: key }) : null;
  const created = !lead;
  if (!lead) {
    lead = await createManualLead(workspaceId, { fullName, company: input.company?.trim() || undefined, email: input.email?.trim().toLowerCase() || undefined, phone, leadSource: "Pilot call", pushToZoho: input.pushToZoho });
  }

  const filter: Record<string, unknown> = { workspaceId, $and: [{ $or: [{ leadId: { $exists: false } }, { leadId: null }] }, { $or: key ? [{ _id: conv._id }, { phone: { $regex: `${key}$` } }] : [{ _id: conv._id }] }] };
  const linked = await Conversation.updateMany(filter, { $set: { leadId: lead._id, leadName: lead.fullName } });

  const calls = await Conversation.find({ workspaceId, leadId: lead._id }).select("startedAt createdAt status callSuccessful summary").sort({ startedAt: -1, createdAt: -1 }).limit(500).lean();
  if (calls.length) {
    const latest = calls[0];
    lead.callCount = calls.length;
    lead.lastCallAt = (latest.startedAt ?? latest.createdAt) as Date;
    lead.lastCallStatus = latest.status;
    lead.lastCallOutcome = latest.callSuccessful;
    lead.lastCallSummary = latest.summary;
    await lead.save();
  }

  const fresh = await Conversation.findOne({ workspaceId, _id: conv._id });
  return { profile: await getConversationProfile(workspaceId, fresh ?? conv), linkedConversations: linked.modifiedCount ?? 0, created };
}
