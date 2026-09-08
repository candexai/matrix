"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, API_URL, errorMessage } from "@/lib/api";
import type {
  AuthUser,
  Me,
  Agent,
  AgentFormConfig,
  GenerateAgentInput,
  GenerateAgentResult,
  HttpTool,
  HttpToolInput,
  KnowledgeDoc,
  AnalyticsDashboard,
  BatchCallResult,
  CallResult,
  Catalog,
  Conversation,
  ConversationListResponse,
  InsightTag,
  InsightsDashboard,
  IntegrationsResponse,
  Lead,
  LeadAgentBinding,
  LeadList,
  LeadListDetail,
  LeadListsResponse,
  LeadListResponse,
  PhoneNumber,
  RemoteAgentSummary,
  SipImportInput,
  TestCallResult,
  TwilioImportInput,
  Voice,
  ZohoAppSettings,
  ZohoFieldMeta,
  ZohoStatus,
} from "@/lib/types";

// ---------- auth ----------
export const useMe = () => useQuery({ queryKey: ["me"], queryFn: () => api.get<Me>("/auth/me"), retry: false, staleTime: 5 * 60_000 });
export const useAuthStatus = () => useQuery({ queryKey: ["auth-status"], queryFn: () => api.get<{ hasAccounts: boolean }>("/auth/status"), retry: false });
export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { email: string; password: string }) => api.post<{ user: AuthUser; token: string }>("/auth/login", input),
    onSuccess: (r) => {
      qc.clear();
      qc.setQueryData(["me"], { user: r.user, workspace: { id: r.user.workspaceId, name: "" } });
    },
  });
}
export function useSignup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; email: string; password: string; company?: string }) => api.post<{ user: AuthUser; token: string }>("/auth/signup", input),
    onSuccess: (r) => {
      qc.clear();
      qc.setQueryData(["me"], { user: r.user, workspace: { id: r.user.workspaceId, name: "" } });
    },
  });
}
export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post("/auth/logout"),
    onSuccess: () => {
      qc.clear();
      if (typeof window !== "undefined") window.location.href = "/login";
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}
export function useChangePassword() {
  return useMutation({
    mutationFn: (input: { currentPassword: string; newPassword: string }) => api.post("/auth/change-password", input),
    onSuccess: () => toast.success("Password changed"),
    onError: (e) => toast.error(errorMessage(e)),
  });
}

// ---------- catalog / reference data ----------
export const useCatalog = () => useQuery({ queryKey: ["catalog"], queryFn: () => api.get<Catalog>("/catalog"), staleTime: Infinity });
export const useVoices = () => useQuery({ queryKey: ["voices"], queryFn: () => api.get<Voice[]>("/voices"), staleTime: 10 * 60_000 });
export const usePhoneNumbers = () => useQuery({ queryKey: ["phone-numbers"], queryFn: () => api.get<PhoneNumber[]>("/phone-numbers"), staleTime: 60_000 });
export const usePhoneNumber = (id?: string) => useQuery({ queryKey: ["phone-numbers", id], queryFn: () => api.get<PhoneNumber>(`/phone-numbers/${id}`), enabled: Boolean(id) });
export function useImportTwilioNumber() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TwilioImportInput) => api.post<{ phone_number_id: string }>("/phone-numbers/twilio", input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["phone-numbers"] });
      toast.success("Twilio number imported");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}
export function useImportSipNumber() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SipImportInput) => api.post<{ phone_number_id: string }>("/phone-numbers/sip-trunk", input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["phone-numbers"] });
      toast.success("SIP trunk number imported");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}
export function useUpdatePhoneNumber() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string; agent_id?: string | null; label?: string; outbound?: SipImportInput["outbound"]; inbound?: SipImportInput["inbound"] }) => api.patch<PhoneNumber>(`/phone-numbers/${id}`, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["phone-numbers"] });
      toast.success("Phone number updated");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}
export function useDeletePhoneNumber() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/phone-numbers/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["phone-numbers"] });
      toast.success("Phone number removed");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}
/** Outbound test call from AI Test: rings a real phone with the agent. */
export function useTestCall() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ agentId, ...input }: { agentId: string; to_number: string; phoneNumberId?: string; dynamic_variables?: Record<string, string> }) => api.post<TestCallResult>(`/agents/${agentId}/test-call`, input),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      toast.success(`Calling ${r.to} from ${r.from} with ${r.agent.name}`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}

// ---------- agents ----------
export const useAgents = () => useQuery({ queryKey: ["agents"], queryFn: () => api.get<Agent[]>("/agents") });
export const useAgent = (id?: string) => useQuery({ queryKey: ["agents", id], queryFn: () => api.get<Agent>(`/agents/${id}`), enabled: Boolean(id) });
export const useRemoteAgents = (enabled = true) => useQuery({ queryKey: ["agents", "remote"], queryFn: () => api.get<RemoteAgentSummary[]>("/agents/remote"), enabled });

export function useCreateAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; description?: string; config: Partial<AgentFormConfig> }) => api.post<Agent>("/agents", input),
    onSuccess: (a) => {
      qc.invalidateQueries({ queryKey: ["agents"] });
      toast.success(`Agent "${a.name}" created`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}
export function useUpdateAgent(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name?: string; description?: string; config?: Partial<AgentFormConfig> }) => api.patch<Agent>(`/agents/${id}`, input),
    onSuccess: (a) => {
      qc.invalidateQueries({ queryKey: ["agents"] });
      qc.setQueryData(["agents", id], a);
      toast.success("Agent updated");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}
export function useDeleteAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/agents/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agents"] });
      toast.success("Agent deleted");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}
export function useSyncAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<Agent>(`/agents/${id}/sync`),
    onSuccess: (a) => {
      qc.invalidateQueries({ queryKey: ["agents"] });
      qc.setQueryData(["agents", a._id], a);
      toast.success("Pulled latest settings from ElevenLabs");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}
export function useImportAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (agent_id: string) => api.post<Agent>("/agents/import", { agent_id }),
    onSuccess: (a) => {
      qc.invalidateQueries({ queryKey: ["agents"] });
      toast.success(`Imported "${a.name}"`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}
export const getSignedUrl = (id: string) => api.get<{ signed_url: string; agent_id: string }>(`/agents/${id}/signed-url`);

// ---------- HTTP tools (ElevenLabs webhook tools) ----------
export const useHttpTools = () => useQuery({ queryKey: ["tools"], queryFn: () => api.get<HttpTool[]>("/tools"), staleTime: 60_000 });
export function useCreateHttpTool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: HttpToolInput) => api.post<HttpTool>("/tools", input),
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: ["tools"] });
      toast.success(`Tool "${t.name}" created`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}
export function useUpdateHttpTool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: HttpToolInput & { id: string }) => api.patch<HttpTool>(`/tools/${id}`, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tools"] });
      toast.success("Tool updated");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}
export function useDeleteHttpTool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/tools/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tools"] });
      toast.success("Tool deleted");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}

// ---------- knowledge base (ElevenLabs documents) ----------
export const useKnowledgeDocs = () => useQuery({ queryKey: ["knowledge-base"], queryFn: () => api.get<KnowledgeDoc[]>("/knowledge-base"), staleTime: 60_000 });
export function useAddKnowledgeDoc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { kind: "url"; url: string; name?: string } | { kind: "text"; text: string; name?: string } | { kind: "file"; file: File; name?: string }) => {
      if (input.kind === "url") return api.post<{ id: string; name: string }>("/knowledge-base/url", { url: input.url, name: input.name });
      if (input.kind === "text") return api.post<{ id: string; name: string }>("/knowledge-base/text", { text: input.text, name: input.name });
      const fd = new FormData();
      fd.append("file", input.file);
      if (input.name) fd.append("name", input.name);
      const { default: axios } = await import("axios");
      const { data } = await axios.post(`${API_URL}/knowledge-base/file`, fd, { timeout: 180000 });
      return data.data as { id: string; name: string };
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["knowledge-base"] });
      toast.success(`Document "${d.name}" added`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}
export function useDeleteKnowledgeDoc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/knowledge-base/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["knowledge-base"] });
      toast.success("Document deleted");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}

// ---------- leads ----------
export interface LeadFilters {
  listId?: string;
  search?: string;
  status?: string;
  source?: string;
  called?: "yes" | "no";
  page?: number;
  limit?: number;
  sort?: string;
}
export const useLeads = (filters: LeadFilters) => useQuery({ queryKey: ["leads", filters], queryFn: () => api.get<LeadListResponse>("/leads", filters as Record<string, unknown>), placeholderData: (prev) => prev });
export const useLead = (id?: string) => useQuery({ queryKey: ["leads", "one", id], queryFn: () => api.get<Lead>(`/leads/${id}`), enabled: Boolean(id) });
export const useLeadConversations = (id?: string) => useQuery({ queryKey: ["leads", id, "conversations"], queryFn: () => api.get<Conversation[]>(`/leads/${id}/conversations`), enabled: Boolean(id) });
export const useLeadBinding = (listId?: string | null) => useQuery({ queryKey: ["lead-binding", listId ?? null], queryFn: () => api.get<LeadAgentBinding | null>("/leads/agent-binding", listId && listId !== "all" ? { listId } : undefined) });

// ---------- lead lists (Zoho custom views / manual lists) ----------
export const useLeadLists = () => useQuery({ queryKey: ["lead-lists"], queryFn: () => api.get<LeadListsResponse>("/lead-lists") });
export const useLeadList = (id?: string) => useQuery({ queryKey: ["lead-lists", id], queryFn: () => api.get<LeadListDetail>(`/lead-lists/${id}`), enabled: Boolean(id) });
export function useCreateLeadList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; columns?: string[] }) => api.post<LeadList>("/lead-lists", input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lead-lists"] });
      toast.success("List created");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}
export function useUpdateLeadList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string; name?: string; columns?: string[] }) => api.patch<LeadList>(`/lead-lists/${id}`, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lead-lists"] });
      toast.success("List updated");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}
export function useDeleteLeadList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/lead-lists/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lead-lists"] });
      qc.invalidateQueries({ queryKey: ["leads"] });
      toast.success("List deleted");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}
export function useAddLeadsToList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, leadIds }: { id: string; leadIds: string[] }) => api.post<{ modified: number; recordCount: number }>(`/lead-lists/${id}/leads`, { leadIds }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["lead-lists"] });
      qc.invalidateQueries({ queryKey: ["leads"] });
      toast.success(`${r.modified} lead${r.modified === 1 ? "" : "s"} added to list`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}
export function useRemoveLeadsFromList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, leadIds }: { id: string; leadIds: string[] }) => api.delete<{ modified: number; recordCount: number }>(`/lead-lists/${id}/leads`, undefined, { leadIds }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lead-lists"] });
      qc.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Removed from list");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}

export function useSetLeadBinding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { listId?: string | null; agentId: string; phoneNumberId?: string; fields: { zohoField: string; label?: string; dataType?: string; description?: string }[]; onlyFillEmpty?: boolean; pushToZoho?: boolean; updateLeadStatusTo?: string }) =>
      api.put<LeadAgentBinding>("/leads/agent-binding", { ...input, listId: input.listId && input.listId !== "all" ? input.listId : null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lead-binding"] });
      qc.invalidateQueries({ queryKey: ["lead-lists"] });
      qc.invalidateQueries({ queryKey: ["agents"] });
      toast.success("Voice agent attached");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}
export function useClearLeadBinding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (listId?: string | null) => api.delete("/leads/agent-binding", listId && listId !== "all" ? { listId } : undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lead-binding"] });
      qc.invalidateQueries({ queryKey: ["lead-lists"] });
      toast.success("Agent detached");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}
export function useCallLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, agentId, phoneNumberId, listId }: { id: string; agentId?: string; phoneNumberId?: string; listId?: string }) => api.post<CallResult>(`/leads/${id}/call`, { agentId, phoneNumberId, listId }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
      toast.success(`Calling ${r.to} with ${r.agent.name}`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}
export function useBatchCall() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { leadIds: string[]; agentId?: string; phoneNumberId?: string; callName?: string; listId?: string }) => api.post<BatchCallResult>("/leads/batch-call", input),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      toast.success(`Batch "${r.name}" submitted · ${r.scheduled} calls${r.skipped ? ` (${r.skipped} skipped – no phone)` : ""}`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}
export function useUpdateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string; fields?: Record<string, unknown>; pushToZoho?: boolean } & Partial<Lead>) => api.patch<{ lead: Lead; zoho?: { ok: boolean; message?: string } }>(`/leads/${id}`, patch),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      if (r.zoho && !r.zoho.ok) toast.warning(`Saved locally, Zoho rejected: ${r.zoho.message}`);
      else toast.success("Lead updated");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}
export function useCreateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<Lead> & { pushToZoho?: boolean }) => api.post<Lead>("/leads", input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Lead added");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}
export function useDeleteLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/leads/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Lead deleted");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}

/** AI agent generation for a lead table. `dryRun` returns an editable draft; passing `draft` creates + attaches the agent. */
export function useGenerateAgent(listId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: GenerateAgentInput) => api.post<GenerateAgentResult>(`/lead-lists/${listId}/generate-agent`, input),
    onSuccess: (r) => {
      if (r.agent) {
        qc.invalidateQueries({ queryKey: ["agents"] });
        qc.invalidateQueries({ queryKey: ["lead-lists"] });
        qc.invalidateQueries({ queryKey: ["lead-binding"] });
        toast.success(`Agent "${r.agent.name}" created and attached`);
      }
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}
export function useEnsureWebhooks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ url: string | null; updated: number }>("/agents/webhooks/ensure"),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["agents"] });
      toast.success(r.url ? `Post-call webhook active (${r.updated} agent${r.updated === 1 ? "" : "s"} updated)` : "No public https URL yet — start ngrok http 5001");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}

// ---------- conversations ----------
export interface ConversationFilters {
  tag?: string;
  channel?: string;
  agentId?: string;
  leadId?: string;
  status?: string;
  outcome?: string;
  search?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}
export const useConversations = (filters: ConversationFilters) =>
  useQuery({ queryKey: ["conversations", filters], queryFn: () => api.get<ConversationListResponse>("/conversations", filters as Record<string, unknown>), placeholderData: (prev) => prev, refetchInterval: 10_000, refetchOnWindowFocus: true });
export const useConversation = (id?: string) => useQuery({ queryKey: ["conversations", "one", id], queryFn: () => api.get<Conversation>(`/conversations/${id}`), enabled: Boolean(id) });
export function useSyncConversations() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { agentId?: string; sinceHours?: number } = {}) => api.post<{ scanned: number; upserted: number; skipped: number; errors: string[] }>("/conversations/sync", input),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      qc.invalidateQueries({ queryKey: ["leads"] });
      toast.success(`Synced ${r.upserted} conversation${r.upserted === 1 ? "" : "s"} from ElevenLabs`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}
export function useRefreshConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<Conversation>(`/conversations/${id}/refresh`),
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      qc.setQueryData(["conversations", "one", c._id], c);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}
export function useDeleteConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/conversations/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      toast.success("Conversation deleted");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}

// ---------- integrations / zoho ----------
export const useIntegrations = () => useQuery({ queryKey: ["integrations"], queryFn: () => api.get<IntegrationsResponse>("/integrations") });
export const useZohoStatus = (opts: { refetchInterval?: number | false } = {}) => useQuery({ queryKey: ["zoho", "status"], queryFn: () => api.get<ZohoStatus>("/integrations/zoho/status"), refetchInterval: opts.refetchInterval ?? false });
export const useZohoFields = (enabled = true) => useQuery({ queryKey: ["zoho", "fields"], queryFn: () => api.get<ZohoFieldMeta[]>("/integrations/zoho/fields"), enabled, staleTime: 10 * 60_000, retry: 0 });
export const useZohoApp = () => useQuery({ queryKey: ["zoho", "app"], queryFn: () => api.get<ZohoAppSettings | null>("/integrations/zoho/app") });
export function useSaveZohoApp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { clientId: string; clientSecret?: string; accountsUrl?: string; redirectUri?: string }) => api.put<ZohoAppSettings>("/integrations/zoho/app", input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["zoho"] });
      qc.invalidateQueries({ queryKey: ["integrations"] });
      toast.success("Zoho app saved — click Connect Zoho CRM");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}
export function useClearZohoApp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete("/integrations/zoho/app"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["zoho"] });
      qc.invalidateQueries({ queryKey: ["integrations"] });
      toast.success("Zoho app settings removed");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}
export function useZohoPurge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ leads: number; lists: number; bindings: number }>("/integrations/zoho/purge"),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["zoho"] });
      qc.invalidateQueries({ queryKey: ["integrations"] });
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["lead-lists"] });
      qc.invalidateQueries({ queryKey: ["lead-binding"] });
      toast.success(`Removed ${r.leads} synced leads and ${r.lists} tables (connection kept)`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}
export function useZohoConnect() {
  return useMutation({
    mutationFn: () => api.post<{ authUrl: string }>("/integrations/zoho/connect"),
    onSuccess: ({ authUrl }) => {
      window.location.href = authUrl;
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}
export function useZohoSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (opts?: { full?: boolean }) => api.post<{ fetched: number; created: number; updated: number; lists?: number; durationMs: number; calls?: { upserted: number; processed: number }; callCatchUp?: string }>("/integrations/zoho/sync", { full: Boolean(opts?.full) }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["zoho"] });
      qc.invalidateQueries({ queryKey: ["integrations"] });
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["lead-lists"] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
      const calls = r.calls && (r.calls.upserted || r.calls.processed) ? ` · ${r.calls.upserted} call${r.calls.upserted === 1 ? "" : "s"} pulled, ${r.calls.processed} lead update${r.calls.processed === 1 ? "" : "s"} applied` : r.callCatchUp ? " · call catch-up running in background" : "";
      toast.success(`Zoho sync complete · ${r.fetched} fetched, ${r.created} new, ${r.updated} updated${r.lists ? `, ${r.lists} lists` : ""}${calls}`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}
export function useZohoDisconnect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (opts?: { purge?: boolean }) => api.delete<{ disconnected: boolean; purged?: { leads: number; lists: number } }>("/integrations/zoho/disconnect", opts?.purge ? { purge: "true" } : undefined),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["zoho"] });
      qc.invalidateQueries({ queryKey: ["integrations"] });
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["lead-lists"] });
      qc.invalidateQueries({ queryKey: ["lead-binding"] });
      toast.success(r.purged ? `Zoho disconnected · removed ${r.purged.leads} leads and ${r.purged.lists} tables` : "Zoho disconnected");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}

// ---------- conversation insights (dynamic analytics) ----------
export const useInsights = (params: { days?: number; from?: string; to?: string }) => useQuery({ queryKey: ["insights", params], queryFn: () => api.get<InsightsDashboard>("/analytics/insights", params), placeholderData: (p) => p, refetchInterval: 30_000 });
export const useInsightTags = () => useQuery({ queryKey: ["insights", "tags"], queryFn: () => api.get<InsightTag[]>("/analytics/insights/tags") });
export function useMergeInsightTags() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ from, into, label, reason }: { from: string; into: string; label?: string; reason?: string }) => api.post<InsightTag>(`/analytics/insights/tags/${encodeURIComponent(from)}/merge`, { into, label, reason }),
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: ["insights"] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
      toast.success(`Merged into "${t.label}" · ${t.count} calls`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}
export function useRenameInsightTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ key, ...patch }: { key: string; label?: string; description?: string; category?: string }) => api.patch<InsightTag>(`/analytics/insights/tags/${encodeURIComponent(key)}`, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["insights"] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
      toast.success("Tag updated");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}
export function useDeleteInsightTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (key: string) => api.delete(`/analytics/insights/tags/${encodeURIComponent(key)}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["insights"] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
      toast.success("Tag removed");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}
export function useAnalyzePending() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { sinceDays?: number; max?: number; force?: boolean } = {}) => api.post<{ scanned: number; analyzed: number; errors: string[] }>("/analytics/insights/reanalyze", input),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["insights"] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
      toast.success(`Analysed ${r.analyzed} of ${r.scanned} call${r.scanned === 1 ? "" : "s"}${r.errors.length ? ` · ${r.errors.length} failed` : ""}`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}
export function useAnalyzeConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, force }: { id: string; force?: boolean }) => api.post<Conversation>(`/conversations/${id}/analyze`, { force }),
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ["insights"] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
      qc.setQueryData(["conversations", "one", c._id], c);
      toast.success(c.insights?.tags?.length ? `Tagged: ${c.insights.tags.map((t) => t.label).join(", ")}` : c.insights?.skipped || "Analysed");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}

// ---------- analytics ----------
export const useAnalytics = (params: { days?: number; from?: string; to?: string }) => useQuery({ queryKey: ["analytics", params], queryFn: () => api.get<AnalyticsDashboard>("/analytics/dashboard", params), placeholderData: (p) => p });
