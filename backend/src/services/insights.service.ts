/**
 * Conversation Insights: after every call an LLM describes the call with up to 5 SPECIFIC tags
 * (what was discussed, how it ended, what blocked it, anything remarkable) drawn from a capped,
 * self-organising taxonomy (default 30 tags). The model sees the current taxonomy with usage
 * shares, reuses a tag only when it means the same specific thing, may add tags while there is
 * room, and when the taxonomy is full it merges two semantically identical tags to make room.
 * Merges rewrite the tagged conversations and counts are recomputed from conversations, so merged
 * counts always sum correctly.
 *
 * v2 (2026-09): v1 forced one tag per generic dimension and told the model to always reuse, which
 * collapsed onto the same five labels for every call ("Interested / Neutral Caller / Wants More
 * Info / No Objection / Send Details"). v2 bans filler, flags overused tags in the prompt, lets
 * thin calls carry fewer tags and shows the most distinctive tags first.
 */
import { Conversation, ConversationDoc, ConversationInsights } from "../models/Conversation";
import { InsightTag, InsightTagDoc, InsightCategory, INSIGHT_CATEGORIES } from "../models/InsightTag";
import { defaultOpenAICaller, OpenAICaller, openAiConfigured, transcriptToText } from "./extraction.service";
import { HttpError } from "../utils/http";
import type { Range } from "./analytics.service";

export const INSIGHTS_VERSION = 2;
export const TAG_CAP = Math.max(5, Number(process.env.INSIGHT_TAG_CAP || 30));
const TAGS_PER_CALL = 5;
/** A tag on this share of analysed calls (once enough calls exist) no longer distinguishes anything. */
const OVERUSED_SHARE = 0.4;
const OVERUSED_MIN_CALLS = 8;
/** Labels that say nothing about a call; dropped even if the model returns them. */
const FILLER_KEYS = new Set(["no_objection", "no_objections", "no_objection_raised", "none", "n_a", "na", "neutral_caller", "neutral", "neutral_sentiment", "neutral_tone", "general_inquiry", "general_enquiry", "no_next_step", "no_blocker", "no_concerns", "call_successful", "successful_call", "call_success", "call_completed", "completed_call", "call_answered", "call_connected"]);

export function isOverused(count: number, analysedCalls: number): boolean {
  return analysedCalls >= OVERUSED_MIN_CALLS && count / analysedCalls >= OVERUSED_SHARE;
}

let caller: OpenAICaller = defaultOpenAICaller;
export function setInsightsCaller(fn?: OpenAICaller) {
  caller = fn ?? defaultOpenAICaller;
}

// ---------- helpers ----------
export function slug(s: string): string {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}
const titleCase = (s: string) => s.replace(/\s+/g, " ").trim().replace(/\b\w/g, (c) => c.toUpperCase());
const clamp = (n: unknown, lo: number, hi: number, dflt: number) => (typeof n === "number" && Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt);

// per-workspace mutex so concurrent post-call analyses do not race on the taxonomy
const locks = new Map<string, Promise<unknown>>();
async function withLock<T>(workspaceId: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(workspaceId) ?? Promise.resolve();
  const next = prev.catch(() => undefined).then(fn);
  locks.set(workspaceId, next);
  try {
    return await next;
  } finally {
    if (locks.get(workspaceId) === next) locks.delete(workspaceId);
  }
}

// ---------- prompt ----------
interface LlmTag {
  key?: string;
  label?: string;
  category?: string;
  description?: string;
  evidence?: string;
}
interface LlmOutput {
  tags?: LlmTag[];
  merges?: { from?: string; into?: string; label?: string; reason?: string }[];
  sentiment?: string;
  sentiment_score?: number;
  caller_mood?: string;
  intent?: string;
  outcome?: string;
  objections?: string[];
  loss_risk?: number;
  next_best_action?: string;
  key_quote?: string;
}

export function buildInsightsPrompt(conv: ConversationDoc, taxonomy: InsightTagDoc[], cap: number, analysedCalls = 0): { system: string; user: string } {
  const room = Math.max(0, cap - taxonomy.length);
  const system_extra: string[] = [];
  const system_base = [
    "You are the conversation-insights engine of a sales CRM. After each phone call between an AI voice agent and a lead you (a) describe the call with a few SPECIFIC tags and (b) extract a few structured signals.",
    "WHY TAGS EXIST: tags are shown as chips on a list of calls and counted in analytics. Someone scanning the list must see, from the chips alone, what happened in THIS call and how it differs from the other calls. A tag that would fit almost every call carries no information.",
    `WHAT TO TAG: up to ${TAGS_PER_CALL} tags that together tell the story of this call, MOST TELLING FIRST. (1) TOPICS, 1-3 tags: what the caller actually asked about or discussed, named in this business's own vocabulary (education: "Scholarship Query", "Exam Date Asked", "Fee Structure Asked", "Hostel Query", "Course Eligibility Asked"; real estate: "Site Visit Query", "Loan Eligibility Asked"). (2) OUTCOME, 1 tag: how the call ended for the business ("Callback Requested", "Meeting Booked", "Details To Be Sent", "Not Interested", "Wrong Person", "Hung Up Mid-call", "Asked To Call Later"). Use "Interested" only when the caller explicitly said they want to buy / enrol / proceed. (3) BLOCKER, 0-1 tag: only when the caller raised a real objection or obstacle ("Price Too High", "Already Enrolled Elsewhere", "Needs Parent Approval", "Busy Right Now"). (4) NOTABLE BEHAVIOUR, 0-1 tag: only when remarkable for the business ("Angry Caller", "Very Enthusiastic", "Language Switch Requested", "Suspicious Of AI Caller", "Off-topic Questions"). A rich conversation should get ${TAGS_PER_CALL} tags. Categories: topics use "topic" (or "intent" for what the caller wants to do), outcome uses "outcome", blocker uses "objection", notable behaviour uses "sentiment", an agreed next step uses "action".`,
    'IGNORE ROUTINE STEPS: greetings, "who is this?", "where are you calling from?", identity confirmation, agreeing to talk ("yes, go ahead") and picking the call language when the agent offers a choice happen in most calls. When the call went on to real content do not tag them at all; tag them only when that was the whole call (see THIN CALLS). Tag a language issue only when it disrupted the call (the agent could not speak the caller\'s language, or the caller demanded a switch mid-call).',
    "TAG THE CALLER, AT THE RIGHT LEVEL: topic tags describe what the CALLER asked, wanted or told us - not what the agent recited. Keep a topic tag at the level of a subject that will recur across many leads (\"Course Inquiry\", \"Fee Structure Asked\", \"Scholarship Query\", \"Exam Date Asked\", \"Placement Query\", \"Education Loan Query\") rather than one tag per specific course, product or plan name - the specific name belongs in intent / summary.",
    'NEVER output filler: no "No Objection", "Neutral Caller", "General Inquiry", "Call Successful", "Call Completed" (the outcome tag must say WHAT was achieved or agreed); not "Wants More Info" (say WHAT information) and not "Send Details" (say WHICH details). Ordinary or neutral sentiment belongs in the sentiment field, not in a tag.',
    'THIN CALLS: when the caller said almost nothing, only greeted, asked who is calling, or the call dropped within seconds, output just 1-2 tags that say exactly that ("Call Dropped Early", "No Real Conversation", "Asked Who Is Calling", "Voicemail Reached"). Never claim interest that was not expressed. These "nothing happened" tags are ONLY for thin calls: never add one to a call that has real content.',
    "SELF-CHECK before answering: for every tag, the evidence must be something the CALLER said in THIS transcript that directly supports the tag. If you cannot quote the caller for it, drop the tag or replace it with an accurate one. A workspace can run several campaigns (different businesses, products, audiences): never reuse a tag that belongs to a different campaign's subject just because it exists.",
    "LABELS: 2-4 words, Title Case, English. Keys are snake_case of the label. Every tag needs a short evidence quote from the transcript (translated to English).",
    `TAXONOMY: tags live in a shared vocabulary capped at ${cap} tags; it currently has ${taxonomy.length} (room for ${room} new). Each existing tag is listed with how many calls use it and a description of when it applies - respect that description. REUSE an existing tag when it means the same specific thing even if the wording differs ("Scholarship Details Asked" = "Scholarship Query"). Do NOT stretch a tag over a different subject just to reuse it: while there is room, create a new specific tag instead. Tags marked OVERUSED sit on a large share of all calls and have stopped being informative - avoid them unless they are the single most important fact of this call, and prefer something more specific. If there is no room for an essential new tag, propose a MERGE of two existing tags that mean the same thing for the business (their counts are summed, which frees a slot). Never merge tags that mean different things.`,
    'SIGNALS: sentiment_score from -1 (very negative) to 1 (very positive); sentiment = positive|neutral|negative; caller_mood = one or two words; intent = what the lead wants in a few words; outcome = short phrase; objections = list of short phrases (empty if none); loss_risk = probability 0..1 that this lead will be lost; next_best_action = one concrete sentence for the sales team; key_quote = the single most telling caller quote.',
    "LANGUAGE: whatever language the call was in (Hindi, Hinglish, English or other), write EVERYTHING in English using Roman/Latin script - including evidence quotes and key_quote (translate them; never output Devanagari or other non-Latin scripts).",
    'OUTPUT: strict JSON only: {"tags":[{"key":"","label":"","category":"topic|intent|outcome|objection|sentiment|action","description":"","evidence":""}],"merges":[{"from":"key","into":"key","label":"optional new label","reason":""}],"sentiment":"","sentiment_score":0,"caller_mood":"","intent":"","outcome":"","objections":[],"loss_risk":0,"next_best_action":"","key_quote":""}. For existing tags set key to the existing key and omit description. For a NEW tag the description is REQUIRED: one precise sentence saying who says what for the tag to apply (e.g. "Caller asks about scholarship amounts or eligibility."), so that later calls reuse it only when it truly fits. Evidence quotes MUST be in English.',
  ];

  if (room <= 5) system_extra.push(`The taxonomy is ${room === 0 ? "FULL" : "nearly full"}. Prefer an existing broader tag over a new one (one tag per course / product / plan does not scale - use e.g. "Course Inquiry" and let the summary carry the detail), and propose MERGES of near-duplicate tags so that room appears.`);
  const tax = taxonomy.length
    ? taxonomy
        .map((t) => {
          const share = analysedCalls > 0 ? ` (${Math.round((t.count / analysedCalls) * 100)}% of calls)` : "";
          return `- ${t.key} | "${t.label}" | ${t.category} | used ${t.count}×${share}${isOverused(t.count, analysedCalls) ? " | OVERUSED" : ""} | ${t.description}`;
        })
        .join("\n")
    : "(empty - this is the first analysed call; create specific tags for it)";
  const callerTurns = (conv.transcript ?? []).filter((t) => t.role !== "agent" && t.message?.trim()).length;
  const meta = [
    conv.leadName ? `Lead: ${conv.leadName}` : "",
    conv.direction ? `Direction: ${conv.direction}` : "",
    typeof conv.durationSecs === "number" ? `Duration: ${conv.durationSecs}s` : "",
    `Caller turns: ${callerTurns}`,
    conv.terminationReason ? `Ended by: ${conv.terminationReason}` : "",
    conv.callSuccessful ? `Platform-graded outcome: ${conv.callSuccessful}` : "",
    conv.summary ? `Summary: ${conv.summary}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  const system = [...system_base.slice(0, -1), ...system_extra, system_base[system_base.length - 1]].join("\n");
  const user = [`Existing taxonomy (${taxonomy.length}/${cap}), ${analysedCalls} calls analysed so far:`, tax, "", "Call metadata:", meta, "", "Transcript:", transcriptToText(conv.transcript ?? [])].join("\n");
  return { system, user };
}

// ---------- taxonomy operations ----------
async function nextColor(workspaceId: string): Promise<number> {
  const used = await InsightTag.find({ workspaceId }, { color: 1 });
  const taken = new Set(used.map((t) => t.color));
  for (let i = 0; i < 64; i++) if (!taken.has(i)) return i;
  return used.length;
}

/** Recompute `count` and lastSeen for every active tag from the conversations (source of truth). */
export async function recountTags(workspaceId: string): Promise<void> {
  const rows = await Conversation.aggregate<{ _id: string; count: number; last: Date }>([
    { $match: { workspaceId, "insights.tags.0": { $exists: true } } },
    { $unwind: "$insights.tags" },
    { $group: { _id: "$insights.tags.key", count: { $sum: 1 }, last: { $max: { $ifNull: ["$startedAt", "$createdAt"] } } } },
  ]);
  const counts = new Map(rows.map((r) => [r._id, r]));
  const tags = await InsightTag.find({ workspaceId, status: "active" });
  for (const t of tags) {
    const r = counts.get(t.key);
    const count = r?.count ?? 0;
    if (t.count !== count || (r?.last && (!t.lastSeenAt || t.lastSeenAt < r.last))) {
      t.count = count;
      if (r?.last) t.lastSeenAt = r.last;
      await t.save();
    }
  }
}

export async function mergeTags(workspaceId: string, fromKey: string, intoKey: string, opts: { label?: string; reason?: string; by: "llm" | "user" }): Promise<InsightTagDoc> {
  if (fromKey === intoKey) throw new HttpError(400, "Cannot merge a tag into itself", "VALIDATION_ERROR");
  const [from, into] = await Promise.all([InsightTag.findOne({ workspaceId, key: fromKey, status: "active" }), InsightTag.findOne({ workspaceId, key: intoKey, status: "active" })]);
  if (!from || !into) throw new HttpError(404, "Both tags must exist and be active", "TAG_NOT_FOUND");

  // rewrite conversations: replace `from` with `into` (dedupe if both present)
  const convs = await Conversation.find({ workspaceId, "insights.tags.key": from.key });
  for (const c of convs) {
    const tags = (c.insights?.tags ?? []).filter((t) => t.key !== from.key);
    if (!tags.some((t) => t.key === into.key)) {
      const old = c.insights?.tags.find((t) => t.key === from.key);
      tags.push({ key: into.key, label: opts.label ? titleCase(opts.label) : into.label, category: into.category, evidence: old?.evidence });
    }
    c.insights = { ...(c.insights as ConversationInsights), tags };
    c.markModified("insights");
    await c.save();
  }

  into.mergedFrom.push({ key: from.key, label: from.label, count: from.count, at: new Date(), reason: opts.reason, by: opts.by });
  if (opts.label) into.label = titleCase(opts.label);
  if (!into.description && from.description) into.description = from.description;
  into.examples = [...into.examples, ...from.examples].slice(-5);
  if (from.firstSeenAt < into.firstSeenAt) into.firstSeenAt = from.firstSeenAt;
  await into.save();

  from.status = "merged";
  from.mergedInto = into.key;
  await from.save();
  await recountTags(workspaceId);
  return into;
}

export async function renameTag(workspaceId: string, key: string, patch: { label?: string; description?: string; category?: InsightCategory }): Promise<InsightTagDoc> {
  const tag = await InsightTag.findOne({ workspaceId, key, status: "active" });
  if (!tag) throw new HttpError(404, "Tag not found", "TAG_NOT_FOUND");
  if (patch.label?.trim()) tag.label = titleCase(patch.label);
  if (patch.description !== undefined) tag.description = patch.description.trim();
  if (patch.category && INSIGHT_CATEGORIES.includes(patch.category)) tag.category = patch.category;
  await tag.save();
  if (patch.label) await Conversation.updateMany({ workspaceId, "insights.tags.key": key }, { $set: { "insights.tags.$[t].label": tag.label } }, { arrayFilters: [{ "t.key": key }] });
  return tag;
}

export async function deleteTag(workspaceId: string, key: string): Promise<void> {
  const tag = await InsightTag.findOne({ workspaceId, key });
  if (!tag) throw new HttpError(404, "Tag not found", "TAG_NOT_FOUND");
  await Conversation.updateMany({ workspaceId, "insights.tags.key": key }, { $pull: { "insights.tags": { key } } });
  await tag.deleteOne();
}

// ---------- analysis ----------
function parseJson(content: string): LlmOutput {
  try {
    return JSON.parse(content);
  } catch {
    const m = content.match(/\{[\s\S]*\}/);
    return m ? JSON.parse(m[0]) : {};
  }
}

/**
 * Analyse one completed conversation. Returns the stored insights (or a skipped/error marker).
 * Safe to call repeatedly: re-analysis replaces the previous tags of that conversation.
 */
export async function analyzeConversation(conv: ConversationDoc, opts: { force?: boolean } = {}): Promise<ConversationInsights | null> {
  const callerTurns = (conv.transcript ?? []).filter((t) => t.role !== "agent" && t.message?.trim());
  if (conv.status !== "done" || !callerTurns.length) {
    conv.insights = { tags: [], sentiment: "neutral", sentimentScore: 0, objections: [], lossRisk: 0, analyzedAt: new Date(), version: INSIGHTS_VERSION, skipped: conv.status !== "done" ? "call not finished" : "caller said nothing" };
    conv.markModified("insights");
    await conv.save();
    return conv.insights;
  }
  if (!openAiConfigured()) {
    conv.insights = { tags: [], sentiment: "neutral", sentimentScore: 0, objections: [], lossRisk: 0, analyzedAt: new Date(), version: INSIGHTS_VERSION, skipped: "OPENAI_API_KEY not configured" };
    conv.markModified("insights");
    await conv.save();
    return conv.insights;
  }
  if (conv.insights?.tags?.length && !opts.force) return conv.insights;

  return withLock(conv.workspaceId, async () => {
    const model = process.env.OPENAI_INSIGHTS_MODEL || process.env.OPENAI_MODEL || "gpt-4.1-mini";
    const taxonomy: InsightTagDoc[] = await InsightTag.find({ workspaceId: conv.workspaceId, status: "active" }).sort({ count: -1 });
    const analysedCalls = await Conversation.countDocuments({ workspaceId: conv.workspaceId, _id: { $ne: conv._id }, "insights.tags.0": { $exists: true } });
    const { system, user } = buildInsightsPrompt(conv, taxonomy, TAG_CAP, analysedCalls);
    let out: LlmOutput;
    try {
      out = parseJson(await caller([{ role: "system", content: system }, { role: "user", content: user }], model));
    } catch (err) {
      conv.insights = { ...(conv.insights ?? { tags: [], sentiment: "neutral", sentimentScore: 0, objections: [], lossRisk: 0 }), analyzedAt: new Date(), version: INSIGHTS_VERSION, model, error: (err as Error).message } as ConversationInsights;
      conv.markModified("insights");
      await conv.save();
      return conv.insights;
    }

    // 1) merges proposed by the model (validated)
    const applied: { from: string; into: string; reason?: string }[] = [];
    for (const m of out.merges ?? []) {
      const from = slug(m.from ?? "");
      const into = slug(m.into ?? "");
      if (!from || !into || from === into) continue;
      try {
        await mergeTags(conv.workspaceId, from, into, { label: m.label, reason: m.reason, by: "llm" });
        applied.push({ from, into, reason: m.reason });
      } catch (err) {
        console.warn(`[insights] rejected merge ${from}→${into}: ${(err as Error).message}`);
      }
    }

    // 2) resolve tags against the (possibly updated) taxonomy
    const active: InsightTagDoc[] = await InsightTag.find({ workspaceId: conv.workspaceId });
    const byKey = new Map<string, InsightTagDoc>(active.map((t) => [t.key, t]));
    const resolveKey = (k: string): InsightTagDoc | undefined => {
      let t = byKey.get(k);
      let hops = 0;
      while (t && t.status === "merged" && t.mergedInto && hops++ < 5) t = byKey.get(t.mergedInto);
      return t && t.status === "active" ? t : undefined;
    };
    let activeCount = active.filter((t) => t.status === "active").length;
    const finalTags: ConversationInsights["tags"] = [];
    const seen = new Set<string>();
    for (const raw of (out.tags ?? []).slice(0, TAGS_PER_CALL + 2)) {
      const label = titleCase(String(raw.label || raw.key || "").replace(/_/g, " ")).slice(0, 48);
      if (!label) continue;
      const key = slug(raw.key || label);
      if (FILLER_KEYS.has(key) || FILLER_KEYS.has(slug(label))) continue; // says nothing about the call
      let tag = resolveKey(key) ?? active.find((t) => t.status === "active" && t.label.toLowerCase() === label.toLowerCase());
      if (!tag) {
        if (activeCount >= TAG_CAP) {
          console.warn(`[insights] taxonomy full (${TAG_CAP}); dropping new tag "${label}" for ${conv.elevenConversationId}`);
          continue;
        }
        const CATEGORY_ALIASES: Record<string, InsightCategory> = { notable_behaviour: "sentiment", notable_behavior: "sentiment", behaviour: "sentiment", behavior: "sentiment", blocker: "objection", next_step: "action", topics: "topic" };
        const rawCategory = slug(String(raw.category ?? ""));
        const category = (INSIGHT_CATEGORIES as string[]).includes(rawCategory) ? (rawCategory as InsightCategory) : CATEGORY_ALIASES[rawCategory] ?? "topic";
        tag = await InsightTag.create({ workspaceId: conv.workspaceId, key, label, description: String(raw.description ?? "").slice(0, 200), category, color: await nextColor(conv.workspaceId), createdBy: "llm" });
        byKey.set(key, tag);
        active.push(tag);
        activeCount++;
      }
      if (seen.has(tag.key)) continue;
      seen.add(tag.key);
      finalTags.push({ key: tag.key, label: tag.label, category: tag.category, evidence: raw.evidence ? String(raw.evidence).slice(0, 240) : undefined });
      if (finalTags.length >= TAGS_PER_CALL) break;
    }

    // Distinctive tags first: the call list shows only the first few chips, so push tags that sit on a large
    // share of all calls (legitimately common outcomes such as "Callback Requested") behind the specific ones.
    const overused = (key: string) => isOverused(byKey.get(key)?.count ?? 0, analysedCalls);
    finalTags.sort((a, b) => Number(overused(a.key)) - Number(overused(b.key)));

    // 3) store insights on the conversation
    const sentimentScore = clamp(out.sentiment_score, -1, 1, 0);
    const sentiment: ConversationInsights["sentiment"] = ["positive", "neutral", "negative"].includes(String(out.sentiment)) ? (out.sentiment as ConversationInsights["sentiment"]) : sentimentScore > 0.25 ? "positive" : sentimentScore < -0.25 ? "negative" : "neutral";
    conv.insights = {
      tags: finalTags,
      sentiment,
      sentimentScore,
      callerMood: out.caller_mood ? String(out.caller_mood).slice(0, 60) : undefined,
      intent: out.intent ? String(out.intent).slice(0, 160) : undefined,
      outcome: out.outcome ? String(out.outcome).slice(0, 120) : undefined,
      objections: Array.isArray(out.objections) ? out.objections.map((o) => String(o).slice(0, 120)).filter(Boolean).slice(0, 6) : [],
      lossRisk: clamp(out.loss_risk, 0, 1, 0.5),
      nextBestAction: out.next_best_action ? String(out.next_best_action).slice(0, 240) : undefined,
      keyQuote: out.key_quote ? String(out.key_quote).slice(0, 240) : undefined,
      merges: applied.length ? applied : undefined,
      model,
      analyzedAt: new Date(),
      version: INSIGHTS_VERSION,
    };
    conv.markModified("insights");
    await conv.save();

    // 4) examples + counts
    for (const t of finalTags) {
      const doc = byKey.get(t.key);
      if (!doc) continue;
      doc.examples = [...doc.examples.filter((e) => e.conversationId !== String(conv._id)), { conversationId: String(conv._id), leadName: conv.leadName, evidence: t.evidence, at: conv.startedAt ?? new Date() }].slice(-5);
      doc.lastSeenAt = conv.startedAt ?? new Date();
      await doc.save();
    }
    await recountTags(conv.workspaceId);
    return conv.insights;
  });
}

/**
 * Forget the whole taxonomy and every stored analysis of a workspace, so a following re-analysis builds the
 * vocabulary from scratch (used after the tagging rules change: old tags would otherwise bias the new run).
 */
export async function resetInsights(workspaceId: string): Promise<{ tagsRemoved: number; conversationsCleared: number }> {
  return withLock(workspaceId, async () => {
    const tags = await InsightTag.deleteMany({ workspaceId });
    const convs = await Conversation.updateMany({ workspaceId, insights: { $exists: true } }, { $unset: { insights: "" } });
    return { tagsRemoved: tags.deletedCount ?? 0, conversationsCleared: convs.modifiedCount ?? 0 };
  });
}

/** Analyse completed calls that have no insights yet (or failed / skipped for a missing key). */
export async function analyzePending(workspaceId: string, opts: { sinceDays?: number; max?: number; force?: boolean } = {}): Promise<{ scanned: number; analyzed: number; errors: string[] }> {
  const since = new Date(Date.now() - (opts.sinceDays ?? 30) * 86400000);
  const filter: Record<string, unknown> = { workspaceId, status: "done", "transcript.0": { $exists: true }, createdAt: { $gte: since } };
  if (!opts.force) filter.$or = [{ insights: { $exists: false } }, { "insights.error": { $exists: true } }, { "insights.skipped": "OPENAI_API_KEY not configured" }];
  const convs = await Conversation.find(filter).sort({ createdAt: 1 }).limit(opts.max ?? 50);
  let analyzed = 0;
  const errors: string[] = [];
  for (const c of convs) {
    try {
      const r = await analyzeConversation(c, { force: opts.force });
      if (r && !r.error && !r.skipped) analyzed++;
      else if (r?.error) errors.push(`${c.elevenConversationId}: ${r.error}`);
    } catch (err) {
      errors.push(`${c.elevenConversationId}: ${(err as Error).message}`);
    }
  }
  return { scanned: convs.length, analyzed, errors };
}

// ---------- dashboard ----------
function timeMatch(r: Range) {
  return { $or: [{ startedAt: { $gte: r.from, $lte: r.to } }, { startedAt: { $exists: false }, createdAt: { $gte: r.from, $lte: r.to } }] };
}

export async function insightsDashboard(workspaceId: string, r: Range) {
  const match = { workspaceId, channel: "voice", ...timeMatch(r) };
  const [tags, mergedTags, totals, tagCounts, trendRows, sentimentRows, riskRows, objectionRows, actionRows, recent, sentTrend] = await Promise.all([
    InsightTag.find({ workspaceId, status: "active" }).sort({ count: -1 }),
    InsightTag.find({ workspaceId, status: "merged" }).sort({ updatedAt: -1 }).limit(30),
    Conversation.aggregate([{ $match: match }, { $group: { _id: null, done: { $sum: { $cond: [{ $eq: ["$status", "done"] }, 1, 0] } }, analyzed: { $sum: { $cond: [{ $gt: [{ $size: { $ifNull: ["$insights.tags", []] } }, 0] }, 1, 0] } }, pending: { $sum: { $cond: [{ $and: [{ $eq: ["$status", "done"] }, { $eq: [{ $size: { $ifNull: ["$insights.tags", []] } }, 0] }] }, 1, 0] } } } }]),
    Conversation.aggregate([{ $match: { ...match, "insights.tags.0": { $exists: true } } }, { $unwind: "$insights.tags" }, { $group: { _id: "$insights.tags.key", count: { $sum: 1 }, avgRisk: { $avg: "$insights.lossRisk" }, avgSentiment: { $avg: "$insights.sentimentScore" } } }]),
    Conversation.aggregate([
      { $match: { ...match, "insights.tags.0": { $exists: true } } },
      { $addFields: { day: { $dateToString: { format: "%Y-%m-%d", date: { $ifNull: ["$startedAt", "$createdAt"] }, timezone: r.tz } } } },
      { $unwind: "$insights.tags" },
      { $group: { _id: { day: "$day", key: "$insights.tags.key" }, count: { $sum: 1 } } },
    ]),
    Conversation.aggregate([{ $match: { ...match, insights: { $exists: true } } }, { $group: { _id: "$insights.sentiment", count: { $sum: 1 }, avg: { $avg: "$insights.sentimentScore" } } }]),
    Conversation.aggregate([{ $match: { ...match, "insights.lossRisk": { $exists: true } } }, { $bucket: { groupBy: "$insights.lossRisk", boundaries: [0, 0.25, 0.5, 0.75, 1.01], default: "other", output: { count: { $sum: 1 } } } }]),
    Conversation.aggregate([{ $match: { ...match, "insights.objections.0": { $exists: true } } }, { $unwind: "$insights.objections" }, { $group: { _id: { $toLower: "$insights.objections" }, count: { $sum: 1 }, label: { $first: "$insights.objections" } } }, { $sort: { count: -1 } }, { $limit: 10 }]),
    Conversation.aggregate([{ $match: { ...match, "insights.nextBestAction": { $exists: true, $ne: "" } } }, { $group: { _id: { $toLower: "$insights.nextBestAction" }, count: { $sum: 1 }, label: { $first: "$insights.nextBestAction" } } }, { $sort: { count: -1 } }, { $limit: 6 }]),
    Conversation.find({ ...match, "insights.tags.0": { $exists: true } }, { leadName: 1, phone: 1, agentName: 1, startedAt: 1, durationSecs: 1, insights: 1, summaryTitle: 1, leadId: 1 }).sort({ startedAt: -1, createdAt: -1 }).limit(12),
    Conversation.aggregate([
      { $match: { ...match, insights: { $exists: true } } },
      { $addFields: { day: { $dateToString: { format: "%Y-%m-%d", date: { $ifNull: ["$startedAt", "$createdAt"] }, timezone: r.tz } } } },
      { $group: { _id: "$day", avg: { $avg: "$insights.sentimentScore" }, risk: { $avg: "$insights.lossRisk" }, calls: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
  ]);

  const inRange = new Map(tagCounts.map((x) => [x._id, x]));
  const totalTagged = totals[0]?.analyzed ?? 0;
  const taxonomy = tags.map((t) => ({
    key: t.key,
    label: t.label,
    description: t.description,
    category: t.category,
    color: t.color,
    countAllTime: t.count,
    count: inRange.get(t.key)?.count ?? 0,
    share: totalTagged ? Math.round(((inRange.get(t.key)?.count ?? 0) / totalTagged) * 100) : 0,
    avgLossRisk: inRange.get(t.key)?.avgRisk ?? null,
    avgSentiment: inRange.get(t.key)?.avgSentiment ?? null,
    firstSeenAt: t.firstSeenAt,
    lastSeenAt: t.lastSeenAt,
    examples: t.examples.slice(-3).reverse(),
    mergedFrom: t.mergedFrom,
  }));

  // trends: per day, count per tag (top 8 by in-range count)
  const top = taxonomy
    .slice()
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)
    .map((t) => t.key);
  const days: string[] = [];
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: r.tz, year: "numeric", month: "2-digit", day: "2-digit" });
  for (let d = new Date(r.from); d <= r.to; d = new Date(d.getTime() + 86400000)) {
    const k = fmt.format(d);
    if (days[days.length - 1] !== k) days.push(k);
  }
  const trendMap = new Map<string, Record<string, number>>();
  for (const row of trendRows) {
    const day = row._id.day as string;
    const key = row._id.key as string;
    if (!top.includes(key)) continue;
    const rec = trendMap.get(day) ?? {};
    rec[key] = row.count;
    trendMap.set(day, rec);
  }
  const trends = days.map((day) => ({ date: day, ...Object.fromEntries(top.map((k) => [k, trendMap.get(day)?.[k] ?? 0])) }));
  const sentByDay = new Map(sentTrend.map((x) => [x._id, x]));
  const sentimentTrend = days.map((day) => ({ date: day, avgSentiment: sentByDay.get(day)?.avg ?? null, avgLossRisk: sentByDay.get(day)?.risk ?? null, calls: sentByDay.get(day)?.calls ?? 0 }));

  const riskLabels: Record<string, string> = { "0": "Low (0–25%)", "0.25": "Medium (25–50%)", "0.5": "High (50–75%)", "0.75": "Critical (75–100%)" };
  const merges = [...tags, ...mergedTags]
    .flatMap((t) => t.mergedFrom.map((m) => ({ into: t.key, intoLabel: t.label, from: m.key, fromLabel: m.label, count: m.count, at: m.at, reason: m.reason, by: m.by })))
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 20);

  return {
    range: r,
    cap: TAG_CAP,
    coverage: { done: totals[0]?.done ?? 0, analyzed: totalTagged, pending: totals[0]?.pending ?? 0, configured: openAiConfigured() },
    taxonomy,
    trends: { keys: top, rows: trends },
    sentiment: { distribution: sentimentRows.map((x) => ({ name: x._id ?? "unknown", value: x.count, avg: x.avg })), trend: sentimentTrend },
    lossRisk: riskRows.map((x) => ({ bucket: riskLabels[String(x._id)] ?? String(x._id), value: x.count })),
    objections: objectionRows.map((x) => ({ name: x.label, value: x.count })),
    nextActions: actionRows.map((x) => ({ name: x.label, value: x.count })),
    merges,
    recent: recent.map((c) => ({ _id: c._id, leadName: c.leadName, phone: c.phone, agentName: c.agentName, startedAt: c.startedAt, durationSecs: c.durationSecs, summaryTitle: c.summaryTitle, leadId: c.leadId, insights: c.insights })),
  };
}
