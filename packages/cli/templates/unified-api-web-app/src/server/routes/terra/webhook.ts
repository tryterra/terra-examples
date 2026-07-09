import { Hono } from "hono";
import type { Terra } from "terra-api";
import { verifyTerraWebhookSignature } from "terra-api";
import { eq } from "drizzle-orm";
import { terraWebhookEvent } from "../../../../db/schema";
import type { Env } from "../../lib/auth";
import { createDb } from "../../lib/db";
import { createTerraClient } from "../../lib/terra/client";
import {
  extractUserId,
  markEvent,
  processWebhookEvent,
} from "../../lib/terra/webhook-handler";
import { requestBackfill } from "../../lib/terra/backfill";

/* -------------------------------------------------------------------------- */
/*                                    Route                                   */
/* -------------------------------------------------------------------------- */

const terraWebhook = new Hono<{
  Bindings: Env;
}>().post("/", async (c) => {
  const webhookSecret = c.env.TERRA_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return c.json({ error: "Webhook secret not configured" }, 500);
  }

  // Raw body required — signature verification must happen before JSON parsing
  const rawBody = await c.req.text();
  const signature = c.req.header("terra-signature");
  const terraReference = c.req.header("terra-reference");

  if (!signature) {
    console.warn("Webhook rejected: missing terra-signature header");
    return c.json({ error: "Missing terra-signature header" }, 401);
  }

  try {
    await verifyTerraWebhookSignature(rawBody, signature, webhookSecret);
  } catch {
    console.warn("Webhook rejected: invalid signature");
    return c.json({ error: "Invalid signature" }, 401);
  }

  const db = createDb(c.env.DATABASE_URL);
  const eventId = crypto.randomUUID();

  let payload: Terra.WebhookEventType;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    console.warn("Webhook rejected: invalid JSON body");
    return c.json({ error: "Invalid JSON" }, 400);
  }

  const terraUserId = extractUserId(payload);
  console.log(
    `Webhook received: type=${payload.type} terraUser=${terraUserId ?? "none"} ref=${terraReference ?? "none"} eventId=${eventId}`,
  );

  // Build R2 key upfront so we can reference it in the DB row
  let payloadKey: string | undefined;
  if (c.env.TERRA_WEBHOOKS_BUCKET) {
    const now = new Date();
    const datePath = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${String(now.getUTCDate()).padStart(2, "0")}`;
    payloadKey = `webhooks/${datePath}/${eventId}.json`;
  }

  if (terraReference) {
    const [existing] = await db
      .select({ id: terraWebhookEvent.id })
      .from(terraWebhookEvent)
      .where(eq(terraWebhookEvent.terraReference, terraReference))
      .limit(1);

    if (existing) {
      console.log(
        `Webhook deduplicated: ref=${terraReference} existingId=${existing.id}`,
      );
      return c.json({ success: true });
    }
  }

  const [event] = await db
    .insert(terraWebhookEvent)
    .values({
      id: eventId,
      terraReference: terraReference ?? null,
      eventType: payload.type,
      terraUserId: terraUserId ?? null,
      payloadKey: payloadKey ?? null,
    })
    .returning({ id: terraWebhookEvent.id });

  // Return 200 immediately — archive + process async to stay within Terra's 8s timeout
  c.executionCtx.waitUntil(
    (async () => {
      if (c.env.TERRA_WEBHOOKS_BUCKET && payloadKey) {
        await c.env.TERRA_WEBHOOKS_BUCKET.put(payloadKey, rawBody, {
          httpMetadata: { contentType: "application/json" },
        });
        console.log(`Webhook archived: key=${payloadKey}`);
      }
      const client = createTerraClient(c.env);
      await processWebhookEvent(db, event.id, payload, {
        payloadKey: payloadKey ?? null,
        onAuthSuccess: (terraUserId, provider) =>
          requestBackfill(client, terraUserId, provider),
      });
    })().catch(async (error) => {
      const message = error instanceof Error ? error.message : String(error);
      await markEvent(db, event.id, "failed", message);
      console.error(
        `Webhook processing failed: type=${payload.type} eventId=${event.id} error=${message}`,
      );
    }),
  );

  return c.json({ success: true });
});

export default terraWebhook;
