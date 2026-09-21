import { Hono } from "hono";
import type { Env } from "../lib/auth";

// Client-visible feature flags derived from configured credentials.
// Chained so Hono captures the route type for the RPC client.
const config = new Hono<{ Bindings: Env }>().get("/", (c) =>
  c.json({ chatEnabled: Boolean(c.env.ANTHROPIC_API_KEY) }),
);

export default config;
