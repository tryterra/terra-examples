import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import type { AuthSession, AuthUser, Env } from "../../lib/auth";
import { createTerraClient } from "../../lib/terra/client";
import { requireAuth } from "../../middleware/auth";

/* -------------------------------------------------------------------------- */
/*                                    Route                                   */
/* -------------------------------------------------------------------------- */

const terraAuth = new Hono<{
  Bindings: Env;
  Variables: { user: AuthUser; session: AuthSession };
}>().post(
  "/",
  requireAuth,
  zValidator(
    "json",
    z.object({
      resource: z.string(),
      authSuccessRedirectUrl: z.string().url().optional(),
      authFailureRedirectUrl: z.string().url().optional(),
    }),
  ),
  async (c) => {
    try {
      const userId = c.get("user").id;
      const { resource, authSuccessRedirectUrl, authFailureRedirectUrl } =
        c.req.valid("json");

      const client = createTerraClient(c.env);
      const result = await client.authentication.authenticateuser({
        resource,
        reference_id: userId,
        auth_success_redirect_url: authSuccessRedirectUrl,
        auth_failure_redirect_url: authFailureRedirectUrl,
      });

      return c.json(result);
    } catch (error) {
      console.error("Terra auth error:", error);
      return c.json({ error: "Failed to generate auth URL" }, 502);
    }
  },
);

export default terraAuth;
