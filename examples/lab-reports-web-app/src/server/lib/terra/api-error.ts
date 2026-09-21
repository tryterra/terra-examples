/**
 * Terra API error classification: one place that turns an HTTP failure into a
 * category + user-safe message. Pure — no HTTP framework, no retry logic.
 */

/** RFC 7807 problem body, as served by Terra error responses. */
export interface TerraProblem {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
  message?: string;
}

export type TerraErrorCategory =
  | "network" // fetch failed — Terra unreachable
  | "auth" // 401: wrong dev-id / API key
  | "forbidden" // 403: e.g. lab_reports capability not enabled
  | "bad_request" // 400
  | "not_found" // 404
  | "payload_too_large" // 413: file over 20MB
  | "rate_limited" // 429
  | "upstream"; // 5xx from Terra

export class TerraApiError extends Error {
  readonly status: number;
  readonly problem: TerraProblem | undefined;
  constructor(args: { status: number; problem?: unknown; cause?: unknown }) {
    const problem = (args.problem ?? undefined) as TerraProblem | undefined;
    super(
      problem?.detail ??
        problem?.message ??
        `Terra request failed (${args.status})`,
      { cause: args.cause },
    );
    this.status = args.status;
    this.problem = problem;
  }
}

export interface ClassifiedError {
  category: TerraErrorCategory;
  /** Safe to show to an end user. */
  friendlyMessage: string;
  /** The raw detail for logs — never render it. */
  rawDetail: string;
}

/** Classify a Terra failure into a category and user-safe copy. */
export function classifyTerraError(err: unknown): ClassifiedError {
  if (!(err instanceof TerraApiError)) {
    return {
      category: "upstream",
      friendlyMessage: "Something went wrong talking to Terra.",
      rawDetail: err instanceof Error ? err.message : String(err),
    };
  }
  const rawDetail = err.problem?.detail ?? err.problem?.message ?? err.message;
  switch (true) {
    case err.status === 0:
      return {
        category: "network",
        friendlyMessage: "Cannot reach Terra. Check your connection.",
        rawDetail,
      };
    case err.status === 401:
      return {
        category: "auth",
        friendlyMessage:
          "Terra credentials are missing or wrong. Check TERRA_DEV_ID and TERRA_API_KEY.",
        rawDetail,
      };
    case err.status === 403:
      return {
        category: "forbidden",
        friendlyMessage:
          "This Terra feature isn't enabled for your account (lab reports may need enabling).",
        rawDetail,
      };
    case err.status === 400:
      return {
        category: "bad_request",
        friendlyMessage: "Terra couldn't process that request.",
        rawDetail,
      };
    case err.status === 404:
      return {
        category: "not_found",
        friendlyMessage: "Terra couldn't find that resource.",
        rawDetail,
      };
    case err.status === 413:
      return {
        category: "payload_too_large",
        friendlyMessage: "That file is too large - the limit is 20 MB.",
        rawDetail,
      };
    case err.status === 429:
      return {
        category: "rate_limited",
        friendlyMessage: "Terra rate limit hit. Try again in a moment.",
        rawDetail,
      };
    default:
      return {
        category: "upstream",
        friendlyMessage: "Terra had a problem. Try again shortly.",
        rawDetail,
      };
  }
}
