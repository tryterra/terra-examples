import { Hono } from "hono";
import type { Env } from "../../lib/auth";
import terraWebhook from "./webhook";
import terraConnections from "./connections";
import terraIntegrations from "./integrations";
import terraAuth from "./auth";
import terraDashboard from "./dashboard";
import terraTrends from "./trends";

const terraRoutes = new Hono<{ Bindings: Env }>()
  .route("/webhook", terraWebhook)
  .route("/connections", terraConnections)
  .route("/integrations", terraIntegrations)
  .route("/auth", terraAuth)
  .route("/dashboard", terraDashboard)
  .route("/trends", terraTrends);

export default terraRoutes;
