import { DiscoveredDevice, ProducerSdkAdapter } from './ProducerController';

/**
 * Demo mode's fake native SDK: the full producer flow — scan, pick a
 * device, auto-stream — on synthetic data, no hardware, no network.
 * Interchangeable with the real adapter (terraSdk.ts) behind
 * ProducerSdkAdapter.
 */

const DEMO_DEVICES: DiscoveredDevice[] = [
  { id: 'demo-polar', name: 'Polar H10 4F2A1B', raw: { type: 'HEARTRATE' } },
  { id: 'demo-wahoo', name: 'Wahoo TICKR 88C1', raw: { type: 'HEARTRATE' } },
  { id: 'demo-garmin', name: 'Garmin HRM-Pro', raw: { type: 'HEARTRATE' } },
];

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function createDemoSdkAdapter(): ProducerSdkAdapter {
  let updateCb: ((u: { type?: string; ts?: string; val?: number; d?: number[] }) => void) | null = null;
  let deviceCb: ((d: DiscoveredDevice) => void) | null = null;
  let connectionCb: ((connected: boolean) => void) | null = null;
  let scanTimers: ReturnType<typeof setTimeout>[] = [];
  let streamTimers: ReturnType<typeof setInterval>[] = [];
  let t = 0;

  const stopStream = () => {
    streamTimers.forEach(clearInterval);
    streamTimers = [];
    connectionCb?.(false);
  };

  return {
    async initialize() {
      await delay(300);
    },
    async registerDevice() {
      await delay(300);
    },
    async getUserId() {
      return 'demo-uid-you';
    },
    async startScan() {
      // Devices "appear" over a couple of seconds, like a real scan.
      DEMO_DEVICES.forEach((device, i) => {
        scanTimers.push(setTimeout(() => deviceCb?.(device), 500 + i * 700));
      });
    },
    async stopScan() {
      scanTimers.forEach(clearTimeout);
      scanTimers = [];
    },
    async connectToDevice() {
      await delay(700);
      return true;
    },
    async connectWatch() {
      await delay(700);
      return true;
    },
    async startStreaming(connection) {
      await delay(300);
      setTimeout(() => connectionCb?.(true), 500);
      const emit = (type: string, val?: number, d?: number[]) =>
        updateCb?.({ type, ts: new Date().toISOString(), val, d });

      if (connection === 'PHONE') {
        // Phone sensors like the real SDKs: LINEAR acceleration in SI
        // (gravity-compensated m/s² — resting ≈ [0,0,0]) and rad/s. A phone
        // on a table that gets nudged now and then.
        streamTimers.push(
          setInterval(() => {
            t += 1;
            const nudge = t % 23 < 2 ? 2.4 * Math.sin(t * 2) : 0;
            emit('ACCELERATION', undefined, [
              nudge + (Math.random() - 0.5) * 0.06,
              (Math.random() - 0.5) * 0.06,
              nudge / 2 + (Math.random() - 0.5) * 0.04,
            ]);
            emit('GYROSCOPE', undefined, [
              nudge / 3 + (Math.random() - 0.5) * 0.004,
              (Math.random() - 0.5) * 0.004,
              (Math.random() - 0.5) * 0.004,
            ]);
          }, 250),
        );
      } else {
        // BLE strap: heart rate warming up into a workout.
        streamTimers.push(
          setInterval(() => {
            t += 1;
            emit(
              'HEART_RATE',
              Math.round(96 + 28 * Math.sin(t / 13) + (Math.random() - 0.5) * 4),
            );
            if (t % 3 === 0) {
              emit('RR_INTERVAL', Math.round(620 + 60 * Math.sin(t / 5)));
            }
          }, 1000),
        );
      }
    },
    async stopStreaming() {
      stopStream();
    },
    async disconnect() {
      stopStream();
    },
    onDeviceFound(cb) {
      deviceCb = cb;
      return () => {
        deviceCb = null;
      };
    },
    onUpdate(cb) {
      updateCb = cb;
      return () => {
        updateCb = null;
      };
    },
    onConnectionUpdate(cb) {
      connectionCb = cb;
      return () => {
        connectionCb = null;
      };
    },
  };
}
