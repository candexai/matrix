import { Schema, model, Document } from "mongoose";

export interface ZohoFieldMeta {
  api_name: string;
  field_label: string;
  data_type: string;
  read_only: boolean;
  custom_field: boolean;
  pick_list_values?: { display_value: string; actual_value: string }[];
  length?: number;
}

export interface ZohoIntegrationDoc extends Document {
  workspaceId: string;
  status: "connected" | "revoked" | "error";
  accessTokenEnc: string;
  refreshTokenEnc?: string;
  tokenExpiry: Date;
  apiDomain: string;
  accountsServer: string;
  scopes: string[];
  profile?: { email?: string; fullName?: string; orgName?: string; zuid?: string; orgId?: string };
  syncStatus: "idle" | "running" | "error";
  syncError?: string;
  lastSyncAt?: Date;
  lastSyncStats?: { fetched: number; created: number; updated: number; lists?: number; durationMs: number };
  fieldsCache?: ZohoFieldMeta[];
  fieldsCachedAt?: Date;
  connectedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ZohoIntegrationSchema = new Schema<ZohoIntegrationDoc>(
  {
    workspaceId: { type: String, required: true, unique: true, default: "default" },
    status: { type: String, enum: ["connected", "revoked", "error"], default: "connected" },
    accessTokenEnc: { type: String, required: true },
    refreshTokenEnc: String,
    tokenExpiry: { type: Date, required: true },
    apiDomain: { type: String, required: true },
    accountsServer: { type: String, required: true },
    scopes: { type: [String], default: [] },
    profile: { email: String, fullName: String, orgName: String, zuid: String, orgId: String },
    syncStatus: { type: String, enum: ["idle", "running", "error"], default: "idle" },
    syncError: String,
    lastSyncAt: Date,
    lastSyncStats: { fetched: Number, created: Number, updated: Number, lists: Number, durationMs: Number },
    fieldsCache: { type: Schema.Types.Mixed },
    fieldsCachedAt: Date,
    connectedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true, minimize: false }
);

export const ZohoIntegration = model<ZohoIntegrationDoc>("ZohoIntegration", ZohoIntegrationSchema);
