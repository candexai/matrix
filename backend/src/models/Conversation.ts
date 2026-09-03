import { Schema, model, Document, Types } from "mongoose";

export interface TranscriptTurn {
  role: "agent" | "user" | string;
  message: string;
  timeInCallSecs?: number;
  toolCalls?: unknown[];
}

export interface ConversationInsightTag {
  key: string;
  label: string;
  category?: string;
  evidence?: string;
}

/** Output of the per-call insights analysis (see services/insights.service.ts). */
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
  analyzedAt: Date;
  version: number;
  error?: string;
  skipped?: string;
}

export interface ConversationDoc extends Document {
  _id: Types.ObjectId;
  workspaceId: string;
  channel: "voice" | "website" | "whatsapp" | "instagram" | "facebook" | "telegram";
  elevenConversationId: string;
  elevenAgentId?: string;
  agentName?: string;
  agentRef?: Types.ObjectId;
  leadId?: Types.ObjectId;
  leadName?: string;
  phone?: string;
  direction?: "inbound" | "outbound";
  status: "initiated" | "in_progress" | "processing" | "done" | "failed";
  callSuccessful?: "success" | "failure" | "unknown";
  transcript: TranscriptTurn[];
  summary?: string;
  summaryTitle?: string;
  durationSecs?: number;
  startedAt?: Date;
  endedAt?: Date;
  terminationReason?: string;
  dataCollection?: Record<string, { value: unknown; rationale?: string }>;
  evaluation?: Record<string, { result: string; rationale?: string }>;
  dynamicVariables?: Record<string, unknown>;
  hasAudio: boolean;
  batchCallId?: string;
  zohoSync?: {
    attemptedAt?: Date;
    pushedAt?: Date;
    updatedFields?: string[];
    skippedFields?: string[];
    error?: string;
  };
  extraction?: {
    provider: string;
    model?: string;
    at: Date;
    candidateFields: string[];
    extracted: Record<string, unknown>;
    skipped?: string;
    error?: string;
  };
  insights?: ConversationInsights;
  raw?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const ConversationSchema = new Schema<ConversationDoc>(
  {
    workspaceId: { type: String, required: true, index: true, default: "default" },
    channel: { type: String, default: "voice", index: true },
    elevenConversationId: { type: String, required: true, unique: true },
    elevenAgentId: { type: String, index: true },
    agentName: String,
    agentRef: { type: Schema.Types.ObjectId, ref: "Agent" },
    leadId: { type: Schema.Types.ObjectId, ref: "Lead", index: true },
    leadName: String,
    phone: String,
    direction: { type: String, enum: ["inbound", "outbound"] },
    status: { type: String, enum: ["initiated", "in_progress", "processing", "done", "failed"], default: "initiated", index: true },
    callSuccessful: { type: String, enum: ["success", "failure", "unknown"] },
    transcript: { type: [{ role: String, message: String, timeInCallSecs: Number, toolCalls: [Schema.Types.Mixed] }], default: [] },
    summary: String,
    summaryTitle: String,
    durationSecs: Number,
    startedAt: Date,
    endedAt: Date,
    terminationReason: String,
    dataCollection: { type: Schema.Types.Mixed },
    evaluation: { type: Schema.Types.Mixed },
    dynamicVariables: { type: Schema.Types.Mixed },
    hasAudio: { type: Boolean, default: false },
    batchCallId: String,
    zohoSync: {
      attemptedAt: Date,
      pushedAt: Date,
      updatedFields: [String],
      skippedFields: [String],
      error: String,
    },
    extraction: { type: Schema.Types.Mixed },
    insights: { type: Schema.Types.Mixed },
    raw: { type: Schema.Types.Mixed },
  },
  { timestamps: true, minimize: false }
);

ConversationSchema.index({ workspaceId: 1, startedAt: -1 });
ConversationSchema.index({ workspaceId: 1, createdAt: -1 });
ConversationSchema.index({ workspaceId: 1, "insights.tags.key": 1 });

export const Conversation = model<ConversationDoc>("Conversation", ConversationSchema);
