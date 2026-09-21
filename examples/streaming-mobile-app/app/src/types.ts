export const Op = {
  HEARTBEAT: 0,
  HEARTBEAT_ACK: 1,
  HELLO: 2,
  IDENTIFY: 3,
  READY: 4,
  DISPATCH: 5,
  SUBMIT: 6,
  REPLAY: 7,
} as const;

export type StreamStatus =
  | 'idle'
  | 'token'
  | 'connecting'
  | 'ready'
  | 'reconnecting'
  | 'error';

export interface DispatchMessage {
  seq: number;
  uid: string;
  t: string; // 'HEART_RATE', 'STEPS', ...
  ts: string; // ISO 8601 reading timestamp
  val?: number; // scalar types
  d?: number[]; // multi-axis types
}

export interface Sample {
  seq: number;
  ts: string;
  val?: number; // scalar types
  d?: number[]; // vector/waveform/coords types
}

/** A Terra user (one provider connection) and its mapping to YOUR user. */
export interface TerraUser {
  user_id: string;
  reference_id: string | null;
  provider: string | null;
  last_seen: string | null;
  source: string;
}

/** One (user, data type) series, e.g. user X's heart rate. */
export interface MetricSeries {
  uid: string;
  type: string;
  latest: DispatchMessage;
  samples: Sample[]; // scalar history, ordered by seq, capped
  lastUpdated: number; // Date.now() of last message
}
