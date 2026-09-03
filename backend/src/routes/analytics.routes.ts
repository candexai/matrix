import { Router } from "express";
import { asyncHandler, ok } from "../utils/http";
import * as analytics from "../services/analytics.service";

const router = Router();
const range = (q: unknown) => analytics.parseRange(q as { from?: string; to?: string; days?: string; tz?: string });

router.get("/summary", asyncHandler(async (req, res) => ok(res, await analytics.summary(req.workspaceId, range(req.query)))));
router.get("/trends", asyncHandler(async (req, res) => ok(res, await analytics.trends(req.workspaceId, range(req.query)))));
router.get("/agents", asyncHandler(async (req, res) => ok(res, await analytics.byAgent(req.workspaceId, range(req.query)))));
router.get("/outcomes", asyncHandler(async (req, res) => ok(res, await analytics.outcomes(req.workspaceId, range(req.query)))));
router.get("/leads", asyncHandler(async (req, res) => ok(res, await analytics.leadFunnel(req.workspaceId))));
router.get("/heatmap", asyncHandler(async (req, res) => ok(res, await analytics.hourHeatmap(req.workspaceId, range(req.query)))));
router.get("/dashboard", asyncHandler(async (req, res) => {
  const r = range(req.query);
  const [s, t, a, o, l, h] = await Promise.all([
    analytics.summary(req.workspaceId, r),
    analytics.trends(req.workspaceId, r),
    analytics.byAgent(req.workspaceId, r),
    analytics.outcomes(req.workspaceId, r),
    analytics.leadFunnel(req.workspaceId),
    analytics.hourHeatmap(req.workspaceId, r),
  ]);
  ok(res, { summary: s, trends: t, agents: a, outcomes: o, leads: l, heatmap: h, timezone: r.tz });
}));

export default router;
