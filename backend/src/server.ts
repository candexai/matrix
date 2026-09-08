import { env, postCallWebhookUrl } from "./config/env";
import { connectDatabase } from "./config/db";
import { createApp } from "./app";
import { elevenlabs } from "./services/elevenlabs/client";
import { pythonService } from "./services/elevenlabs/pythonService";
import { getZohoApp } from "./services/zoho/zohoClient";
import { ensureWebhooksForAllAgents } from "./services/agent.service";
import { getPublicBackendUrl } from "./services/publicUrl.service";
import { syncConversations } from "./services/conversations.service";

async function main() {
  const db = await connectDatabase();
  const app = createApp();
  app.listen(env.PORT, async () => {
    console.log(`\n  Matrix x CandexAI backend  →  http://localhost:${env.PORT}`);
    console.log(`  Database     : ${db.mode === "atlas" ? "✓ MongoDB Atlas" : "⚠ local fallback (Atlas unreachable) – data in ~/.matrix/mongo-data"}`);
    console.log(`  ElevenLabs   : ${elevenlabs.configured ? "✓ " + env.ELEVENLABS_BASE_URL : "✗ ELEVENLABS_API_KEY missing"}`);
    console.log(`  Python svc   : ${pythonService.configured ? env.ELEVENLABS_SERVICE_URL + " (fallback to direct API when down)" : "not configured"}`);
    const zohoApp = await getZohoApp(env.DEFAULT_WORKSPACE_ID).catch(() => null);
    console.log(`  Zoho CRM     : ${zohoApp ? `✓ configured (${zohoApp.source === "db" ? "app settings in UI" : "env"}, client ${zohoApp.clientId.slice(0, 9)}…)` : "✗ add the Zoho client in Integrations → Zoho CRM → App settings"}`);
    if (zohoApp && !zohoApp.redirectUri.startsWith(env.PUBLIC_BACKEND_URL)) {
      console.warn(`  ⚠ Zoho redirect URI (${zohoApp.redirectUri}) does not point at this backend (${env.PUBLIC_BACKEND_URL}).`);
      console.warn(`    Register ${env.PUBLIC_BACKEND_URL}/api/v1/integrations/zoho/callback on the Zoho client, or use the local bridge (npm run zoho:bridge).`);
    }
    const pub = await getPublicBackendUrl();
    console.log(`  Post-call URL: ${pub ? pub + "/api/v1/webhooks/elevenlabs/post-call" : postCallWebhookUrl() + "  (no public https URL – run: ngrok http " + env.PORT + " and it will be picked up automatically)"}\n`);
    // Keep agents' post-call webhooks pointed at the current public URL (auto-detects ngrok).
    const tick = async () => {
      try {
        const r = await ensureWebhooksForAllAgents();
        if (r.updated) console.log(`[webhook] attached post-call webhook to ${r.updated} agent(s) → ${r.url}`);
      } catch (err) {
        console.warn("[webhook] ensure failed:", (err as Error).message);
      }
    };
    void tick();
    setInterval(tick, 60_000).unref();

    // Self-healing reconciliation: pull any finished conversation the webhook did not deliver
    // (runs the same post-call pipeline: lead fill, Zoho push, insights). Cheap: one list call.
    const reconcileEveryMs = Number(process.env.CONVERSATION_RECONCILE_MS || 120_000);
    if (reconcileEveryMs > 0) {
      const reconcile = async () => {
        try {
          const { Agent } = await import("./models/Agent");
          const ids = (await Agent.distinct("workspaceId")).map(String);
          for (const ws of ids.length ? ids : [env.DEFAULT_WORKSPACE_ID]) {
            const r = await syncConversations(ws, { sinceHours: 6, max: 50 });
            if (r.upserted) console.log(`[reconcile] ${ws}: pulled ${r.upserted} conversation(s) from ElevenLabs`);
          }
        } catch (err) {
          console.warn("[reconcile] failed:", (err as Error).message);
        }
      };
      setTimeout(reconcile, 15_000).unref();
      setInterval(reconcile, reconcileEveryMs).unref();
    }
  });
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
