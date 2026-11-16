/**
 * Minimal Terra API client: base URL + dev-id/x-api-key headers + JSON +
 * error surfacing. Server-side only - the API key never reaches the browser.
 */
import { TerraApiError } from "./api-error";

export const TERRA_BASE_URL = "https://api.tryterra.co/v2";

type Query = Record<string, string | number | boolean | undefined>;

export interface TerraClient {
  get(path: string, query?: Query): Promise<unknown>;
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
  const headers = { "dev-id": opts.devId, "x-api-key": opts.apiKey };

  async function get(path: string, query?: Query): Promise<unknown> {
    const url = new URL(baseUrl + path);
    for (const [k, v] of Object.entries(query ?? {})) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
    const doFetch = () => fetchImpl(url, { method: "GET", headers });
    let res: Response;
    try {
      res = await doFetch();
    } catch (cause) {
      throw new TerraApiError({ status: 0, problem: undefined, cause });
    }
    // One retry on transient upstream trouble; GETs are safe to repeat.
    if (res.status === 502 || res.status === 503) res = await doFetch();
    if (!res.ok) {
      const problem = await res.json().catch(() => undefined);
      throw new TerraApiError({ status: res.status, problem });
    }
    return res.json();
  }

  return { baseUrl, get };
}
