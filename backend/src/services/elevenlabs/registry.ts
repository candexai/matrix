/**
 * Per-workspace ElevenLabs credentials.
 *
 * Every workspace connects its own ElevenLabs API key (Integrations → ElevenLabs); the key is stored
 * encrypted on WorkspaceSettings.elevenLabs. The ONLY fallback to ELEVENLABS_API_KEY from env is the
 * legacy bootstrap workspace (`env.DEFAULT_WORKSPACE_ID`) — every other workspace without a stored
 * key gets a 409 ELEVENLABS_NOT_CONFIGURED so no account can ever see another account's agents,
 * numbers, voices, tools, knowledge base, conversations or usage.
 */
import { env } from "../../config/env";
import { HttpError, upstreamMessage } from "../../utils/http";
import { encrypt, decrypt } from "../../utils/crypto";
import { WorkspaceSettings, getWorkspaceSettings } from "../../models/WorkspaceSettings";
import { ElevenLabsClient, ElevenCredentialSource } from "./client";

export const ELEVEN_BASE_URLS = {
  us: "https://api.elevenlabs.io",
  eu: "https://api.eu.residency.elevenlabs.io",
} as const;
export type ElevenRegion = keyof typeof ELEVEN_BASE_URLS;

export const ELEVENLABS_NOT_CONFIGURED = "ELEVENLABS_NOT_CONFIGURED";
export const ELEVENLABS_INVALID_KEY = "ELEVENLABS_INVALID_KEY";

export interface ElevenStatus {
  configured: boolean;
  source: ElevenCredentialSource | null;
  keyHint: string | null;
  baseUrl: string | null;
  region: ElevenRegion | null;
  connectedAt: string | null;
  account: { name?: string; tier?: string; characterCount?: number; characterLimit?: number } | null;
}

export function notConfiguredError(): HttpError {
  return new HttpError(409, "Connect your ElevenLabs account in Integrations → ElevenLabs", ELEVENLABS_NOT_CONFIGURED);
}

/** True for the error thrown when a workspace has no ElevenLabs credentials (so loops can skip it silently). */
export function isElevenNotConfigured(err: unknown): boolean {
  return err instanceof HttpError && err.code === ELEVENLABS_NOT_CONFIGURED;
}

export function regionOf(baseUrl: string | null | undefined): ElevenRegion | null {
  if (!baseUrl) return null;
  return baseUrl.includes("api.eu.residency.elevenlabs.io") ? "eu" : "us";
}

export function keyHint(apiKey: string): string {
  return `${apiKey.slice(0, 6)}…${apiKey.slice(-4)}`;
}

/** Whether the legacy env key (serves only the "default" workspace) is present. */
export function envElevenConfigured(): boolean {
  return Boolean(env.ELEVENLABS_API_KEY);
}

// ---------- in-memory client cache (per workspace, invalidated by connect/disconnect, TTL as a safety net) ----------
const CACHE_TTL_MS = 5 * 60_000;
const cache = new Map<string, { client: ElevenLabsClient; at: number }>();

export function invalidateElevenClient(workspaceId: string) {
  cache.delete(workspaceId);
}

interface Resolved {
  client: ElevenLabsClient;
  apiKey: string;
  keyHint: string;
  connectedAt: Date | null;
  accountName?: string;
}

async function resolveCredentials(workspaceId: string): Promise<Resolved | null> {
  const settings = await WorkspaceSettings.findOne({ workspaceId }, { elevenLabs: 1 });
  const stored = settings?.elevenLabs;
  if (stored?.apiKeyEnc) {
    try {
      const apiKey = decrypt(stored.apiKeyEnc);
      if (apiKey) {
        return {
          client: new ElevenLabsClient({ apiKey, baseUrl: stored.baseUrl || ELEVEN_BASE_URLS.us, source: "workspace" }),
          apiKey,
          keyHint: stored.keyHint || keyHint(apiKey),
          connectedAt: stored.connectedAt ?? null,
          accountName: stored.accountName,
        };
      }
    } catch (err) {
      console.warn(`[elevenlabs] could not decrypt the stored key of workspace ${workspaceId} (ENCRYPTION_KEY changed?): ${(err as Error).message}`);
    }
  }
  if (workspaceId === env.DEFAULT_WORKSPACE_ID && env.ELEVENLABS_API_KEY) {
    return {
      client: new ElevenLabsClient({ apiKey: env.ELEVENLABS_API_KEY, baseUrl: env.ELEVENLABS_BASE_URL, source: "env" }),
      apiKey: env.ELEVENLABS_API_KEY,
      keyHint: keyHint(env.ELEVENLABS_API_KEY),
      connectedAt: null,
    };
  }
  return null;
}

/** The workspace's ElevenLabs client, or null when it has no credentials (never throws for that). */
export async function findElevenClient(workspaceId: string): Promise<ElevenLabsClient | null> {
  const hit = cache.get(workspaceId);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.client;
  const resolved = await resolveCredentials(workspaceId);
  if (!resolved) {
    cache.delete(workspaceId);
    return null;
  }
  cache.set(workspaceId, { client: resolved.client, at: Date.now() });
  return resolved.client;
}

/** The workspace's ElevenLabs client. Throws 409 ELEVENLABS_NOT_CONFIGURED when the workspace has not connected a key. */
export async function getElevenClient(workspaceId: string): Promise<ElevenLabsClient> {
  const client = await findElevenClient(workspaceId);
  if (!client) throw notConfiguredError();
  return client;
}

// ---------- status / connect / disconnect ----------
const PROBE_TIMEOUT_MS = 6000;

async function probeAccount(client: ElevenLabsClient, fallbackName?: string): Promise<ElevenStatus["account"]> {
  try {
    const [sub, user] = await Promise.all([client.getSubscription({ timeoutMs: PROBE_TIMEOUT_MS }), client.getUser({ timeoutMs: PROBE_TIMEOUT_MS }).catch(() => null)]);
    return {
      name: (typeof user?.first_name === "string" && user.first_name.trim()) || fallbackName || undefined,
      tier: sub?.tier,
      characterCount: sub?.character_count,
      characterLimit: sub?.character_limit,
    };
  } catch {
    return null;
  }
}

/**
 * Status of the workspace's ElevenLabs connection. With `probe` (default) the account (name, tier,
 * character usage) is fetched with a short timeout; failures leave `account` null.
 */
export async function elevenStatus(workspaceId: string, opts: { probe?: boolean } = {}): Promise<ElevenStatus> {
  const resolved = await resolveCredentials(workspaceId);
  if (!resolved) return { configured: false, source: null, keyHint: null, baseUrl: null, region: null, connectedAt: null, account: null };
  const { client } = resolved;
  return {
    configured: true,
    source: client.source,
    keyHint: resolved.keyHint,
    baseUrl: client.baseUrl,
    region: regionOf(client.baseUrl),
    connectedAt: resolved.connectedAt ? resolved.connectedAt.toISOString() : null,
    account: opts.probe === false ? (resolved.accountName ? { name: resolved.accountName } : null) : await probeAccount(client, resolved.accountName),
  };
}

/**
 * Validate an API key against ElevenLabs and store it (encrypted) for the workspace.
 * A key that changes the effective account also drops the stored post-call webhook, which belonged
 * to the previous account; ensureWorkspaceWebhook() re-creates it in the new one.
 */
export async function connectEleven(workspaceId: string, input: { apiKey: string; region?: ElevenRegion }): Promise<ElevenStatus> {
  const apiKey = (input.apiKey ?? "").trim();
  if (apiKey.length < 10) throw new HttpError(400, "Paste a valid ElevenLabs API key", ELEVENLABS_INVALID_KEY);
  const region: ElevenRegion = input.region === "eu" ? "eu" : "us";
  const baseUrl = ELEVEN_BASE_URLS[region];
  const candidate = new ElevenLabsClient({ apiKey, baseUrl, source: "workspace" });

  let accountName: string | undefined;
  try {
    const user = await candidate.getUser({ timeoutMs: 15000 });
    accountName = typeof user?.first_name === "string" && user.first_name.trim() ? user.first_name.trim() : undefined;
  } catch (err) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status === 401 || status === 403) {
      throw new HttpError(400, `ElevenLabs rejected this API key for the ${region.toUpperCase()} region. Check the key (Profile → API keys) and that the region matches your account (EU data residency keys only work with region "eu").`, ELEVENLABS_INVALID_KEY);
    }
    throw new HttpError(400, `Could not verify the key with ElevenLabs (${baseUrl}): ${upstreamMessage(err)}`, ELEVENLABS_INVALID_KEY);
  }

  const previous = await resolveCredentials(workspaceId);
  const settings = await getWorkspaceSettings(workspaceId);
  settings.elevenLabs = { apiKeyEnc: encrypt(apiKey), baseUrl, keyHint: keyHint(apiKey), connectedAt: new Date(), accountName };
  if (settings.elevenWebhook && !(previous && previous.apiKey === apiKey)) {
    // The stored webhook (and its HMAC secret) lives in the previous ElevenLabs account.
    settings.elevenWebhook = undefined;
  }
  await settings.save();
  invalidateElevenClient(workspaceId);
  return elevenStatus(workspaceId);
}

/** Remove the workspace's stored key. The legacy "default" workspace then falls back to the env key (source "env"). */
export async function disconnectEleven(workspaceId: string): Promise<ElevenStatus> {
  const settings = await WorkspaceSettings.findOne({ workspaceId });
  if (settings?.elevenLabs) {
    let removedKey: string | null = null;
    try {
      removedKey = decrypt(settings.elevenLabs.apiKeyEnc);
    } catch {
      removedKey = null;
    }
    settings.elevenLabs = undefined;
    const fallsBackToSameKey = workspaceId === env.DEFAULT_WORKSPACE_ID && Boolean(env.ELEVENLABS_API_KEY) && removedKey === env.ELEVENLABS_API_KEY;
    if (settings.elevenWebhook && !fallsBackToSameKey) settings.elevenWebhook = undefined;
    await settings.save();
  }
  invalidateElevenClient(workspaceId);
  return elevenStatus(workspaceId);
}
