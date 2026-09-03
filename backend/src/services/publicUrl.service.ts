/**
 * Resolves the public https URL of this backend. Uses PUBLIC_BACKEND_URL when it is https;
 * otherwise auto-detects a local ngrok tunnel (http://127.0.0.1:4040/api/tunnels) pointing at our port.
 */
import axios from "axios";
import { env } from "../config/env";

let cached: { url: string | null; at: number } = { url: null, at: 0 };
const TTL_MS = 30_000;

export function isHttps(u: string | null | undefined): boolean {
  return Boolean(u && /^https:\/\//i.test(u));
}

async function detectNgrok(): Promise<string | null> {
  try {
    const { data } = await axios.get("http://127.0.0.1:4040/api/tunnels", { timeout: 1500 });
    const tunnels: { public_url: string; proto: string; config?: { addr?: string } }[] = data?.tunnels ?? [];
    const mine = tunnels.filter((t) => t.proto === "https" && (t.config?.addr ?? "").replace(/^https?:\/\//, "").endsWith(`:${env.PORT}`));
    const any = tunnels.filter((t) => t.proto === "https");
    const pick = mine[0] ?? any[0];
    return pick ? pick.public_url.replace(/\/$/, "") : null;
  } catch {
    return null;
  }
}

/** Public https base URL, or null when none is available (webhooks cannot be delivered). */
export async function getPublicBackendUrl(): Promise<string | null> {
  if (isHttps(env.PUBLIC_BACKEND_URL)) return env.PUBLIC_BACKEND_URL;
  if (Date.now() - cached.at < TTL_MS) return cached.url;
  const url = await detectNgrok();
  cached = { url, at: Date.now() };
  return url;
}

export function getPublicBackendUrlSync(): string | null {
  return isHttps(env.PUBLIC_BACKEND_URL) ? env.PUBLIC_BACKEND_URL : cached.url;
}

export async function getPostCallWebhookUrl(): Promise<string | null> {
  const base = await getPublicBackendUrl();
  return base ? `${base}/api/v1/webhooks/elevenlabs/post-call` : null;
}
