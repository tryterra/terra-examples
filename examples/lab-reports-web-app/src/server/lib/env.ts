/**
 * Environment + the one shared Terra client. Two modes:
 *
 * - **Live** (TERRA_DEV_ID + TERRA_API_KEY set): every read hits the real
 *   Terra API, writes (uploads, widget sessions) enabled.
 * - **Demo** (no credentials): the app serves the bundled sample database
 *   read-only. Code paths that would reach Terra either branch on
 *   `isDemoMode()` or receive a client whose calls throw a clear error —
 *   per-resource catches then degrade the same way a network failure would.
 */
import "dotenv/config";
import { createTerraClient, type TerraClient } from "./terra/client";

export interface AppEnv {
  client: TerraClient;
  devId: string;
}

export function isDemoMode(): boolean {
  return !process.env.TERRA_DEV_ID || !process.env.TERRA_API_KEY;
}

const demoClient: TerraClient = {
  baseUrl: "demo://",
  get: async () => {
    throw new Error("Demo mode: Terra API calls are disabled.");
  },
  postJson: async () => {
    throw new Error("Demo mode: Terra API calls are disabled.");
  },
  postMultipart: async () => {
    throw new Error("Demo mode: Terra API calls are disabled.");
  },
};

let cached: AppEnv | undefined;

export function getAppEnv(): AppEnv {
  if (cached) return cached;
  const devId = process.env.TERRA_DEV_ID;
  const apiKey = process.env.TERRA_API_KEY;
  if (!devId || !apiKey) {
    cached = { devId: "demo", client: demoClient };
    return cached;
  }
  cached = {
    devId,
    client: createTerraClient({
      devId,
      apiKey,
      baseUrl: process.env.TERRA_BASE_URL,
    }),
  };
  return cached;
}
