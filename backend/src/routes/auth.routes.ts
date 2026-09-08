import { Router } from "express";
import { z } from "zod";
import { asyncHandler, ok } from "../utils/http";
import * as auth from "../services/auth.service";
import { requireAuth } from "../middleware/auth.middleware";
import { User } from "../models/User";
import { WorkspaceSettings } from "../models/WorkspaceSettings";

const router = Router();

router.post("/signup", asyncHandler(async (req, res) => {
  const body = z.object({ email: z.string().min(3), password: z.string().min(1), name: z.string().min(1).max(80), company: z.string().max(120).optional() }).parse(req.body);
  auth.throttle(`signup:${req.ip}`);
  const user = await auth.signup(body);
  res.cookie(auth.AUTH_COOKIE, auth.signSession(user), auth.cookieOptions());
  ok(res, { user: auth.publicUser(user), token: auth.signSession(user) }, 201);
}));

router.post("/login", asyncHandler(async (req, res) => {
  const body = z.object({ email: z.string().min(3), password: z.string().min(1) }).parse(req.body);
  const key = `login:${body.email.toLowerCase()}:${req.ip}`;
  auth.throttle(key);
  const user = await auth.login(body);
  auth.clearThrottle(key);
  res.cookie(auth.AUTH_COOKIE, auth.signSession(user), auth.cookieOptions());
  ok(res, { user: auth.publicUser(user), token: auth.signSession(user) });
}));

router.post("/logout", (req, res) => {
  res.clearCookie(auth.AUTH_COOKIE, { path: "/" });
  ok(res, { loggedOut: true });
});

router.get("/me", requireAuth, asyncHandler(async (req, res) => {
  const [user, settings] = await Promise.all([User.findById(req.user!.sub), WorkspaceSettings.findOne({ workspaceId: req.user!.ws })]);
  if (!user) return res.status(401).json({ success: false, error: { code: "UNAUTHENTICATED", message: "Session is no longer valid" } });
  ok(res, { user: auth.publicUser(user), workspace: { id: user.workspaceId, name: settings?.name ?? "Matrix" } });
}));

router.post("/change-password", requireAuth, asyncHandler(async (req, res) => {
  const body = z.object({ currentPassword: z.string(), newPassword: z.string() }).parse(req.body);
  await auth.changePassword(req.user!.sub, body.currentPassword, body.newPassword);
  ok(res, { changed: true });
}));

/** Whether any account exists yet (so the login page can offer sign-up first). */
router.get("/status", asyncHandler(async (_req, res) => ok(res, { hasAccounts: (await User.countDocuments()) > 0 })));

export default router;
