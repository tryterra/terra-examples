/**
 * Environment + the one shared Vantage client. Demo mode is automatic when
 * credentials are missing: the client's fetch is swapped for the read-only
 * fixture interceptor so the whole UI renders without an account.
 */
import "dotenv/config";
import {
  createVantageClient,
  PRODUCTION_BASE_URL,
  SANDBOX_BASE_URL,
  type VantageClient,
} from "./vantage/client";
import { demoFetch } from "./vantage/fixtures";

export interface AppEnv {
  demoMode: boolean;
  /** true when pointed at the sandbox — gates the simulate controls. */
  sandbox: boolean;
  signingSecret: string | undefined;
  client: VantageClient;
}

let cached: AppEnv | undefined;

export function getAppEnv(): AppEnv {
  if (cached) return cached;
  const devId = process.env.TERRA_DEV_ID;
  const apiKey = process.env.TERRA_API_KEY;
  const baseUrl = process.env.VANTAGE_BASE_URL ?? SANDBOX_BASE_URL;
  const demoMode = !devId || !apiKey;
  cached = {
    demoMode,
    sandbox: baseUrl !== PRODUCTION_BASE_URL,
    signingSecret: process.env.TERRA_SIGNING_SECRET,
    client: createVantageClient({
      devId: devId ?? "demo",
      apiKey: apiKey ?? "demo",
      baseUrl,
      fetchImpl: demoMode ? demoFetch : undefined,
    }),
  };
  return cached;
}
