import { Schema, model, Document, Types } from "mongoose";

/**
 * A "lead table" as the user sees it in My Leads. Zoho custom views of the Leads module map 1:1
 * to lists; manual lists can be created locally.
 */
export interface LeadListDoc extends Document {
  _id: Types.ObjectId;
  workspaceId: string;
  source: "zoho" | "manual";
  zohoCvId?: string;
  name: string;
  systemName?: string;
  category?: string;
  isDefault: boolean;
  /** Zoho field api_names shown as columns in this view */
  columns: string[];
  criteria?: unknown;
  recordCount: number;
  lastSyncAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const LeadListSchema = new Schema<LeadListDoc>(
  {
    workspaceId: { type: String, required: true, index: true, default: "default" },
    source: { type: String, enum: ["zoho", "manual"], default: "manual" },
    zohoCvId: { type: String },
    name: { type: String, required: true },
    systemName: String,
    category: String,
    isDefault: { type: Boolean, default: false },
    columns: { type: [String], default: [] },
    criteria: { type: Schema.Types.Mixed },
    recordCount: { type: Number, default: 0 },
    lastSyncAt: Date,
  },
  { timestamps: true }
);

LeadListSchema.index({ workspaceId: 1, zohoCvId: 1 }, { unique: true, sparse: true });
LeadListSchema.index({ workspaceId: 1, isDefault: -1, name: 1 });

export const LeadList = model<LeadListDoc>("LeadList", LeadListSchema);
