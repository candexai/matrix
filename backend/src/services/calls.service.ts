import { Types } from "mongoose";
import { Agent, AgentDoc } from "../models/Agent";
import { Conversation } from "../models/Conversation";
import { Lead, LeadDoc } from "../models/Lead";
import { LeadAgentBinding } from "../models/LeadAgentBinding";
import { elevenlabs, ElevenPhoneNumber } from "./elevenlabs/client";
import { HttpError } from "../utils/http";
import { normalizePhone } from "../utils/phone";

let phoneCache: { at: number; list: ElevenPhoneNumber[] } | null = null;

export function invalidatePhoneCache() {
  phoneCache = null;
}

export async function listPhoneNumbers(force = false): Promise<ElevenPhoneNumber[]> {
  if (!force && phoneCache && Date.now() - phoneCache.at < 60_000) return phoneCache.list;
  const list = await elevenlabs.listPhoneNumbers();
  phoneCache = { at: Date.now(), list };
  return list;
}

export function leadDynamicVariables(lead: LeadDoc, agent?: AgentDoc | null): Record<string, string> {
  const dyn: Record<string, string> = {
    lead_id: String(lead._id),
    name: lead.fullName || "there",
    first_name: lead.firstName || lead.fullName?.split(" ")[0] || "there",
    last_name: lead.lastName || "",
    company: lead.company || "",
    email: lead.email || "",
    phone: lead.phone || "",
    city: lead.city || "",
    lead_status: lead.leadStatus || "",
    lead_source: lead.leadSource || "",
    zoho_lead_id: lead.zohoId || "",
    agent_name: agent?.config?.dynamic_variable_placeholders?.agent_name || agent?.name || "Matrix Assistant",
  };
  for (const [k, v] of Object.entries(lead.fields ?? {})) {
    if (v === null || v === undefined || typeof v === "object") continue;
    const key = `zoho_${k.toLowerCase()}`;
    if (!(key in dyn)) dyn[key] = String(v).slice(0, 500);
  }
  return dyn;
}

async function resolveAgentAndNumber(workspaceId: string, agentId?: string, phoneNumberId?: string, listId?: string): Promise<{ agent: AgentDoc; phone: ElevenPhoneNumber }> {
  const binding =
    (listId && listId !== "all" ? await LeadAgentBinding.findOne({ workspaceId, listId, active: true }) : null) ??
    (await LeadAgentBinding.findOne({ workspaceId, listId: null, active: true }));
  let agent: AgentDoc | null = null;
  if (agentId) agent = await Agent.findOne({ workspaceId, $or: [{ _id: Types.ObjectId.isValid(agentId) ? agentId : undefined }, { elevenAgentId: agentId }].filter((x) => Object.values(x)[0] !== undefined) });
  else if (binding) agent = await Agent.findById(binding.agentId);
  if (!agent) throw new HttpError(400, "No voice agent selected. Attach an agent to My Leads or pick one for this call.", "AGENT_REQUIRED");

  const numbers = await listPhoneNumbers();
  const wantedId = phoneNumberId || binding?.phoneNumberId;
  let phone = wantedId ? numbers.find((n) => n.phone_number_id === wantedId) : undefined;
  if (!phone) phone = numbers.find((n) => n.assigned_agent?.agent_id === agent!.elevenAgentId && n.supports_outbound !== false);
  if (!phone) phone = numbers.find((n) => n.supports_outbound !== false);
  if (!phone) throw new HttpError(400, "No outbound phone number is available in your ElevenLabs workspace. Import a Twilio or SIP number first.", "PHONE_NUMBER_REQUIRED");
  return { agent, phone };
}

export async function callLead(workspaceId: string, leadId: string, opts: { agentId?: string; phoneNumberId?: string; listId?: string } = {}) {
  const lead = await Lead.findOne({ workspaceId, _id: leadId });
  if (!lead) throw new HttpError(404, "Lead not found", "LEAD_NOT_FOUND");
  const to = normalizePhone(lead.phone || lead.mobile);
  if (!to) throw new HttpError(400, `Lead "${lead.fullName}" has no valid phone number`, "LEAD_PHONE_INVALID");

  const listId = opts.listId && opts.listId !== "all" ? opts.listId : lead.listIds?.[0];
  const { agent, phone } = await resolveAgentAndNumber(workspaceId, opts.agentId, opts.phoneNumberId, listId);
  const provider = phone.provider === "sip_trunk" ? "sip_trunk" : "twilio";
  const dyn = { ...leadDynamicVariables(lead, agent), lead_list_id: listId ?? "" };
  const result = await elevenlabs.outboundCall({
    provider,
    agent_id: agent.elevenAgentId,
    agent_phone_number_id: phone.phone_number_id,
    to_number: to,
    dynamic_variables: dyn,
  });
  if (!result.success && !result.conversation_id) throw new HttpError(502, result.message || "ElevenLabs could not place the call", "CALL_FAILED");

  const conv = result.conversation_id
    ? await Conversation.findOneAndUpdate(
        { elevenConversationId: result.conversation_id },
        {
          $set: {
            workspaceId,
            channel: "voice",
            elevenAgentId: agent.elevenAgentId,
            agentName: agent.name,
            agentRef: agent._id,
            leadId: lead._id,
            leadName: lead.fullName,
            phone: to,
            direction: "outbound",
            status: "initiated",
            startedAt: new Date(),
            dynamicVariables: dyn,
          },
        },
        { upsert: true, new: true }
      )
    : null;

  lead.lastCallAt = new Date();
  lead.lastCallStatus = "initiated";
  lead.lastAgentId = agent.elevenAgentId;
  await lead.save();
  await Agent.updateOne({ _id: agent._id }, { $inc: { callCount: 1 }, $set: { lastCallAt: new Date() } });

  return { conversationId: result.conversation_id ?? null, callSid: result.callSid ?? result.sip_call_id ?? null, message: result.message, agent: { id: agent._id, name: agent.name }, from: phone.phone_number, to, conversation: conv };
}

/** Ad-hoc outbound call to any number with a given agent (AI Test → "Call my phone"). */
export async function testCallAgent(workspaceId: string, agentId: string, input: { to_number: string; phoneNumberId?: string; dynamic_variables?: Record<string, string> }) {
  const to = normalizePhone(input.to_number);
  if (!to) throw new HttpError(400, "Enter a valid phone number in international format, e.g. +919876543210", "PHONE_INVALID");
  const { agent, phone } = await resolveAgentAndNumber(workspaceId, agentId, input.phoneNumberId);
  const provider = phone.provider === "sip_trunk" ? "sip_trunk" : "twilio";
  const dyn: Record<string, string> = {
    name: input.dynamic_variables?.name || "there",
    agent_name: agent.config?.dynamic_variable_placeholders?.agent_name || agent.name,
    ...(input.dynamic_variables ?? {}),
    phone: to,
    test_call: "true",
  };
  const result = await elevenlabs.outboundCall({ provider, agent_id: agent.elevenAgentId, agent_phone_number_id: phone.phone_number_id, to_number: to, dynamic_variables: dyn });
  if (!result.success && !result.conversation_id) throw new HttpError(502, result.message || "ElevenLabs could not place the call", "CALL_FAILED");
  const conv = result.conversation_id
    ? await Conversation.findOneAndUpdate(
        { elevenConversationId: result.conversation_id },
        { $set: { workspaceId, channel: "voice", elevenAgentId: agent.elevenAgentId, agentName: agent.name, agentRef: agent._id, leadName: dyn.name !== "there" ? `${dyn.name} (test call)` : "Test call", phone: to, direction: "outbound", status: "initiated", startedAt: new Date(), dynamicVariables: dyn } },
        { upsert: true, new: true }
      )
    : null;
  await Agent.updateOne({ _id: agent._id }, { $inc: { callCount: 1 }, $set: { lastCallAt: new Date() } });
  return { conversationId: result.conversation_id ?? null, callSid: result.callSid ?? result.sip_call_id ?? null, message: result.message, agent: { id: agent._id, name: agent.name }, from: phone.phone_number, to, provider, conversation: conv };
}

export async function batchCallLeads(workspaceId: string, input: { leadIds: string[]; agentId?: string; phoneNumberId?: string; callName?: string; scheduledTimeUnix?: number; listId?: string }) {
  const leads = await Lead.find({ workspaceId, _id: { $in: input.leadIds } });
  if (!leads.length) throw new HttpError(400, "No leads selected", "VALIDATION_ERROR");
  const listId = input.listId && input.listId !== "all" ? input.listId : undefined;
  const { agent, phone } = await resolveAgentAndNumber(workspaceId, input.agentId, input.phoneNumberId, listId);

  const recipients: { lead: LeadDoc; to: string }[] = [];
  for (const lead of leads) {
    const to = normalizePhone(lead.phone || lead.mobile);
    if (to) recipients.push({ lead, to });
  }
  if (!recipients.length) throw new HttpError(400, "None of the selected leads have a valid phone number", "VALIDATION_ERROR");

  const result = await elevenlabs.submitBatchCall({
    call_name: input.callName || `Matrix batch · ${new Date().toISOString().slice(0, 16).replace("T", " ")}`,
    agent_id: agent.elevenAgentId,
    agent_phone_number_id: phone.phone_number_id,
    recipients: recipients.map(({ lead, to }) => ({ phone_number: to, conversation_initiation_client_data: { dynamic_variables: { ...leadDynamicVariables(lead, agent), lead_list_id: listId ?? lead.listIds?.[0] ?? "" } } })),
    scheduled_time_unix: input.scheduledTimeUnix,
  });

  const now = new Date();
  await Lead.updateMany({ _id: { $in: recipients.map((r) => r.lead._id) } }, { $set: { lastCallAt: now, lastCallStatus: "queued", lastAgentId: agent.elevenAgentId } });
  await Agent.updateOne({ _id: agent._id }, { $inc: { callCount: recipients.length }, $set: { lastCallAt: now } });
  return { batchId: result.id, name: result.name, status: result.status, scheduled: result.total_calls_scheduled ?? recipients.length, skipped: leads.length - recipients.length, agent: { id: agent._id, name: agent.name }, from: phone.phone_number };
}
