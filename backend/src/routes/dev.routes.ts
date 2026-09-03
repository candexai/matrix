/**
 * Development-only helpers (disabled in production): seed demo data so the UI can be exercised
 * before ElevenLabs / Zoho are connected.
 */
import { Router } from "express";
import { asyncHandler, ok, HttpError } from "../utils/http";
import { env } from "../config/env";
import { Agent } from "../models/Agent";
import { Lead } from "../models/Lead";
import { Conversation } from "../models/Conversation";
import { LeadAgentBinding } from "../models/LeadAgentBinding";
import { withDefaults } from "../services/elevenlabs/configBuilder";
import { phoneKey } from "../utils/phone";

const router = Router();

router.use((_req, _res, next) => {
  if (env.NODE_ENV === "production") throw new HttpError(404, "Not found", "NOT_FOUND");
  next();
});

const FIRST = ["Asha", "Rohan", "Priya", "Vikram", "Neha", "Arjun", "Kavya", "Sameer", "Ananya", "Karan", "Meera", "Dev"];
const LAST = ["Verma", "Mehta", "Iyer", "Singh", "Kapoor", "Nair", "Reddy", "Shah", "Bose", "Malhotra", "Pillai", "Chopra"];
const COMPANIES = ["Acme Corp", "Bluebird Realty", "Nimbus Labs", "Orchid Interiors", "Zenith Motors", "Cedar Finance", "Helix Health", "Sunrise Schools", "Vector Logistics", "Maple Foods", "Quartz Studio", "Aurora Retail"];
const CITIES = ["Mumbai", "Delhi", "Bengaluru", "Pune", "Hyderabad", "Chennai", "Kolkata", "Jaipur"];
const STATUSES = ["Not Contacted", "Contacted", "Qualified", "Not Qualified", "Junk Lead", "Attempted to Contact"];
const SOURCES = ["Web Download", "Advertisement", "Cold Call", "Trade Show", "Partner", "Online Store"];

async function clearDemo(ws: string) {
  const [l, c, a] = await Promise.all([
    Lead.deleteMany({ workspaceId: ws, $or: [{ tags: "demo" }, { zohoId: /^50000000000\d\d$/ }] }),
    Conversation.deleteMany({ workspaceId: ws, $or: [{ "raw.seed": true }, { elevenConversationId: /^conv_seed_/ }] }),
    Agent.deleteMany({ workspaceId: ws, lastProvider: "seed" }),
  ]);
  return { leads: l.deletedCount, conversations: c.deletedCount, agents: a.deletedCount };
}

/** Remove demo data only (leads tagged "demo", seeded conversations, seeded agent). Real data is untouched. */
router.delete("/seed", asyncHandler(async (req, res) => ok(res, await clearDemo(req.workspaceId))));

router.post("/seed", asyncHandler(async (req, res) => {
  const ws = req.workspaceId;
  const reset = req.query.reset === "1" || req.body?.reset === true;
  if (reset) await clearDemo(ws);

  let agent = await Agent.findOne({ workspaceId: ws });
  if (!agent) {
    agent = await Agent.create({
      workspaceId: ws,
      elevenAgentId: `agent_seed_${Date.now().toString(36)}`,
      name: "Lead Qualifier (demo)",
      description: "Seeded demo agent – not connected to ElevenLabs.",
      config: withDefaults({
        voice_id: "21m00Tcm4TlvDq8ikWAM",
        data_collection: [
          { key: "budget", type: "string", description: "Budget the lead mentioned", zohoField: "Budget" },
          { key: "timeline", type: "string", description: "When they want to buy", zohoField: "Timeline" },
          { key: "city", type: "string", description: "City of the lead", zohoField: "City" },
        ],
      }),
      lastProvider: "seed",
      callCount: 0,
    });
  }

  const leads = [];
  for (let i = 0; i < 12; i++) {
    const first = FIRST[i];
    const last = LAST[i];
    const phone = `+9198${String(10000000 + i * 7919).slice(0, 8)}`;
    const empty = i % 3 === 0;
    const lead = await Lead.create({
      workspaceId: ws,
      source: "zoho",
      zohoId: `${5000000000000 + i}`,
      firstName: first,
      lastName: last,
      fullName: `${first} ${last}`,
      email: `${first.toLowerCase()}.${last.toLowerCase()}@example.com`,
      phone,
      phoneKey: phoneKey(phone) ?? undefined,
      company: COMPANIES[i],
      leadStatus: STATUSES[i % STATUSES.length],
      leadSource: SOURCES[i % SOURCES.length],
      city: empty ? undefined : CITIES[i % CITIES.length],
      tags: ["demo"],
      fields: {
        First_Name: first,
        Last_Name: last,
        Email: `${first.toLowerCase()}.${last.toLowerCase()}@example.com`,
        Phone: phone,
        Company: COMPANIES[i],
        Lead_Status: STATUSES[i % STATUSES.length],
        Lead_Source: SOURCES[i % SOURCES.length],
        City: empty ? "" : CITIES[i % CITIES.length],
        Budget: empty ? "" : `${(i + 2) * 50},000 INR`,
        Timeline: i % 2 === 0 ? "" : "Next quarter",
        Industry: i % 4 === 0 ? "" : "Services",
      },
      syncedAt: new Date(),
    });
    leads.push(lead);
  }

  const outcomes: ("success" | "failure" | "unknown")[] = ["success", "success", "failure", "success", "unknown", "success", "failure", "success"];
  const reasons = ["end_call", "end_call", "voicemail", "end_call", "max_duration", "end_call", "user_hangup", "end_call"];
  let convCount = 0;
  for (let i = 0; i < 8; i++) {
    const lead = leads[i];
    const startedAt = new Date(Date.now() - (i * 11 + 3) * 3600 * 1000);
    const dur = 45 + i * 37;
    const ok = outcomes[i] === "success";
    const conv = await Conversation.create({
      workspaceId: ws,
      channel: "voice",
      elevenConversationId: `conv_seed_${i}_${Date.now().toString(36)}`,
      elevenAgentId: agent.elevenAgentId,
      agentName: agent.name,
      agentRef: agent._id,
      leadId: lead._id,
      leadName: lead.fullName,
      phone: lead.phone,
      direction: i % 5 === 4 ? "inbound" : "outbound",
      status: "done",
      callSuccessful: outcomes[i],
      transcript: [
        { role: "agent", message: `Hi ${lead.firstName}, this is Maya calling from Matrix. Do you have a quick moment?`, timeInCallSecs: 0 },
        { role: "user", message: ok ? "Sure, go ahead." : "I'm a bit busy right now.", timeInCallSecs: 4 },
        { role: "agent", message: "Great. Could you tell me roughly what budget you have in mind?", timeInCallSecs: 8 },
        { role: "user", message: ok ? `Around ${(i + 3) * 50} thousand, and we'd like to start next month.` : "I'd rather not say.", timeInCallSecs: 14 },
        { role: "agent", message: ok ? "Perfect, I've noted that. Someone from our team will follow up. Thanks!" : "No problem, I'll call back another time. Thank you!", timeInCallSecs: 20 },
      ],
      summary: ok ? `${lead.fullName} is interested; budget ~${(i + 3) * 50}k INR, wants to start next month.` : `${lead.fullName} was busy; asked to call back later.`,
      summaryTitle: ok ? "Interested – budget shared" : "Call back later",
      durationSecs: dur,
      startedAt,
      endedAt: new Date(startedAt.getTime() + dur * 1000),
      terminationReason: reasons[i],
      dataCollection: ok ? { budget: { value: `${(i + 3) * 50},000 INR`, rationale: "Stated by the user" }, timeline: { value: "Next month", rationale: "User said next month" }, city: { value: CITIES[i % CITIES.length], rationale: "Mentioned" } } : { budget: { value: null, rationale: "Not shared" } },
      evaluation: { interested: { result: ok ? "success" : "failure", rationale: ok ? "Lead engaged and shared details" : "Lead declined" } },
      dynamicVariables: { lead_id: String(lead._id), name: lead.fullName, company: lead.company },
      hasAudio: false,
      zohoSync: ok ? { attemptedAt: startedAt, updatedFields: ["Budget", "Timeline"], skippedFields: ["City: already set"], error: "Zoho not connected" } : undefined,
      raw: { seed: true },
    });
    lead.callCount = 1;
    lead.lastCallAt = startedAt;
    lead.lastCallStatus = "done";
    lead.lastCallOutcome = outcomes[i];
    lead.lastCallSummary = conv.summary;
    lead.lastAgentId = agent.elevenAgentId;
    if (ok) {
      lead.fields = { ...lead.fields, Budget: lead.fields.Budget || `${(i + 3) * 50},000 INR`, Timeline: lead.fields.Timeline || "Next month" };
      lead.markModified("fields");
    }
    await lead.save();
    convCount++;
  }
  await Agent.updateOne({ _id: agent._id }, { $set: { callCount: convCount, lastCallAt: new Date() } });

  ok(res, { agent: agent.name, leads: leads.length, conversations: convCount, reset });
}));

export default router;
