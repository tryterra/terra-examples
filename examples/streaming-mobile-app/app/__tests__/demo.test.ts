/**
 * Demo mode: the synthetic producer SDK adapter.
 * Pure timers — verified with jest fake timers, no native anything.
 */
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}), { virtual: true });

import { createDemoSession } from '../src/auth/session';
import { createDemoSdkAdapter } from '../src/producer/demoSdkAdapter';

describe('createDemoSession', () => {
  test('is flagged and never expires', () => {
    const s = createDemoSession();
    expect(s.demo).toBe(true);
    expect(s.expiresAt).toBeNull();
    expect(s.userId).toBe('demo-uid-you');
  });
});

describe('createDemoSdkAdapter', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('full producer flow: scan finds devices, streaming emits readings', async () => {
    const sdk = createDemoSdkAdapter();
    const devices: string[] = [];
    const updates: { type?: string; val?: number; d?: number[] }[] = [];
    let connected = false;
    sdk.onDeviceFound((d) => devices.push(d.name));
    sdk.onUpdate((u) => updates.push(u));
    sdk.onConnectionUpdate((c) => {
      connected = c;
    });

    await sdk.startScan('BLE');
    jest.advanceTimersByTime(3_000);
    expect(devices).toContain('Polar H10 4F2A1B');

    const start = sdk.startStreaming('BLE', ['HEART_RATE'], 'rt.demo');
    jest.advanceTimersByTime(400); // the internal startup delay
    await start;
    jest.advanceTimersByTime(5_000);
    expect(connected).toBe(true);
    expect(updates.some((u) => u.type === 'HEART_RATE' && typeof u.val === 'number')).toBe(true);

    const count = updates.length;
    await sdk.stopStreaming('BLE');
    expect(connected).toBe(false);
    jest.advanceTimersByTime(3_000);
    expect(updates.length).toBe(count);
  });

  test('phone sensors emit vector data in g', async () => {
    const sdk = createDemoSdkAdapter();
    const updates: { type?: string; d?: number[] }[] = [];
    sdk.onUpdate((u) => updates.push(u));

    const start = sdk.startStreaming('PHONE', ['ACCELERATION', 'GYROSCOPE'], 'rt.demo');
    jest.advanceTimersByTime(400);
    await start;
    jest.advanceTimersByTime(2_000);

    const accel = updates.filter((u) => u.type === 'ACCELERATION');
    expect(accel.length).toBeGreaterThan(0);
    // LINEAR acceleration (gravity-compensated SI): resting ≈ 0, nudges
    // bounded — matching the real SDKs.
    for (const u of accel) {
      const [x, y, z] = u.d ?? [];
      expect(Math.hypot(x, y, z)).toBeLessThan(4);
    }
    expect(updates.some((u) => u.type === 'GYROSCOPE')).toBe(true);
  });
});
