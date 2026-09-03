import { Router } from "express";
import { asyncHandler } from "../utils/http";
import { verifyElevenLabsSignature } from "../utils/crypto";
import { collectWebhookSecrets, processPostCallEvent } from "../services/postCall.service";
import { env } from "../config/env";

const router = Router();

/**
 * ElevenLabs post-call webhook (transcript / audio / call_initiation_failure).
 * Verified with the HMAC secret(s) we stored when the workspace webhook was created.
 */
router.post("/elevenlabs/post-call", asyncHandler(async (req, res) => {
  const raw = req.rawBody ?? JSON.stringify(req.body ?? {});
  const payload = req.body ?? {};
  const agentId = payload?.data?.agent_id as string | undefined;
  const secrets = await collectWebhookSecrets(agentId);
  const header = req.header("elevenlabs-signature") ?? req.header("ElevenLabs-Signature");

  let verified = false;
  for (const s of secrets) {
    if (verifyElevenLabsSignature(header, raw, s)) {
      verified = true;
      break;
    }
  }
  if (!verified) {
    const allowUnverified = env.NODE_ENV !== "production" && process.env.WEBHOOK_ALLOW_UNVERIFIED === "true";
    if (!allowUnverified) {
      console.warn(`[webhook] rejected post-call event (type=${payload?.type}) – signature mismatch. Known secrets: ${secrets.length}`);
      return res.status(401).json({ success: false, error: { code: "INVALID_SIGNATURE", message: "Webhook signature verification failed" } });
    }
    console.warn("[webhook] accepting UNVERIFIED post-call event because WEBHOOK_ALLOW_UNVERIFIED=true");
  }

  // Ack fast, process async.
  res.status(200).json({ success: true });
  processPostCallEvent(payload).then((r) => console.log(`[webhook] processed ${r.handled} conversation=${payload?.data?.conversation_id}`)).catch((err) => console.error("[webhook] processing failed:", err));
}));

export default router;
