/** Shared error responder: classify a Vantage failure, return safe JSON. */
import type { Context } from "hono";
import {
  classifyVantageError,
  type ClassifiedError,
} from "../lib/vantage/api-error";

// Literal statuses (not the widened ContentfulStatusCode) so Hono RPC infers
// error responses per-status and InferResponseType<..., 200> stays clean.
const STATUS = {
  network: 502,
  auth: 401,
  forbidden: 403,
  validation: 400,
  bad_request: 400,
  not_found: 404,
  conflict: 409,
  invalid_transition: 422,
  upstream: 502,
} as const satisfies Record<ClassifiedError["category"], number>;

export function respondVantageError(c: Context, err: unknown) {
  const classified = classifyVantageError(err);
  // rawDetail may contain internal naming — log it, never return it.
  console.error(
    "vantage_error",
    `category=${classified.category}`,
    `detail=${classified.rawDetail}`,
  );
  return c.json(
    {
      error: classified.friendlyMessage,
      category: classified.category,
      invalidFields: classified.invalidFields,
    },
    STATUS[classified.category],
  );
}
