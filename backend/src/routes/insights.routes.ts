import { Router } from "express";
import { z } from "zod";
import { asyncHandler, ok } from "../utils/http";
import * as analytics from "../services/analytics.service";
import * as insights from "../services/insights.service";
import { InsightTag, INSIGHT_CATEGORIES } from "../models/InsightTag";

const router = Router();
const range = (q: unknown) => analytics.parseRange(q as { from?: string; to?: string; days?: string; tz?: string });

router.get("/", asyncHandler(async (req, res) => ok(res, await insights.insightsDashboard(req.workspaceId, range(req.query)))));
router.get("/tags", asyncHandler(async (req, res) => ok(res, await InsightTag.find({ workspaceId: req.workspaceId }).sort({ status: 1, count: -1 }))));
router.patch("/tags/:key", asyncHandler(async (req, res) => {
  const body = z.object({ label: z.string().min(1).max(48).optional(), description: z.string().max(200).optional(), category: z.enum(INSIGHT_CATEGORIES as [string, ...string[]]).optional() }).parse(req.body ?? {});
  ok(res, await insights.renameTag(req.workspaceId, req.params.key, body as Parameters<typeof insights.renameTag>[2]));
}));
router.post("/tags/:key/merge", asyncHandler(async (req, res) => {
  const body = z.object({ into: z.string().min(1), label: z.string().max(48).optional(), reason: z.string().max(200).optional() }).parse(req.body);
  ok(res, await insights.mergeTags(req.workspaceId, req.params.key, body.into, { label: body.label, reason: body.reason, by: "user" }));
}));
router.delete("/tags/:key", asyncHandler(async (req, res) => {
  await insights.deleteTag(req.workspaceId, req.params.key);
  ok(res, { deleted: true });
}));
router.post("/reanalyze", asyncHandler(async (req, res) => {
  const body = z.object({ sinceDays: z.number().optional(), max: z.number().optional(), force: z.boolean().optional() }).parse(req.body ?? {});
  ok(res, await insights.analyzePending(req.workspaceId, body));
}));

export default router;
