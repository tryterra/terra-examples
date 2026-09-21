import { zValidator } from "@hono/zod-validator";
import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import type { Terra } from "terra-api";
import { z } from "zod";
import { terraConnection, terraWebhookEvent } from "../../../../db/schema";
import type { AuthSession, AuthUser, Env } from "../../lib/auth";
import { createDb } from "../../lib/db";
import { createTerraClient } from "../../lib/terra/client";
import { requestBackfill } from "../../lib/terra/backfill";
import { syncTerraConnections } from "../../lib/terra/sync-connections";
import { requireAuth } from "../../middleware/auth";

/* -------------------------------------------------------------------------- */
/*                                   Helpers                                  */
/* -------------------------------------------------------------------------- */

/** Column subset shared by connection list and detail endpoints. */
const connectionFields = {
  id: terraConnection.id,
  terraUserId: terraConnection.terraUserId,
  provider: terraConnection.provider,
  scopes: terraConnection.scopes,
  status: terraConnection.status,
  lastWebhookAt: terraConnection.lastWebhookAt,
  connectedAt: terraConnection.connectedAt,
} as const;

/* -------------------------------------------------------------------------- */
/*                                    Route                                   */
/* -------------------------------------------------------------------------- */

const terraConnections = new Hono<{
  Bindings: Env;
  Variables: { user: AuthUser; session: AuthSession };
}>()
  .get(
    "/:id",
    requireAuth,
    zValidator("param", z.object({ id: z.uuid() })),
    zValidator(
      "query",
      z.object({ offset: z.coerce.number().int().min(0).default(0) }),
    ),
    async (c) => {
      try {
        const db = createDb(c.env.DATABASE_URL);
        const userId = c.get("user").id;
        const { id: connectionId } = c.req.valid("param");
        const { offset } = c.req.valid("query");

        const [connection] = await db
          .select(connectionFields)
          .from(terraConnection)
          .where(
            and(
              eq(terraConnection.id, connectionId),
              eq(terraConnection.userId, userId),
            ),
          )
          .limit(1);

        if (!connection) {
          return c.json({ error: "Connection not found" }, 404);
        }

        const webhookEvents = await db
          .select({
            eventType: terraWebhookEvent.eventType,
            createdAt: terraWebhookEvent.createdAt,
          })
          .from(terraWebhookEvent)
          .where(eq(terraWebhookEvent.terraUserId, connection.terraUserId))
          .orderBy(desc(terraWebhookEvent.createdAt))
          .limit(5)
          .offset(offset);

        return c.json({ connection, webhookEvents });
      } catch (error) {
        console.error("Terra connection detail error:", error);
        return c.json({ error: "Failed to load connection" }, 502);
      }
    },
  )

  .get("/", requireAuth, async (c) => {
    try {
      const db = createDb(c.env.DATABASE_URL);
      const userId = c.get("user").id;

      const connections = await db
        .select(connectionFields)
        .from(terraConnection)
        .where(eq(terraConnection.userId, userId));

      return c.json({ connections });
    } catch (error) {
      console.error("Terra connections fetch error:", error);
      return c.json({ error: "Failed to load connections" }, 502);
    }
  })

  .post("/sync", requireAuth, async (c) => {
    try {
      const db = createDb(c.env.DATABASE_URL);
      const userId = c.get("user").id;
      const client = createTerraClient(c.env);
      const result = await syncTerraConnections(db, client, userId, {
        onNeedsBackfill: (terraUserId, provider) =>
          requestBackfill(client, terraUserId, provider),
      });
      return c.json(result);
    } catch (error) {
      console.error("Terra sync error:", error);
      return c.json({ error: "Failed to sync connections" }, 502);
    }
  })

  .delete(
    "/:id",
    requireAuth,
    zValidator("param", z.object({ id: z.uuid() })),
    async (c) => {
      try {
        const db = createDb(c.env.DATABASE_URL);
        const userId = c.get("user").id;
        const { id: connectionId } = c.req.valid("param");

        const [connection] = await db
          .select({
            id: terraConnection.id,
            terraUserId: terraConnection.terraUserId,
          })
          .from(terraConnection)
          .where(
            and(
              eq(terraConnection.id, connectionId),
              eq(terraConnection.userId, userId),
            ),
          )
          .limit(1);

        if (!connection) {
          return c.json({ error: "Connection not found" }, 404);
        }

        const client = createTerraClient(c.env);

        // Check if the user still exists on Terra before attempting deauth
        let existsOnTerra = false;
        try {
          const info = await client.user.getinfoforuserid({
            reference_id: userId,
          });
          const users =
            ("users" in info ? (info.users as Terra.TerraUser[]) : []) ?? [];
          existsOnTerra = users.some(
            (u) => u.user_id === connection.terraUserId,
          );
        } catch (error) {
          console.error("Terra user lookup error:", error);
        }

        if (existsOnTerra) {
          try {
            await client.authentication.deauthenticateuser({
              user_id: connection.terraUserId,
            });
          } catch (error) {
            console.error("Terra deauth error:", error);
            await db
              .update(terraConnection)
              .set({ status: "error" })
              .where(eq(terraConnection.id, connectionId));
            return c.json({ error: "Failed to deauth with provider" }, 502);
          }
        }

        await db
          .delete(terraConnection)
          .where(eq(terraConnection.id, connectionId));

        return c.json({ success: true });
      } catch (error) {
        console.error("Terra connection delete error:", error);
        return c.json({ error: "Failed to delete connection" }, 502);
      }
    },
  );

export default terraConnections;
