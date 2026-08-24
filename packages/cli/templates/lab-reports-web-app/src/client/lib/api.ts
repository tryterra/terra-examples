/**
 * Typed RPC client over the server's AppType — end-to-end types, no codegen.
 */
import { hc } from "hono/client";
import type { AppType } from "../../server/index";

export const api = hc<AppType>(window.location.origin);

/** Server error envelope (see routes/respond.ts). */
export interface ApiErrorBody {
  error: string;
  category: string;
  invalidFields: Array<{ field: string; message: string }>;
}

/** Throwing JSON unwrapper for query functions. */
export async function unwrap<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({
      error: `Request failed (${res.status})`,
      category: "upstream",
      invalidFields: [],
    }))) as ApiErrorBody;
    throw Object.assign(new Error(body.error), { body, status: res.status });
  }
  return res.json() as Promise<T>;
}
