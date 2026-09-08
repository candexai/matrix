import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { User, UserDoc } from "../models/User";
import { WorkspaceSettings } from "../models/WorkspaceSettings";
import { HttpError } from "../utils/http";
import { env } from "../config/env";

export const AUTH_COOKIE = "matrix_session";
const SESSION_DAYS = 30;

function secret(): string {
  const s = process.env.JWT_SECRET || env.ENCRYPTION_KEY;
  if (!s || s.length < 16) throw new HttpError(500, "JWT_SECRET is not configured", "AUTH_NOT_CONFIGURED");
  return s;
}

export interface SessionClaims {
  sub: string;
  ws: string;
  email: string;
  name: string;
  role: string;
}

export function signSession(user: UserDoc): string {
  const claims: SessionClaims = { sub: String(user._id), ws: user.workspaceId, email: user.email, name: user.name, role: user.role };
  return jwt.sign(claims, secret(), { expiresIn: `${SESSION_DAYS}d` });
}

export function verifySession(token: string): SessionClaims | null {
  try {
    return jwt.verify(token, secret()) as SessionClaims;
  } catch {
    return null;
  }
}

export const cookieOptions = () => ({
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_DAYS * 24 * 3600 * 1000,
});

export function publicUser(u: UserDoc) {
  return { id: String(u._id), email: u.email, name: u.name, workspaceId: u.workspaceId, role: u.role, createdAt: u.createdAt };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Sign-up. The very first account takes ownership of the bootstrap workspace ("default") so data
 * created before auth existed stays visible; every later account gets its own empty workspace.
 */
export async function signup(input: { email: string; password: string; name: string; company?: string }): Promise<UserDoc> {
  const email = input.email.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) throw new HttpError(400, "Enter a valid email address", "VALIDATION_ERROR");
  if (!input.password || input.password.length < 8) throw new HttpError(400, "Password must be at least 8 characters", "VALIDATION_ERROR");
  if (!input.name?.trim()) throw new HttpError(400, "Name is required", "VALIDATION_ERROR");
  if (await User.exists({ email })) throw new HttpError(409, "An account with this email already exists — sign in instead", "EMAIL_TAKEN");

  const first = (await User.countDocuments()) === 0;
  const workspaceId = first ? env.DEFAULT_WORKSPACE_ID : crypto.randomBytes(8).toString("hex");
  const user = await User.create({ email, passwordHash: await bcrypt.hash(input.password, 11), name: input.name.trim(), workspaceId, role: "owner", lastLoginAt: new Date() });
  const settings = (await WorkspaceSettings.findOne({ workspaceId })) ?? (await WorkspaceSettings.create({ workspaceId }));
  if (input.company?.trim() || settings.name === "Matrix") {
    settings.name = input.company?.trim() || `${user.name}'s workspace`;
    await settings.save();
  }
  return user;
}

export async function login(input: { email: string; password: string }): Promise<UserDoc> {
  const email = input.email.trim().toLowerCase();
  const user = await User.findOne({ email });
  const ok = user ? await bcrypt.compare(input.password || "", user.passwordHash) : await bcrypt.compare(input.password || "", "$2a$11$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalid").catch(() => false);
  if (!user || !ok) throw new HttpError(401, "Incorrect email or password", "INVALID_CREDENTIALS");
  user.lastLoginAt = new Date();
  await user.save();
  return user;
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
  const user = await User.findById(userId);
  if (!user) throw new HttpError(404, "User not found", "USER_NOT_FOUND");
  if (!(await bcrypt.compare(currentPassword || "", user.passwordHash))) throw new HttpError(401, "Current password is incorrect", "INVALID_CREDENTIALS");
  if (!newPassword || newPassword.length < 8) throw new HttpError(400, "New password must be at least 8 characters", "VALIDATION_ERROR");
  user.passwordHash = await bcrypt.hash(newPassword, 11);
  await user.save();
}

/** Simple in-memory login throttle: max 10 attempts per email+ip per 15 minutes. */
const attempts = new Map<string, { n: number; until: number }>();
export function throttle(key: string) {
  const now = Date.now();
  const cur = attempts.get(key);
  if (cur && cur.until > now && cur.n >= 10) throw new HttpError(429, "Too many attempts — try again in a few minutes", "RATE_LIMITED");
  if (!cur || cur.until <= now) attempts.set(key, { n: 1, until: now + 15 * 60_000 });
  else cur.n++;
}
export function clearThrottle(key: string) {
  attempts.delete(key);
}
