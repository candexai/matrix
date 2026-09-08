/**
 * Workspace-level ElevenLabs resources used by agents: HTTP (webhook) tools and knowledge-base documents.
 */
import { Router } from "express";
import { z } from "zod";
import multer from "multer";
import { asyncHandler, ok, HttpError } from "../utils/http";
import { elevenlabs } from "../services/elevenlabs/client";

export const toolsRouter = Router();
export const knowledgeRouter = Router();

const paramSchema = z.object({
  name: z.string().min(1).max(64).regex(/^[A-Za-z_][A-Za-z0-9_]*$/, "Use letters, digits and underscores"),
  type: z.enum(["string", "number", "integer", "boolean"]).default("string"),
  description: z.string().max(300).default(""),
  required: z.boolean().default(false),
  location: z.enum(["query", "body", "path"]).default("query"),
  /** fill from a dynamic variable instead of asking the LLM (e.g. lead_id) */
  dynamic_variable: z.string().max(64).optional(),
  constant_value: z.string().max(300).optional(),
});

const toolBody = z.object({
  name: z.string().min(1).max(64).regex(/^[A-Za-z_][A-Za-z0-9_-]*$/, "Use letters, digits, _ or -"),
  description: z.string().min(1).max(1000),
  url: z.string().url(),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).default("POST"),
  headers: z.record(z.string(), z.string()).default({}),
  params: z.array(paramSchema).default([]),
  response_timeout_secs: z.number().int().min(1).max(120).default(20),
  disable_interruptions: z.boolean().optional(),
  content_type: z.enum(["application/json", "application/x-www-form-urlencoded"]).optional(),
});

function literal(p: z.infer<typeof paramSchema>) {
  const out: Record<string, unknown> = { type: p.type, description: p.description };
  if (p.dynamic_variable) out.dynamic_variable = p.dynamic_variable;
  if (p.constant_value !== undefined && p.constant_value !== "") out.constant_value = p.type === "number" || p.type === "integer" ? Number(p.constant_value) : p.type === "boolean" ? p.constant_value === "true" : p.constant_value;
  return out;
}

/** Build ElevenLabs' webhook tool_config from our simplified form. */
export function buildWebhookToolConfig(b: z.infer<typeof toolBody>): Record<string, unknown> {
  const query = b.params.filter((p) => p.location === "query");
  const body = b.params.filter((p) => p.location === "body");
  const path = b.params.filter((p) => p.location === "path");
  const api_schema: Record<string, unknown> = { url: b.url, method: b.method, request_headers: b.headers };
  if (query.length) api_schema.query_params_schema = { properties: Object.fromEntries(query.map((p) => [p.name, literal(p)])), required: query.filter((p) => p.required).map((p) => p.name) };
  if (body.length) api_schema.request_body_schema = { type: "object", description: "Request body", properties: Object.fromEntries(body.map((p) => [p.name, literal(p)])), required: body.filter((p) => p.required).map((p) => p.name) };
  if (path.length) api_schema.path_params_schema = Object.fromEntries(path.map((p) => [p.name, literal(p)]));
  if (b.content_type) api_schema.content_type = b.content_type;
  return {
    type: "webhook",
    name: b.name,
    description: b.description,
    response_timeout_secs: b.response_timeout_secs,
    ...(b.disable_interruptions !== undefined ? { disable_interruptions: b.disable_interruptions } : {}),
    api_schema,
  };
}

/** Flatten a tool_config back into the form shape for editing / display. */
export function summarizeTool(t: { id: string; tool_config: Record<string, any>; usage_stats?: unknown }) {
  const cfg = t.tool_config ?? {};
  const api = cfg.api_schema ?? {};
  const params: unknown[] = [];
  const push = (loc: string, props: Record<string, any> | undefined, required: string[] = []) => {
    for (const [name, v] of Object.entries(props ?? {})) params.push({ name, type: v?.type ?? "string", description: v?.description ?? "", required: required.includes(name), location: loc, dynamic_variable: v?.dynamic_variable || undefined, constant_value: v?.constant_value ?? undefined });
  };
  push("query", api.query_params_schema?.properties, api.query_params_schema?.required);
  push("body", api.request_body_schema?.properties, api.request_body_schema?.required);
  push("path", api.path_params_schema);
  return {
    id: t.id,
    type: cfg.type,
    name: cfg.name,
    description: cfg.description,
    url: api.url,
    method: api.method ?? "GET",
    headers: api.request_headers ?? {},
    params,
    response_timeout_secs: cfg.response_timeout_secs ?? 20,
    usage_stats: t.usage_stats,
  };
}

toolsRouter.get("/", asyncHandler(async (_req, res) => ok(res, (await elevenlabs.listTools()).map((t) => summarizeTool(t as any)))));
toolsRouter.post("/", asyncHandler(async (req, res) => {
  const body = toolBody.parse(req.body);
  const created = await elevenlabs.createTool(buildWebhookToolConfig(body));
  ok(res, summarizeTool(created as any), 201);
}));
toolsRouter.patch("/:id", asyncHandler(async (req, res) => {
  const body = toolBody.parse(req.body);
  const updated = await elevenlabs.updateTool(req.params.id, buildWebhookToolConfig(body));
  ok(res, summarizeTool(updated as any));
}));
toolsRouter.delete("/:id", asyncHandler(async (req, res) => {
  await elevenlabs.deleteTool(req.params.id);
  ok(res, { deleted: true });
}));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

knowledgeRouter.get("/", asyncHandler(async (_req, res) => ok(res, (await elevenlabs.listKnowledgeBase()).filter((d) => d.type !== "folder").map((d) => ({ id: d.id, name: d.name, type: d.type, url: d.url, createdAt: d.metadata?.created_at_unix_secs ? new Date(d.metadata.created_at_unix_secs * 1000) : null, sizeBytes: d.metadata?.size_bytes ?? null, dependentAgents: Array.isArray(d.dependent_agents) ? d.dependent_agents.length : undefined })))));
knowledgeRouter.post("/url", asyncHandler(async (req, res) => {
  const { url, name } = z.object({ url: z.string().url(), name: z.string().max(120).optional() }).parse(req.body);
  ok(res, await elevenlabs.createKnowledgeUrl(url, name), 201);
}));
knowledgeRouter.post("/text", asyncHandler(async (req, res) => {
  const { text, name } = z.object({ text: z.string().min(1).max(500_000), name: z.string().max(120).optional() }).parse(req.body);
  ok(res, await elevenlabs.createKnowledgeText(text, name), 201);
}));
knowledgeRouter.post("/file", upload.single("file"), asyncHandler(async (req, res) => {
  const f = (req as unknown as { file?: Express.Multer.File }).file;
  if (!f) throw new HttpError(400, "Attach a file (pdf, docx, txt, html, epub)", "VALIDATION_ERROR");
  const name = typeof req.body?.name === "string" && req.body.name.trim() ? req.body.name.trim() : undefined;
  ok(res, await elevenlabs.createKnowledgeFile({ buffer: f.buffer, filename: f.originalname, mimetype: f.mimetype }, name), 201);
}));
knowledgeRouter.delete("/:id", asyncHandler(async (req, res) => {
  await elevenlabs.deleteKnowledgeDoc(req.params.id);
  ok(res, { deleted: true });
}));
