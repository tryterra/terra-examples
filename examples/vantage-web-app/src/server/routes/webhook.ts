/**
 * Inbound Vantage webhook endpoint. The order of operations is the contract:
 * read the RAW body → verify the signature → parse → dedup+persist → 200.
 *
 * Respond 2xx fast; Vantage retries on failure and delivery is
 * at-least-once, so persistence dedups on event_id. On serverless, hand the
 * post-response work to waitUntil/a queue so it survives the response.
 */
import { Hono } from "hono";
import { createDb } from "../lib/db";
import { getAppEnv } from "../lib/env";
import type { VantageWebhookEvent } from "../lib/vantage/schemas";
import { verifyVantageSignature } from "../lib/vantage/webhook-signature";
import { recordWebhookEvent } from "../lib/webhook-events";

export const webhookRoutes = new Hono().post("/", async (c) => {
  const { signingSecret } = getAppEnv();
  if (!signingSecret)
    return c.json({ error: "TERRA_SIGNING_SECRET not configured" }, 500);

  // Raw body FIRST — the HMAC covers these exact bytes.
  const rawBody = await c.req.text();
  const signature = c.req.header("X-Terra-Signature");
  const valid = verifyVantageSignature(rawBody, signature, signingSecret);
  if (!valid) return c.json({ error: "Invalid signature" }, 401);

  let event: VantageWebhookEvent;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  const { deduplicated } = await recordWebhookEvent(createDb(), event, valid);
  return c.json({ received: true, deduplicated }, 200);
});
