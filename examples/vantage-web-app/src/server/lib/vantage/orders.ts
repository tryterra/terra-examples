/**
 * Orders: create, track, and list. Vantage is the system of record — query it,
 * don't mirror it. Track everything downstream by order_item_id (results,
 * activation, and acknowledgment are all per item), not order_id.
 */
import type { VantageClient } from "./client";
import type {
  CreateOrderRequest,
  CreateOrderResponse,
  GetOrderResponse,
  ListLabsResponse,
  ListOrdersResponse,
} from "./schemas";

/**
 * Create an order. NOT idempotent: client_order_reference_id is a
 * reconciliation key, not a dedupe key — retrying the same body creates a
 * second order (and a second charge). On an ambiguous failure, reconcile with
 * findOrderByReference() before retrying (see reconcile.ts).
 */
export function createOrder(
  client: VantageClient,
  order: CreateOrderRequest,
  idempotencyKey?: string,
): Promise<CreateOrderResponse> {
  // One unique key per order ATTEMPT: same key + same body replays the
  // original result instead of double-ordering; without it, creation is not
  // deduplicated (see reconcile.ts for the no-key fallback).
  return client.post(
    "/orders",
    order,
    undefined,
    idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
  ) as Promise<CreateOrderResponse>;
}

/** Full order detail: items, recipient, financials, and status_history. */
export function getOrder(
  client: VantageClient,
  orderId: string,
): Promise<GetOrderResponse> {
  return client.get(`/orders/${orderId}`) as Promise<GetOrderResponse>;
}

export interface ListOrdersFilters {
  limit?: number;
  /** next_cursor from the previous page; absent next_cursor = last page. */
  cursor?: string;
  /** RFC 3339; only orders created at/after this instant. */
  since?: string;
  /** Same order.* vocabulary on REST and webhooks. */
  status?: string;
  collectionType?: "AT_HOME" | "GO_TO_LAB";
  /** true = delivered/completed orders still waiting on results. */
  missing?: boolean;
}

/** Keyset-paginated order index, newest first. */
export function listOrders(
  client: VantageClient,
  filters: ListOrdersFilters = {},
): Promise<ListOrdersResponse> {
  return client.get("/orders", {
    limit: filters.limit,
    cursor: filters.cursor,
    since: filters.since,
    status: filters.status,
    collection_type: filters.collectionType,
    missing: filters.missing,
  }) as Promise<ListOrdersResponse>;
}

/** Nearby lab draw sites for a US zip — offer these before a GO_TO_LAB order. */
export function listLabs(
  client: VantageClient,
  zipCode: string,
): Promise<ListLabsResponse> {
  return client.get("/labs", {
    zip_code: zipCode,
  }) as Promise<ListLabsResponse>;
}

/**
 * Programmatic kit activation (the alternative to the Vantage-hosted
 * activation page a kit's QR code opens). Unauthenticated by design —
 * authorized by kit_id knowledge; emits results.kit_activated on success,
 * which carries the newly assigned test_taker_id. 409 = already activated.
 */
export function activateKit(
  client: VantageClient,
  activation: import("./schemas").ActivationContextDTO & {
    supplier_kit_id: string;
  },
): Promise<import("./schemas").ActivateKitResponse> {
  return client.post("/orders/activate", activation) as Promise<
    import("./schemas").ActivateKitResponse
  >;
}

/** URL of the Vantage-hosted activation page (what the kit QR code embeds). */
export function activationPageUrl(baseUrl: string, kitId: string): string {
  return `${baseUrl}/orders/activate?kit_id=${encodeURIComponent(kitId)}`;
}
