import { useEffect, useSyncExternalStore } from "react";
import { retainStream, store } from "../lib/stream";
import type { StreamSnapshot } from "../lib/store";

/**
 * Subscribe to the live stream. Starts the shared consumer on first mount
 * (StrictMode-safe — see retainStream) and re-renders on coalesced store
 * updates. Call once, near the root.
 */
export function useStream(): StreamSnapshot {
  useEffect(retainStream, []);
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}
