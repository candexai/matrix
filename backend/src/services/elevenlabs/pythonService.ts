/**
 * Client for the user's own FastAPI "ElevenLabs Agent API" wrapper (Desktop/elvenlabs_agent).
 * Used for agent create/update + post-call webhook provisioning when reachable.
 */
import axios, { AxiosInstance } from "axios";
import { env } from "../../config/env";

class PythonElevenLabsService {
  private http: AxiosInstance | null = null;
  private lastHealth: { ok: boolean; at: number } | null = null;

  constructor() {
    if (env.ELEVENLABS_SERVICE_URL) {
      this.http = axios.create({ baseURL: env.ELEVENLABS_SERVICE_URL, timeout: 60000, headers: { "Content-Type": "application/json" } });
    }
  }

  get configured(): boolean {
    return Boolean(this.http);
  }

  /** Cached (20s) reachability probe so we fall back to the direct API quickly when the service is down. */
  async isReachable(): Promise<boolean> {
    if (!this.http) return false;
    const now = Date.now();
    if (this.lastHealth && now - this.lastHealth.at < 20000) return this.lastHealth.ok;
    try {
      await this.http.get("/health", { timeout: 2500 });
      this.lastHealth = { ok: true, at: now };
    } catch {
      this.lastHealth = { ok: false, at: now };
    }
    return this.lastHealth.ok;
  }

  async createAgent(body: { name: string; conversation_config: Record<string, unknown> }): Promise<{ agent_id: string }> {
    const { data } = await this.http!.post("/api/v1/agents", body);
    return data;
  }

  async updateAgent(agentId: string, body: { name?: string; conversation_config?: Record<string, unknown> }): Promise<Record<string, unknown>> {
    const { data } = await this.http!.patch(`/api/v1/agents/${encodeURIComponent(agentId)}`, body);
    return data;
  }

  /** Provisions/reuses an HMAC workspace webhook for the URL and assigns it to the agent. */
  async setPostCallWebhook(agentId: string, url: string, events: string[]): Promise<{ post_call_webhook_id?: string; post_call_webhook_secret?: string }> {
    const { data } = await this.http!.patch(`/api/v1/agents/${encodeURIComponent(agentId)}/prompt`, {
      post_call_webhook_url: url,
      post_call_webhook_name: "Matrix post-call webhook",
      post_call_webhook_events: events,
    });
    return data;
  }

  async deleteAgent(agentId: string): Promise<void> {
    await this.http!.delete(`/api/v1/agents/${encodeURIComponent(agentId)}`);
  }
}

export const pythonService = new PythonElevenLabsService();
