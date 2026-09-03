import { env, postCallWebhookUrl } from "./config/env";
import { connectDatabase } from "./config/db";
import { createApp } from "./app";
import { elevenlabs } from "./services/elevenlabs/client";
import { pythonService } from "./services/elevenlabs/pythonService";
import { zohoConfigured } from "./services/zoho/zohoClient";
import { ensureWebhooksForAllAgents } from "./services/agent.service";
import { getPublicBackendUrl } from "./services/publicUrl.service";

async function main() {
  const db = await connectDatabase();
  const app = createApp();
  app.listen(env.PORT, async () => {
    console.log(`\n  Matrix x CandexAI backend  →  http://localhost:${env.PORT}`);
    console.log(`  Database     : ${db.mode === "atlas" ? "✓ MongoDB Atlas" : "⚠ local fallback (Atlas unreachable) – data in ~/.matrix/mongo-data"}`);
    console.log(`  ElevenLabs   : ${elevenlabs.configured ? "✓ " + env.ELEVENLABS_BASE_URL : "✗ ELEVENLABS_API_KEY missing"}`);
    console.log(`  Python svc   : ${pythonService.configured ? env.ELEVENLABS_SERVICE_URL + " (fallback to direct API when down)" : "not configured"}`);
    console.log(`  Zoho CRM     : ${zohoConfigured() ? "✓ configured" : "✗ set ZOHO_CLIENT_ID / ZOHO_CLIENT_SECRET"}`);
    if (zohoConfigured() && !env.ZOHO_REDIRECT_URI.startsWith(env.PUBLIC_BACKEND_URL)) {
      console.warn(`  ⚠ ZOHO_REDIRECT_URI (${env.ZOHO_REDIRECT_URI}) does not point at this backend (${env.PUBLIC_BACKEND_URL}).`);
      console.warn(`    Zoho will send the OAuth callback elsewhere. Register ${env.PUBLIC_BACKEND_URL}/api/v1/integrations/zoho/callback in the Zoho API console and set ZOHO_REDIRECT_URI to it.`);
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
  });
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
