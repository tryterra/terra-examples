/**
 * Inbound webhook persistence + the one side-effect we keep locally:
 * capturing test_taker_id when a kit is activated. DB-touching by design —
 * this is app code, not part of the liftable lib/vantage surface.
 */
import { eq } from "drizzle-orm";
import type { Db } from "./db";
import { schema } from "./db";
import type { VantageWebhookEvent } from "./vantage/schemas";

export interface StoredWebhookEvent {
  deduplicated: boolean;
}

/**
 * Persist an event (dedup on event_id — delivery is at-least-once) and apply
 * its effects. Call after signature verification, with the parsed payload.
 */
export async function recordWebhookEvent(
  db: Db,
  event: VantageWebhookEvent,
  signatureValid: boolean,
): Promise<StoredWebhookEvent> {
  const data = event.data as Record<string, unknown>;
  const status = (data["status"] ?? data["results_status"] ?? "") as string;

  const inserted = await db
    .insert(schema.webhookEvent)
    .values({
      eventId: event.event_id,
      eventType: event.event_type,
      status,
      orderId: (data["order_id"] as string) ?? null,
      orderItemId: (data["order_item_id"] as string) ?? null,
      signatureValid,
      payload: JSON.stringify(event),
    })
    .onConflictDoNothing({ target: schema.webhookEvent.eventId })
    .returning({ id: schema.webhookEvent.id });

  if (inserted.length === 0) return { deduplicated: true };

  // kit_activated carries the newly assigned test_taker_id — the key needed
  // to fetch and acknowledge results for this item later.
  if (
    event.event_type === "order_item.results_status_change" &&
    status === "results.kit_activated"
  ) {
    const orderItemId = data["order_item_id"] as string;
    const testTaker = data["test_taker"] as
      { test_taker_id?: string } | undefined;
    if (orderItemId && testTaker?.test_taker_id) {
      await db
        .update(schema.patientOrderItem)
        .set({ testTakerId: testTaker.test_taker_id })
        .where(eq(schema.patientOrderItem.orderItemId, orderItemId));
    }
  }
  return { deduplicated: false };
}
