/**
 * API assembly. The chained .route() calls + `export type AppType` are the
 * whole client contract — the React app consumes it via hc<AppType>, no
 * codegen. Don't break the chain.
 */
import { Hono } from "hono";
import { logger } from "hono/logger";
import { aiEnabled } from "./lib/ai";
import { isDemoMode } from "./lib/env";
import { aiRoutes } from "./routes/ai";
import { analysisRoutes } from "./routes/analysis";
import { chatRoutes } from "./routes/chat";
import { drawContextRoutes } from "./routes/draw-context";
import { flagInsightRoutes } from "./routes/flag-insight";
import { labReportRoutes } from "./routes/lab-reports";
import { labTrendRoutes } from "./routes/lab-trends";
import { patientRoutes } from "./routes/patients";
import { uploadRoutes } from "./routes/uploads";
import { wearableRoutes } from "./routes/wearables";

const app = new Hono();
app.use(logger());

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- consumed as `typeof routes` below
const routes = app
  .get("/api/health", (c) =>
    c.json({ ok: true, demo: isDemoMode(), ai: aiEnabled() }),
  )
  .route("/api/patients", patientRoutes)
  .route("/api", labReportRoutes)
  .route("/api", uploadRoutes)
  .route("/api", wearableRoutes)
  .route("/api", analysisRoutes)
  .route("/api", labTrendRoutes)
  .route("/api", aiRoutes)
  .route("/api", chatRoutes)
  .route("/api", drawContextRoutes)
  .route("/api", flagInsightRoutes);

export type AppType = typeof routes;
export default app;
