/**
 * Inbound Terra webhook. Order of operations is the contract:
 * read the RAW body -> verify the signature -> parse -> persist -> 200.
 *
 * - `clinical_record` (unified_api.clinical_record.updated) carries only new
 *   or changed records; upsert them. Delivery is at-least-once, and upserts
 *   keyed on record_id make redelivery harmless.
 * - `auth` success registers the user and, in live mode, kicks off a
 *   backfill of everything already received.
 *
 * Respond fast: Terra times out slow endpoints. On serverless, move the
 * post-response backfill to waitUntil or a queue.
 */
import { Hono } from "hono";
import type { ClinicalRecordEvent, TerraUser } from "../lib/clinical/types";
import { verifyTerraSignature } from "../lib/clinical/webhook-signature";
import { getTerraClient, isDemoMode, webhookSecret } from "../lib/env";
import { markWebhook, syncUser, upsertRecords, upsertUser } from "../lib/store";

type WebhookPayload =
  | ClinicalRecordEvent
  | { type: "auth"; status?: string; user?: TerraUser }
  | { type: string; user?: TerraUser };

export const webhookRoutes = new Hono().post("/", async (c) => {
  const secret = webhookSecret();
  if (!secret)
    return c.json({ error: "TERRA_WEBHOOK_SECRET not configured" }, 500);

  // Raw body FIRST - the HMAC covers these exact bytes.
  const rawBody = await c.req.text();
  if (!verifyTerraSignature(rawBody, c.req.header("terra-signature"), secret))
    return c.json({ error: "Invalid signature" }, 401);

  let payload: WebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  const user = payload.user;
  if (payload.type === "clinical_record" && user?.user_id) {
    const event = payload as ClinicalRecordEvent;
    await upsertUser(user);
    const stored = await upsertRecords(user.user_id, event.data ?? []);
    await markWebhook(user.user_id);
    return c.json({ received: true, stored });
  }

  if (
    payload.type === "auth" &&
    (payload as { status?: string }).status === "success" &&
    user?.user_id
  ) {
    await upsertUser(user);
    if (!isDemoMode()) {
      void syncUser(getTerraClient(), user.user_id).catch((err) =>
        console.error("backfill_failed", user.user_id, String(err)),
      );
    }
    return c.json({ received: true });
  }

  return c.json({ received: true, ignored: payload.type });
});
