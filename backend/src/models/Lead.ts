import { Schema, model, Document, Types } from "mongoose";

export type LeadSource = "zoho" | "manual" | "csv";

export interface LeadDoc extends Document {
  _id: Types.ObjectId;
  workspaceId: string;
  source: LeadSource;
  zohoId?: string;
  zohoModifiedTime?: Date;
  firstName?: string;
  lastName?: string;
  fullName: string;
  email?: string;
  phone?: string;
  phoneKey?: string;
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
  /** Every Zoho field by api_name (raw) – used for "fill empty fields" logic and generic column display */
  fields: Record<string, unknown>;
  /** LeadList ids (Zoho custom views / manual lists) this lead belongs to */
  listIds: string[];
  tags: string[];
  callCount: number;
  lastCallAt?: Date;
  lastCallStatus?: string;
  lastCallOutcome?: string;
  lastCallSummary?: string;
  lastAgentId?: string;
  syncedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const LeadSchema = new Schema<LeadDoc>(
  {
    workspaceId: { type: String, required: true, index: true, default: "default" },
    source: { type: String, enum: ["zoho", "manual", "csv"], default: "manual", index: true },
    zohoId: { type: String, sparse: true },
    zohoModifiedTime: Date,
    firstName: String,
    lastName: String,
    fullName: { type: String, required: true, default: "" },
    email: { type: String, lowercase: true, trim: true },
    phone: String,
    phoneKey: { type: String, index: true },
    mobile: String,
    company: String,
    title: String,
    leadStatus: String,
    leadSource: String,
    city: String,
    state: String,
    country: String,
    industry: String,
    website: String,
    description: String,
    rating: String,
    annualRevenue: Number,
    fields: { type: Schema.Types.Mixed, default: {} },
    listIds: { type: [String], default: [], index: true },
    tags: { type: [String], default: [] },
    callCount: { type: Number, default: 0 },
    lastCallAt: Date,
    lastCallStatus: String,
    lastCallOutcome: String,
    lastCallSummary: String,
    lastAgentId: String,
    syncedAt: Date,
  },
  { timestamps: true, minimize: false }
);

LeadSchema.index({ workspaceId: 1, zohoId: 1 }, { unique: true, sparse: true });
LeadSchema.index({ workspaceId: 1, updatedAt: -1 });
LeadSchema.index({ workspaceId: 1, leadStatus: 1 });
LeadSchema.index({ fullName: "text", email: "text", company: "text", phone: "text" });

export const Lead = model<LeadDoc>("Lead", LeadSchema);
