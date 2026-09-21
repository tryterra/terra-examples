import { TerraClient } from "terra-api";
import type { Env } from "../auth";

/** Creates an authenticated Terra API client (requires TERRA_DEV_ID + TERRA_API_KEY). */
export function createTerraClient(env: Env) {
  if (!env.TERRA_DEV_ID || !env.TERRA_API_KEY) {
    throw new Error("Terra API credentials not configured");
  }
  return new TerraClient({
    devId: env.TERRA_DEV_ID,
    apiKey: env.TERRA_API_KEY,
    baseUrl: "https://access.tryterra.co/api/v2",
  });
}

/** Creates an unauthenticated Terra client for public endpoints (e.g. integrations list). */
export function createTerraPublicClient(env: Env) {
  if (!env.TERRA_DEV_ID) {
    throw new Error("TERRA_DEV_ID not configured");
  }
  return new TerraClient({ devId: env.TERRA_DEV_ID });
}
