/**
 * Environment + the one shared Terra client. Two modes:
 *
 * - **Live** (TERRA_DEV_ID + TERRA_API_KEY set): backfills page the real
 *   Terra pull API; webhooks upsert records when TERRA_WEBHOOK_SECRET is set.
 * - **Demo** (no credentials): the app seeds bundled synthetic records and
 *   serves them read-only. Calls that would reach Terra throw a clear error.
 */
import "dotenv/config";
import { createTerraClient, type TerraClient } from "./terra/client";

export function isDemoMode(): boolean {
  return !process.env.TERRA_DEV_ID || !process.env.TERRA_API_KEY;
}

export function webhookSecret(): string | undefined {
  return process.env.TERRA_WEBHOOK_SECRET || undefined;
}

const demoClient: TerraClient = {
  baseUrl: "demo://",
  get: async () => {
    throw new Error("Demo mode: Terra API calls are disabled.");
  },
};

let cached: TerraClient | undefined;

export function getTerraClient(): TerraClient {
  if (cached) return cached;
  const devId = process.env.TERRA_DEV_ID;
  const apiKey = process.env.TERRA_API_KEY;
  cached =
    devId && apiKey
      ? createTerraClient({
          devId,
          apiKey,
          baseUrl: process.env.TERRA_BASE_URL,
        })
      : demoClient;
  return cached;
}
