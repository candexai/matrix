/**
 * Zoho CRM OAuth + REST (v6) client.
 */
import axios, { AxiosInstance } from "axios";
import crypto from "crypto";
import { env } from "../../config/env";
import { ZohoIntegration, ZohoIntegrationDoc, ZohoFieldMeta } from "../../models/ZohoIntegration";
import { OAuthState } from "../../models/OAuthState";
import { encrypt, decrypt } from "../../utils/crypto";
import { getWorkspaceSettings } from "../../models/WorkspaceSettings";
import { HttpError } from "../../utils/http";

export const ZOHO_SCOPES = ["ZohoCRM.modules.ALL", "ZohoCRM.settings.ALL", "ZohoCRM.users.READ", "ZohoCRM.org.READ"];

export interface ZohoAppConfig {
  clientId: string;
  clientSecret: string;
  accountsUrl: string;
  redirectUri: string;
  source: "db" | "env";
}

/** Zoho OAuth client for a workspace: UI-configured (WorkspaceSettings.zohoApp) wins over env vars. */
export async function getZohoApp(workspaceId: string): Promise<ZohoAppConfig | null> {
  const settings = await getWorkspaceSettings(workspaceId);
  const defaultRedirect = `${env.PUBLIC_BACKEND_URL}/api/v1/integrations/zoho/callback`;
  if (settings.zohoApp?.clientId && settings.zohoApp.clientSecretEnc) {
    let secret = "";
    try {
      secret = decrypt(settings.zohoApp.clientSecretEnc);
    } catch {
      secret = "";
    }
    if (secret) {
      return {
        clientId: settings.zohoApp.clientId,
        clientSecret: secret,
        accountsUrl: (settings.zohoApp.accountsUrl || env.ZOHO_ACCOUNTS_URL).replace(/\/$/, ""),
        redirectUri: settings.zohoApp.redirectUri || defaultRedirect,
        source: "db",
      };
    }
  }
  if (env.ZOHO_CLIENT_ID && env.ZOHO_CLIENT_SECRET) {
    return { clientId: env.ZOHO_CLIENT_ID, clientSecret: env.ZOHO_CLIENT_SECRET, accountsUrl: env.ZOHO_ACCOUNTS_URL, redirectUri: env.ZOHO_REDIRECT_URI, source: "env" };
  }
  return null;
}

export async function saveZohoApp(workspaceId: string, input: { clientId: string; clientSecret?: string; accountsUrl?: string; redirectUri?: string }): Promise<ZohoAppConfig> {
  const settings = await getWorkspaceSettings(workspaceId);
  const clientId = input.clientId.trim();
  if (!/^1000\.[A-Z0-9]{20,}$/i.test(clientId)) throw new HttpError(400, "Client ID should look like 1000.XXXXXXXXXXXXXXXXXXXXXXXX", "VALIDATION_ERROR");
  let secretEnc = settings.zohoApp?.clientSecretEnc;
  if (input.clientSecret?.trim()) secretEnc = encrypt(input.clientSecret.trim());
  if (!secretEnc) throw new HttpError(400, "Client Secret is required", "VALIDATION_ERROR");
  settings.zohoApp = {
    clientId,
    clientSecretEnc: secretEnc,
    accountsUrl: (input.accountsUrl || env.ZOHO_ACCOUNTS_URL).replace(/\/$/, ""),
    redirectUri: input.redirectUri?.trim() || undefined,
    updatedAt: new Date(),
  };
  await settings.save();
  return (await getZohoApp(workspaceId))!;
}

export async function clearZohoApp(workspaceId: string): Promise<void> {
  const settings = await getWorkspaceSettings(workspaceId);
  settings.zohoApp = undefined;
  await settings.save();
}

export async function zohoConfigured(workspaceId = env.DEFAULT_WORKSPACE_ID): Promise<boolean> {
  return Boolean(await getZohoApp(workspaceId));
}

async function requireApp(workspaceId: string): Promise<ZohoAppConfig> {
  const app = await getZohoApp(workspaceId);
  if (!app) throw new HttpError(500, "Zoho is not configured: add the Zoho client in Integrations → Zoho CRM → App settings (or set ZOHO_CLIENT_ID / ZOHO_CLIENT_SECRET)", "ZOHO_NOT_CONFIGURED");
  return app;
}

export async function buildAuthUrl(workspaceId: string): Promise<string> {
  const app = await requireApp(workspaceId);
  const state = crypto.randomBytes(16).toString("hex");
  await OAuthState.create({ state, provider: "zoho", workspaceId });
  const params = new URLSearchParams({
    scope: ZOHO_SCOPES.join(","),
    client_id: app.clientId,
    response_type: "code",
    access_type: "offline",
    redirect_uri: app.redirectUri,
    prompt: "consent",
    state,
  });
  return `${app.accountsUrl}/oauth/v2/auth?${params.toString()}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  api_domain: string;
  token_type: string;
  expires_in: number;
  error?: string;
}

export async function exchangeCode(workspaceId: string, code: string, accountsServer?: string): Promise<TokenResponse & { accountsServer: string }> {
  const app = await requireApp(workspaceId);
  const accounts = (accountsServer || app.accountsUrl).replace(/\/$/, "");
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: app.clientId,
    client_secret: app.clientSecret,
    redirect_uri: app.redirectUri,
    code,
  });
  const { data } = await axios.post<TokenResponse>(`${accounts}/oauth/v2/token`, body.toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    timeout: 20000,
  });
  if (data.error || !data.access_token) throw new HttpError(400, `Zoho token exchange failed: ${data.error || "no access_token"}`, "ZOHO_OAUTH_ERROR", data);
  return { ...data, accountsServer: accounts };
}

async function refreshAccessToken(integ: ZohoIntegrationDoc): Promise<void> {
  const app = await requireApp(integ.workspaceId);
  if (!integ.refreshTokenEnc) throw new HttpError(401, "Zoho refresh token missing – reconnect Zoho", "ZOHO_TOKEN_EXPIRED");
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: app.clientId,
    client_secret: app.clientSecret,
    refresh_token: decrypt(integ.refreshTokenEnc),
  });
  const { data } = await axios.post<TokenResponse>(`${integ.accountsServer}/oauth/v2/token`, body.toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    timeout: 20000,
  });
  if (data.error || !data.access_token) {
    integ.status = "error";
    integ.syncError = `Token refresh failed: ${data.error}`;
    await integ.save();
    throw new HttpError(401, `Zoho token refresh failed: ${data.error}`, "ZOHO_TOKEN_EXPIRED");
  }
  integ.accessTokenEnc = encrypt(data.access_token);
  integ.tokenExpiry = new Date(Date.now() + (data.expires_in - 60) * 1000);
  if (data.api_domain) integ.apiDomain = data.api_domain;
  integ.status = "connected";
  await integ.save();
}

export async function getIntegration(workspaceId: string): Promise<ZohoIntegrationDoc | null> {
  return ZohoIntegration.findOne({ workspaceId });
}

export async function requireIntegration(workspaceId: string): Promise<ZohoIntegrationDoc> {
  const integ = await getIntegration(workspaceId);
  if (!integ || integ.status === "revoked") throw new HttpError(400, "Zoho CRM is not connected", "ZOHO_NOT_CONNECTED");
  return integ;
}

export async function ensureValidToken(integ: ZohoIntegrationDoc): Promise<string> {
  if (integ.tokenExpiry.getTime() - Date.now() < 60_000) {
    await refreshAccessToken(integ);
  }
  return decrypt(integ.accessTokenEnc);
}

export async function zohoHttp(integ: ZohoIntegrationDoc): Promise<AxiosInstance> {
  const token = await ensureValidToken(integ);
  return axios.create({
    baseURL: integ.apiDomain.replace(/\/$/, ""),
    timeout: 30000,
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
  });
}

export async function revokeToken(integ: ZohoIntegrationDoc): Promise<void> {
  try {
    const token = integ.refreshTokenEnc ? decrypt(integ.refreshTokenEnc) : decrypt(integ.accessTokenEnc);
    await axios.post(`${integ.accountsServer}/oauth/v2/token/revoke?token=${encodeURIComponent(token)}`, null, { timeout: 15000 });
  } catch (e) {
    console.warn("[zoho] revoke failed (ignored):", (e as Error).message);
  }
}

// ---------- CRM API ----------

export async function fetchCurrentUser(integ: ZohoIntegrationDoc): Promise<{ email?: string; full_name?: string; zuid?: string } | null> {
  const http = await zohoHttp(integ);
  try {
    const { data } = await http.get("/crm/v6/users", { params: { type: "CurrentUser" } });
    const u = data?.users?.[0];
    return u ? { email: u.email, full_name: u.full_name, zuid: u.zuid } : null;
  } catch {
    return null;
  }
}

export async function fetchOrg(integ: ZohoIntegrationDoc): Promise<{ company_name?: string; id?: string } | null> {
  const http = await zohoHttp(integ);
  try {
    const { data } = await http.get("/crm/v6/org");
    const o = data?.org?.[0];
    return o ? { company_name: o.company_name, id: o.id } : null;
  } catch {
    return null;
  }
}

const NON_WRITABLE_TYPES = new Set(["lookup", "ownerlookup", "formula", "fileupload", "imageupload", "multiselectlookup", "userlookup", "subform", "consent_lookup", "rollup_summary", "profileimage", "ALARM", "RRULE"]);

export async function fetchLeadFields(integ: ZohoIntegrationDoc, force = false): Promise<ZohoFieldMeta[]> {
  const fresh = integ.fieldsCache && integ.fieldsCachedAt && Date.now() - integ.fieldsCachedAt.getTime() < 6 * 3600 * 1000;
  if (fresh && !force) return integ.fieldsCache!;
  const http = await zohoHttp(integ);
  const { data } = await http.get("/crm/v6/settings/fields", { params: { module: "Leads" } });
  const fields: ZohoFieldMeta[] = (data?.fields ?? []).map((f: any) => ({
    api_name: f.api_name,
    field_label: f.field_label ?? f.display_label ?? f.api_name,
    data_type: f.data_type,
    read_only: Boolean(f.read_only) || !(f.view_type?.edit ?? true) || NON_WRITABLE_TYPES.has(f.data_type),
    custom_field: Boolean(f.custom_field),
    pick_list_values: (f.pick_list_values ?? []).map((p: any) => ({ display_value: p.display_value, actual_value: p.actual_value })),
    length: f.length,
  }));
  integ.fieldsCache = fields;
  integ.fieldsCachedAt = new Date();
  await integ.save();
  return fields;
}

export interface ZohoCustomView {
  id: string;
  name: string;
  display_value?: string;
  system_name?: string;
  category?: string;
  default?: boolean;
  favorite?: number | boolean;
  fields?: { api_name: string; id?: string }[] | string[];
  criteria?: unknown;
}

/** Custom views of the Leads module = the "lead tables" shown in My Leads. */
export async function fetchLeadCustomViews(integ: ZohoIntegrationDoc): Promise<ZohoCustomView[]> {
  const http = await zohoHttp(integ);
  const { data } = await http.get("/crm/v6/settings/custom_views", { params: { module: "Leads" }, validateStatus: (s) => s === 200 || s === 204 });
  const views: ZohoCustomView[] = data?.custom_views ?? [];
  // list responses omit fields/criteria; fetch details for views we will show (max 40)
  const detailed: ZohoCustomView[] = [];
  for (const v of views.slice(0, 40)) {
    if (v.fields && v.fields.length) {
      detailed.push(v);
      continue;
    }
    try {
      const res = await http.get(`/crm/v6/settings/custom_views/${encodeURIComponent(v.id)}`, { params: { module: "Leads" }, validateStatus: (s) => s === 200 || s === 204 });
      const d = res.data?.custom_views?.[0];
      detailed.push(d ? { ...v, ...d } : v);
    } catch {
      detailed.push(v);
    }
  }
  return detailed;
}

/** Record ids that belong to a custom view (cheap: only id + Modified_Time). */
export async function fetchViewLeadIds(integ: ZohoIntegrationDoc, cvid: string, maxPages = 50): Promise<string[]> {
  const http = await zohoHttp(integ);
  const ids: string[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const res = await http.get("/crm/v6/Leads", { params: { cvid, fields: "id,Modified_Time", page, per_page: 200 }, validateStatus: (s) => s === 200 || s === 204 });
    if (res.status !== 200) break;
    for (const rec of res.data?.data ?? []) ids.push(rec.id);
    if (!res.data?.info?.more_records) break;
  }
  return ids;
}

export interface ZohoLeadRecord {
  id: string;
  Modified_Time?: string;
  [key: string]: unknown;
}

/** Zoho v6 requires `fields` (max 50). We chunk and merge records by id. */
export async function fetchLeadsPage(integ: ZohoIntegrationDoc, fieldNames: string[], page: number, perPage = 200, modifiedSince?: Date): Promise<{ records: ZohoLeadRecord[]; moreRecords: boolean }> {
  const http = await zohoHttp(integ);
  const chunks: string[][] = [];
  const names = Array.from(new Set(["id", "Modified_Time", ...fieldNames]));
  for (let i = 0; i < names.length; i += 50) chunks.push(names.slice(i, i + 50));

  const merged = new Map<string, ZohoLeadRecord>();
  let moreRecords = false;
  for (const chunk of chunks) {
    const headers: Record<string, string> = {};
    if (modifiedSince) headers["If-Modified-Since"] = modifiedSince.toISOString();
    const res = await http.get("/crm/v6/Leads", {
      params: { fields: chunk.join(","), page, per_page: perPage, sort_by: "Modified_Time", sort_order: "desc" },
      headers,
      validateStatus: (s) => s === 200 || s === 204 || s === 304,
    });
    if (res.status !== 200) return { records: [], moreRecords: false };
    for (const rec of res.data?.data ?? []) {
      const prev = merged.get(rec.id) ?? { id: rec.id };
      merged.set(rec.id, { ...prev, ...rec });
    }
    moreRecords = Boolean(res.data?.info?.more_records);
  }
  return { records: Array.from(merged.values()), moreRecords };
}

export async function updateLead(integ: ZohoIntegrationDoc, zohoId: string, fields: Record<string, unknown>): Promise<{ ok: boolean; message?: string; details?: unknown }> {
  const http = await zohoHttp(integ);
  const { data } = await http.put(`/crm/v6/Leads/${encodeURIComponent(zohoId)}`, { data: [{ ...fields }] }, { validateStatus: () => true });
  const r = data?.data?.[0];
  if (r?.status === "success") return { ok: true };
  return { ok: false, message: r?.message || data?.message || "Zoho update failed", details: r ?? data };
}

export async function createLead(integ: ZohoIntegrationDoc, fields: Record<string, unknown>): Promise<{ ok: boolean; id?: string; message?: string; details?: unknown }> {
  const http = await zohoHttp(integ);
  const { data } = await http.post(`/crm/v6/Leads`, { data: [{ ...fields }] }, { validateStatus: () => true });
  const r = data?.data?.[0];
  if (r?.status === "success") return { ok: true, id: r?.details?.id };
  return { ok: false, message: r?.message || data?.message || "Zoho create failed", details: r ?? data };
}
