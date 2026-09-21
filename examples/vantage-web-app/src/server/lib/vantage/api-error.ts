/**
 * Vantage error classification: one place that turns an HTTP failure into a
 * category + user-safe message. Pure — no HTTP framework, no retry logic.
 *
 * Why sanitize: some upstream messages name internal supplier IDs (e.g.
 * "Supplier with ID 1 only supports GB"). A customer-facing surface must
 * translate those; the raw detail is preserved for logs.
 */

/** RFC 7807 problem body, as served by every Vantage error response. */
export interface VantageProblem {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
  invalid_fields?: Array<{
    field: string;
    message: string;
    tag: string;
    value: string;
  }>;
}

export type VantageErrorCategory =
  | "network" // fetch failed — Vantage unreachable
  | "auth" // 401: wrong dev-id / API key
  | "forbidden" // 403: no Vantage access, curated-out product, or simulate in prod
  | "validation" // 400 with field-level errors
  | "bad_request" // other 400
  | "not_found" // 404
  | "conflict" // 409 (e.g. kit already activated)
  | "invalid_transition" // 422 (simulate event not valid from current status)
  | "upstream"; // 5xx from Vantage

export class VantageApiError extends Error {
  readonly status: number;
  readonly problem: VantageProblem | undefined;
  constructor(args: { status: number; problem?: unknown; cause?: unknown }) {
    const problem = (args.problem ?? undefined) as VantageProblem | undefined;
    super(problem?.detail ?? `Vantage request failed (${args.status})`, {
      cause: args.cause,
    });
    this.status = args.status;
    this.problem = problem;
  }
}

export interface ClassifiedError {
  category: VantageErrorCategory;
  /** Safe to show to an end user — internal naming stripped. */
  friendlyMessage: string;
  /** Field-level validation errors, when the API provided them. */
  invalidFields: Array<{ field: string; message: string }>;
  /** The raw detail for logs — may contain internal naming; never render it. */
  rawDetail: string;
}

const SUPPLIER_CONSTRAINT =
  /supplier with id \d+ only supports shipping to the following country codes: (.+)\./i;

/** Classify a Vantage failure into a category and user-safe copy. */
export function classifyVantageError(err: unknown): ClassifiedError {
  if (!(err instanceof VantageApiError)) {
    return {
      category: "upstream",
      friendlyMessage:
        "Something went wrong talking to the diagnostics service.",
      invalidFields: [],
      rawDetail: err instanceof Error ? err.message : String(err),
    };
  }
  const detail = err.problem?.detail ?? "";
  const invalidFields = (err.problem?.invalid_fields ?? []).map((f) => ({
    field: f.field,
    message: f.message,
  }));

  const base: Omit<ClassifiedError, "category" | "friendlyMessage"> = {
    invalidFields,
    rawDetail: detail,
  };
  switch (true) {
    case err.status === 0:
      return {
        category: "network",
        friendlyMessage:
          "Cannot reach the diagnostics service. Check your connection.",
        ...base,
      };
    case err.status === 401:
      return {
        category: "auth",
        friendlyMessage:
          "Diagnostics credentials are missing or wrong. Check TERRA_DEV_ID and TERRA_API_KEY.",
        ...base,
      };
    case err.status === 403:
      return {
        category: "forbidden",
        friendlyMessage:
          "This action isn't available for your account or this product.",
        ...base,
      };
    case err.status === 400 && invalidFields.length > 0:
      return {
        category: "validation",
        friendlyMessage:
          "Some details need correcting — see the highlighted fields.",
        ...base,
      };
    case err.status === 400: {
      const supplier = SUPPLIER_CONSTRAINT.exec(detail);
      if (supplier) {
        return {
          category: "bad_request",
          friendlyMessage: `This kit can only ship to: ${supplier[1]}. Try a different address or kit.`,
          ...base,
        };
      }
      return {
        category: "bad_request",
        friendlyMessage:
          "That request couldn't be processed. Check the order details.",
        ...base,
      };
    }
    case err.status === 404:
      return {
        category: "not_found",
        friendlyMessage:
          "We couldn't find that. It may belong to a different account.",
        ...base,
      };
    case err.status === 409:
      return {
        category: "conflict",
        friendlyMessage: "This kit looks like it was already activated.",
        ...base,
      };
    case err.status === 422:
      // Surface the API's actual reason — it names why the transition is
      // invalid, which is exactly what an ops user needs.
      return {
        category: "invalid_transition",
        friendlyMessage:
          detail ||
          "That lifecycle event isn't valid from the order's current status.",
        ...base,
      };
    default:
      return {
        category: "upstream",
        friendlyMessage:
          "The diagnostics service had a problem. Try again shortly.",
        ...base,
      };
  }
}
