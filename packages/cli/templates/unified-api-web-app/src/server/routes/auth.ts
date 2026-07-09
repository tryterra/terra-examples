import { Hono } from "hono";
import { getAuth, type Env } from "../lib/auth";

const auth = new Hono<{ Bindings: Env }>();

auth.on(["POST", "GET"], "/*", (c) => {
  const origin = new URL(c.req.url).origin;
  return getAuth(c.env, origin).handler(c.req.raw);
});

export default auth;
