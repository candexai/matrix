import { Router } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import { asyncHandler, ok, HttpError } from "../utils/http";
import { Conversation } from "../models/Conversation";
import { elevenlabs } from "../services/elevenlabs/client";
import { syncConversations, refreshConversation } from "../services/conversations.service";
import { analyzeConversation } from "../services/insights.service";

const router = Router();

router.get("/", asyncHandler(async (req, res) => {
  const q = req.query as Record<string, string>;
  const page = Math.max(1, Number(q.page ?? 1));
  const limit = Math.min(100, Math.max(1, Number(q.limit ?? 30)));
  const filter: Record<string, unknown> = { workspaceId: req.workspaceId };
  if (q.channel && q.channel !== "all") filter.channel = q.channel;
  if (q.agentId) filter.elevenAgentId = q.agentId;
  if (q.leadId) filter.leadId = q.leadId;
  if (q.status) filter.status = q.status;
  if (q.outcome) filter.callSuccessful = q.outcome;
  if (q.tag) filter["insights.tags.key"] = q.tag;
  if (q.sentiment) filter["insights.sentiment"] = q.sentiment;
  if (q.from || q.to) filter.createdAt = { ...(q.from ? { $gte: new Date(q.from) } : {}), ...(q.to ? { $lte: new Date(q.to) } : {}) };
  if (q.search?.trim()) {
    const rx = new RegExp(q.search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ leadName: rx }, { phone: rx }, { summary: rx }, { summaryTitle: rx }, { agentName: rx }, { "transcript.message": rx }];
  }
  const [items, total, channelCounts] = await Promise.all([
    Conversation.find(filter, { transcript: { $slice: 2 }, raw: 0 }).sort({ startedAt: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Conversation.countDocuments(filter),
    Conversation.aggregate([{ $match: { workspaceId: req.workspaceId } }, { $group: { _id: "$channel", count: { $sum: 1 } } }]),
  ]);
  ok(res, { items, total, page, limit, pages: Math.ceil(total / limit), channelCounts: Object.fromEntries(channelCounts.map((c) => [c._id, c.count])) });
}));

router.post("/sync", asyncHandler(async (req, res) => {
  const body = z.object({ agentId: z.string().optional(), sinceHours: z.number().optional(), max: z.number().optional() }).parse(req.body ?? {});
  ok(res, await syncConversations(req.workspaceId, body));
}));

async function findConv(workspaceId: string, id: string) {
  const conv = Types.ObjectId.isValid(id) ? await Conversation.findOne({ workspaceId, _id: id }) : await Conversation.findOne({ workspaceId, elevenConversationId: id });
  if (!conv) throw new HttpError(404, "Conversation not found", "CONVERSATION_NOT_FOUND");
  return conv;
}

router.get("/:id", asyncHandler(async (req, res) => ok(res, await findConv(req.workspaceId, req.params.id))));
router.post("/:id/refresh", asyncHandler(async (req, res) => {
  const conv = await findConv(req.workspaceId, req.params.id);
  ok(res, await refreshConversation(req.workspaceId, conv.elevenConversationId));
}));
router.post("/:id/analyze", asyncHandler(async (req, res) => {
  const conv = await findConv(req.workspaceId, req.params.id);
  const { force } = z.object({ force: z.boolean().optional() }).parse(req.body ?? {});
  await analyzeConversation(conv, { force });
  ok(res, await findConv(req.workspaceId, req.params.id));
}));
router.get("/:id/audio", asyncHandler(async (req, res) => {
  const conv = await findConv(req.workspaceId, req.params.id);
  const { stream, contentType } = await elevenlabs.getConversationAudio(conv.elevenConversationId);
  res.setHeader("Content-Type", contentType);
  res.setHeader("Cache-Control", "private, max-age=3600");
  stream.pipe(res);
}));
router.delete("/:id", asyncHandler(async (req, res) => {
  const conv = await findConv(req.workspaceId, req.params.id);
  if (req.query.remote === "true") await elevenlabs.deleteConversation(conv.elevenConversationId).catch(() => undefined);
  await conv.deleteOne();
  ok(res, { deleted: true });
}));

export default router;
