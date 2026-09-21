/**
 * Minimal Terra API client: base URL + dev-id/x-api-key headers + JSON +
 * error surfacing. The terra-api npm SDK does not cover the lab-reports
 * endpoints, so one fetch wrapper serves both products with one auth path.
 */
import { TerraApiError } from "./api-error";

export const TERRA_BASE_URL = "https://access.tryterra.co/api/v2";

type Query = Record<string, string | number | boolean | undefined>;

export interface TerraClient {
  get(path: string, query?: Query): Promise<unknown>;
  postJson(path: string, body?: unknown, query?: Query): Promise<unknown>;
  /** Multipart upload — pass the incoming File straight through. */
  postMultipart(path: string, form: FormData, query?: Query): Promise<unknown>;
  readonly baseUrl: string;
}

export interface TerraClientOptions {
  devId: string;
  apiKey: string;
  baseUrl?: string;
  /** Injectable for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

export function createTerraClient(opts: TerraClientOptions): TerraClient {
  const baseUrl = opts.baseUrl ?? TERRA_BASE_URL;
  const fetchImpl = opts.fetchImpl ?? fetch;
  const authHeaders = { "dev-id": opts.devId, "x-api-key": opts.apiKey };

  async function request(
    method: string,
    path: string,
    query: Query | undefined,
    init: { body?: string | FormData; headers?: Record<string, string> },
  ): Promise<unknown> {
    const url = new URL(baseUrl + path);
    for (const [k, v] of Object.entries(query ?? {})) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
    const doFetch = () =>
      fetchImpl(url, {
        method,
        headers: { ...authHeaders, ...init.headers },
        body: init.body,
      });
    let res: Response;
    try {
      res = await doFetch();
    } catch (cause) {
      throw new TerraApiError({ status: 0, problem: undefined, cause });
    }
    if ((res.status === 502 || res.status === 503) && method === "GET") {
      // One retry on transient upstream trouble — GETs only. Uploads are not
      // idempotent (a blind retry can double-ingest a report).
      res = await doFetch();
    }
    if (!res.ok) {
      const problem = await res.json().catch(() => undefined);
      throw new TerraApiError({ status: res.status, problem });
    }
    if (res.status === 204) return undefined;
    // Lab report session IDs are 64-bit snowflakes serialized as JSON
    // strings — never Number() them (JavaScript rounds past 2^53).
    return res.json();
  }

  return {
    baseUrl,
    get: (path, query) => request("GET", path, query, {}),
    postJson: (path, body, query) =>
      request("POST", path, query, {
        body: body !== undefined ? JSON.stringify(body) : undefined,
        headers:
          body !== undefined ? { "Content-Type": "application/json" } : {},
      }),
    // No Content-Type header: fetch sets the multipart boundary itself.
    postMultipart: (path, form, query) =>
      request("POST", path, query, { body: form }),
  };
}
