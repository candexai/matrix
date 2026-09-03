import type { Request, Response, NextFunction } from "express";
import { HttpError, upstreamMessage } from "../utils/http";
import { ZodError } from "zod";

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Route not found" } });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ success: false, error: { code: err.code, message: err.message, details: err.details } });
  }
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: { code: "VALIDATION_ERROR", message: err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "), details: err.issues },
    });
  }
  const anyErr = err as { response?: { status?: number }; message?: string; stack?: string };
  if (anyErr?.response?.status) {
    const status = anyErr.response.status >= 500 ? 502 : anyErr.response.status;
    return res.status(status).json({ success: false, error: { code: "UPSTREAM_ERROR", message: upstreamMessage(err) } });
  }
  console.error("[error]", anyErr?.stack || err);
  return res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: anyErr?.message || "Internal server error" } });
}
