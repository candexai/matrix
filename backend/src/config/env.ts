import dotenv from "dotenv";
dotenv.config();

function req(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === "") {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

function opt(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

const PUBLIC_BACKEND_URL = opt("PUBLIC_BACKEND_URL", `http://localhost:${opt("PORT", "5001")}`).replace(/\/$/, "");

export const env = {
  NODE_ENV: opt("NODE_ENV", "development"),
  PORT: Number(opt("PORT", "5001")),
  FRONTEND_URL: opt("FRONTEND_URL", "http://localhost:3000").replace(/\/$/, ""),
  PUBLIC_BACKEND_URL,

  MONGODB_URI: req("MONGODB_URI"),
  DB_NAME: opt("DB_NAME", "matrix"),

  ELEVENLABS_API_KEY: opt("ELEVENLABS_API_KEY"),
  ELEVENLABS_BASE_URL: opt("ELEVENLABS_BASE_URL", "https://api.elevenlabs.io").replace(/\/$/, ""),
  ELEVENLABS_SERVICE_URL: opt("ELEVENLABS_SERVICE_URL").replace(/\/$/, ""),

  ZOHO_CLIENT_ID: opt("ZOHO_CLIENT_ID"),
  ZOHO_CLIENT_SECRET: opt("ZOHO_CLIENT_SECRET"),
  ZOHO_ACCOUNTS_URL: opt("ZOHO_ACCOUNTS_URL", "https://accounts.zoho.com").replace(/\/$/, ""),
  ZOHO_REDIRECT_URI: opt("ZOHO_REDIRECT_URI") || `${PUBLIC_BACKEND_URL}/api/v1/integrations/zoho/callback`,

  ENCRYPTION_KEY: opt("ENCRYPTION_KEY", "matrix-dev-encryption-key-change-me-32chars"),

  /** Single-tenant for now; every document carries this so multi-tenancy can be added later. */
  DEFAULT_WORKSPACE_ID: "default",
};

export const postCallWebhookUrl = () => `${env.PUBLIC_BACKEND_URL}/api/v1/webhooks/elevenlabs/post-call`;
