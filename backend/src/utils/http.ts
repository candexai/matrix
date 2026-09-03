import type { Request, Response, NextFunction, RequestHandler } from "express";

export class HttpError extends Error {
  status: number;
  code: string;
  details?: unknown;
  constructor(status: number, message: string, code = "ERROR", details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

export function ok(res: Response, data: unknown, status = 200) {
  return res.status(status).json({ success: true, data });
}

/** Extract a readable message from an axios error against ElevenLabs / Zoho. */
export function upstreamMessage(err: unknown): string {
  const e = err as { response?: { status?: number; data?: unknown }; message?: string };
  const data = e?.response?.data;
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    const detail = d.detail ?? d.error ?? d.message;
    if (typeof detail === "string") return detail;
    if (detail && typeof detail === "object") {
      const dd = detail as Record<string, unknown>;
      if (typeof dd.message === "string") return dd.message;
      return JSON.stringify(detail).slice(0, 500);
    }
    return JSON.stringify(data).slice(0, 500);
  }
  if (typeof data === "string") return data.slice(0, 500);
  return e?.message || "Upstream request failed";
}
