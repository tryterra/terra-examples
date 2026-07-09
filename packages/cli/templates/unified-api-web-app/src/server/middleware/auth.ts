import { createMiddleware } from "hono/factory";
import {
  getAuth,
  type AuthSession,
  type AuthUser,
  type Env,
} from "../lib/auth";

export const authMiddleware = createMiddleware<{
  Bindings: Env;
  Variables: {
    user: AuthUser | null;
    session: AuthSession | null;
  };
}>(async (c, next) => {
  const origin = new URL(c.req.url).origin;
  const auth = getAuth(c.env, origin);
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  c.set("user", session?.user ?? null);
  c.set("session", session?.session ?? null);
  await next();
});

export const requireAuth = createMiddleware<{
  Bindings: Env;
  Variables: {
    user: AuthUser;
    session: AuthSession;
  };
}>(async (c, next) => {
  const origin = new URL(c.req.url).origin;
  const auth = getAuth(c.env, origin);
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  c.set("user", session.user);
  c.set("session", session.session);
  await next();
});
