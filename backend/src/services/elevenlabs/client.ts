/**
 * Direct ElevenLabs REST client (Conversational AI + voices + workspace webhooks).
 * Base URL honours EU data residency via ELEVENLABS_BASE_URL.
 */
import axios, { AxiosInstance } from "axios";
import { env } from "../../config/env";
import { HttpError } from "../../utils/http";

export interface ElevenVoice {
  voice_id: string;
  name: string;
  category?: string;
  description?: string;
  preview_url?: string;
  labels?: Record<string, string>;
  verified_languages?: { language: string; model_id?: string; accent?: string; locale?: string }[];
}

export interface ElevenPhoneNumber {
  phone_number_id: string;
  phone_number: string;
  label?: string;
  provider?: "twilio" | "sip_trunk" | "exotel" | string;
  supports_inbound?: boolean;
  supports_outbound?: boolean;
  assigned_agent?: { agent_id: string; agent_name: string } | null;
}

export interface RemoteAgent {
  agent_id: string;
  name: string;
  conversation_config: Record<string, any>;
  platform_settings?: Record<string, any>;
  metadata?: { created_at_unix_secs?: number };
  phone_numbers?: ElevenPhoneNumber[];
  tags?: string[];
}

export interface RemoteConversationSummary {
  agent_id: string;
  agent_name?: string;
  conversation_id: string;
  start_time_unix_secs: number;
  call_duration_secs: number;
  message_count: number;
  status: string;
  termination_reason?: string;
  call_successful?: "success" | "failure" | "unknown";
  transcript_summary?: string;
  call_summary_title?: string;
  direction?: "inbound" | "outbound" | null;
}

export interface RemoteConversation {
  agent_id: string;
  agent_name?: string;
  conversation_id: string;
  status: string;
  transcript: { role: string; message?: string | null; time_in_call_secs?: number; tool_calls?: unknown[] }[];
  metadata: {
    start_time_unix_secs?: number;
    call_duration_secs?: number;
    termination_reason?: string;
    phone_call?: { direction?: string; external_number?: string; agent_number?: string; call_sid?: string; phone_number_id?: string; type?: string } | null;
    batch_call?: { batch_call_id?: string } | null;
    main_language?: string;
    error?: unknown;
  };
  analysis?: {
    transcript_summary?: string;
    call_summary_title?: string;
    call_successful?: "success" | "failure" | "unknown";
    data_collection_results?: Record<string, { value: unknown; rationale?: string; data_collection_id?: string }>;
    evaluation_criteria_results?: Record<string, { result: string; rationale?: string; criteria_id?: string }>;
  } | null;
  conversation_initiation_client_data?: { dynamic_variables?: Record<string, unknown> } | null;
  has_audio?: boolean;
}

export interface ElevenTool {
  id: string;
  tool_config: {
    type: string;
    name: string;
    description: string;
    response_timeout_secs?: number;
    api_schema?: { url: string; method?: string; request_headers?: Record<string, string>; query_params_schema?: unknown; request_body_schema?: unknown; path_params_schema?: unknown };
    [k: string]: unknown;
  };
  access_info?: unknown;
  usage_stats?: unknown;
}

export interface ElevenKnowledgeDoc {
  id: string;
  name: string;
  type: "file" | "url" | "text" | "folder" | string;
  metadata?: { created_at_unix_secs?: number; last_updated_at_unix_secs?: number; size_bytes?: number };
  url?: string;
  dependent_agents?: unknown[];
}

class ElevenLabsClient {
  private http: AxiosInstance;

  constructor() {
    this.http = axios.create({
      baseURL: env.ELEVENLABS_BASE_URL,
      timeout: 45000,
      headers: { "xi-api-key": env.ELEVENLABS_API_KEY, "Content-Type": "application/json" },
    });
  }

  get configured(): boolean {
    return Boolean(env.ELEVENLABS_API_KEY);
  }

  private assertConfigured() {
    if (!this.configured) throw new HttpError(500, "ELEVENLABS_API_KEY is not configured", "ELEVENLABS_NOT_CONFIGURED");
  }

  // ---------- Agents ----------
  async createAgent(body: { name: string; conversation_config: Record<string, unknown>; platform_settings?: Record<string, unknown>; tags?: string[] }): Promise<{ agent_id: string }> {
    this.assertConfigured();
    const { data } = await this.http.post("/v1/convai/agents/create", body);
    return data;
  }

  async getAgent(agentId: string): Promise<RemoteAgent> {
    this.assertConfigured();
    const { data } = await this.http.get(`/v1/convai/agents/${encodeURIComponent(agentId)}`);
    return data;
  }

  async patchAgent(agentId: string, body: { name?: string; conversation_config?: Record<string, unknown>; platform_settings?: Record<string, unknown>; tags?: string[] }): Promise<RemoteAgent> {
    this.assertConfigured();
    const { data } = await this.http.patch(`/v1/convai/agents/${encodeURIComponent(agentId)}`, body);
    return data;
  }

  async deleteAgent(agentId: string): Promise<void> {
    this.assertConfigured();
    await this.http.delete(`/v1/convai/agents/${encodeURIComponent(agentId)}`);
  }

  async listAgents(pageSize = 100): Promise<{ agents: { agent_id: string; name: string; created_at_unix_secs?: number; last_call_time_unix_secs?: number | null }[]; next_cursor?: string | null }> {
    this.assertConfigured();
    const { data } = await this.http.get("/v1/convai/agents", { params: { page_size: pageSize } });
    return data;
  }

  async getSignedUrl(agentId: string): Promise<{ signed_url: string }> {
    this.assertConfigured();
    const { data } = await this.http.get("/v1/convai/conversation/get-signed-url", { params: { agent_id: agentId } });
    return data;
  }

  async getWebRtcToken(agentId: string): Promise<{ token: string; conversation_id?: string }> {
    this.assertConfigured();
    const { data } = await this.http.get("/v1/convai/conversation/token", { params: { agent_id: agentId } });
    return data;
  }

  // ---------- Voices / models / account ----------
  async listVoices(): Promise<ElevenVoice[]> {
    this.assertConfigured();
    const { data } = await this.http.get("/v1/voices", { params: { show_legacy: false } });
    return data.voices ?? [];
  }

  async listModels(): Promise<{ model_id: string; name: string; can_do_text_to_speech?: boolean; languages?: { language_id: string; name: string }[] }[]> {
    this.assertConfigured();
    const { data } = await this.http.get("/v1/models");
    return data ?? [];
  }

  async getSubscription(): Promise<{ tier?: string; character_count?: number; character_limit?: number; next_character_count_reset_unix?: number; status?: string }> {
    this.assertConfigured();
    const { data } = await this.http.get("/v1/user/subscription");
    return data;
  }

  // ---------- Telephony ----------
  async listPhoneNumbers(): Promise<ElevenPhoneNumber[]> {
    this.assertConfigured();
    const { data } = await this.http.get("/v1/convai/phone-numbers");
    return Array.isArray(data) ? data : data?.phone_numbers ?? [];
  }

  async getPhoneNumber(id: string): Promise<ElevenPhoneNumber & Record<string, unknown>> {
    this.assertConfigured();
    const { data } = await this.http.get(`/v1/convai/phone-numbers/${encodeURIComponent(id)}`);
    return data;
  }

  /** Import a Twilio / SIP-trunk / Exotel number. Body must match ElevenLabs' Create*PhoneNumberRequest. */
  async importPhoneNumber(body: Record<string, unknown>): Promise<{ phone_number_id: string }> {
    this.assertConfigured();
    const { data } = await this.http.post("/v1/convai/phone-numbers", body);
    return data;
  }

  async updatePhoneNumber(id: string, body: Record<string, unknown>): Promise<ElevenPhoneNumber & Record<string, unknown>> {
    this.assertConfigured();
    const { data } = await this.http.patch(`/v1/convai/phone-numbers/${encodeURIComponent(id)}`, body);
    return data;
  }

  async deletePhoneNumber(id: string): Promise<void> {
    this.assertConfigured();
    await this.http.delete(`/v1/convai/phone-numbers/${encodeURIComponent(id)}`);
  }

  async outboundCall(input: {
    provider: "twilio" | "sip_trunk";
    agent_id: string;
    agent_phone_number_id: string;
    to_number: string;
    dynamic_variables?: Record<string, unknown>;
  }): Promise<{ success: boolean; message: string; conversation_id?: string | null; callSid?: string | null; sip_call_id?: string | null }> {
    this.assertConfigured();
    const path = input.provider === "sip_trunk" ? "/v1/convai/sip-trunk/outbound-call" : "/v1/convai/twilio/outbound-call";
    const body: Record<string, unknown> = {
      agent_id: input.agent_id,
      agent_phone_number_id: input.agent_phone_number_id,
      to_number: input.to_number,
      conversation_initiation_client_data: { dynamic_variables: input.dynamic_variables ?? {} },
    };
    const { data } = await this.http.post(path, body);
    return data;
  }

  async submitBatchCall(input: {
    call_name: string;
    agent_id: string;
    agent_phone_number_id: string;
    recipients: { phone_number: string; conversation_initiation_client_data?: { dynamic_variables?: Record<string, unknown> } }[];
    scheduled_time_unix?: number;
  }): Promise<{ id: string; name: string; status: string; total_calls_scheduled: number }> {
    this.assertConfigured();
    const { data } = await this.http.post("/v1/convai/batch-calling/submit", input);
    return data;
  }

  // ---------- Conversations ----------
  async listConversations(params: { agent_id?: string; cursor?: string; page_size?: number; call_start_after_unix?: number } = {}): Promise<{ conversations: RemoteConversationSummary[]; next_cursor?: string | null; has_more: boolean }> {
    this.assertConfigured();
    const { data } = await this.http.get("/v1/convai/conversations", { params: { page_size: 100, ...params } });
    return data;
  }

  async getConversation(conversationId: string): Promise<RemoteConversation> {
    this.assertConfigured();
    const { data } = await this.http.get(`/v1/convai/conversations/${encodeURIComponent(conversationId)}`);
    return data;
  }

  async getConversationAudio(conversationId: string): Promise<{ stream: NodeJS.ReadableStream; contentType: string }> {
    this.assertConfigured();
    const res = await this.http.get(`/v1/convai/conversations/${encodeURIComponent(conversationId)}/audio`, { responseType: "stream" });
    return { stream: res.data, contentType: String(res.headers["content-type"] || "audio/mpeg") };
  }

  async deleteConversation(conversationId: string): Promise<void> {
    this.assertConfigured();
    await this.http.delete(`/v1/convai/conversations/${encodeURIComponent(conversationId)}`);
  }

  // ---------- Tools (webhook / HTTP tools) ----------
  async listTools(): Promise<ElevenTool[]> {
    this.assertConfigured();
    const { data } = await this.http.get("/v1/convai/tools");
    return data?.tools ?? [];
  }

  async createTool(tool_config: Record<string, unknown>): Promise<ElevenTool> {
    this.assertConfigured();
    const { data } = await this.http.post("/v1/convai/tools", { tool_config });
    return data;
  }

  async updateTool(id: string, tool_config: Record<string, unknown>): Promise<ElevenTool> {
    this.assertConfigured();
    const { data } = await this.http.patch(`/v1/convai/tools/${encodeURIComponent(id)}`, { tool_config });
    return data;
  }

  async deleteTool(id: string): Promise<void> {
    this.assertConfigured();
    await this.http.delete(`/v1/convai/tools/${encodeURIComponent(id)}`);
  }

  // ---------- Knowledge base ----------
  async listKnowledgeBase(): Promise<ElevenKnowledgeDoc[]> {
    this.assertConfigured();
    const out: ElevenKnowledgeDoc[] = [];
    let cursor: string | undefined;
    for (let i = 0; i < 10; i++) {
      const { data } = await this.http.get("/v1/convai/knowledge-base", { params: { page_size: 100, cursor } });
      out.push(...(data?.documents ?? []));
      if (!data?.has_more || !data?.next_cursor) break;
      cursor = data.next_cursor;
    }
    return out;
  }

  async createKnowledgeUrl(url: string, name?: string): Promise<{ id: string; name: string }> {
    this.assertConfigured();
    const { data } = await this.http.post("/v1/convai/knowledge-base/url", { url, name: name || undefined });
    return data;
  }

  async createKnowledgeText(text: string, name?: string): Promise<{ id: string; name: string }> {
    this.assertConfigured();
    const { data } = await this.http.post("/v1/convai/knowledge-base/text", { text, name: name || undefined });
    return data;
  }

  async createKnowledgeFile(file: { buffer: Buffer; filename: string; mimetype: string }, name?: string): Promise<{ id: string; name: string }> {
    this.assertConfigured();
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(file.buffer)], { type: file.mimetype || "application/octet-stream" }), file.filename);
    if (name) form.append("name", name);
    const { data } = await this.http.post("/v1/convai/knowledge-base/file", form, { headers: { "Content-Type": "multipart/form-data" }, timeout: 120000 });
    return data;
  }

  async deleteKnowledgeDoc(id: string): Promise<void> {
    this.assertConfigured();
    await this.http.delete(`/v1/convai/knowledge-base/${encodeURIComponent(id)}`, { params: { force: true } });
  }

  // ---------- Workspace webhooks (post-call) ----------
  async listWebhooks(): Promise<{ webhook_id: string; name: string; webhook_url: string; is_disabled: boolean; auth_type: string }[]> {
    this.assertConfigured();
    const { data } = await this.http.get("/v1/workspace/webhooks");
    return data.webhooks ?? [];
  }

  async createHmacWebhook(name: string, webhookUrl: string): Promise<{ webhook_id: string; webhook_secret?: string | null }> {
    this.assertConfigured();
    const { data } = await this.http.post("/v1/workspace/webhooks", { settings: { auth_type: "hmac", name, webhook_url: webhookUrl } });
    return data;
  }
}

export const elevenlabs = new ElevenLabsClient();
