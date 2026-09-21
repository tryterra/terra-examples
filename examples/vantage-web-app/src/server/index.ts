/**
 * API assembly. The chained .route() calls + `export type AppType` are the
 * whole client contract — the React app consumes it via hc<AppType>, no
 * codegen. Don't break the chain.
 */
import { Hono } from "hono";
import { logger } from "hono/logger";
import { opsRoutes } from "./routes/ops";
import { storefrontRoutes } from "./routes/storefront";
import { webhookRoutes } from "./routes/webhook";

const app = new Hono();
app.use(logger());

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- consumed as `typeof routes` below
const routes = app
  .route("/api/shop", storefrontRoutes)
  .route("/api/ops", opsRoutes)
  .route("/api/webhook", webhookRoutes);

export type AppType = typeof routes;
export default app;
