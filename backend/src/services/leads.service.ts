import { Types } from "mongoose";
import { Lead, LeadDoc } from "../models/Lead";
import { LeadAgentBinding, BindingField } from "../models/LeadAgentBinding";
import { LeadList } from "../models/LeadList";
import { Agent } from "../models/Agent";
import { Conversation } from "../models/Conversation";
import { HttpError } from "../utils/http";
import { normalizePhone, phoneKey } from "../utils/phone";
import { toSnake } from "./elevenlabs/configBuilder";
import { updateAgent } from "./agent.service";
import { getIntegration, fetchLeadFields, updateLead as zohoUpdateLead, createLead as zohoCreateLead } from "./zoho/zohoClient";

export interface LeadQuery {
  listId?: string;
  search?: string;
  status?: string;
  source?: string;
  called?: "yes" | "no";
  page?: number;
  limit?: number;
  sort?: string;
}

export async function listLeads(workspaceId: string, q: LeadQuery) {
  const page = Math.max(1, q.page ?? 1);
  const limit = Math.min(200, Math.max(1, q.limit ?? 50));
  const filter: Record<string, unknown> = { workspaceId };
  if (q.listId && q.listId !== "all") filter.listIds = q.listId;
  if (q.status) filter.leadStatus = q.status;
  if (q.source) filter.source = q.source;
  if (q.called === "yes") filter.callCount = { $gt: 0 };
  if (q.called === "no") filter.callCount = { $in: [0, null] };
  if (q.search?.trim()) {
    const rx = new RegExp(q.search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ fullName: rx }, { email: rx }, { phone: rx }, { company: rx }, { city: rx }];
  }
  const sortField = (q.sort ?? "-updatedAt").replace(/^-/, "");
  const sortDir = (q.sort ?? "-updatedAt").startsWith("-") ? -1 : 1;
  const [items, total, statuses] = await Promise.all([
    Lead.find(filter).sort({ [sortField]: sortDir }).skip((page - 1) * limit).limit(limit),
    Lead.countDocuments(filter),
    Lead.distinct("leadStatus", { workspaceId }),
  ]);
  return { items, total, page, limit, pages: Math.ceil(total / limit), statuses: statuses.filter(Boolean).sort() };
}

export async function getLead(workspaceId: string, id: string): Promise<LeadDoc> {
  if (!Types.ObjectId.isValid(id)) throw new HttpError(404, "Lead not found", "LEAD_NOT_FOUND");
  const lead = await Lead.findOne({ workspaceId, _id: id });
  if (!lead) throw new HttpError(404, "Lead not found", "LEAD_NOT_FOUND");
  return lead;
}

export async function leadConversations(workspaceId: string, id: string) {
  return Conversation.find({ workspaceId, leadId: id }).sort({ startedAt: -1, createdAt: -1 }).limit(50);
}

const STANDARD_TO_ZOHO: Record<string, string> = {
  firstName: "First_Name",
  lastName: "Last_Name",
  email: "Email",
  phone: "Phone",
  mobile: "Mobile",
  company: "Company",
  title: "Designation",
  leadStatus: "Lead_Status",
  leadSource: "Lead_Source",
  city: "City",
  state: "State",
  country: "Country",
  industry: "Industry",
  website: "Website",
  description: "Description",
  rating: "Rating",
  annualRevenue: "Annual_Revenue",
};

export async function createManualLead(workspaceId: string, input: Partial<LeadDoc> & { fields?: Record<string, unknown>; pushToZoho?: boolean }) {
  const fullName = input.fullName?.trim() || `${input.firstName ?? ""} ${input.lastName ?? ""}`.trim();
  if (!fullName) throw new HttpError(400, "Name is required", "VALIDATION_ERROR");
  const phone = normalizePhone(input.phone) ?? input.phone;
  const fields: Record<string, unknown> = { ...(input.fields ?? {}) };
  for (const [local, zoho] of Object.entries(STANDARD_TO_ZOHO)) {
    const v = (input as any)[local];
    if (v !== undefined && v !== null && v !== "") fields[zoho] = v;
  }
  if (!input.lastName && !fields.Last_Name) fields.Last_Name = fullName; // Zoho requires Last_Name
  const lead = await Lead.create({
    workspaceId,
    source: "manual",
    fullName,
    firstName: input.firstName,
    lastName: input.lastName || fullName,
    email: input.email,
    phone,
    phoneKey: phoneKey(phone) ?? undefined,
    company: input.company,
    leadStatus: input.leadStatus,
    leadSource: input.leadSource || "Matrix",
    city: input.city,
    fields,
  });
  if (input.pushToZoho) {
    const integ = await getIntegration(workspaceId);
    if (integ?.status === "connected") {
      const res = await zohoCreateLead(integ, { ...fields, Lead_Source: fields.Lead_Source ?? "Matrix" });
      if (res.ok && res.id) {
        lead.zohoId = res.id;
        lead.source = "zoho";
        await lead.save();
      }
    }
  }
  return lead;
}

export async function updateLeadFields(workspaceId: string, id: string, patch: { fields?: Record<string, unknown>; pushToZoho?: boolean } & Partial<LeadDoc>) {
  const lead = await getLead(workspaceId, id);
  const changed: Record<string, unknown> = {};
  for (const [local, zoho] of Object.entries(STANDARD_TO_ZOHO)) {
    if ((patch as any)[local] !== undefined) {
      (lead as any)[local] = (patch as any)[local];
      changed[zoho] = (patch as any)[local];
    }
  }
  for (const [k, v] of Object.entries(patch.fields ?? {})) {
    changed[k] = v;
    const local = Object.entries(STANDARD_TO_ZOHO).find(([, z]) => z === k)?.[0];
    if (local) (lead as any)[local] = v;
  }
  lead.fields = { ...(lead.fields ?? {}), ...changed };
  lead.markModified("fields");
  if (patch.tags) lead.tags = patch.tags;
  if (changed.First_Name !== undefined || changed.Last_Name !== undefined) lead.fullName = `${lead.firstName ?? ""} ${lead.lastName ?? ""}`.trim() || lead.fullName;
  if (changed.Phone !== undefined || changed.Mobile !== undefined) {
    lead.phone = normalizePhone(lead.phone) ?? lead.phone;
    lead.phoneKey = phoneKey(lead.phone || lead.mobile) ?? undefined;
  }
  await lead.save();
  let zoho: { ok: boolean; message?: string } | undefined;
  if (patch.pushToZoho !== false && lead.zohoId && Object.keys(changed).length) {
    const integ = await getIntegration(workspaceId);
    if (integ?.status === "connected") zoho = await zohoUpdateLead(integ, lead.zohoId, changed);
  }
  return { lead, zoho };
}

export async function deleteLead(workspaceId: string, id: string) {
  const lead = await getLead(workspaceId, id);
  await lead.deleteOne();
}

// ---------- Agent ↔ My Leads binding ----------

function normListId(listId?: string | null): string | null {
  return listId && listId !== "all" ? listId : null;
}

export async function getBinding(workspaceId: string, listId?: string | null) {
  const lid = normListId(listId);
  const [own, dflt] = await Promise.all([LeadAgentBinding.findOne({ workspaceId, listId: lid }), lid ? LeadAgentBinding.findOne({ workspaceId, listId: null }) : null]);
  let binding = own;
  let inherited = false;
  if (!binding && lid && dflt) {
    binding = dflt;
    inherited = true;
  }
  if (!binding) return null;
  const agent = await Agent.findById(binding.agentId);
  return { ...binding.toObject(), inherited, agent: agent ? { _id: agent._id, name: agent.name, elevenAgentId: agent.elevenAgentId } : null };
}

export interface BindingInput {
  listId?: string | null;
  agentId: string;
  phoneNumberId?: string;
  fields: { zohoField: string; label?: string; dataType?: string; description?: string }[];
  onlyFillEmpty?: boolean;
  pushToZoho?: boolean;
  updateLeadStatusTo?: string;
  active?: boolean;
}

/** Attach a voice agent to My Leads and configure which Zoho fields it should collect. */
export async function setBinding(workspaceId: string, input: BindingInput) {
  const agent = await Agent.findOne({ workspaceId, $or: [{ _id: Types.ObjectId.isValid(input.agentId) ? input.agentId : undefined }, { elevenAgentId: input.agentId }].filter((x) => Object.values(x)[0] !== undefined) });
  if (!agent) throw new HttpError(404, "Agent not found", "AGENT_NOT_FOUND");

  // enrich with Zoho field metadata when connected
  const integ = await getIntegration(workspaceId);
  const meta = integ?.status === "connected" ? await fetchLeadFields(integ).catch(() => []) : [];
  const metaByName = new Map(meta.map((m) => [m.api_name, m]));

  const fields: BindingField[] = input.fields
    .filter((f) => f.zohoField)
    .map((f) => {
      const m = metaByName.get(f.zohoField);
      const label = f.label || m?.field_label || f.zohoField.replace(/_/g, " ");
      const dataType = f.dataType || m?.data_type || "text";
      const picklist = m?.pick_list_values?.length ? ` One of: ${m.pick_list_values.map((p) => p.display_value).join(", ")}.` : "";
      return {
        zohoField: f.zohoField,
        label,
        dataType,
        description: f.description?.trim() || `${label} of the lead.${picklist}`,
        collectionKey: toSnake(f.zohoField),
      };
    });

  const binding = await LeadAgentBinding.findOneAndUpdate(
    { workspaceId, listId: normListId(input.listId) },
    {
      $set: {
        agentId: agent._id,
        elevenAgentId: agent.elevenAgentId,
        phoneNumberId: input.phoneNumberId,
        fields,
        onlyFillEmpty: input.onlyFillEmpty ?? true,
        pushToZoho: input.pushToZoho ?? true,
        updateLeadStatusTo: input.updateLeadStatusTo,
        active: input.active ?? true,
      },
    },
    { upsert: true, new: true }
  );

  // Push a matching data-collection schema to the agent so ElevenLabs extracts these fields after each call.
  const existing = agent.config.data_collection ?? [];
  const keep = existing.filter((d) => !d.zohoField || fields.some((f) => f.zohoField === d.zohoField));
  const byKey = new Map(keep.map((d) => [d.key, d]));
  for (const f of fields) {
    const type = /integer|bigint/.test(f.dataType) ? "integer" : /double|currency|decimal|percent/.test(f.dataType) ? "number" : /boolean/.test(f.dataType) ? "boolean" : "string";
    byKey.set(f.collectionKey, { key: f.collectionKey, type, description: f.description, zohoField: f.zohoField });
  }
  const updated = await updateAgent(workspaceId, String(agent._id), { config: { data_collection: Array.from(byKey.values()) } });

  return { ...binding.toObject(), agent: { _id: updated._id, name: updated.name, elevenAgentId: updated.elevenAgentId } };
}

export async function clearBinding(workspaceId: string, listId?: string | null) {
  await LeadAgentBinding.deleteOne({ workspaceId, listId: normListId(listId) });
}

// ---------- Lead lists ----------

export async function listLeadLists(workspaceId: string) {
  const [lists, total, bindings] = await Promise.all([
    LeadList.find({ workspaceId }).sort({ isDefault: -1, source: 1, name: 1 }),
    Lead.countDocuments({ workspaceId }),
    LeadAgentBinding.find({ workspaceId, active: true }),
  ]);
  const agentIds = Array.from(new Set(bindings.map((b) => String(b.agentId))));
  const agents = await Agent.find({ _id: { $in: agentIds } }, { name: 1 });
  const agentName = new Map(agents.map((a) => [String(a._id), a.name]));
  const bindingFor = (listId: string | null) => {
    const b = bindings.find((x) => x.listId === listId);
    return b ? { agentId: String(b.agentId), agentName: agentName.get(String(b.agentId)) ?? null, fields: b.fields.length } : null;
  };
  const defaultBinding = bindingFor(null);
  return {
    all: { _id: "all", name: "All leads", source: "all", recordCount: total, columns: [], isDefault: false, binding: defaultBinding },
    items: lists.map((l) => ({ ...l.toObject(), binding: bindingFor(String(l._id)) ?? (defaultBinding ? { ...defaultBinding, inherited: true } : null) })),
    defaultBinding,
  };
}

export interface ResolvedColumn {
  api_name: string;
  label: string;
  data_type: string;
  /** true when the column belongs to the Zoho view definition */
  inView: boolean;
}

/** Table columns = exactly the Zoho view's columns, in Zoho's order (labels/types from field metadata). */
function resolveColumns(viewColumns: string[], meta: { api_name: string; field_label: string; data_type: string }[]): ResolvedColumn[] {
  const byName = new Map(meta.map((m) => [m.api_name, m]));
  const out: ResolvedColumn[] = [];
  const seen = new Set<string>();
  for (const c of viewColumns) {
    if (!c || seen.has(c)) continue;
    seen.add(c);
    const m = byName.get(c);
    out.push({ api_name: c, label: m?.field_label ?? c.replace(/_/g, " "), data_type: m?.data_type ?? "text", inView: true });
  }
  return out;
}

export async function getLeadList(workspaceId: string, id: string) {
  const integ = await getIntegration(workspaceId).catch(() => null);
  const meta = integ?.fieldsCache ?? [];
  if (id === "all") {
    // "All leads" mirrors the columns of the Zoho default view when one is synced.
    const [total, binding, defaultView] = await Promise.all([Lead.countDocuments({ workspaceId }), getBinding(workspaceId, null), LeadList.findOne({ workspaceId, source: "zoho", isDefault: true })]);
    return { _id: "all", name: "All leads", source: "all", recordCount: total, isDefault: false, columns: defaultView?.columns ?? [], resolvedColumns: resolveColumns(defaultView?.columns ?? [], meta), binding };
  }
  if (!Types.ObjectId.isValid(id)) throw new HttpError(404, "Lead list not found", "LIST_NOT_FOUND");
  const [list, recordCount, binding] = await Promise.all([LeadList.findOne({ workspaceId, _id: id }), Lead.countDocuments({ workspaceId, listIds: id }), getBinding(workspaceId, id)]);
  if (!list) throw new HttpError(404, "Lead list not found", "LIST_NOT_FOUND");
  return { ...list.toObject(), recordCount, resolvedColumns: resolveColumns(list.columns, meta), binding };
}

export async function createLeadList(workspaceId: string, input: { name: string; columns?: string[] }) {
  if (!input.name?.trim()) throw new HttpError(400, "List name is required", "VALIDATION_ERROR");
  return LeadList.create({ workspaceId, source: "manual", name: input.name.trim(), columns: input.columns ?? ["First_Name", "Last_Name", "Email", "Phone", "Company", "Lead_Status"] });
}

export async function updateLeadList(workspaceId: string, id: string, patch: { name?: string; columns?: string[] }) {
  const list = await LeadList.findOne({ workspaceId, _id: id });
  if (!list) throw new HttpError(404, "Lead list not found", "LIST_NOT_FOUND");
  if (patch.name !== undefined) list.name = patch.name.trim() || list.name;
  if (patch.columns) list.columns = patch.columns;
  await list.save();
  return list;
}

export async function deleteLeadList(workspaceId: string, id: string) {
  const list = await LeadList.findOne({ workspaceId, _id: id });
  if (!list) throw new HttpError(404, "Lead list not found", "LIST_NOT_FOUND");
  if (list.source === "zoho") throw new HttpError(400, "Zoho views are managed in Zoho CRM; disconnect or change the view there.", "LIST_MANAGED_BY_ZOHO");
  await Lead.updateMany({ workspaceId, listIds: id }, { $pull: { listIds: id } });
  await LeadAgentBinding.deleteOne({ workspaceId, listId: id });
  await list.deleteOne();
}

export async function addLeadsToList(workspaceId: string, id: string, leadIds: string[]) {
  const list = await LeadList.findOne({ workspaceId, _id: id });
  if (!list) throw new HttpError(404, "Lead list not found", "LIST_NOT_FOUND");
  const r = await Lead.updateMany({ workspaceId, _id: { $in: leadIds } }, { $addToSet: { listIds: id } });
  list.recordCount = await Lead.countDocuments({ workspaceId, listIds: id });
  await list.save();
  return { modified: r.modifiedCount, recordCount: list.recordCount };
}

export async function removeLeadsFromList(workspaceId: string, id: string, leadIds: string[]) {
  const list = await LeadList.findOne({ workspaceId, _id: id });
  if (!list) throw new HttpError(404, "Lead list not found", "LIST_NOT_FOUND");
  const r = await Lead.updateMany({ workspaceId, _id: { $in: leadIds } }, { $pull: { listIds: id } });
  list.recordCount = await Lead.countDocuments({ workspaceId, listIds: id });
  await list.save();
  return { modified: r.modifiedCount, recordCount: list.recordCount };
}
