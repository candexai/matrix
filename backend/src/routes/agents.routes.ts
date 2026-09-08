import { Router } from "express";
import { z } from "zod";
import { asyncHandler, ok } from "../utils/http";
import * as agents from "../services/agent.service";
import { ensureWebhooksForAllAgents } from "../services/agent.service";
import { testCallAgent } from "../services/calls.service";

const router = Router();

const configSchema = z.record(z.string(), z.unknown());
const agentBody = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  config: configSchema.default({}),
});

router.get("/", asyncHandler(async (req, res) => ok(res, await agents.listAgents(req.workspaceId))));
router.get("/providers", asyncHandler(async (req, res) => ok(res, await agents.describeProviders(req.workspaceId))));
router.post("/webhooks/ensure", asyncHandler(async (req, res) => ok(res, await ensureWebhooksForAllAgents(req.workspaceId))));
router.get("/remote", asyncHandler(async (req, res) => ok(res, await agents.listRemoteAgents(req.workspaceId))));
router.post("/import", asyncHandler(async (req, res) => {
  const { agent_id } = z.object({ agent_id: z.string().min(1) }).parse(req.body);
  ok(res, await agents.importRemoteAgent(req.workspaceId, agent_id), 201);
}));
router.post("/", asyncHandler(async (req, res) => {
  const body = agentBody.parse(req.body);
  ok(res, await agents.createAgent(req.workspaceId, body as agents.AgentInput), 201);
}));
router.get("/:id", asyncHandler(async (req, res) => ok(res, await agents.getAgent(req.workspaceId, req.params.id))));
router.patch("/:id", asyncHandler(async (req, res) => {
  const body = agentBody.partial().parse(req.body);
  ok(res, await agents.updateAgent(req.workspaceId, req.params.id, body as Partial<agents.AgentInput>));
}));
router.delete("/:id", asyncHandler(async (req, res) => {
  await agents.deleteAgent(req.workspaceId, req.params.id, { remote: req.query.remote !== "false" });
  ok(res, { deleted: true });
}));
router.post("/:id/sync", asyncHandler(async (req, res) => ok(res, await agents.syncAgentFromRemote(req.workspaceId, req.params.id))));
router.post("/:id/test-call", asyncHandler(async (req, res) => {
  const body = z.object({ to_number: z.string().min(6), phoneNumberId: z.string().optional(), dynamic_variables: z.record(z.string(), z.string()).optional() }).parse(req.body ?? {});
  ok(res, await testCallAgent(req.workspaceId, req.params.id, body), 202);
}));
router.get("/:id/signed-url", asyncHandler(async (req, res) => ok(res, await agents.getSignedUrl(req.workspaceId, req.params.id))));

export default router;
