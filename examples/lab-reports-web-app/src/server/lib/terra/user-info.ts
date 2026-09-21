/**
 * reference_id → wearable connections, with a short in-memory cache so the
 * roster page doesn't fan out to Terra on every render. Connections change
 * rarely (only when a patient connects/disconnects a device).
 */
import { isDemoMode } from "../env";
import type { TerraClient } from "./client";
import type { TerraUser, UserInfoByReferenceResponse } from "./types";

const TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { at: number; users: TerraUser[] }>();

export async function getConnections(
  client: TerraClient,
  referenceId: string,
): Promise<TerraUser[]> {
  if (isDemoMode()) return [];
  const hit = cache.get(referenceId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.users;
  const res = (await client.get("/userInfo", {
    reference_id: referenceId,
  })) as UserInfoByReferenceResponse;
  const users = (res.users ?? []).filter((u) => u.active !== false);
  cache.set(referenceId, { at: Date.now(), users });
  return users;
}

/** Drop a cached entry — call after a connect flow starts so status refreshes. */
export function invalidateConnections(referenceId: string): void {
  cache.delete(referenceId);
}
