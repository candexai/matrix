import { Schema, model, Document, Types } from "mongoose";

export interface BindingField {
  /** Zoho Leads api_name, e.g. "Lead_Status" or a custom "Budget" */
  zohoField: string;
  label: string;
  dataType: string;
  /** Instruction for the agent on what to collect */
  description: string;
  /** Key used in ElevenLabs data_collection (snake_case) */
  collectionKey: string;
}

/**
 * "Attach a voice agent to My Leads": which agent calls the leads, from which number,
 * and which Zoho fields it should collect + write back when they are empty.
 */
export interface LeadAgentBindingDoc extends Document {
  workspaceId: string;
  /** null = workspace default binding; otherwise a LeadList id */
  listId: string | null;
  agentId: Types.ObjectId;
  elevenAgentId: string;
  phoneNumberId?: string;
  fields: BindingField[];
  onlyFillEmpty: boolean;
  pushToZoho: boolean;
  updateLeadStatusTo?: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const LeadAgentBindingSchema = new Schema<LeadAgentBindingDoc>(
  {
    workspaceId: { type: String, required: true, default: "default" },
    listId: { type: String, default: null },
    agentId: { type: Schema.Types.ObjectId, ref: "Agent", required: true },
    elevenAgentId: { type: String, required: true },
    phoneNumberId: String,
    fields: { type: [{ zohoField: String, label: String, dataType: String, description: String, collectionKey: String }], default: [] },
    onlyFillEmpty: { type: Boolean, default: true },
    pushToZoho: { type: Boolean, default: true },
    updateLeadStatusTo: String,
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

LeadAgentBindingSchema.index({ workspaceId: 1, listId: 1 }, { unique: true });

export const LeadAgentBinding = model<LeadAgentBindingDoc>("LeadAgentBinding", LeadAgentBindingSchema);
