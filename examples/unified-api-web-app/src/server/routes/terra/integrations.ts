import { Hono } from "hono";
import type { AuthSession, AuthUser, Env } from "../../lib/auth";
import { createTerraPublicClient } from "../../lib/terra/client";
import { requireAuth } from "../../middleware/auth";

const terraIntegrations = new Hono<{
  Bindings: Env;
  Variables: { user: AuthUser; session: AuthSession };
}>().get("/", requireAuth, async (c) => {
  try {
    const client = createTerraPublicClient(c.env);
    const result = await client.integrations.detailedfetch({ sdk: false });
    return c.json(result);
  } catch (error) {
    console.error("Terra integrations fetch error:", error);
    return c.json({ error: "Failed to fetch integrations" }, 502);
  }
});

export default terraIntegrations;
