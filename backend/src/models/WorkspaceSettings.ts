import { Schema, model, Document } from "mongoose";

export interface WorkspaceSettingsDoc extends Document {
  workspaceId: string;
  name: string;
  elevenWebhook?: { webhookId: string; url: string; secretEnc?: string; events: string[]; createdAt: Date };
  defaultPhoneNumberId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const WorkspaceSettingsSchema = new Schema<WorkspaceSettingsDoc>(
  {
    workspaceId: { type: String, required: true, unique: true, default: "default" },
    name: { type: String, default: "Matrix" },
    elevenWebhook: { webhookId: String, url: String, secretEnc: String, events: [String], createdAt: Date },
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
