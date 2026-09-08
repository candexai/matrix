import { Schema, model, Document, Types } from "mongoose";

export interface UserDoc extends Document {
  _id: Types.ObjectId;
  email: string;
  passwordHash: string;
  name: string;
  workspaceId: string;
  role: "owner" | "member";
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<UserDoc>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    workspaceId: { type: String, required: true, index: true },
    role: { type: String, enum: ["owner", "member"], default: "owner" },
    lastLoginAt: Date,
  },
  { timestamps: true }
);

export const User = model<UserDoc>("User", UserSchema);
