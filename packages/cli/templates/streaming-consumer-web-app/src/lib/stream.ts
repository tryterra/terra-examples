// Singleton wiring: one StreamStore + one StreamingConsumer for the whole app.
//
// This is the ONLY place the frontend knows where tokens come from. To use
// this demo's consumer in your own product, change the mintToken closure to
// call your backend's endpoint — consumer.ts needs no changes.

import { StreamingConsumer } from "./consumer";
import { StreamStore } from "./store";

export const store = new StreamStore();

export const consumer = new StreamingConsumer({
  // Contract with the token server (see server/index.ts):
  //   POST /api/token  →  200 { "token": "..." }
  mintToken: async () => {
    const res = await fetch("/api/token", { method: "POST" });
    const body = (await res.json().catch(() => ({}))) as { token?: string; error?: string };
    if (!res.ok || !body.token) {
      throw new Error(body.error ?? `token endpoint returned ${res.status}`);
    }
    return body.token;
  },
  onDispatch: (msg, receivedAt) => store.ingest(msg, receivedAt),
  onStatusChange: (status, detail) => store.setStatus(status, detail),
});

let refCount = 0;

/**
 * Reference-counted start/stop for React effects. The release is deferred a
 * tick because React StrictMode (dev) runs mount → cleanup → remount
 * synchronously; by the time the timeout fires, refCount is back to 1 and the
 * socket never bounces. That matters here more than usual: tokens are
 * single-use and the gateway allows ONE consumer session per developer, so a
 * naive start/stop/start would burn a token and can trip close code 4002.
 */
export function retainStream(): () => void {
  refCount += 1;
  consumer.start(); // idempotent — no-op if already running
  return () => {
    refCount -= 1;
    setTimeout(() => {
      if (refCount === 0) consumer.stop();
    }, 0);
  };
}
