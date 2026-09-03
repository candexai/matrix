import type { Request, Response, NextFunction } from "express";
import { env } from "../config/env";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      workspaceId: string;
      rawBody?: string;
    }
  }
}

/** Single-tenant today: workspace comes from a header if provided, else "default". */
export function workspace(req: Request, _res: Response, next: NextFunction) {
  const hdr = req.header("x-workspace-id");
  req.workspaceId = (hdr && hdr.trim()) || env.DEFAULT_WORKSPACE_ID;
  next();
}
