// Shared API types (mirror of backend models)

export interface CatalogOption {
  value: string;
  label: string;
  group?: string;
  description?: string;
}
export interface TtsModelOption extends CatalogOption {
  languages: "*" | "non-en" | string[];
  latency: "lowest" | "low" | "medium";
  quality: "good" | "high" | "highest";
}
export interface LanguageOption extends CatalogOption {
  nativeName: string;
}

export interface HumanTransferRule {
  condition: string;
  phone_number: string;
  transfer_type: "sip_refer" | "conference" | "blind";
}
export interface DataCollectionField {
  key: string;
  type: "string" | "number" | "integer" | "boolean";
  description: string;
  zohoField?: string;
}
export interface EvaluationCriterion {
  id: string;
  name: string;
  conversation_goal_prompt: string;
}

export interface AgentFormConfig {
  first_message: string;
  system_prompt: string;
  language: string;
  additional_languages: string[];
  hinglish_mode: boolean;
  llm: string;
  custom_llm_url?: string;
  custom_llm_model_id?: string;
  temperature: number;
  max_tokens?: number;
  reasoning_effort?: string;
  voice_id: string;
  tts_model_id: string;
  stability: number;
  similarity_boost: number;
  speed: number;
  optimize_streaming_latency: number;
  agent_output_audio_format: string;
  expressive_mode?: boolean;
  asr_provider: string;
  asr_quality: string;
  user_input_audio_format: string;
  asr_keywords: string[];
  turn_mode: "turn" | "silence";
  turn_timeout: number;
  silence_end_call_timeout: number;
  turn_eagerness: "patient" | "normal" | "eager";
  disable_first_message_interruptions: boolean;
  max_duration_seconds: number;
  max_conversation_duration_message?: string;
  built_in_tools: string[];
  voicemail_message?: string;
  enable_human_transfer: boolean;
  human_transfer_rules: HumanTransferRule[];
  tool_ids: string[];
  knowledge_base_ids: string[];
  data_collection: DataCollectionField[];
  evaluation_criteria: EvaluationCriterion[];
  summary_language?: string;
  record_voice: boolean;
  retention_days: number;
  agent_concurrency_limit: number;
  daily_limit: number;
  post_call_webhook_enabled: boolean;
  post_call_webhook_events: string[];
  dynamic_variable_placeholders: Record<string, string>;
}

export interface Catalog {
  llmModels: CatalogOption[];
  defaultLlm: string;
  ttsModels: TtsModelOption[];
  defaultTtsModel: string;
  languages: LanguageOption[];
  asrProviders: CatalogOption[];
  turnModes: CatalogOption[];
  turnEagerness: CatalogOption[];
  audioFormats: CatalogOption[];
  builtInTools: CatalogOption[];
  dataCollectionTypes: CatalogOption[];
  webhookEvents: CatalogOption[];
  defaults: AgentFormConfig;
}

export interface Voice {
  voice_id: string;
  name: string;
  category?: string;
  description?: string;
  preview_url?: string;
  labels: Record<string, string>;
  languages: string[];
}

export interface SipTrunkConfig {
  address?: string;
  transport?: "auto" | "udp" | "tcp" | "tls";
  media_encryption?: "disabled" | "allowed" | "required";
  headers?: Record<string, string>;
  has_auth_credentials?: boolean;
  username?: string | null;
  has_outbound_trunk?: boolean;
  allowed_addresses?: string[];
  allowed_numbers?: string[] | null;
}
export interface PhoneNumber {
  phone_number_id: string;
  phone_number: string;
  label?: string;
  provider?: "twilio" | "sip_trunk" | "exotel" | string;
  supports_inbound?: boolean;
  supports_outbound?: boolean;
  assigned_agent?: { agent_id: string; agent_name: string } | null;
  /** SIP trunk only */
  outbound_trunk?: SipTrunkConfig | null;
  inbound_trunk?: SipTrunkConfig | null;
  provider_config?: SipTrunkConfig | null;
}

export interface TwilioImportInput {
  phone_number: string;
  label: string;
  sid: string;
  token: string;
  agent_id?: string;
  supports_inbound?: boolean;
  supports_outbound?: boolean;
}
export interface SipImportInput {
  phone_number: string;
  label: string;
  agent_id?: string;
  supports_inbound?: boolean;
  supports_outbound?: boolean;
  outbound?: { address: string; transport?: "auto" | "udp" | "tcp" | "tls"; media_encryption?: "disabled" | "allowed" | "required"; credentials?: { username: string; password?: string }; headers?: Record<string, string> };
  inbound?: { allowed_addresses?: string[]; allowed_numbers?: string[]; media_encryption?: "disabled" | "allowed" | "required"; credentials?: { username: string; password?: string } };
}
export interface TestCallResult {
  conversationId: string | null;
  callSid: string | null;
  message: string;
  agent: { id: string; name: string };
  from: string;
  to: string;
  provider: string;
  conversation?: Conversation | null;
}

export interface Agent {
  _id: string;
  workspaceId: string;
  elevenAgentId: string;
  name: string;
  description?: string;
  config: AgentFormConfig;
  postCallWebhook?: { webhookId?: string; url?: string; events?: string[] };
  lastProvider?: string;
  lastSyncedAt?: string;
  callCount: number;
  lastCallAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RemoteAgentSummary {
  agent_id: string;
  name: string;
  created_at_unix_secs?: number;
  imported: boolean;
}

export interface Lead {
  _id: string;
  workspaceId: string;
  source: "zoho" | "manual" | "csv";
  zohoId?: string;
  firstName?: string;
  lastName?: string;
  fullName: string;
  email?: string;
  phone?: string;
  mobile?: string;
  company?: string;
  title?: string;
  leadStatus?: string;
  leadSource?: string;
  city?: string;
  state?: string;
  country?: string;
  industry?: string;
  website?: string;
  description?: string;
  rating?: string;
  annualRevenue?: number;
  fields: Record<string, unknown>;
  listIds: string[];
  tags: string[];
  callCount: number;
  lastCallAt?: string;
  lastCallStatus?: string;
  lastCallOutcome?: string;
  lastCallSummary?: string;
  lastAgentId?: string;
  syncedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface LeadListResponse extends Paginated<Lead> {
  statuses: string[];
}

export interface TranscriptTurn {
  role: "agent" | "user" | string;
  message: string;
  timeInCallSecs?: number;
  toolCalls?: unknown[];
}

export interface Conversation {
  _id: string;
  workspaceId: string;
  channel: "voice" | "website" | "whatsapp" | "instagram" | "facebook" | "telegram";
  elevenConversationId: string;
  elevenAgentId?: string;
  agentName?: string;
  agentRef?: string;
  leadId?: string;
  leadName?: string;
  phone?: string;
  direction?: "inbound" | "outbound";
  status: "initiated" | "in_progress" | "processing" | "done" | "failed";
  callSuccessful?: "success" | "failure" | "unknown";
  transcript: TranscriptTurn[];
  summary?: string;
  summaryTitle?: string;
  durationSecs?: number;
  startedAt?: string;
  endedAt?: string;
  terminationReason?: string;
  dataCollection?: Record<string, { value: unknown; rationale?: string }>;
  evaluation?: Record<string, { result: string; rationale?: string }>;
  dynamicVariables?: Record<string, unknown>;
  hasAudio: boolean;
  batchCallId?: string;
  zohoSync?: { attemptedAt?: string; pushedAt?: string; updatedFields?: string[]; skippedFields?: string[]; error?: string };
  extraction?: { provider: string; model?: string; at: string; candidateFields: string[]; extracted: Record<string, unknown>; skipped?: string; error?: string };
  insights?: ConversationInsights;
  createdAt: string;
  updatedAt: string;
}

export type InsightCategory = "outcome" | "sentiment" | "objection" | "intent" | "topic" | "action" | "other";

export interface ConversationInsightTag {
  key: string;
  label: string;
  category?: InsightCategory | string;
  evidence?: string;
}
export interface ConversationInsights {
  tags: ConversationInsightTag[];
  sentiment: "positive" | "neutral" | "negative";
  sentimentScore: number;
  callerMood?: string;
  intent?: string;
  outcome?: string;
  objections: string[];
  lossRisk: number;
  nextBestAction?: string;
  keyQuote?: string;
  merges?: { from: string; into: string; reason?: string }[];
  model?: string;
  analyzedAt: string;
  version: number;
  error?: string;
  skipped?: string;
}

export interface InsightTag {
  _id?: string;
  key: string;
  label: string;
  description: string;
  category: InsightCategory;
  color: number;
  count: number;
  firstSeenAt: string;
  lastSeenAt?: string;
  examples: { conversationId: string; leadName?: string; evidence?: string; at: string }[];
  status: "active" | "merged";
  mergedInto?: string;
  mergedFrom: { key: string; label: string; count: number; at: string; reason?: string; by: "llm" | "user" }[];
  createdBy: "llm" | "user";
}

export interface InsightsTaxonomyEntry {
  key: string;
  label: string;
  description: string;
  category: InsightCategory;
  color: number;
  countAllTime: number;
  count: number;
  share: number;
  avgLossRisk: number | null;
  avgSentiment: number | null;
  firstSeenAt: string;
  lastSeenAt?: string;
  examples: { conversationId: string; leadName?: string; evidence?: string; at: string }[];
  mergedFrom: InsightTag["mergedFrom"];
}

export interface InsightsDashboard {
  range: { from: string; to: string; tz: string };
  cap: number;
  coverage: { done: number; analyzed: number; pending: number; configured: boolean };
  taxonomy: InsightsTaxonomyEntry[];
  trends: { keys: string[]; rows: ({ date: string } & Record<string, number | string>)[] };
  sentiment: { distribution: { name: string; value: number; avg: number | null }[]; trend: { date: string; avgSentiment: number | null; avgLossRisk: number | null; calls: number }[] };
  lossRisk: { bucket: string; value: number }[];
  objections: { name: string; value: number }[];
  nextActions: { name: string; value: number }[];
  merges: { into: string; intoLabel: string; from: string; fromLabel: string; count: number; at: string; reason?: string; by: "llm" | "user" }[];
  recent: { _id: string; leadName?: string; phone?: string; agentName?: string; startedAt?: string; durationSecs?: number; summaryTitle?: string; leadId?: string; insights: ConversationInsights }[];
}

export interface AgentDraft {
  name: string;
  description: string;
  first_message: string;
  system_prompt: string;
  language: string;
  fields: { zohoField: string; label: string; description: string; askAs: string }[];
  evaluation_criteria: { id: string; name: string; conversation_goal_prompt: string }[];
  updateLeadStatusTo?: string;
  website?: { url: string; title?: string; chars: number };
  model: string;
}
export interface GenerateAgentInput {
  instructions?: string;
  websiteUrl?: string;
  language?: string;
  tone?: string;
  agentName?: string;
  companyName?: string;
  fields?: string[];
  dryRun?: boolean;
  draft?: AgentDraft;
  voiceId?: string;
  phoneNumberId?: string;
  llm?: string;
  ttsModelId?: string;
}
export interface GenerateAgentResult {
  draft: AgentDraft;
  agent?: Agent;
  binding?: LeadAgentBinding;
}

export interface ToolParam {
  name: string;
  type: "string" | "number" | "integer" | "boolean";
  description: string;
  required: boolean;
  location: "query" | "body" | "path";
  dynamic_variable?: string;
  constant_value?: string | number | boolean;
}
export interface HttpTool {
  id: string;
  type: string;
  name: string;
  description: string;
  url: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  headers: Record<string, string>;
  params: ToolParam[];
  response_timeout_secs: number;
  usage_stats?: unknown;
}
export interface HttpToolInput {
  name: string;
  description: string;
  url: string;
  method: HttpTool["method"];
  headers?: Record<string, string>;
  params?: (Omit<ToolParam, "constant_value"> & { constant_value?: string })[];
  response_timeout_secs?: number;
  disable_interruptions?: boolean;
  content_type?: "application/json" | "application/x-www-form-urlencoded";
}
export interface KnowledgeDoc {
  id: string;
  name: string;
  type: "file" | "url" | "text" | string;
  url?: string;
  createdAt?: string | null;
  sizeBytes?: number | null;
  dependentAgents?: number;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  workspaceId: string;
  role: "owner" | "member";
  createdAt: string;
}
export interface Me {
  user: AuthUser;
  workspace: { id: string; name: string };
}

export interface ConversationListResponse extends Paginated<Conversation> {
  channelCounts: Record<string, number>;
}

export interface ZohoFieldMeta {
  api_name: string;
  field_label: string;
  data_type: string;
  read_only: boolean;
  custom_field: boolean;
  pick_list_values?: { display_value: string; actual_value: string }[];
  length?: number;
}

export interface ZohoStatus {
  configured: boolean;
  connected: boolean;
  status: string;
  profile?: { email?: string; fullName?: string; orgName?: string } | null;
  apiDomain?: string | null;
  connectedAt?: string | null;
  lastSyncAt?: string | null;
  lastSyncStats?: { fetched: number; created: number; updated: number; lists?: number; durationMs: number } | null;
  syncStatus: "idle" | "running" | "error";
  syncError?: string | null;
  leadCount: number;
  redirectUri: string;
  accountsUrl: string;
  /** OAuth client in use (from UI settings or server env) */
  app?: { source: "db" | "env"; clientId: string; clientIdMasked: string; accountsUrl: string; redirectUri: string } | null;
  defaultRedirectUri?: string;
}
export interface ZohoAppSettings {
  source: "db" | "env";
  clientId: string;
  accountsUrl: string;
  redirectUri: string;
  hasSecret: boolean;
}

export interface IntegrationItem {
  id: string;
  name: string;
  category: string;
  available: boolean;
  configured?: boolean;
  connected?: boolean;
  status?: string;
  note?: string;
  lastSyncAt?: string | null;
  lastSyncStats?: ZohoStatus["lastSyncStats"];
  syncStatus?: string;
  syncError?: string | null;
  profile?: ZohoStatus["profile"];
  leadCount?: number;
  redirectUri?: string;
  baseUrl?: string;
  pythonService?: string | null;
}
export interface IntegrationsResponse {
  crm: IntegrationItem[];
  voice: IntegrationItem[];
  channels: IntegrationItem[];
  productivity: IntegrationItem[];
}

export interface LeadListBindingSummary {
  agentId: string;
  agentName: string | null;
  fields: number;
  inherited?: boolean;
}
export interface LeadList {
  _id: string;
  workspaceId?: string;
  source: "zoho" | "manual" | "all";
  zohoCvId?: string;
  name: string;
  systemName?: string;
  category?: string;
  isDefault: boolean;
  columns: string[];
  recordCount: number;
  lastSyncAt?: string;
  createdAt?: string;
  updatedAt?: string;
  binding?: LeadListBindingSummary | null;
}
export interface LeadListDetail extends Omit<LeadList, "binding"> {
  /** View columns first (inView=true), then every other displayable Zoho field */
  resolvedColumns: { api_name: string; label: string; data_type: string; inView: boolean }[];
  binding: (LeadAgentBinding & { inherited?: boolean }) | null;
}
export interface LeadListsResponse {
  all: LeadList;
  items: LeadList[];
  defaultBinding: LeadListBindingSummary | null;
}

export interface BindingField {
  zohoField: string;
  label: string;
  dataType: string;
  description: string;
  collectionKey: string;
}
export interface LeadAgentBinding {
  _id: string;
  listId?: string | null;
  inherited?: boolean;
  agentId: string;
  elevenAgentId: string;
  phoneNumberId?: string;
  fields: BindingField[];
  onlyFillEmpty: boolean;
  pushToZoho: boolean;
  updateLeadStatusTo?: string;
  active: boolean;
  agent?: { _id: string; name: string; elevenAgentId: string } | null;
}

export interface Usage {
  configured: boolean;
  tier?: string;
  status?: string;
  charactersUsed?: number;
  charactersLimit?: number;
  charactersRemaining?: number;
  minutesRemaining?: number;
  resetsAt?: string | null;
}

export interface AnalyticsSummary {
  calls: number;
  completed: number;
  failed: number;
  successRate: number;
  successCount: number;
  failureCount: number;
  minutes: number;
  avgDurationSecs: number;
  inbound: number;
  outbound: number;
  leadsUpdated: number;
  zohoPushed: number;
  leadsTotal: number;
  leadsCalled: number;
  agents: number;
  previous: { calls: number; minutes: number };
}
export interface AnalyticsDashboard {
  summary: AnalyticsSummary;
  trends: { date: string; calls: number; minutes: number; success: number; failed: number }[];
  agents: { agentId: string; agentName: string; calls: number; minutes: number; successRate: number; avgDurationSecs: number }[];
  outcomes: { result: { name: string; value: number }[]; termination: { name: string; value: number }[]; direction: { name: string; value: number }[] };
  leads: { total: number; called: number; reached: number; qualified: number; byStatus: { name: string; value: number }[] };
  heatmap: { dow: number; hour: number; count: number; tz?: string }[];
  timezone?: string;
}

export interface CallResult {
  conversationId: string | null;
  callSid: string | null;
  message: string;
  agent: { id: string; name: string };
  from: string;
  to: string;
}
export interface BatchCallResult {
  batchId: string;
  name: string;
  status: string;
  scheduled: number;
  skipped: number;
  agent: { id: string; name: string };
  from: string;
}
