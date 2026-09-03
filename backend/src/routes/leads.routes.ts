import { Router } from "express";
import { z } from "zod";
import { asyncHandler, ok } from "../utils/http";
import * as leads from "../services/leads.service";
import { callLead, batchCallLeads } from "../services/calls.service";

const router = Router();

router.get("/", asyncHandler(async (req, res) => {
  const q = req.query as Record<string, string>;
  ok(res, await leads.listLeads(req.workspaceId, { listId: q.listId, search: q.search, status: q.status, source: q.source, called: q.called as "yes" | "no" | undefined, page: q.page ? Number(q.page) : undefined, limit: q.limit ? Number(q.limit) : undefined, sort: q.sort }));
}));

router.get("/agent-binding", asyncHandler(async (req, res) => ok(res, await leads.getBinding(req.workspaceId, (req.query.listId as string) || null))));
router.put("/agent-binding", asyncHandler(async (req, res) => {
  const body = z.object({
    listId: z.string().nullable().optional(),
    agentId: z.string().min(1),
    phoneNumberId: z.string().optional(),
    fields: z.array(z.object({ zohoField: z.string().min(1), label: z.string().optional(), dataType: z.string().optional(), description: z.string().optional() })).default([]),
    onlyFillEmpty: z.boolean().optional(),
    pushToZoho: z.boolean().optional(),
    updateLeadStatusTo: z.string().optional(),
    active: z.boolean().optional(),
  }).parse(req.body);
  ok(res, await leads.setBinding(req.workspaceId, body));
}));
router.delete("/agent-binding", asyncHandler(async (req, res) => {
  await leads.clearBinding(req.workspaceId, (req.query.listId as string) || null);
  ok(res, { cleared: true });
}));

router.post("/batch-call", asyncHandler(async (req, res) => {
  const body = z.object({ leadIds: z.array(z.string()).min(1), agentId: z.string().optional(), phoneNumberId: z.string().optional(), callName: z.string().optional(), scheduledTimeUnix: z.number().optional(), listId: z.string().optional() }).parse(req.body);
  ok(res, await batchCallLeads(req.workspaceId, body), 202);
}));

router.post("/", asyncHandler(async (req, res) => ok(res, await leads.createManualLead(req.workspaceId, req.body ?? {}), 201)));
router.get("/:id", asyncHandler(async (req, res) => ok(res, await leads.getLead(req.workspaceId, req.params.id))));
router.patch("/:id", asyncHandler(async (req, res) => ok(res, await leads.updateLeadFields(req.workspaceId, req.params.id, req.body ?? {}))));
router.delete("/:id", asyncHandler(async (req, res) => {
  await leads.deleteLead(req.workspaceId, req.params.id);
  ok(res, { deleted: true });
}));
router.get("/:id/conversations", asyncHandler(async (req, res) => ok(res, await leads.leadConversations(req.workspaceId, req.params.id))));
router.post("/:id/call", asyncHandler(async (req, res) => {
  const body = z.object({ agentId: z.string().optional(), phoneNumberId: z.string().optional(), listId: z.string().optional() }).parse(req.body ?? {});
  ok(res, await callLead(req.workspaceId, req.params.id, body), 202);
}));

export default router;
