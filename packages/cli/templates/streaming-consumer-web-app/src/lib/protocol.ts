// Terra Streaming wire protocol — consumer side.
// Spec: https://docs.tryterra.co/streaming-api (Terra → your backend)
//
// Every frame is a JSON text message shaped `{ op, d?, uid?, seq?, t? }`.
// The `op` (opcode) says what the frame means; the rest depends on the op.

export const Op = {
  /** Client → server keep-alive ping. */
  HEARTBEAT: 0,
  /** Server → client heartbeat acknowledgement. */
  HEARTBEAT_ACK: 1,
  /** Server → client, sent immediately on connect; carries heartbeat_interval. */
  HELLO: 2,
  /** Client → server authentication (token + connection type). */
  IDENTIFY: 3,
  /** Server → client: authentication accepted. */
  READY: 4,
  /** Server → client: a real-time data reading. */
  DISPATCH: 5,
  /** Client → server data submission — PRODUCER connections only. */
  SUBMIT: 6,
  /** Client → server: request missed data by sequence range (optional). */
  REPLAY: 7,
} as const;

// IDENTIFY `type` field: 0 = USER (producer, sends data), 1 = DEVELOPER
// (consumer, receives data). This app is a consumer.
export const IDENTIFY_TYPE_DEVELOPER = 1;

// Close codes the gateway uses. The comments drive reconnect policy in
// consumer.ts: some codes mean "fix your client", not "try again".
export const CloseCode = {
  /** IDENTIFY not received within 15s of connecting. Client bug. */
  IDENTIFY_TIMEOUT: 4000,
  /** Bad or expired token — tokens are single-use; mint a fresh one. */
  BAD_TOKEN: 4001,
  /** Consumer session cap reached (currently 1 per developer). */
  SESSION_LIMIT: 4002,
  /** IDENTIFY sent more than once on a connection. Client bug. */
  DUPLICATE_IDENTIFY: 4003,
  /** Invalid opcode for this session type. Client bug. */
  INVALID_OPCODE: 4004,
  /** No heartbeat received within heartbeat_interval. */
  HEARTBEAT_TIMEOUT: 4005,
} as const;

// Close codes that indicate a bug in this client — reconnecting would just
// loop the same failure, so the consumer surfaces an error instead.
export const CLIENT_BUG_CLOSE_CODES: ReadonlySet<number> = new Set([
  CloseCode.IDENTIFY_TIMEOUT,
  CloseCode.DUPLICATE_IDENTIFY,
  CloseCode.INVALID_OPCODE,
  1003, // unsupported data (we sent a malformed frame)
]);

/** A raw frame as received off the wire (after the parse guard). */
export interface Frame {
  op: number;
  d?: unknown;
  uid?: string;
  seq?: number;
  t?: string;
}

/**
 * A DISPATCH reading, flattened for the app. `d.val` carries scalar types
 * (HEART_RATE, STEPS, …); `d.d` carries multi-value types (ACCELERATION
 * [x,y,z], LOCATION [lat,lng], ECG waveform samples).
 */
export interface DispatchMessage {
  /** Terra user id of the producing device. */
  uid: string;
  /** Data type, e.g. "HEART_RATE". */
  t: string;
  /** Gateway sequence cursor (sparse but time-ordered). */
  seq?: number;
  /** ISO 8601 timestamp of the reading, from the producer. */
  ts?: string;
  /** Scalar value (bpm, step count, …). */
  val?: number;
  /** Vector/waveform values ([x,y,z], [lat,lng], ECG samples). */
  d?: number[];
}

/**
 * Parse guard for incoming messages. The socket is untrusted input, so we
 * verify "object with a numeric op" before trusting the shape.
 */
export function parseFrame(raw: unknown): Frame | null {
  if (typeof raw !== "string") return null; // gateway is text-only
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const frame = parsed as Record<string, unknown>;
  if (typeof frame.op !== "number") return null;
  return frame as unknown as Frame;
}
