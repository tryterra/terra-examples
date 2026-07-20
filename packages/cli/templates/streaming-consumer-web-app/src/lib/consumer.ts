// StreamingConsumer — a browser client for the consumer side of the Terra
// Streaming API. This is the file to read if you're integrating streaming
// into your own product.
//
// Connection lifecycle (each step maps to a protocol rule):
//
//   1. Mint a token          POST /auth/developer via YOUR backend
//   2. Open the WebSocket    wss://ws.tryterra.co/connect
//   3. Receive HELLO (op 2)  carries heartbeat_interval (ms)
//   4. Send IDENTIFY (op 3)  { token, type: 1 } — within 15s or close 4000
//   5. Receive READY (op 4)  authenticated; data starts flowing
//   6. Receive DISPATCH (op 5) readings, forever
//   ... while sending HEARTBEAT (op 0) and receiving ACKs (op 1)
//
// Integration seam: `mintToken` is injected. This class never knows about
// Express, /api/token, or fetch specifics — to use it in your app, pass a
// function that asks YOUR backend for a token (see src/lib/stream.ts) and
// copy this file unchanged.

import {
  CLIENT_BUG_CLOSE_CODES,
  CloseCode,
  IDENTIFY_TYPE_DEVELOPER,
  Op,
  parseFrame,
  type DispatchMessage,
} from "./protocol";

export const TERRA_WS_URL = "wss://ws.tryterra.co/connect";

export type StreamStatus =
  | "idle" //          not started
  | "token" //         minting a token from the backend
  | "connecting" //    socket open, waiting for READY
  | "ready" //         authenticated, receiving data
  | "reconnecting" //  connection lost, retrying with backoff
  | "error"; //        terminal until start() is called again

export interface ConsumerOptions {
  /**
   * Returns a fresh single-use consumer token. Tokens are consumed by a
   * successful IDENTIFY, so this is called before EVERY connection attempt —
   * including reconnects. Point it at your own backend.
   */
  mintToken: () => Promise<string>;
  /** Called for every DISPATCH reading (live and REPLAY backfill alike). */
  onDispatch: (msg: DispatchMessage, receivedAt: number) => void;
  /** Called on every status transition; `detail` explains error states. */
  onStatusChange: (status: StreamStatus, detail?: string) => void;
}

const MAX_BACKOFF_MS = 30_000;

export class StreamingConsumer {
  private ws: WebSocket | null = null;
  private heartbeatTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private awaitingAck = false;
  private attempt = 0;
  private running = false;

  constructor(private readonly opts: ConsumerOptions) {}

  /** Start (or restart after an error). Idempotent while running. */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.attempt = 0;
    void this.connect();
  }

  /** Stop and release the consumer slot. Idempotent. */
  stop(): void {
    if (!this.running) return;
    this.running = false;
    this.clearTimers();
    this.teardownSocket();
    this.opts.onStatusChange("idle");
  }

  private async connect(): Promise<void> {
    if (!this.running) return;

    // Fresh token every attempt: tokens are single-use (consumed on
    // IDENTIFY), so a cached token would be rejected with close 4001.
    this.opts.onStatusChange(this.attempt === 0 ? "token" : "reconnecting");
    let token: string;
    try {
      token = await this.opts.mintToken();
    } catch (err) {
      this.scheduleReconnect(`Token mint failed: ${String(err)}`);
      return;
    }
    if (!this.running) return;

    this.opts.onStatusChange("connecting");
    const ws = new WebSocket(TERRA_WS_URL);
    this.ws = ws;

    ws.onmessage = (ev) => this.onFrame(token, ev.data);
    ws.onclose = (ev) => this.onClose(ev);
    // onerror is always followed by onclose; the close handler decides.
    ws.onerror = () => {};
  }

  private onFrame(token: string, data: unknown): void {
    const frame = parseFrame(data);
    if (!frame) return;

    switch (frame.op) {
      case Op.HELLO: {
        // HELLO carries the heartbeat cadence. IDENTIFY goes out first —
        // the server closes with 4000 if it doesn't arrive within 15s.
        // Exactly once per connection (a second IDENTIFY is close 4003).
        const interval =
          typeof (frame.d as { heartbeat_interval?: unknown })?.heartbeat_interval === "number"
            ? (frame.d as { heartbeat_interval: number }).heartbeat_interval
            : 40_000;
        this.send({ op: Op.IDENTIFY, d: { token, type: IDENTIFY_TYPE_DEVELOPER } });
        // First beat after interval * random() — the jitter stops a fleet of
        // clients that reconnected together from heartbeating in sync.
        this.scheduleHeartbeat(interval * Math.random(), interval);
        break;
      }

      case Op.READY:
        // Authenticated. Reset backoff so the next drop retries quickly.
        this.attempt = 0;
        this.opts.onStatusChange("ready");
        break;

      case Op.DISPATCH: {
        // Both live readings and REPLAY backfill arrive as DISPATCH.
        if (typeof frame.uid !== "string" || typeof frame.t !== "string") return;
        const d = (frame.d ?? {}) as { ts?: string; val?: number; d?: number[] };
        const msg: DispatchMessage = {
          uid: frame.uid,
          t: frame.t,
          seq: frame.seq,
          ts: d.ts,
          val: typeof d.val === "number" ? d.val : undefined,
          d: Array.isArray(d.d) ? d.d : undefined,
        };
        this.opts.onDispatch(msg, Date.now());
        break;
      }

      case Op.HEARTBEAT_ACK:
        this.awaitingAck = false;
        break;
    }
  }

  private scheduleHeartbeat(firstDelayMs: number, intervalMs: number): void {
    this.awaitingAck = false;
    const beat = () => {
      // If the previous beat was never ACKed, the connection is dead but the
      // socket doesn't know it yet — force-close and let onClose reconnect.
      if (this.awaitingAck) {
        this.ws?.close();
        return;
      }
      this.awaitingAck = true;
      this.send({ op: Op.HEARTBEAT });
      this.heartbeatTimer = setTimeout(beat, intervalMs);
    };
    this.heartbeatTimer = setTimeout(beat, firstDelayMs);
  }

  private onClose(ev: CloseEvent): void {
    this.clearTimers();
    this.ws = null;
    if (!this.running) return;

    // The close code decides the policy — this switch is the important part.
    if (CLIENT_BUG_CLOSE_CODES.has(ev.code)) {
      // 4000/4003/4004/1003 mean this client broke the protocol. Retrying
      // would just loop the same failure.
      this.fail(`Protocol error (close ${ev.code}). This is a client bug, not retrying.`);
      return;
    }
    if (ev.code === CloseCode.SESSION_LIMIT) {
      // Another consumer holds the slot (the cap is currently 1 per
      // developer). Auto-retrying here would make two consumers kick each
      // other off forever — surface it and let the user retry manually.
      this.fail(
        "Another consumer is already connected (close 4002). " +
          "Close other tabs or disconnect your backend consumer, then retry.",
      );
      return;
    }

    // Everything else is retryable: 4001 (token expired — the fresh mint in
    // connect() fixes it), 4005 (missed heartbeat), 1006 (network), etc.
    this.scheduleReconnect(`Connection closed (${ev.code})`);
  }

  private scheduleReconnect(reason: string): void {
    if (!this.running) return;
    this.opts.onStatusChange("reconnecting", reason);
    // Capped exponential backoff + jitter so a flaky network or Terra blip
    // doesn't hammer the token endpoint.
    const delay = Math.min(1000 * 2 ** this.attempt, MAX_BACKOFF_MS) * (0.5 + Math.random() * 0.5);
    this.attempt += 1;
    this.reconnectTimer = setTimeout(() => void this.connect(), delay);
  }

  private fail(detail: string): void {
    this.running = false;
    this.teardownSocket();
    this.opts.onStatusChange("error", detail);
  }

  private send(frame: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(frame));
    }
  }

  private clearTimers(): void {
    if (this.heartbeatTimer) clearTimeout(this.heartbeatTimer);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.heartbeatTimer = null;
    this.reconnectTimer = null;
  }

  private teardownSocket(): void {
    if (!this.ws) return;
    // Null the handlers BEFORE closing — otherwise the close event of a
    // socket we intentionally stopped would trigger a zombie reconnect.
    this.ws.onmessage = null;
    this.ws.onclose = null;
    this.ws.onerror = null;
    try {
      this.ws.close();
    } catch {
      // already closing
    }
    this.ws = null;
  }
}

// Not implemented (kept simple on purpose): REPLAY (op 7) lets a consumer
// backfill missed readings after a drop — send { op: 7, d: { after, before } }
// with exclusive seq bounds and the gateway re-delivers them as ordinary
// DISPATCH frames. See the docs' "missed data" section.
