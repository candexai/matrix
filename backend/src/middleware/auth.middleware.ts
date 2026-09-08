import type { Request, Response, NextFunction } from "express";
import { AUTH_COOKIE, verifySession, SessionClaims } from "../services/auth.service";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: SessionClaims;
    }
  }
}

function readToken(req: Request): string | null {
  const auth = req.header("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7).trim();
  const cookie = (req as Request & { cookies?: Record<string, string> }).cookies?.[AUTH_COOKIE];
  return cookie || null;
}

/** Attaches req.user + req.workspaceId when a valid session is present (no rejection). */
export function attachSession(req: Request, _res: Response, next: NextFunction) {
  const token = readToken(req);
  const claims = token ? verifySession(token) : null;
  if (claims) {
    req.user = claims;
    req.workspaceId = claims.ws;
  }
  next();
}

/** Rejects unauthenticated requests with 401. */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: { code: "UNAUTHENTICATED", message: "Sign in to continue" } });
  }
  next();
}
