import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { env } from "./config/env";
import { attachSession, requireAuth } from "./middleware/auth.middleware";
import authRoutes from "./routes/auth.routes";
import { errorHandler, notFound } from "./middleware/error.middleware";
import agentsRoutes from "./routes/agents.routes";
import catalogRoutes from "./routes/catalog.routes";
import leadsRoutes from "./routes/leads.routes";
import conversationsRoutes from "./routes/conversations.routes";
import integrationsRoutes from "./routes/integrations.routes";
import webhooksRoutes from "./routes/webhooks.routes";
import analyticsRoutes from "./routes/analytics.routes";
import devRoutes from "./routes/dev.routes";
import phoneNumbersRoutes from "./routes/phoneNumbers.routes";
import leadListsRoutes from "./routes/leadLists.routes";
import insightsRoutes from "./routes/insights.routes";
import { toolsRouter, knowledgeRouter } from "./routes/toolsKb.routes";

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        const allowed = [env.FRONTEND_URL, "http://localhost:3000", "http://127.0.0.1:3000"];
        cb(null, allowed.includes(origin) || /^https?:\/\/localhost(:\d+)?$/.test(origin));
      },
      credentials: true,
    })
  );
  app.use(
    express.json({
      limit: "10mb",
      verify: (req, _res, buf) => {
        (req as express.Request).rawBody = buf.toString("utf8");
      },
    })
  );
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(attachSession);

  app.get("/health", (_req, res) => res.json({ ok: true, service: "matrix-backend", time: new Date().toISOString() }));
  app.get("/api/v1/health", (_req, res) => res.json({ ok: true, service: "matrix-backend", time: new Date().toISOString() }));

  // ---- auth: public endpoints are the session routes, the ElevenLabs webhook, the Zoho OAuth
  // callback (identified by its state) and health; everything else needs a session ----
  const PUBLIC = [/^\/auth\//, /^\/webhooks\//, /^\/integrations\/zoho\/callback$/, /^\/health$/];
  app.use("/api/v1", (req, res, next) => (PUBLIC.some((re) => re.test(req.path)) ? next() : requireAuth(req, res, next)));
  app.use("/api/v1/auth", authRoutes);
  app.use("/api/v1/agents", agentsRoutes);
  app.use("/api/v1/phone-numbers", phoneNumbersRoutes);
  app.use("/api/v1/tools", toolsRouter);
  app.use("/api/v1/knowledge-base", knowledgeRouter);
  app.use("/api/v1", catalogRoutes);
  app.use("/api/v1/lead-lists", leadListsRoutes);
  app.use("/api/v1/leads", leadsRoutes);
  app.use("/api/v1/conversations", conversationsRoutes);
  app.use("/api/v1/integrations", integrationsRoutes);
  app.use("/api/v1/webhooks", webhooksRoutes);
  app.use("/api/v1/analytics/insights", insightsRoutes);
  app.use("/api/v1/analytics", analyticsRoutes);
  app.use("/api/v1/dev", devRoutes);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
