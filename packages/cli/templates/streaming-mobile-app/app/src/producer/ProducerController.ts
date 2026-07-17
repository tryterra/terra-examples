/**
 * Producer state machine — the phone streams wearable data up to Terra.
 * Pure TypeScript with the SDK and token calls injected, so the full
 * lifecycle is unit-testable without native code. useProducer.ts binds it
 * to React; terraSdk.ts / demoSdkAdapter.ts implement the SDK side.
 *
 * The producer streams a wearable's data to Terra's backend (see the
 * Streaming API overview): https://docs.tryterra.co/streaming-api/getting-started
 */

export type ConnectionType = 'BLE' | 'PHONE' | 'WATCH' | 'WEAR';

/** Connection types that discover devices via a scan + list. */
export const SCANNING_TYPES: ConnectionType[] = ['BLE', 'WEAR'];

/**
 * Everything the demo requests from a device — types are not user-selected.
 * Devices ignore types they can't provide, so over-requesting is free.
 * LOCATION is excluded: it needs permissions the demo doesn't ask for.
 */
export const STREAM_DATA_TYPES: string[] = [
  'HEART_RATE',
  'STEPS',
  'HRV',
  'RR_INTERVAL',
  'CALORIES',
  'DISTANCE',
  'SPEED',
  'STEPS_CADENCE',
  'BIKE_CADENCE',
  'POWER',
  'FLOORS_CLIMBED',
  'MET',
  'ACTIVITY',
  'ACCELERATION',
  'GYROSCOPE',
  'ECG',
];

export type ProducerPhase =
  | 'unavailable' // no dev-id (pair via the dashboard QR first)
  | 'idle'
  | 'settingUp'
  | 'ready' // SDK initialized, device registered with Terra
  | 'scanning' // BLE: discovering devices for the custom list
  | 'connectingDevice'
  | 'deviceConnected'
  | 'starting'
  | 'streaming';

export interface DiscoveredDevice {
  id: string;
  name: string;
  /** The SDK's original device payload — passed back on connect. */
  raw: unknown;
}

export interface LocalReading {
  val?: number;
  d?: number[];
  receivedAt: number;
}

export interface ProducerSample {
  seq: number;
  ts: string;
  val?: number;
  d?: number[];
}

/** Rolling history caps per data type — dense types get more headroom. */
const SERIES_CAPS: Record<string, number> = {
  ACCELERATION: 256,
  GYROSCOPE: 256,
  ECG: 200,
  LOCATION: 100,
};
const DEFAULT_SERIES_CAP = 120;

export interface ProducerSnapshot {
  phase: ProducerPhase;
  error: string | null;
  /** Terra user_id assigned to this phone after registration. */
  userId: string | null;
  referenceId: string | null;
  /** Which pipe the wearable data arrives through. */
  connectionType: ConnectionType;
  /** BLE devices discovered during the current scan. */
  devices: DiscoveredDevice[];
  /** Name of the device we connected to (label on the control card). */
  deviceName: string | null;
  /** SDK's websocket-to-Terra status (ConnectionUpdate events). */
  terraSocketConnected: boolean;
  /** Epoch ms when the current stream started; null when not streaming. */
  streamingSince: number | null;
  /** Latest local reading per data type. */
  readings: Record<string, LocalReading>;
  /** Rolling local history per type — the Live tab's "you" section. */
  series: Record<string, ProducerSample[]>;
}

/** What we need from the native SDK (implemented in terraSdk.ts). */
export interface ProducerSdkAdapter {
  initialize(devId: string, referenceId: string): Promise<void>;
  registerDevice(token: string): Promise<void>;
  getUserId(): Promise<string | null>;
  /** Begin a callback-driven scan; devices arrive via onDeviceFound. */
  startScan(connection: ConnectionType): Promise<void>;
  stopScan(connection: ConnectionType): Promise<void>;
  /** Pair with a device previously reported by onDeviceFound. */
  connectToDevice(device: DiscoveredDevice): Promise<boolean>;
  /** Establish the WatchConnectivity session with a paired Apple Watch. */
  connectWatch(): Promise<boolean>;
  startStreaming(
    connection: ConnectionType,
    dataTypes: string[],
    token: string,
  ): Promise<void>;
  stopStreaming(connection: ConnectionType): Promise<void>;
  disconnect(connection: ConnectionType): Promise<void>;
  onDeviceFound(cb: (device: DiscoveredDevice) => void): () => void;
  onUpdate(cb: (u: { type?: string; ts?: string; val?: number; d?: number[] }) => void): () => void;
  onConnectionUpdate(cb: (connected: boolean) => void): () => void;
}

/** Token operations (implemented by RtTokenProvider). */
export interface ProducerApi {
  fetchSdkToken(): Promise<string>;
  fetchStreamingToken(userId: string): Promise<string>;
  mapUser(userId: string, referenceId: string): Promise<void>;
}

export interface ProducerDeps {
  sdk: ProducerSdkAdapter;
  api: ProducerApi;
  devId: string | undefined;
}

type Listener = (snapshot: ProducerSnapshot) => void;

export class ProducerController {
  private snapshot: ProducerSnapshot;
  private listeners = new Set<Listener>();
  private unsubscribers: Array<() => void> = [];
  private seq = 0;

  constructor(private readonly deps: ProducerDeps) {
    this.snapshot = {
      phase: deps.devId ? 'idle' : 'unavailable',
      error: null,
      userId: null,
      referenceId: null,
      connectionType: 'BLE',
      devices: [],
      deviceName: null,
      terraSocketConnected: false,
      streamingSince: null,
      readings: {},
      series: {},
    };
    if (deps.sdk) {
      this.unsubscribers.push(
        deps.sdk.onUpdate((u) => this.handleUpdate(u)),
        deps.sdk.onDeviceFound((d) => this.handleDeviceFound(d)),
        deps.sdk.onConnectionUpdate((connected) =>
          this.set({ terraSocketConnected: connected }),
        ),
      );
    }
  }

  getSnapshot(): ProducerSnapshot {
    return this.snapshot;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** initTerra → rt. token → initConnection → map reference_id. */
  async setup(referenceId: string): Promise<void> {
    const { sdk, api, devId } = this.deps;
    if (!sdk || !devId) return;
    this.set({ phase: 'settingUp', error: null, referenceId });
    try {
      await sdk.initialize(devId, referenceId);
      const token = await api.fetchSdkToken();
      await sdk.registerDevice(token);
      const userId = await sdk.getUserId();
      if (userId) {
        // Best-effort — a no-op for RtTokenProvider (identity ships in the QR).
        await api.mapUser(userId, referenceId).catch(() => undefined);
      }
      this.set({ phase: 'ready', userId });
    } catch (err) {
      this.set({ phase: 'idle', error: `Setup failed: ${String(err)}` });
    }
  }

  /** Switch pipe — only between sessions, not mid-connection. */
  setConnectionType(connection: ConnectionType): void {
    if (this.snapshot.connectionType === connection) return;
    if (
      ['scanning', 'connectingDevice', 'deviceConnected', 'starting', 'streaming'].includes(
        this.snapshot.phase,
      )
    ) {
      return; // disconnect first (resetDevice)
    }
    this.set({ connectionType: connection, devices: [] });
  }

  /**
   * BLE / WEAR: begin discovery for the custom device list.
   * PHONE: no device to find — jump straight to connected + streaming.
   * WATCH: establish the WatchConnectivity session, then stream.
   */
  async connectDevice(): Promise<void> {
    const { sdk } = this.deps;
    if (!sdk || this.snapshot.phase !== 'ready') return;

    if (this.snapshot.connectionType === 'PHONE') {
      this.set({ phase: 'deviceConnected', deviceName: 'This phone', error: null });
      await this.startStreaming();
      return;
    }

    if (this.snapshot.connectionType === 'WATCH') {
      const epoch = ++this.connectEpoch;
      this.set({ phase: 'connectingDevice', error: null });
      try {
        const connected = await sdk.connectWatch();
        if (epoch !== this.connectEpoch) return; // cancelled while in flight
        if (!connected) {
          this.set({
            phase: 'ready',
            error:
              "Couldn't reach your Apple Watch — make sure Terra Grip is installed and open on the watch",
          });
          return;
        }
        this.set({ phase: 'deviceConnected', deviceName: 'Apple Watch' });
        await this.startStreaming();
      } catch (err) {
        if (epoch !== this.connectEpoch) return;
        this.set({ phase: 'ready', error: `Watch pairing failed: ${String(err)}` });
      }
      return;
    }

    this.set({ phase: 'scanning', devices: [], error: null });
    try {
      await sdk.startScan(this.snapshot.connectionType);
    } catch (err) {
      this.set({ phase: 'ready', error: `Scan failed: ${String(err)}` });
    }
  }

  /** Guards connectToDevice against results arriving after a cancel. */
  private connectEpoch = 0;

  /** Pair with a device from the list, then auto-start streaming. */
  async connectToDevice(device: DiscoveredDevice): Promise<void> {
    const { sdk } = this.deps;
    if (!sdk || this.snapshot.phase !== 'scanning') return;
    const epoch = ++this.connectEpoch;
    this.set({ phase: 'connectingDevice', error: null });
    try {
      await sdk.stopScan(this.snapshot.connectionType).catch(() => undefined);
      const connected = await sdk.connectToDevice(device);
      if (epoch !== this.connectEpoch) return; // cancelled while in flight
      if (!connected) {
        this.set({ phase: 'scanning', error: `Couldn't connect to ${device.name}` });
        await sdk.startScan(this.snapshot.connectionType).catch(() => undefined);
        return;
      }
      this.set({ phase: 'deviceConnected', deviceName: device.name });
      await this.startStreaming();
    } catch (err) {
      if (epoch !== this.connectEpoch) return; // cancelled while in flight
      this.set({
        phase: 'ready',
        error: `Device connection failed: ${String(err)}`,
      });
    }
  }

  /**
   * Abort a connect that's taking too long (BLE connects can hang
   * indefinitely). Any late result from the in-flight attempt is ignored.
   */
  async cancelConnect(): Promise<void> {
    const { sdk } = this.deps;
    if (!sdk || this.snapshot.phase !== 'connectingDevice') return;
    this.connectEpoch++;
    try {
      await sdk.disconnect(this.snapshot.connectionType);
    } catch {
      // aborting a half-open connection is best-effort
    }
    this.set({ phase: 'ready', devices: [], deviceName: null, error: null });
  }

  async cancelScan(): Promise<void> {
    const { sdk } = this.deps;
    if (!sdk || this.snapshot.phase !== 'scanning') return;
    await sdk.stopScan(this.snapshot.connectionType).catch(() => undefined);
    this.set({ phase: 'ready', devices: [] });
  }

  /** Always streams to Terra — a missing token is an error, not a mode. */
  async startStreaming(): Promise<void> {
    const { sdk, api } = this.deps;
    if (!sdk || this.snapshot.phase !== 'deviceConnected') return;
    this.set({ phase: 'starting', error: null });
    try {
      if (!this.snapshot.userId) {
        throw new Error(
          'no Terra user_id from registration — re-run setup before streaming',
        );
      }
      const token = await api.fetchStreamingToken(this.snapshot.userId);
      console.log('[producer] streaming to Terra (reusable token)');
      await sdk.startStreaming(this.snapshot.connectionType, STREAM_DATA_TYPES, token);
      this.set({ phase: 'streaming', streamingSince: Date.now() });
    } catch (err) {
      this.set({
        phase: 'deviceConnected',
        error: `Start streaming failed: ${String(err)}`,
      });
    }
  }

  async stopStreaming(): Promise<void> {
    const { sdk } = this.deps;
    if (!sdk || this.snapshot.phase !== 'streaming') return;
    try {
      await sdk.stopStreaming(this.snapshot.connectionType);
    } catch {
      // stopping a dead stream is fine
    }
    this.set({ phase: 'deviceConnected', terraSocketConnected: false, streamingSince: null });
  }

  /** Back to the picker: stop streaming, drop the device, phase → ready. */
  async resetDevice(): Promise<void> {
    const { sdk } = this.deps;
    if (!sdk) return;
    const phase = this.snapshot.phase;
    if (!['deviceConnected', 'starting', 'streaming'].includes(phase)) return;
    try {
      if (phase === 'streaming') await sdk.stopStreaming(this.snapshot.connectionType);
      await sdk.disconnect(this.snapshot.connectionType);
    } catch {
      // dropping a dead device is fine
    }
    this.set({
      phase: 'ready',
      terraSocketConnected: false,
      streamingSince: null,
      deviceName: null,
      readings: {},
      series: {},
      error: null,
    });
  }

  dispose(): void {
    this.unsubscribers.forEach((u) => u());
    this.unsubscribers = [];
    this.listeners.clear();
  }

  private handleDeviceFound(device: DiscoveredDevice): void {
    if (this.snapshot.phase !== 'scanning') return;
    if (this.snapshot.devices.some((d) => d.id === device.id)) return;
    this.set({ devices: [...this.snapshot.devices, device] });
  }

  private handleUpdate(u: { type?: string; ts?: string; val?: number; d?: number[] }): void {
    if (!u.type) return;
    const cap = SERIES_CAPS[u.type] ?? DEFAULT_SERIES_CAP;
    const sample: ProducerSample = {
      seq: this.seq++,
      ts: u.ts ?? new Date().toISOString(),
      val: u.val,
      d: u.d,
    };
    const existing = this.snapshot.series[u.type] ?? [];
    this.set({
      readings: {
        ...this.snapshot.readings,
        [u.type]: { val: u.val, d: u.d, receivedAt: Date.now() },
      },
      series: {
        ...this.snapshot.series,
        [u.type]: [...existing, sample].slice(-cap),
      },
    });
  }

  private set(patch: Partial<ProducerSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach((l) => l(this.snapshot));
  }
}
