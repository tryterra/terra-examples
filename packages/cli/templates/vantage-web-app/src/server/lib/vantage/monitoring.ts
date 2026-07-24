/**
 * Account monitoring: analytics overview and webhook delivery outcomes.
 * Note webhook-deliveries event_type historically used internal enum names
 * (EVENT_TYPE_...); it now matches the webhook payload strings. Correlate by
 * event_id for exactness.
 */
import type { VantageClient } from "./client";
import type { OverviewResponse, WebhookDeliveriesResponse } from "./schemas";

/** Orders by status, results in/missing, webhook failures (default: last 7d). */
export function getOverview(
  client: VantageClient,
  window: { since?: string; until?: string } = {},
): Promise<OverviewResponse> {
  return client.get("/overview", window) as Promise<OverviewResponse>;
}

export function listWebhookDeliveries(
  client: VantageClient,
  filters: {
    outcome?:
      | "delivered"
      | "rejected"
      | "invalid"
      | "dead_lettered"
      | "replayed"
      | "failed";
    limit?: number;
    cursor?: string;
  } = {},
): Promise<WebhookDeliveriesResponse> {
  return client.get(
    "/webhook-deliveries",
    filters,
  ) as Promise<WebhookDeliveriesResponse>;
}
