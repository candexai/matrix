import { Schema, model, Document } from "mongoose";

export type InsightCategory = "outcome" | "sentiment" | "objection" | "intent" | "topic" | "action" | "other";
export const INSIGHT_CATEGORIES: InsightCategory[] = ["outcome", "sentiment", "objection", "intent", "topic", "action", "other"];

export interface InsightTagExample {
  conversationId: string;
  leadName?: string;
  evidence?: string;
  at: Date;
}

export interface InsightTagMerge {
  key: string;
  label: string;
  count: number;
  at: Date;
  reason?: string;
  by: "llm" | "user";
}

/** One entry of the capped, self-organising tag taxonomy used by Conversation Insights. */
export interface InsightTagDoc extends Document {
  workspaceId: string;
  key: string;
  label: string;
  description: string;
  category: InsightCategory;
  /** stable palette index (0..n) assigned at creation */
  color: number;
  /** number of conversations currently carrying this tag (recomputed from conversations) */
  count: number;
  firstSeenAt: Date;
  lastSeenAt?: Date;
  examples: InsightTagExample[];
  status: "active" | "merged";
  mergedInto?: string;
  mergedFrom: InsightTagMerge[];
  createdBy: "llm" | "user";
  createdAt: Date;
  updatedAt: Date;
}

const InsightTagSchema = new Schema<InsightTagDoc>(
  {
    workspaceId: { type: String, required: true, index: true, default: "default" },
    key: { type: String, required: true },
    label: { type: String, required: true },
    description: { type: String, default: "" },
    category: { type: String, enum: INSIGHT_CATEGORIES, default: "topic" },
    color: { type: Number, default: 0 },
    count: { type: Number, default: 0 },
    firstSeenAt: { type: Date, default: () => new Date() },
    lastSeenAt: Date,
    examples: { type: [{ conversationId: String, leadName: String, evidence: String, at: Date }], default: [] },
    status: { type: String, enum: ["active", "merged"], default: "active", index: true },
    mergedInto: String,
    mergedFrom: { type: [{ key: String, label: String, count: Number, at: Date, reason: String, by: String }], default: [] },
    createdBy: { type: String, enum: ["llm", "user"], default: "llm" },
  },
  { timestamps: true }
);

InsightTagSchema.index({ workspaceId: 1, key: 1 }, { unique: true });
InsightTagSchema.index({ workspaceId: 1, status: 1, count: -1 });

export const InsightTag = model<InsightTagDoc>("InsightTag", InsightTagSchema);
