/**
 * Sandbox lifecycle simulation. Applies one event exactly as a supplier
 * update would: status history is recorded AND the signed webhook is
 * delivered to your registered endpoint.
 *
 * Sandbox-only — production refuses with 403. Only valid forward transitions
 * are accepted; an out-of-order event returns 422 naming the problem.
 */
import type { VantageClient } from "./client";
import type { SimulateEvent, SimulateOrderResponse } from "./schemas";

export const SIMULATE_ORDER_EVENTS = [
  "payment_complete",
  "payment_failed",
  "processing",
  "delayed",
  "cancelled",
  "delivery_fulfilled",
  "completed",
] as const satisfies readonly SimulateEvent[];

export const SIMULATE_RESULT_EVENTS = [
  "kit_activated",
  "sample_processing_in_lab",
  "sample_rejected",
  "partial_results_ready",
  "results_ready",
  "lab_processing_error",
  "escalation_raised",
] as const satisfies readonly SimulateEvent[];

export function simulateOrderEvent(
  client: VantageClient,
  orderId: string,
  event: SimulateEvent,
  opts: { orderItemId?: string } = {},
): Promise<SimulateOrderResponse> {
  return client.post(`/orders/${orderId}/simulate`, {
    event,
    ...(opts.orderItemId ? { order_item_id: opts.orderItemId } : {}),
  }) as Promise<SimulateOrderResponse>;
}
