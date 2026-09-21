import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { agentsMiddleware } from "hono-agents";
import { terraConnection } from "../../db/schema";
import type { Env } from "./lib/auth";
import { createDb } from "./lib/db";
import { createTerraClient } from "./lib/terra/client";
import { syncTerraConnections } from "./lib/terra/sync-connections";
import authRoutes from "./routes/auth";
import chatRoutes from "./routes/chat";
import configRoutes from "./routes/config";
import healthRoutes from "./routes/health";
import onboardingRoutes from "./routes/onboarding";
import terraRoutes from "./routes/terra/route";
import usersRoutes from "./routes/users";

export { ChatAgent } from "./agents/chat-agent";

const app = new Hono<{ Bindings: Env }>();

app.use("*", logger());

app.use("/agents/*", agentsMiddleware());

app.use(
  "/api/*",
  cors({
    origin: (origin, c) => {
      const self = new URL(c.req.url).origin;
      return origin === self ? origin : null;
    },
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["POST", "GET", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  }),
);

const routes = app
  .route("/api/auth", authRoutes)
  .route("/api/chat", chatRoutes)
  .route("/api/config", configRoutes)
  .route("/api/health", healthRoutes)
  .route("/api/onboarding", onboardingRoutes)
  .route("/api/users", usersRoutes)
  .route("/api/terra", terraRoutes);

export type AppType = typeof routes;

export default {
  fetch: (...args: Parameters<typeof app.fetch>) => app.fetch(...args),

  async scheduled(
    _controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ) {
    ctx.waitUntil(
      (async () => {
        if (!env.TERRA_DEV_ID || !env.TERRA_API_KEY) return;

        const db = createDb(env.DATABASE_URL);
        const client = createTerraClient(env);

        const userIds = await db
          .selectDistinct({ userId: terraConnection.userId })
          .from(terraConnection)
          .where(eq(terraConnection.status, "active"));

        for (const { userId } of userIds) {
          try {
            await syncTerraConnections(db, client, userId);
          } catch (error) {
            console.error(`Sync failed for user ${userId}:`, error);
          }
        }
      })(),
    );
  },
};
