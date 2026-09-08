import { Agent, AgentDoc, AgentFormConfig } from "../models/Agent";
import { getWorkspaceSettings } from "../models/WorkspaceSettings";
import type { ElevenLabsClient, RemoteAgent } from "./elevenlabs/client";
import { findElevenClient, getElevenClient, isElevenNotConfigured } from "./elevenlabs/registry";
import { pythonService } from "./elevenlabs/pythonService";
import { buildConversationConfig, buildPlatformSettings, formFromRemote, withDefaults, KnowledgeLookup } from "./elevenlabs/configBuilder";
import { ttsModelSupportsLanguage } from "../constants/catalog";
import { encrypt } from "../utils/crypto";
import { HttpError, upstreamMessage } from "../utils/http";
import { env, postCallWebhookUrl } from "../config/env";
import { getPostCallWebhookUrl, getPublicBackendUrlSync } from "./publicUrl.service";

export interface AgentInput {
  name: string;
  description?: string;
  config: Partial<AgentFormConfig>;
}

/** Names/types of the knowledge-base docs an agent references (ElevenLabs needs both in the locator). */
async function knowledgeLookup(client: ElevenLabsClient, ids: string[]): Promise<KnowledgeLookup> {
  const map: KnowledgeLookup = new Map();
  if (!ids?.length) return map;
  try {
    for (const d of await client.listKnowledgeBase()) map.set(d.id, { name: d.name, type: d.type });
  } catch (err) {
    console.warn("[agents] knowledge base lookup failed:", upstreamMessage(err));
  }
  return map;
}

function validateConfig(cfg: AgentFormConfig) {
  if (!cfg.voice_id) throw new HttpError(400, "Pick a voice for the agent", "VALIDATION_ERROR");
  if (!cfg.system_prompt?.trim()) throw new HttpError(400, "System prompt is required", "VALIDATION_ERROR");
  if (!cfg.llm) throw new HttpError(400, "Select an LLM model", "VALIDATION_ERROR");
  if (!ttsModelSupportsLanguage(cfg.tts_model_id, cfg.language)) {
    throw new HttpError(400, `TTS model ${cfg.tts_model_id} does not support language "${cfg.language}"`, "VALIDATION_ERROR");
  }
  if (cfg.enable_human_transfer && !cfg.human_transfer_rules.length) {
    throw new HttpError(400, "Add at least one transfer rule or disable human transfer", "VALIDATION_ERROR");
  }
}

const webhookName = (workspaceId: string) => `Matrix post-call (${workspaceId})`;

// Remember (per workspace, 10 min) that the stored webhook still exists in the ElevenLabs account,
// so the periodic ensure loop does not list webhooks on every tick.
const webhookVerified = new Map<string, { webhookId: string; at: number }>();
const WEBHOOK_VERIFY_TTL_MS = 10 * 60_000;

async function storedWebhookStillExists(client: ElevenLabsClient, workspaceId: string, webhookId: string): Promise<boolean> {
  const v = webhookVerified.get(workspaceId);
  if (v && v.webhookId === webhookId && Date.now() - v.at < WEBHOOK_VERIFY_TTL_MS) return true;
  try {
    const exists = (await client.listWebhooks()).some((w) => w.webhook_id === webhookId);
    if (exists) webhookVerified.set(workspaceId, { webhookId, at: Date.now() });
    return exists;
  } catch (err) {
    // Cannot list (permissions / transient error): keep trusting what we stored.
    console.warn(`[webhook] could not verify webhook ${webhookId} for ${workspaceId}:`, upstreamMessage(err));
    return true;
  }
}

/**
 * Make sure the workspace has an HMAC post-call webhook registered in ITS ElevenLabs account whose
 * secret we know. The secret is only returned at creation time, so we always create our own and
 * remember it; the webhook is named per workspace so two Matrix workspaces sharing one ElevenLabs
 * account never collide. Throws 409 ELEVENLABS_NOT_CONFIGURED when the workspace has no key.
 */
export async function ensureWorkspaceWebhook(workspaceId: string): Promise<{ webhookId: string; url: string } | null> {
  const client = await getElevenClient(workspaceId);
  const url = await getPostCallWebhookUrl();
  if (!url) {
    console.warn(`[webhook] no public https URL (set PUBLIC_BACKEND_URL or run "ngrok http ${env.PORT}"); ElevenLabs requires https – skipping post-call webhook registration.`);
    return null;
  }
  const settings = await getWorkspaceSettings(workspaceId);
  const stored = settings.elevenWebhook;
  if (stored?.webhookId && stored.url === url && stored.secretEnc && (await storedWebhookStillExists(client, workspaceId, stored.webhookId))) {
    return { webhookId: stored.webhookId, url };
  }
  // ElevenLabs allows one webhook per URL; use a per-workspace cache-buster so we always own the secret.
  const uniqueUrl = `${url}?ws=${encodeURIComponent(workspaceId)}&v=${Date.now().toString(36)}`;
  const created = await client.createHmacWebhook(webhookName(workspaceId), uniqueUrl);
  settings.elevenWebhook = {
    webhookId: created.webhook_id,
    url,
    secretEnc: created.webhook_secret ? encrypt(created.webhook_secret) : undefined,
    events: ["transcript"],
    createdAt: new Date(),
  };
  await settings.save();
  webhookVerified.set(workspaceId, { webhookId: created.webhook_id, at: Date.now() });
  return { webhookId: created.webhook_id, url };
}

/** Agents of the workspace. Requires a connected ElevenLabs account (409 otherwise) so the UI can prompt to connect first. */
export async function listAgents(workspaceId: string): Promise<AgentDoc[]> {
  await getElevenClient(workspaceId);
  return Agent.find({ workspaceId }).sort({ createdAt: -1 });
}

export async function getAgent(workspaceId: string, id: string): Promise<AgentDoc> {
  const doc = await Agent.findOne({ workspaceId, $or: [{ _id: id.match(/^[a-f0-9]{24}$/) ? id : undefined }, { elevenAgentId: id }].filter((x) => Object.values(x)[0] !== undefined) });
  if (!doc) throw new HttpError(404, "Agent not found", "AGENT_NOT_FOUND");
  return doc;
}

/** The FastAPI wrapper holds its own copy of the env key, so it can only act for the env-backed (legacy) workspace. */
async function usePythonService(client: ElevenLabsClient): Promise<boolean> {
  return client.source === "env" && pythonService.configured && (await pythonService.isReachable());
}

async function providerCreate(client: ElevenLabsClient, name: string, conversation_config: Record<string, unknown>, platform_settings: Record<string, unknown>): Promise<{ agentId: string; provider: string }> {
  if (await usePythonService(client)) {
    try {
      const { agent_id } = await pythonService.createAgent({ name, conversation_config });
      // The FastAPI wrapper only forwards name + conversation_config; apply platform settings (data collection, webhook, limits) directly.
      await client.patchAgent(agent_id, { platform_settings });
      return { agentId: agent_id, provider: "python-service" };
    } catch (err) {
      console.warn("[agents] python service create failed, falling back to direct ElevenLabs:", upstreamMessage(err));
    }
  }
  const { agent_id } = await client.createAgent({ name, conversation_config, platform_settings });
  return { agentId: agent_id, provider: "direct" };
}

async function providerUpdate(client: ElevenLabsClient, agentId: string, name: string, conversation_config: Record<string, unknown>, platform_settings: Record<string, unknown>): Promise<string> {
  if (await usePythonService(client)) {
    try {
      await pythonService.updateAgent(agentId, { name, conversation_config });
      await client.patchAgent(agentId, { platform_settings });
      return "python-service";
    } catch (err) {
      console.warn("[agents] python service update failed, falling back to direct ElevenLabs:", upstreamMessage(err));
    }
  }
  await client.patchAgent(agentId, { name, conversation_config, platform_settings });
  return "direct";
}

export async function createAgent(workspaceId: string, input: AgentInput): Promise<AgentDoc> {
  const cfg = withDefaults(input.config);
  validateConfig(cfg);
  if (!input.name?.trim()) throw new HttpError(400, "Agent name is required", "VALIDATION_ERROR");
  const client = await getElevenClient(workspaceId);

  const webhook = cfg.post_call_webhook_enabled ? await ensureWorkspaceWebhook(workspaceId) : null;
  const conversation_config = buildConversationConfig(cfg, "create", await knowledgeLookup(client, cfg.knowledge_base_ids));
  const platform_settings = buildPlatformSettings(cfg, webhook ? { webhookId: webhook.webhookId, events: cfg.post_call_webhook_events } : null);

  const { agentId, provider } = await providerCreate(client, input.name.trim(), conversation_config, platform_settings);
  const remote = await client.getAgent(agentId).catch(() => null);
  const settings = await getWorkspaceSettings(workspaceId);

  const doc = await Agent.create({
    workspaceId,
    elevenAgentId: agentId,
    name: input.name.trim(),
    description: input.description,
    config: remote ? formFromRemote(remote, cfg) : cfg,
    postCallWebhook: webhook
      ? { webhookId: webhook.webhookId, url: webhook.url, events: cfg.post_call_webhook_events, secretEnc: settings.elevenWebhook?.secretEnc }
      : undefined,
    lastProvider: provider,
    remoteSnapshot: (remote as unknown as Record<string, unknown>) ?? undefined,
    lastSyncedAt: remote ? new Date() : undefined,
  });
  return doc;
}

export async function updateAgent(workspaceId: string, id: string, input: Partial<AgentInput>): Promise<AgentDoc> {
  const doc = await getAgent(workspaceId, id);
  const cfg = withDefaults({ ...doc.config, ...(input.config ?? {}) });
  validateConfig(cfg);
  const name = input.name?.trim() || doc.name;
  const client = await getElevenClient(workspaceId);

  const webhook = cfg.post_call_webhook_enabled ? await ensureWorkspaceWebhook(workspaceId) : null;
  const conversation_config = buildConversationConfig(cfg, "update", await knowledgeLookup(client, cfg.knowledge_base_ids));
  const platform_settings = buildPlatformSettings(cfg, webhook ? { webhookId: webhook.webhookId, events: cfg.post_call_webhook_events } : null);
  if (!webhook) platform_settings.workspace_overrides = { webhooks: { post_call_webhook_id: null, events: [] } };

  const provider = await providerUpdate(client, doc.elevenAgentId, name, conversation_config, platform_settings);
  const remote = await client.getAgent(doc.elevenAgentId).catch(() => null);
  const settings = await getWorkspaceSettings(workspaceId);

  doc.name = name;
  if (input.description !== undefined) doc.description = input.description;
  doc.config = remote ? formFromRemote(remote, cfg) : cfg;
  doc.markModified("config");
  doc.postCallWebhook = webhook ? { webhookId: webhook.webhookId, url: webhook.url, events: cfg.post_call_webhook_events, secretEnc: settings.elevenWebhook?.secretEnc } : undefined;
  doc.lastProvider = provider;
  if (remote) {
    doc.remoteSnapshot = remote as unknown as Record<string, unknown>;
    doc.lastSyncedAt = new Date();
  }
  await doc.save();
  return doc;
}

export async function deleteAgent(workspaceId: string, id: string, opts: { remote?: boolean } = { remote: true }): Promise<void> {
  const doc = await getAgent(workspaceId, id);
  if (opts.remote !== false) {
    const client = await getElevenClient(workspaceId);
    try {
      await client.deleteAgent(doc.elevenAgentId);
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status !== 404) throw err;
    }
  }
  await doc.deleteOne();
}

export async function syncAgentFromRemote(workspaceId: string, id: string): Promise<AgentDoc> {
  const doc = await getAgent(workspaceId, id);
  const client = await getElevenClient(workspaceId);
  const remote = await client.getAgent(doc.elevenAgentId);
  doc.name = remote.name || doc.name;
  doc.config = formFromRemote(remote, doc.config);
  doc.markModified("config");
  doc.remoteSnapshot = remote as unknown as Record<string, unknown>;
  doc.lastSyncedAt = new Date();
  await doc.save();
  return doc;
}

export async function listRemoteAgents(workspaceId: string): Promise<{ agent_id: string; name: string; created_at_unix_secs?: number; imported: boolean }[]> {
  const client = await getElevenClient(workspaceId);
  const { agents } = await client.listAgents(100);
  const known = new Set((await Agent.find({ workspaceId }, { elevenAgentId: 1 })).map((a) => a.elevenAgentId));
  return agents.map((a) => ({ agent_id: a.agent_id, name: a.name, created_at_unix_secs: a.created_at_unix_secs, imported: known.has(a.agent_id) }));
}

export async function importRemoteAgent(workspaceId: string, elevenAgentId: string): Promise<AgentDoc> {
  const existing = await Agent.findOne({ elevenAgentId });
  if (existing) {
    if (existing.workspaceId === workspaceId) return existing;
    // elevenAgentId is unique across Matrix: an agent can be linked to one workspace only.
    throw new HttpError(409, "This ElevenLabs agent is already linked to another Matrix workspace", "AGENT_ALREADY_LINKED");
  }
  const client = await getElevenClient(workspaceId);
  const remote: RemoteAgent = await client.getAgent(elevenAgentId);
  const cfg = formFromRemote(remote);
  const settings = await getWorkspaceSettings(workspaceId);
  const remoteWebhookId = remote.platform_settings?.workspace_overrides?.webhooks?.post_call_webhook_id;
  return Agent.create({
    workspaceId,
    elevenAgentId,
    name: remote.name || elevenAgentId,
    config: cfg,
    remoteSnapshot: remote as unknown as Record<string, unknown>,
    lastSyncedAt: new Date(),
    lastProvider: "import",
    postCallWebhook:
      remoteWebhookId && settings.elevenWebhook?.webhookId === remoteWebhookId
        ? { webhookId: remoteWebhookId, url: settings.elevenWebhook?.url, events: cfg.post_call_webhook_events, secretEnc: settings.elevenWebhook?.secretEnc }
        : undefined,
  });
}

export async function getSignedUrl(workspaceId: string, id: string): Promise<{ signed_url: string; agent_id: string }> {
  const doc = await getAgent(workspaceId, id);
  const client = await getElevenClient(workspaceId);
  const { signed_url } = await client.getSignedUrl(doc.elevenAgentId);
  return { signed_url, agent_id: doc.elevenAgentId };
}

export async function describeProviders(workspaceId: string) {
  const pub = getPublicBackendUrlSync();
  const client = await findElevenClient(workspaceId);
  return {
    direct: { configured: Boolean(client), source: client?.source ?? null, baseUrl: client?.baseUrl ?? null },
    // The FastAPI wrapper carries its own copy of the env key, so it only serves the env-backed (legacy) workspace.
    pythonService: { configured: pythonService.configured && client?.source === "env", url: pythonService.configured ? env.ELEVENLABS_SERVICE_URL || null : null },
    postCallWebhookUrl: pub ? `${pub}/api/v1/webhooks/elevenlabs/post-call` : postCallWebhookUrl(),
    publicUrlSource: /^https:/i.test(env.PUBLIC_BACKEND_URL) ? "env" : pub ? "ngrok" : "none",
  };
}

/**
 * Make sure every agent points at the current post-call webhook. Runs at startup and periodically,
 * so starting `ngrok http <port>` is enough to get transcripts delivered.
 * Without a workspaceId it walks every workspace that owns agents and silently skips the ones that
 * have not connected ElevenLabs; for a specific workspace the 409 propagates to the caller.
 */
export async function ensureWebhooksForAllAgents(workspaceId?: string): Promise<{ url: string | null; updated: number }> {
  if (!workspaceId) {
    const ids = (await Agent.distinct("workspaceId")).map(String);
    let url: string | null = null;
    let updated = 0;
    for (const id of ids.length ? ids : [env.DEFAULT_WORKSPACE_ID]) {
      try {
        const r = await ensureWebhooksForAllAgents(id);
        url = r.url ?? url;
        updated += r.updated;
      } catch (err) {
        if (isElevenNotConfigured(err)) continue;
        console.warn(`[webhook] ensure failed for workspace ${id}:`, upstreamMessage(err));
      }
    }
    return { url, updated };
  }
  const client = await getElevenClient(workspaceId);
  const webhook = await ensureWorkspaceWebhook(workspaceId);
  if (!webhook) return { url: null, updated: 0 };
  const settings = await getWorkspaceSettings(workspaceId);
  const agents = await Agent.find({ workspaceId });
  let updated = 0;
  for (const doc of agents) {
    if (doc.config?.post_call_webhook_enabled === false) continue;
    if (doc.postCallWebhook?.webhookId === webhook.webhookId && doc.postCallWebhook?.url === webhook.url) continue;
    try {
      const events = doc.config?.post_call_webhook_events?.length ? doc.config.post_call_webhook_events : ["transcript"];
      await client.patchAgent(doc.elevenAgentId, { platform_settings: { workspace_overrides: { webhooks: { post_call_webhook_id: webhook.webhookId, events } } } });
      doc.postCallWebhook = { webhookId: webhook.webhookId, url: webhook.url, events, secretEnc: settings.elevenWebhook?.secretEnc };
      await doc.save();
      updated++;
      console.log(`[webhook] agent "${doc.name}" now delivers post-call events to ${webhook.url}`);
    } catch (err) {
      console.warn(`[webhook] could not attach webhook to agent ${doc.name}:`, upstreamMessage(err));
    }
  }
  return { url: webhook.url, updated };
}
