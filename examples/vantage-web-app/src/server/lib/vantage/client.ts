/**
 * Minimal Vantage API client: base URL + Basic auth + JSON + error surfacing.
 *
 * Copyable as-is into any TypeScript backend; the only import is the error
 * classifier. Vantage is not part of the terra-api npm SDK — this fetch
 * wrapper is the whole client.
 */
import { VantageApiError } from "./api-error";

export const SANDBOX_BASE_URL = "https://vantage-sandbox.tryterra.co/api/v1";
export const PRODUCTION_BASE_URL = "https://vantage.tryterra.co/api/v1";

export interface VantageClient {
  get(
    path: string,
    query?: Record<string, string | number | boolean | undefined>,
  ): Promise<unknown>;
  post(
    path: string,
    body?: unknown,
    query?: Record<string, string | number | boolean | undefined>,
    headers?: Record<string, string>,
  ): Promise<unknown>;
  put(path: string, body?: unknown): Promise<unknown>;
  patch(path: string, body?: unknown): Promise<unknown>;
  readonly baseUrl: string;
}

export interface VantageClientOptions {
  devId: string;
  apiKey: string;
  baseUrl?: string;
  /** Injectable for tests and demo mode (fixtures); defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

/** Build a Vantage client. Credentials are the standard Terra dev-id / API key. */
export function createVantageClient(opts: VantageClientOptions): VantageClient {
  const baseUrl = opts.baseUrl ?? SANDBOX_BASE_URL;
  const fetchImpl = opts.fetchImpl ?? fetch;
  // Basic auth: username = dev-id, password = API key. The dev-id/x-api-key
  // header pair works too; Basic is what the Vantage docs show.
  const auth =
    "Basic " + Buffer.from(`${opts.devId}:${opts.apiKey}`).toString("base64");

  async function request(
    method: string,
    path: string,
    body?: unknown,
    query?: Record<string, string | number | boolean | undefined>,
    headers?: Record<string, string>,
  ): Promise<unknown> {
    const url = new URL(baseUrl + path);
    for (const [k, v] of Object.entries(query ?? {})) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
    let res: Response;
    try {
      res = await fetchImpl(url, {
        method,
        headers: {
          Authorization: auth,
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
          ...headers,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (cause) {
      throw new VantageApiError({ status: 0, problem: undefined, cause });
    }
    if ((res.status === 502 || res.status === 503) && method === "GET") {
      // One retry on transient upstream trouble — GETs only. Order creation
      // is NOT idempotent (see orders.ts / reconcile.ts): a blind POST retry
      // can double-order, so writes surface the failure instead.
      res = await fetchImpl(url, {
        method,
        headers: {
          Authorization: auth,
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    }
    if (!res.ok) {
      // Vantage errors are RFC 7807 problem details (+ invalid_fields on
      // order validation); keep the parsed body for the classifier.
      const problem = await res.json().catch(() => undefined);
      throw new VantageApiError({ status: res.status, problem });
    }
    if (res.status === 204) return undefined;
    // IDs in Vantage responses are 64-bit snowflakes serialized as JSON
    // strings — never Number() them (JavaScript rounds past 2^53).
    return res.json();
  }

  return {
    baseUrl,
    get: (path, query) => request("GET", path, undefined, query),
    post: (path, body, query, headers) =>
      request("POST", path, body, query, headers),
    put: (path, body) => request("PUT", path, body),
    patch: (path, body) => request("PATCH", path, body),
  };
}
