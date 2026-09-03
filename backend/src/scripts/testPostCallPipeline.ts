/**
 * Offline test of the post-call pipeline (no ElevenLabs / Zoho network calls).
 * Run: npx ts-node --transpile-only src/scripts/testPostCallPipeline.ts
 */
import mongoose from "mongoose";
import crypto from "crypto";
import { MongoMemoryServer } from "mongodb-memory-server";
import { Agent } from "../models/Agent";
import { Lead } from "../models/Lead";
import { Conversation } from "../models/Conversation";
import { LeadAgentBinding } from "../models/LeadAgentBinding";
import { withDefaults, buildConversationConfig, buildPlatformSettings, formFromRemote } from "../services/elevenlabs/configBuilder";
import { processPostCallEvent } from "../services/postCall.service";
import { verifyElevenLabsSignature } from "../utils/crypto";
import { extractFieldsFromTranscript, coerceValue, setOpenAICaller } from "../services/extraction.service";
import { LeadList } from "../models/LeadList";
import { InsightTag } from "../models/InsightTag";
import { setInsightsCaller, analyzeConversation, mergeTags, TAG_CAP } from "../services/insights.service";
import { buildGeneratorPrompt } from "../services/agentGenerator.service";

let failures = 0;
function check(name: string, cond: unknown, detail?: unknown) {
  if (cond) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.log(`  ✗ ${name}`, detail !== undefined ? JSON.stringify(detail) : "");
  }
}

async function main() {
  process.env.OPENAI_API_KEY = ""; // never hit the real API in this test
  const mem = await MongoMemoryServer.create();
  await mongoose.connect(mem.getUri(), { dbName: "matrix-test" });

  console.log("\n[1] config builder");
  const cfg = withDefaults({
    voice_id: "voice_1",
    language: "hi",
    additional_languages: ["en", "hi"],
    hinglish_mode: true,
    built_in_tools: ["end_call", "voicemail_detection"],
    voicemail_message: "Sorry we missed you",
    enable_human_transfer: true,
    human_transfer_rules: [{ condition: "asks for human", phone_number: "+911234567890", transfer_type: "conference" }],
    data_collection: [{ key: "Budget Range", type: "string", description: "Budget", zohoField: "Budget" }],
    evaluation_criteria: [{ id: "", name: "Interested", conversation_goal_prompt: "Was the lead interested?" }],
  });
  const cc = buildConversationConfig(cfg, "create") as any;
  check("primary language + presets exclude primary", cc.agent.language === "hi" && Object.keys(cc.language_presets).join() === "en");
  check("hinglish only for hi", cc.agent.hinglish_mode === true);
  check("built_in_tools include end_call, voicemail, transfer", ["end_call", "voicemail_detection", "transfer_to_number"].every((k) => cc.agent.prompt.built_in_tools[k]), Object.keys(cc.agent.prompt.built_in_tools));
  check("voicemail message set", cc.agent.prompt.built_in_tools.voicemail_detection.params.voicemail_message === "Sorry we missed you");
  check("transfer rule shape", cc.agent.prompt.built_in_tools.transfer_to_number.params.transfers[0].transfer_destination.phone_number === "+911234567890");
  check("v3 default sets expressive_mode", cc.tts.model_id === "eleven_v3_conversational" && cc.tts.expressive_mode === true);
  const ps = buildPlatformSettings(cfg, { webhookId: "wh_1", events: ["transcript"] }) as any;
  check("data_collection key snake_cased", Boolean(ps.data_collection.budget_range), Object.keys(ps.data_collection));
  check("evaluation id derived", ps.evaluation.criteria[0].id === "interested");
  check("webhook override", ps.workspace_overrides.webhooks.post_call_webhook_id === "wh_1");
  const updateCc = buildConversationConfig({ ...cfg, built_in_tools: ["end_call"], enable_human_transfer: false }, "update") as any;
  check("update sends null for disabled tools", updateCc.agent.prompt.built_in_tools.voicemail_detection === null && updateCc.agent.prompt.built_in_tools.transfer_to_number === null);
  const round = formFromRemote({ agent_id: "a", name: "n", conversation_config: cc, platform_settings: ps }, cfg);
  check("remote → form round trip keeps zohoField mapping", round.data_collection[0].zohoField === "Budget" && round.language === "hi" && round.human_transfer_rules.length === 1, round.data_collection);

  console.log("\n[2] HMAC signature");
  const secret = "whsec_test";
  const body = JSON.stringify({ type: "post_call_transcription", data: { conversation_id: "c1" } });
  const t = Math.floor(Date.now() / 1000);
  const sig = `t=${t},v0=${crypto.createHmac("sha256", secret).update(`${t}.${body}`).digest("hex")}`;
  check("valid signature accepted", verifyElevenLabsSignature(sig, body, secret));
  check("wrong secret rejected", !verifyElevenLabsSignature(sig, body, "other"));
  check("stale timestamp rejected", !verifyElevenLabsSignature(`t=${t - 7200},v0=abc`, body, secret));

  console.log("\n[3] post-call pipeline: lead matched by lead_id, empty fields filled, status advanced");
  const agent = await Agent.create({ workspaceId: "default", elevenAgentId: "agent_test", name: "Qualifier", config: withDefaults({ voice_id: "v", data_collection: [{ key: "budget", type: "string", description: "Budget", zohoField: "Budget" }] }) });
  await LeadAgentBinding.create({
    workspaceId: "default",
    agentId: agent._id,
    elevenAgentId: "agent_test",
    fields: [
      { zohoField: "Budget", label: "Budget", dataType: "text", description: "Budget", collectionKey: "budget" },
      { zohoField: "City", label: "City", dataType: "text", description: "City", collectionKey: "city" },
      { zohoField: "Email", label: "Email", dataType: "email", description: "Email", collectionKey: "email" },
    ],
    onlyFillEmpty: true,
    pushToZoho: true,
    updateLeadStatusTo: "Contacted",
  });
  const lead = await Lead.create({ workspaceId: "default", source: "zoho", zohoId: "z123", fullName: "Vivek Singh", phone: "+918979145539", phoneKey: "8979145539", fields: { Budget: "", City: "Delhi", Email: null, Lead_Status: "Not Contacted", Company_Size: "" } });
  const now = Math.floor(Date.now() / 1000);
  const payload = (convId: string, dyn: Record<string, unknown>, results: Record<string, unknown>) => ({
    type: "post_call_transcription",
    event_timestamp: now,
    data: {
      agent_id: "agent_test",
      conversation_id: convId,
      status: "done",
      transcript: [
        { role: "agent", message: "Hi Vivek, do you have a minute?", time_in_call_secs: 0 },
        { role: "user", message: "Sure. My budget is around 50k.", time_in_call_secs: 4 },
      ],
      metadata: { start_time_unix_secs: now - 60, call_duration_secs: 42, termination_reason: "end_call", phone_call: { direction: "outbound", external_number: "+91 89791 45539" } },
      analysis: { transcript_summary: "Lead is interested, budget 50k.", call_successful: "success", data_collection_results: results },
      conversation_initiation_client_data: { dynamic_variables: dyn },
    },
  });
  await processPostCallEvent(payload("conv_1", { lead_id: String(lead._id) }, { budget: { value: "50,000 INR", rationale: "user said 50k" }, city: { value: "Mumbai" }, email: { value: "n/a" }, company_size: { value: "10-50" } }));
  const l1 = await Lead.findById(lead._id);
  const c1 = await Conversation.findOne({ elevenConversationId: "conv_1" });
  check("conversation stored with transcript + summary", c1?.transcript.length === 2 && c1?.summary?.includes("interested"));
  check("conversation linked to lead", String(c1?.leadId) === String(lead._id));
  check("empty Budget filled", l1?.fields.Budget === "50,000 INR", l1?.fields);
  check("non-empty City NOT overwritten", l1?.fields.City === "Delhi");
  check("meaningless 'n/a' ignored", l1?.fields.Email === null || l1?.fields.Email === undefined);
  check("unmapped key matched by name fallback (company_size → Company_Size)", l1?.fields.Company_Size === "10-50");
  check("Lead_Status advanced", l1?.fields.Lead_Status === "Contacted" && l1?.leadStatus === "Contacted");
  check("lead call stats updated", l1?.callCount === 1 && l1?.lastCallOutcome === "success");
  check("zohoSync recorded (no Zoho connected → error noted, fields listed)", (c1?.zohoSync?.updatedFields ?? []).includes("Budget") && c1?.zohoSync?.error === "Zoho not connected", c1?.zohoSync);

  console.log("\n[4] post-call pipeline: lead matched by phone when no lead_id; idempotent re-delivery");
  await processPostCallEvent(payload("conv_2", {}, { city: { value: "Pune" } }));
  const c2 = await Conversation.findOne({ elevenConversationId: "conv_2" });
  check("matched by phone", String(c2?.leadId) === String(lead._id));
  await processPostCallEvent(payload("conv_2", {}, { city: { value: "Pune" } }));
  const count = await Conversation.countDocuments({ elevenConversationId: "conv_2" });
  check("re-delivery does not duplicate", count === 1);

  console.log("\n[5] OpenAI extraction (fake model) + list-scoped binding");
  process.env.OPENAI_API_KEY = "test";
  let fakeCalls = 0;
  const fake = async (messages: { role: string; content: string }[]) => {
    const user = messages[1].content;
    if (fakeCalls++ === 0) check("prompt lists candidate fields with types", user.includes("Budget") && user.includes("Company_Size") && user.includes("Transcript:"));
    else check("pipeline prompt excludes already-filled Budget", !user.includes("- Budget (") && user.includes("- Website ("), user.split("Transcript:")[0].slice(-400));
    return JSON.stringify({ Budget: "10 lakh", Company_Size: "", Industry: "Real Estate", Website: "acme dot com", Annual_Revenue: "2 crore", Interested: "yes" });
  };
  const ex = await extractFieldsFromTranscript(
    {
      transcript: [{ role: "agent", message: "Budget?" }, { role: "user", message: "Around ten lakh, we are in real estate, acme dot com, revenue two crore." }],
      fields: [
        { api_name: "Budget", label: "Budget", data_type: "text" },
        { api_name: "Company_Size", label: "Company size", data_type: "text" },
        { api_name: "Industry", label: "Industry", data_type: "picklist", pick_list_values: ["Real Estate", "Services", "Retail"] },
        { api_name: "Website", label: "Website", data_type: "website" },
        { api_name: "Annual_Revenue", label: "Annual revenue", data_type: "currency" },
        { api_name: "Interested", label: "Interested", data_type: "boolean" },
      ],
    },
    fake as any
  );
  check("empty answers dropped", !("Company_Size" in ex.values), ex.values);
  check("picklist matched", ex.values.Industry === "Real Estate");
  check("website normalised", ex.values.Website === "https://acme.com", ex.values.Website);
  check("boolean coerced", ex.values.Interested === true);
  check("currency parsed", ex.values.Annual_Revenue === 2, ex.values.Annual_Revenue);
  check("coerce integer from digits", coerceValue({ api_name: "x", label: "x", data_type: "integer" }, "1,000,000") === 1000000);

  // list-scoped binding: a list with its own agent binding overrides the default
  const list = await LeadList.create({ workspaceId: "default", source: "manual", name: "Hot leads", columns: ["First_Name", "Budget"] });
  await LeadAgentBinding.create({ workspaceId: "default", listId: String(list._id), agentId: agent._id, elevenAgentId: "agent_test", fields: [{ zohoField: "Industry", label: "Industry", dataType: "picklist", description: "Industry", collectionKey: "industry" }], onlyFillEmpty: true, pushToZoho: true, updateLeadStatusTo: "Qualified" });
  const lead5 = (await Lead.findById(lead._id))!; // reload: the pipeline updated the stored document
  lead5.listIds = [String(list._id)];
  lead5.fields = { ...lead5.fields, Industry: "", Website: "" };
  lead5.markModified("fields");
  await lead5.save();
  // route OpenAI through the fake for the pipeline call
  setOpenAICaller(fake as any);
  await processPostCallEvent(payload("conv_3", { lead_id: String(lead._id), lead_list_id: String(list._id) }, { industry: { value: "Retail" } }));
  setOpenAICaller(undefined);
  const l3 = await Lead.findById(lead._id);
  const c3 = await Conversation.findOne({ elevenConversationId: "conv_3" });
  check("list binding used (status → Qualified)", l3?.fields.Lead_Status === "Qualified", l3?.fields.Lead_Status);
  check("ElevenLabs result filled Industry via list binding", l3?.fields.Industry === "Retail", l3?.fields.Industry);
  check("extraction metadata recorded", c3?.extraction?.provider === "openai" && Array.isArray(c3?.extraction?.candidateFields), c3?.extraction);
  check("OpenAI filled empty Website from transcript", l3?.fields.Website === "https://acme.com", { website: l3?.fields.Website, extracted: c3?.extraction?.extracted });
  check("Budget already set → not overwritten by extraction", l3?.fields.Budget === "50,000 INR", l3?.fields.Budget);
  check("extracted fields listed in zohoSync.updatedFields", (c3?.zohoSync?.updatedFields ?? []).includes("Website"), c3?.zohoSync?.updatedFields);

  console.log("\n[6] conversation insights: capped taxonomy, reuse, LLM merge with summed counts");
  process.env.OPENAI_API_KEY = "test";
  let insightCalls = 0;
  const insightsFake = async (messages: { role: string; content: string }[]) => {
    const user = messages[1].content;
    insightCalls++;
    if (insightCalls === 1) {
      check("first prompt shows empty taxonomy + cap", user.includes(`(0/${TAG_CAP})`) && messages[0].content.includes(`capped at ${TAG_CAP}`));
      return JSON.stringify({ tags: [{ key: "interested", label: "Interested", category: "outcome", description: "Lead wants to proceed", evidence: "Sure, go ahead" }, { key: "not_happy", label: "Not Happy", category: "sentiment", description: "Caller unhappy", evidence: "not great" }, { key: "budget_shared", label: "Budget Shared", category: "topic", description: "Budget disclosed", evidence: "50k" }], sentiment: "neutral", sentiment_score: 0.1, caller_mood: "hesitant", intent: "compare options", outcome: "follow-up", objections: ["price too high"], loss_risk: 0.4, next_best_action: "Send pricing sheet", key_quote: "My budget is around 50k" });
    }
    if (insightCalls === 2) {
      check("second prompt lists existing tags with counts", user.includes("interested |") && user.includes("used 1×"));
      return JSON.stringify({ tags: [{ key: "aggressive_caller", label: "Aggressive Caller", category: "sentiment", description: "Hostile tone", evidence: "stop calling me" }, { key: "interested", label: "Interested" }, { key: "price_objection", label: "Price Objection", category: "objection", description: "Objects to price" }], sentiment: "negative", sentiment_score: -0.7, loss_risk: 0.8, objections: ["price too high"], next_best_action: "Do not call again this week" });
    }
    // third call: model merges Not Happy + Aggressive Caller → Frustrated Caller and reuses it
    return JSON.stringify({ merges: [{ from: "aggressive_caller", into: "not_happy", label: "Frustrated Caller", reason: "same business meaning" }], tags: [{ key: "not_happy", label: "Frustrated Caller" }, { key: "interested", label: "Interested" }], sentiment: "negative", sentiment_score: -0.5, loss_risk: 0.6, objections: [] });
  };
  setInsightsCaller(insightsFake as any);
  const k1 = (await Conversation.findOne({ elevenConversationId: "conv_1" }))!;
  const i1 = await analyzeConversation(k1, { force: true });
  check("3 tags stored on conversation", i1?.tags.length === 3, i1?.tags);
  check("signals stored", i1?.lossRisk === 0.4 && i1?.objections[0] === "price too high" && i1?.nextBestAction === "Send pricing sheet");
  check("taxonomy created with counts", (await InsightTag.countDocuments({ status: "active" })) === 3 && (await InsightTag.findOne({ key: "interested" }))?.count === 1);
  const k2 = (await Conversation.findOne({ elevenConversationId: "conv_2" }))!;
  await analyzeConversation(k2, { force: true });
  check("existing tag reused, count incremented", (await InsightTag.findOne({ key: "interested" }))?.count === 2);
  check("taxonomy grew to 5", (await InsightTag.countDocuments({ status: "active" })) === 5);
  const k3 = (await Conversation.findOne({ elevenConversationId: "conv_3" }))!;
  const i3 = await analyzeConversation(k3, { force: true });
  const frustrated = await InsightTag.findOne({ key: "not_happy" });
  const aggressive = await InsightTag.findOne({ key: "aggressive_caller" });
  check("LLM merge applied: label renamed, source marked merged", frustrated?.label === "Frustrated Caller" && aggressive?.status === "merged" && aggressive?.mergedInto === "not_happy", { f: frustrated?.label, a: aggressive?.status });
  check("merged counts summed (1 + 1 + this call = 3)", frustrated?.count === 3, frustrated?.count);
  check("conversation previously tagged Aggressive now carries Frustrated Caller", (await Conversation.findOne({ elevenConversationId: "conv_2" }))?.insights?.tags.some((t) => t.key === "not_happy"));
  check("merge recorded on conversation + tag history", i3?.merges?.[0]?.from === "aggressive_caller" && frustrated?.mergedFrom[0]?.count === 1);
  check("active taxonomy shrank to 4", (await InsightTag.countDocuments({ status: "active" })) === 4);
  // cap enforcement
  for (let i = 0; i < TAG_CAP; i++) await InsightTag.create({ workspaceId: "default", key: `filler_${i}`, label: `Filler ${i}`, category: "topic" });
  setInsightsCaller((async () => JSON.stringify({ tags: [{ key: "brand_new", label: "Brand New", category: "topic" }, { key: "interested", label: "Interested" }], sentiment: "neutral", sentiment_score: 0, loss_risk: 0.3, objections: [] })) as any);
  const i1b = await analyzeConversation((await Conversation.findOne({ elevenConversationId: "conv_1" }))!, { force: true });
  check("cap enforced: new tag dropped when taxonomy is full, existing tag kept", !(await InsightTag.findOne({ key: "brand_new" })) && i1b?.tags.length === 1 && i1b?.tags[0].key === "interested", i1b?.tags);
  // manual merge by user
  const merged = await mergeTags("default", "filler_0", "filler_1", { by: "user", reason: "duplicate" });
  check("manual merge works", merged.key === "filler_1" && (await InsightTag.findOne({ key: "filler_0" }))?.status === "merged");
  setInsightsCaller(undefined);
  process.env.OPENAI_API_KEY = "";

  console.log("\n[7] agent generator prompt");
  const gp = buildGeneratorPrompt({
    instructions: "Call real-estate leads, confirm interest in 2/3 BHK, capture budget and timeline.",
    language: "hi",
    tone: "Friendly & warm",
    companyName: "Acme Homes",
    agentName: "Riya",
    list: { name: "Hot leads", recordCount: 42, columns: ["Budget", "Timeline"] },
    fields: [{ api_name: "Budget", label: "Budget", data_type: "currency", filledShare: 0.1 }, { api_name: "Timeline", label: "Timeline", data_type: "picklist", picklist: ["This month", "Next quarter"], filledShare: 0.4 }],
    known: ["Company", "City"],
    website: { url: "https://acme.example", title: "Acme Homes", text: "We build affordable 2 and 3 BHK apartments in Faridabad." },
  });
  check("system prompt demands conversation flow + data sections", /CONVERSATION FLOW/.test(gp.system) && /DATA TO COLLECT/.test(gp.system) && /AVAILABLE DATA/.test(gp.system));
  check("user prompt carries website, known variables, empty columns with fill rates", gp.user.includes("Faridabad") && gp.user.includes("{{zoho_company}}") && gp.user.includes("Budget") && gp.user.includes("10% of leads") && gp.user.includes("This month | Next quarter"));
  check("language + tone + names included", gp.user.includes("Hindi (hi)") && gp.user.includes("Friendly & warm") && gp.user.includes("Riya") && gp.user.includes("Acme Homes"));

  console.log("\n[8] other event types");
  await processPostCallEvent({ type: "post_call_audio", data: { conversation_id: "conv_1" } });
  check("audio flag set", (await Conversation.findOne({ elevenConversationId: "conv_1" }))?.hasAudio === true);
  const r = await processPostCallEvent({ type: "something_else", data: {} });
  check("unknown type ignored", r.handled.startsWith("ignored"));

  await mongoose.disconnect();
  await mem.stop();
  console.log(failures ? `\n${failures} check(s) FAILED` : "\nALL CHECKS PASSED");
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
