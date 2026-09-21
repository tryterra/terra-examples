/**
 * Reconcile helpers: the safety net for at-least-once webhooks and
 * non-idempotent order creation. Run these from an explicit user action
 * (a "Sync" button) — they're cheap reads, but they're a recovery tool,
 * not a background job.
 */
import type { VantageClient } from "./client";
import { listOrders } from "./orders";
import { getOrder } from "./orders";
import type { GetOrderResponse, OrderSummary } from "./schemas";

/**
 * Safe-retry lookup: before retrying a create that failed ambiguously
 * (timeout / 5xx), check whether the order already exists. There is no
 * server-side filter for client_order_reference_id, so scan recent orders
 * and match client-side.
 */
export async function findOrderByReference(
  client: VantageClient,
  clientOrderReferenceId: string,
  opts: { sinceIso?: string; maxPages?: number } = {},
): Promise<OrderSummary | undefined> {
  let cursor: string | undefined;
  for (let page = 0; page < (opts.maxPages ?? 4); page++) {
    const res = await listOrders(client, {
      limit: 100,
      cursor,
      since: opts.sinceIso,
    });
    const hit = res.orders.find(
      (o) => o.client_order_reference_id === clientOrderReferenceId,
    );
    if (hit) return hit;
    if (!res.next_cursor) return undefined;
    cursor = res.next_cursor;
  }
  return undefined;
}

/** Delivered/completed orders still missing results — the "chase these" set. */
export async function listOrdersMissingResults(
  client: VantageClient,
): Promise<OrderSummary[]> {
  const res = await listOrders(client, { missing: true, limit: 100 });
  return res.orders;
}

/**
 * Recover test_taker_ids for an order without relying on the kit_activated
 * webhook (which you may have missed). They appear on items once a kit is
 * activated.
 */
export async function recoverTestTakers(
  client: VantageClient,
  orderId: string,
): Promise<Map<string, string[]>> {
  const order: GetOrderResponse = await getOrder(client, orderId);
  const byItem = new Map<string, string[]>();
  for (const item of order.items ?? []) {
    if (item.order_item_id)
      byItem.set(item.order_item_id, item.test_taker_ids ?? []);
  }
  return byItem;
}
