/**
 * Results: index, presigned download, and the MANDATORY acknowledgment.
 *
 * Both the fetch and the acknowledge require test_taker_id (query param) —
 * it first appears on the results.kit_activated webhook and is recoverable
 * from GET /orders/{id} items[].test_taker_ids.
 */
import type { VantageClient } from "./client";
import type {
  AcknowledgeResultsResponse,
  GetResultsURLResponse,
  ListResultsResponse,
} from "./schemas";

/** Keyset index of result activity; rows carry is_acknowledged. */
export function listResults(
  client: VantageClient,
  filters: { limit?: number; cursor?: string; status?: string } = {},
): Promise<ListResultsResponse> {
  return client.get("/results", filters) as Promise<ListResultsResponse>;
}

/**
 * Presigned FHIR download URL. Valid for 15 minutes — fetch it when the user
 * opens the result and never store it; re-call to re-mint.
 */
export function getResultDownloadUrl(
  client: VantageClient,
  orderItemId: string,
  testTakerId: string,
): Promise<GetResultsURLResponse> {
  return client.get(`/results/${orderItemId}`, {
    test_taker_id: testTakerId,
  }) as Promise<GetResultsURLResponse>;
}

/**
 * Acknowledge results. Not optional: patients cannot access results until
 * acknowledged, and unacknowledged results shift liability to you.
 * MUST be triggered by an explicit end-user action (a checkbox + button
 * after the results are displayed) — never automatically on retrieval.
 */
export function acknowledgeResults(
  client: VantageClient,
  orderItemId: string,
  testTakerId: string,
): Promise<AcknowledgeResultsResponse> {
  return client.post(`/results/${orderItemId}/acknowledge`, undefined, {
    test_taker_id: testTakerId,
  }) as Promise<AcknowledgeResultsResponse>;
}
