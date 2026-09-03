import { Router } from "express";
import { z } from "zod";
import { asyncHandler, ok, HttpError } from "../utils/http";
import { env } from "../config/env";
import { ZohoIntegration } from "../models/ZohoIntegration";
import { OAuthState } from "../models/OAuthState";
import { Lead } from "../models/Lead";
import { encrypt } from "../utils/crypto";
import * as zoho from "../services/zoho/zohoClient";
import { syncZohoLeads } from "../services/zoho/zohoSync";
import { syncConversations } from "../services/conversations.service";
import { reprocessPendingExtractions } from "../services/postCall.service";
import { analyzePending } from "../services/insights.service";
import { elevenlabs } from "../services/elevenlabs/client";
import { pythonService } from "../services/elevenlabs/pythonService";

const router = Router();

/** Catalog of integrations shown on the Integrations page. Only Zoho + ElevenLabs are live in this phase. */
router.get("/", asyncHandler(async (req, res) => {
  const integ = await zoho.getIntegration(req.workspaceId);
  const leadCount = await Lead.countDocuments({ workspaceId: req.workspaceId, source: "zoho" });
  ok(res, {
    crm: [
      {
        id: "zoho",
        name: "Zoho CRM",
        category: "crm",
        available: true,
        configured: zoho.zohoConfigured(),
        connected: Boolean(integ && integ.status === "connected"),
        status: integ?.status ?? "disconnected",
        lastSyncAt: integ?.lastSyncAt ?? null,
        lastSyncStats: integ?.lastSyncStats ?? null,
        syncStatus: integ?.syncStatus ?? "idle",
        syncError: integ?.syncError ?? null,
        profile: integ?.profile ?? null,
        leadCount,
        redirectUri: env.ZOHO_REDIRECT_URI,
      },
      { id: "hubspot", name: "HubSpot", category: "crm", available: false },
      { id: "salesforce", name: "Salesforce", category: "crm", available: false },
      { id: "pipedrive", name: "Pipedrive", category: "crm", available: false },
    ],
    voice: [
      { id: "elevenlabs", name: "ElevenLabs", category: "voice", available: true, connected: elevenlabs.configured, baseUrl: env.ELEVENLABS_BASE_URL, pythonService: pythonService.configured ? env.ELEVENLABS_SERVICE_URL : null },
      { id: "twilio", name: "Twilio", category: "voice", available: false, note: "Import numbers in ElevenLabs" },
    ],
    channels: [
      { id: "website", name: "Website chat", category: "channels", available: false },
      { id: "whatsapp", name: "WhatsApp", category: "channels", available: false },
      { id: "instagram", name: "Instagram", category: "channels", available: false },
      { id: "facebook", name: "Facebook Messenger", category: "channels", available: false },
      { id: "telegram", name: "Telegram", category: "channels", available: false },
      { id: "email", name: "Email", category: "channels", available: false },
    ],
    productivity: [
      { id: "google-calendar", name: "Google Calendar", category: "productivity", available: false },
      { id: "calendly", name: "Calendly", category: "productivity", available: false },
      { id: "slack", name: "Slack", category: "productivity", available: false },
    ],
  });
}));

// ---------- Zoho ----------
router.post("/zoho/connect", asyncHandler(async (req, res) => ok(res, { authUrl: await zoho.buildAuthUrl(req.workspaceId) })));

router.get("/zoho/callback", asyncHandler(async (req, res) => {
  const q = req.query as Record<string, string>;
  const redirect = (status: string, msg?: string) => res.redirect(`${env.FRONTEND_URL}/integrations?provider=zoho&status=${status}${msg ? `&message=${encodeURIComponent(msg)}` : ""}`);
  if (q.error) return redirect("error", q.error);
  const st = q.state ? await OAuthState.findOneAndDelete({ state: q.state, provider: "zoho" }) : null;
  if (!st) return redirect("error", "Invalid or expired OAuth state. Please try connecting again.");
  if (!q.code) return redirect("error", "Missing authorization code");
  try {
    const tok = await zoho.exchangeCode(q.code, q["accounts-server"]);
    const doc = await ZohoIntegration.findOneAndUpdate(
      { workspaceId: st.workspaceId },
      {
        $set: {
          status: "connected",
          accessTokenEnc: encrypt(tok.access_token),
          ...(tok.refresh_token ? { refreshTokenEnc: encrypt(tok.refresh_token) } : {}),
          tokenExpiry: new Date(Date.now() + (tok.expires_in - 60) * 1000),
          apiDomain: tok.api_domain || "https://www.zohoapis.com",
          accountsServer: tok.accountsServer,
          scopes: zoho.ZOHO_SCOPES,
          connectedAt: new Date(),
          syncStatus: "idle",
          syncError: null,
        },
      },
      { upsert: true, new: true }
    );
    const [user, org] = await Promise.all([zoho.fetchCurrentUser(doc), zoho.fetchOrg(doc)]);
    doc.profile = { email: user?.email, fullName: user?.full_name, zuid: user?.zuid, orgName: org?.company_name, orgId: org?.id };
    await doc.save();
    zoho.fetchLeadFields(doc, true).catch(() => undefined);
    return redirect("connected");
  } catch (err) {
    const e = err as HttpError;
    return redirect("error", e.message || "Zoho connection failed");
  }
}));

router.get("/zoho/status", asyncHandler(async (req, res) => {
  const [integ, leadCount] = await Promise.all([zoho.getIntegration(req.workspaceId), Lead.countDocuments({ workspaceId: req.workspaceId, source: "zoho" })]);
  ok(res, {
    configured: zoho.zohoConfigured(),
    connected: Boolean(integ && integ.status === "connected"),
    status: integ?.status ?? "disconnected",
    profile: integ?.profile ?? null,
    apiDomain: integ?.apiDomain ?? null,
    accountsServer: integ?.accountsServer ?? null,
    scopes: integ?.scopes ?? [],
    connectedAt: integ?.connectedAt ?? null,
    tokenExpiry: integ?.tokenExpiry ?? null,
    lastSyncAt: integ?.lastSyncAt ?? null,
    lastSyncStats: integ?.lastSyncStats ?? null,
    syncStatus: integ?.syncStatus ?? "idle",
    syncError: integ?.syncError ?? null,
    leadCount,
    redirectUri: env.ZOHO_REDIRECT_URI,
    accountsUrl: env.ZOHO_ACCOUNTS_URL,
  });
}));

router.post("/zoho/sync", asyncHandler(async (req, res) => {
  const { full } = z.object({ full: z.boolean().optional() }).parse(req.body ?? {});
  const integ = await zoho.requireIntegration(req.workspaceId);
  if (integ.syncStatus === "running" && integ.updatedAt && Date.now() - integ.updatedAt.getTime() < 10 * 60_000) {
    throw new HttpError(409, "A sync is already running", "SYNC_RUNNING");
  }
  const stats = await syncZohoLeads(req.workspaceId, integ, { full });
  // Catch up on finished calls too, so extracted values reach the leads (and Zoho) even when the
  // post-call webhook could not reach this server.
  let calls: { upserted: number; processed: number } | undefined;
  try {
    const c = await syncConversations(req.workspaceId, { sinceHours: 72, max: 100 });
    const p = await reprocessPendingExtractions(req.workspaceId, { sinceHours: 72 });
    await analyzePending(req.workspaceId, { sinceDays: 3, max: 30 }).catch((e) => console.warn("[insights] catch-up:", (e as Error).message));
    calls = { upserted: c.upserted, processed: p.processed };
  } catch (err) {
    console.warn("[zoho sync] call catch-up skipped:", (err as Error).message);
  }
  ok(res, { ...stats, calls });
}));

router.get("/zoho/fields", asyncHandler(async (req, res) => {
  const integ = await zoho.requireIntegration(req.workspaceId);
  const fields = await zoho.fetchLeadFields(integ, req.query.refresh === "1");
  ok(res, fields);
}));

router.delete("/zoho/disconnect", asyncHandler(async (req, res) => {
  const integ = await zoho.getIntegration(req.workspaceId);
  if (integ) {
    await zoho.revokeToken(integ);
    integ.status = "revoked";
    await integ.save();
  }
  ok(res, { disconnected: true });
}));

export default router;
