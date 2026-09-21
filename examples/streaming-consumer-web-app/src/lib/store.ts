// StreamStore — framework-free state container between the WebSocket consumer
// and React. Holds per-user, per-data-type rolling buffers and exposes the
// snapshot/subscribe pair that useSyncExternalStore needs.
//
// Two deliberate choices worth copying:
//
// 1. Immutable snapshots, coalesced notifications. High-frequency types
//    (ACCELERATION, ECG) can arrive many times per second; re-rendering React
//    on every frame is the classic live-dashboard mistake. Data is ingested
//    synchronously, but subscribers are notified at most every NOTIFY_MS.
//    Status changes notify immediately (they're rare and users watch them).
//
// 2. Points are timestamped with `receivedAt` (client clock), not the wire
//    `ts`: the producer's clock can skew, and a monotone local clock gives a
//    smooth scrolling chart window. `ts` is still kept on `latest` for display.

import { resolveDataType, valueOf } from "./dataTypes";
import type { DispatchMessage } from "./protocol";
import type { StreamStatus } from "./consumer";

export interface SeriesPoint {
  /** Client receive time (ms epoch). */
  at: number;
  value: number;
}

export interface Series {
  latest: DispatchMessage;
  points: SeriesPoint[];
  /** Client receive time of the latest reading. */
  lastAt: number;
}

export interface UserStreams {
  lastSeenAt: number;
  /** Keyed by data type ("HEART_RATE", …). */
  series: Record<string, Series>;
}

export interface StreamSnapshot {
  status: StreamStatus;
  statusDetail: string | null;
  /** Keyed by the producing Terra user id. */
  users: Record<string, UserStreams>;
}

// Rolling-buffer caps per data type: enough for the 60s hero chart at each
// type's natural rate without unbounded growth.
const SERIES_CAPS: Record<string, number> = {
  ECG: 200,
  ACCELERATION: 256,
  GYROSCOPE: 256,
};
const DEFAULT_SERIES_CAP = 300;

const NOTIFY_MS = 200;

const EMPTY_SNAPSHOT: StreamSnapshot = { status: "idle", statusDetail: null, users: {} };

export class StreamStore {
  private snapshot: StreamSnapshot = EMPTY_SNAPSHOT;
  private listeners = new Set<() => void>();
  private notifyTimer: ReturnType<typeof setTimeout> | null = null;

  // Bound methods so they can be passed straight to useSyncExternalStore.
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): StreamSnapshot => this.snapshot;

  setStatus(status: StreamStatus, detail?: string): void {
    this.snapshot = { ...this.snapshot, status, statusDetail: detail ?? null };
    this.notifyNow(); // status changes are rare — render them immediately
  }

  ingest(msg: DispatchMessage, receivedAt: number): void {
    const def = resolveDataType(msg.t);
    const value = valueOf(def, msg);

    const user = this.snapshot.users[msg.uid];
    const existing = user?.series[msg.t];
    const cap = SERIES_CAPS[msg.t] ?? DEFAULT_SERIES_CAP;

    // Unchartable types (LOCATION, ACTIVITY) still update `latest` so their
    // card renders — they just don't grow a points buffer.
    const points =
      value === undefined
        ? (existing?.points ?? [])
        : [...(existing?.points ?? []), { at: receivedAt, value }].slice(-cap);

    this.snapshot = {
      ...this.snapshot,
      users: {
        ...this.snapshot.users,
        [msg.uid]: {
          lastSeenAt: receivedAt,
          series: {
            ...user?.series,
            [msg.t]: { latest: msg, points, lastAt: receivedAt },
          },
        },
      },
    };
    this.notifyCoalesced();
  }

  private notifyNow(): void {
    if (this.notifyTimer) {
      clearTimeout(this.notifyTimer);
      this.notifyTimer = null;
    }
    this.listeners.forEach((listener) => listener());
  }

  private notifyCoalesced(): void {
    if (this.notifyTimer) return; // a flush is already scheduled
    this.notifyTimer = setTimeout(() => {
      this.notifyTimer = null;
      this.listeners.forEach((listener) => listener());
    }, NOTIFY_MS);
  }
}
