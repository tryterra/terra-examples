/** Shared error responder: classify a Terra failure, return safe JSON. */
import type { Context } from "hono";
import {
  classifyTerraError,
  type ClassifiedError,
} from "../lib/terra/api-error";

// Literal statuses (not the widened ContentfulStatusCode) so Hono RPC infers
// error responses per-status and InferResponseType<..., 200> stays clean.
const STATUS = {
  network: 502,
  auth: 401,
  forbidden: 403,
  bad_request: 400,
  not_found: 404,
  payload_too_large: 413,
  rate_limited: 429,
  upstream: 502,
} as const satisfies Record<ClassifiedError["category"], number>;

export function respondTerraError(c: Context, err: unknown) {
  const classified = classifyTerraError(err);
  // rawDetail may contain internal naming — log it, never return it.
  console.error(
    "terra_error",
    `category=${classified.category}`,
    `detail=${classified.rawDetail}`,
  );
  return c.json(
    { error: classified.friendlyMessage, category: classified.category },
    STATUS[classified.category],
  );
}
