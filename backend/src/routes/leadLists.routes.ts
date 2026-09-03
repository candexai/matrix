import { Router } from "express";
import { z } from "zod";
import { asyncHandler, ok } from "../utils/http";
import * as leads from "../services/leads.service";
import { generateDraft, createAgentFromDraft, AgentDraft } from "../services/agentGenerator.service";

const router = Router();

const bindingBody = z.object({
  agentId: z.string().min(1),
  phoneNumberId: z.string().optional(),
  fields: z.array(z.object({ zohoField: z.string().min(1), label: z.string().optional(), dataType: z.string().optional(), description: z.string().optional() })).default([]),
  onlyFillEmpty: z.boolean().optional(),
  pushToZoho: z.boolean().optional(),
  updateLeadStatusTo: z.string().optional(),
  active: z.boolean().optional(),
});

router.get("/", asyncHandler(async (req, res) => ok(res, await leads.listLeadLists(req.workspaceId))));
router.post("/", asyncHandler(async (req, res) => {
  const body = z.object({ name: z.string().min(1).max(120), columns: z.array(z.string()).optional() }).parse(req.body);
  ok(res, await leads.createLeadList(req.workspaceId, body), 201);
}));
router.get("/:id", asyncHandler(async (req, res) => ok(res, await leads.getLeadList(req.workspaceId, req.params.id))));
router.patch("/:id", asyncHandler(async (req, res) => {
  const body = z.object({ name: z.string().min(1).max(120).optional(), columns: z.array(z.string()).optional() }).parse(req.body ?? {});
  ok(res, await leads.updateLeadList(req.workspaceId, req.params.id, body));
}));
router.delete("/:id", asyncHandler(async (req, res) => {
  await leads.deleteLeadList(req.workspaceId, req.params.id);
  ok(res, { deleted: true });
}));
router.post("/:id/leads", asyncHandler(async (req, res) => {
  const { leadIds } = z.object({ leadIds: z.array(z.string()).min(1) }).parse(req.body);
  ok(res, await leads.addLeadsToList(req.workspaceId, req.params.id, leadIds));
}));
router.delete("/:id/leads", asyncHandler(async (req, res) => {
  const { leadIds } = z.object({ leadIds: z.array(z.string()).min(1) }).parse(req.body);
  ok(res, await leads.removeLeadsFromList(req.workspaceId, req.params.id, leadIds));
}));
/** AI agent generation for a table: dryRun returns an editable draft; otherwise (or with `draft`) creates + attaches the agent. */
router.post("/:id/generate-agent", asyncHandler(async (req, res) => {
  const body = z
    .object({
      instructions: z.string().max(4000).optional(),
      websiteUrl: z.string().max(500).optional(),
      language: z.string().max(10).optional(),
      tone: z.string().max(80).optional(),
      agentName: z.string().max(80).optional(),
      companyName: z.string().max(120).optional(),
      fields: z.array(z.string()).optional(),
      dryRun: z.boolean().optional(),
      draft: z.record(z.string(), z.unknown()).optional(),
      voiceId: z.string().optional(),
      phoneNumberId: z.string().optional(),
      llm: z.string().optional(),
      ttsModelId: z.string().optional(),
    })
    .parse(req.body ?? {});
  const draft = (body.draft as unknown as AgentDraft | undefined) ?? (await generateDraft(req.workspaceId, req.params.id, { instructions: body.instructions ?? "", websiteUrl: body.websiteUrl, language: body.language, tone: body.tone, agentName: body.agentName, companyName: body.companyName, fields: body.fields }));
  if (body.dryRun) return ok(res, { draft });
  const result = await createAgentFromDraft(req.workspaceId, req.params.id, draft, { voiceId: body.voiceId, phoneNumberId: body.phoneNumberId, llm: body.llm, ttsModelId: body.ttsModelId });
  ok(res, { draft, ...result }, 201);
}));

router.get("/:id/agent-binding", asyncHandler(async (req, res) => ok(res, await leads.getBinding(req.workspaceId, req.params.id))));
router.put("/:id/agent-binding", asyncHandler(async (req, res) => {
  const body = bindingBody.parse(req.body);
  ok(res, await leads.setBinding(req.workspaceId, { ...body, listId: req.params.id }));
}));
router.delete("/:id/agent-binding", asyncHandler(async (req, res) => {
  await leads.clearBinding(req.workspaceId, req.params.id);
  ok(res, { cleared: true });
}));

export default router;
