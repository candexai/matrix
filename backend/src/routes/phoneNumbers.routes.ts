import { Router } from "express";
import { z } from "zod";
import { asyncHandler, ok } from "../utils/http";
import { getElevenClient } from "../services/elevenlabs/registry";
import { listPhoneNumbers, invalidatePhoneCache } from "../services/calls.service";
import { normalizePhone } from "../utils/phone";

const router = Router();

const e164 = z.string().min(6).transform((v, ctx) => {
  const n = normalizePhone(v);
  if (!n) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Phone number must be in international format, e.g. +14155551234" });
    return z.NEVER;
  }
  return n;
});

const credentials = z.object({ username: z.string().min(1), password: z.string().optional() }).optional();
const transport = z.enum(["auto", "udp", "tcp", "tls"]).default("auto");
const encryption = z.enum(["disabled", "allowed", "required"]).default("allowed");

const twilioBody = z.object({
  phone_number: e164,
  label: z.string().min(1).max(80),
  sid: z.string().min(10),
  token: z.string().min(10),
  agent_id: z.string().optional(),
  supports_inbound: z.boolean().default(true),
  supports_outbound: z.boolean().default(true),
});

const sipBody = z.object({
  phone_number: e164,
  label: z.string().min(1).max(80),
  agent_id: z.string().optional(),
  supports_inbound: z.boolean().default(true),
  supports_outbound: z.boolean().default(true),
  outbound: z
    .object({
      address: z.string().min(3),
      transport,
      media_encryption: encryption,
      credentials,
      headers: z.record(z.string(), z.string()).optional(),
    })
    .optional(),
  inbound: z
    .object({
      allowed_addresses: z.array(z.string()).optional(),
      allowed_numbers: z.array(z.string()).optional(),
      media_encryption: encryption,
      credentials,
    })
    .optional(),
});

router.get("/", asyncHandler(async (req, res) => ok(res, await listPhoneNumbers(req.workspaceId, req.query.refresh === "1"))));
router.get("/:id", asyncHandler(async (req, res) => ok(res, await (await getElevenClient(req.workspaceId)).getPhoneNumber(req.params.id))));

router.post("/twilio", asyncHandler(async (req, res) => {
  const b = twilioBody.parse(req.body);
  const eleven = await getElevenClient(req.workspaceId);
  const created = await eleven.importPhoneNumber({ provider: "twilio", ...b, agent_id: b.agent_id || null });
  invalidatePhoneCache(req.workspaceId);
  ok(res, created, 201);
}));

router.post("/sip-trunk", asyncHandler(async (req, res) => {
  const b = sipBody.parse(req.body);
  const body: Record<string, unknown> = {
    provider: "sip_trunk",
    phone_number: b.phone_number,
    label: b.label,
    agent_id: b.agent_id || null,
    supports_inbound: b.supports_inbound,
    supports_outbound: b.supports_outbound,
  };
  if (b.outbound) {
    body.outbound_trunk_config = {
      address: b.outbound.address,
      transport: b.outbound.transport,
      media_encryption: b.outbound.media_encryption,
      headers: b.outbound.headers ?? {},
      credentials: b.outbound.credentials ? { username: b.outbound.credentials.username, password: b.outbound.credentials.password ?? null } : null,
    };
  }
  if (b.inbound) {
    body.inbound_trunk_config = {
      allowed_addresses: b.inbound.allowed_addresses ?? [],
      allowed_numbers: b.inbound.allowed_numbers ?? null,
      media_encryption: b.inbound.media_encryption,
      credentials: b.inbound.credentials ? { username: b.inbound.credentials.username, password: b.inbound.credentials.password ?? null } : null,
    };
  }
  const eleven = await getElevenClient(req.workspaceId);
  const created = await eleven.importPhoneNumber(body);
  invalidatePhoneCache(req.workspaceId);
  ok(res, created, 201);
}));

router.patch("/:id", asyncHandler(async (req, res) => {
  const b = z
    .object({
      agent_id: z.string().nullable().optional(),
      label: z.string().min(1).max(80).optional(),
      outbound: sipBody.shape.outbound,
      inbound: sipBody.shape.inbound,
    })
    .parse(req.body ?? {});
  const body: Record<string, unknown> = {};
  if (b.agent_id !== undefined) body.agent_id = b.agent_id;
  if (b.label !== undefined) body.label = b.label;
  if (b.outbound) body.outbound_trunk_config = { address: b.outbound.address, transport: b.outbound.transport, media_encryption: b.outbound.media_encryption, headers: b.outbound.headers ?? {}, credentials: b.outbound.credentials ? { username: b.outbound.credentials.username, password: b.outbound.credentials.password ?? null } : null };
  if (b.inbound) body.inbound_trunk_config = { allowed_addresses: b.inbound.allowed_addresses ?? [], allowed_numbers: b.inbound.allowed_numbers ?? null, media_encryption: b.inbound.media_encryption, credentials: b.inbound.credentials ? { username: b.inbound.credentials.username, password: b.inbound.credentials.password ?? null } : null };
  const eleven = await getElevenClient(req.workspaceId);
  const updated = await eleven.updatePhoneNumber(req.params.id, body);
  invalidatePhoneCache(req.workspaceId);
  ok(res, updated);
}));

router.delete("/:id", asyncHandler(async (req, res) => {
  const eleven = await getElevenClient(req.workspaceId);
  await eleven.deletePhoneNumber(req.params.id);
  invalidatePhoneCache(req.workspaceId);
  ok(res, { deleted: true });
}));

export default router;
