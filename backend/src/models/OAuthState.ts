import { Schema, model, Document } from "mongoose";

/** Short-lived CSRF state for OAuth redirects. */
export interface OAuthStateDoc extends Document {
  state: string;
  provider: string;
  workspaceId: string;
  createdAt: Date;
}

const OAuthStateSchema = new Schema<OAuthStateDoc>({
  state: { type: String, required: true, unique: true },
  provider: { type: String, required: true },
  workspaceId: { type: String, required: true },
  createdAt: { type: Date, default: () => new Date(), expires: 600 },
});

export const OAuthState = model<OAuthStateDoc>("OAuthState", OAuthStateSchema);
