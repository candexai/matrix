import { Schema, model, Document } from "mongoose";

export interface WorkspaceSettingsDoc extends Document {
  workspaceId: string;
  name: string;
  elevenWebhook?: { webhookId: string; url: string; secretEnc?: string; events: string[]; createdAt: Date };
  /** Zoho OAuth client configured from the UI (overrides ZOHO_* env vars) */
  zohoApp?: { clientId: string; clientSecretEnc: string; accountsUrl: string; redirectUri?: string; updatedAt: Date };
  /** ElevenLabs API key of this workspace (encrypted). Only the legacy "default" workspace may fall back to ELEVENLABS_API_KEY. */
  elevenLabs?: { apiKeyEnc: string; baseUrl: string; keyHint: string; connectedAt: Date; accountName?: string };
  defaultPhoneNumberId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const WorkspaceSettingsSchema = new Schema<WorkspaceSettingsDoc>(
  {
    workspaceId: { type: String, required: true, unique: true, default: "default" },
    name: { type: String, default: "Matrix" },
    elevenWebhook: { webhookId: String, url: String, secretEnc: String, events: [String], createdAt: Date },
    zohoApp: { clientId: String, clientSecretEnc: String, accountsUrl: String, redirectUri: String, updatedAt: Date },
    elevenLabs: { apiKeyEnc: String, baseUrl: String, keyHint: String, connectedAt: Date, accountName: String },
    defaultPhoneNumberId: String,
  },
  { timestamps: true }
);

export const WorkspaceSettings = model<WorkspaceSettingsDoc>("WorkspaceSettings", WorkspaceSettingsSchema);

export async function getWorkspaceSettings(workspaceId: string): Promise<WorkspaceSettingsDoc> {
  const existing = await WorkspaceSettings.findOne({ workspaceId });
  if (existing) return existing;
  return WorkspaceSettings.create({ workspaceId });
}
