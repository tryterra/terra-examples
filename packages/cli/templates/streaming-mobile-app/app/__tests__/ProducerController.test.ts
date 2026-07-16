import {
  DiscoveredDevice,
  ProducerApi,
  ProducerController,
  ProducerSdkAdapter,
  STREAM_DATA_TYPES,
} from '../src/producer/ProducerController';

function makeSdk(overrides: Partial<ProducerSdkAdapter> = {}) {
  let updateCb: ((u: any) => void) | null = null;
  let deviceCb: ((d: DiscoveredDevice) => void) | null = null;
  let connectionCb: ((c: boolean) => void) | null = null;
  const calls: Record<string, any[][]> = {};
  const record =
    (name: string, ret: any = undefined) =>
    async (...args: any[]) => {
      (calls[name] ??= []).push(args);
      return ret;
    };

  const sdk: ProducerSdkAdapter = {
    initialize: record('initialize'),
    registerDevice: record('registerDevice'),
    getUserId: async () => 'terra-user-1',
    startScan: record('startScan'),
    stopScan: record('stopScan'),
    connectToDevice: record('connectToDevice', true) as any,
    connectWatch: record('connectWatch', true) as any,
    startStreaming: record('startStreaming'),
    stopStreaming: record('stopStreaming'),
    disconnect: record('disconnect'),
    onDeviceFound: (cb) => {
      deviceCb = cb;
      return () => undefined;
    },
    onUpdate: (cb) => {
      updateCb = cb;
      return () => undefined;
    },
    onConnectionUpdate: (cb) => {
      connectionCb = cb;
      return () => undefined;
    },
    ...overrides,
  };
  return {
    sdk,
    calls,
    emitUpdate: (u: any) => updateCb?.(u),
    emitDevice: (d: DiscoveredDevice) => deviceCb?.(d),
    emitConnection: (c: boolean) => connectionCb?.(c),
  };
}

function makeApi(overrides: Partial<ProducerApi> = {}) {
  const mapped: Array<[string, string]> = [];
  let streamingTokenCalls = 0;
  const api: ProducerApi = {
    fetchSdkToken: async () => 'sdk-token',
    fetchStreamingToken: async (uid) => {
      streamingTokenCalls += 1;
      return `rt-token-for-${uid}`;
    },
    mapUser: async (uid, ref) => {
      mapped.push([uid, ref]);
    },
    ...overrides,
  };
  return { api, mapped, streamingTokenCalls: () => streamingTokenCalls };
}

const strap: DiscoveredDevice = { id: 'AA:BB', name: 'Polar H10', raw: { id: 'AA:BB' } };

describe('ProducerController', () => {
  test('unavailable without a dev-id', () => {
    const { api } = makeApi();
    const { sdk } = makeSdk();
    expect(
      new ProducerController({ sdk, api, devId: undefined }).getSnapshot().phase,
    ).toBe('unavailable');
  });

  test('setup: init → register → map reference_id → ready', async () => {
    const { sdk, calls } = makeSdk();
    const { api, mapped } = makeApi();
    const c = new ProducerController({ sdk, api, devId: 'dev-1' });

    await c.setup('adrian');

    expect(calls.initialize).toEqual([['dev-1', 'adrian']]);
    expect(calls.registerDevice).toEqual([['sdk-token']]);
    expect(mapped).toEqual([['terra-user-1', 'adrian']]);
    expect(c.getSnapshot()).toMatchObject({
      phase: 'ready',
      userId: 'terra-user-1',
      referenceId: 'adrian',
      connectionType: 'BLE',
    });
  });

  test('setup failure returns to idle with error, mapping failure does not block', async () => {
    const { sdk } = makeSdk({
      registerDevice: async () => {
        throw new Error('bad token');
      },
    });
    const { api } = makeApi();
    const c = new ProducerController({ sdk, api, devId: 'dev-1' });
    await c.setup('x');
    expect(c.getSnapshot().phase).toBe('idle');
    expect(c.getSnapshot().error).toContain('bad token');

    const { sdk: sdk2 } = makeSdk();
    const { api: api2 } = makeApi({
      mapUser: async () => {
        throw new Error('server down');
      },
    });
    const c2 = new ProducerController({ sdk: sdk2, api: api2, devId: 'dev-1' });
    await c2.setup('y');
    expect(c2.getSnapshot().phase).toBe('ready'); // best-effort mapping
  });

  test('BLE flow: scan → device list → connect → AUTO-streams all types', async () => {
    const { sdk, calls, emitDevice } = makeSdk();
    const { api, streamingTokenCalls } = makeApi();
    const c = new ProducerController({ sdk, api, devId: 'dev-1' });
    await c.setup('adrian');

    await c.connectDevice();
    expect(calls.startScan).toEqual([['BLE']]);
    expect(c.getSnapshot().phase).toBe('scanning');

    emitDevice(strap);
    emitDevice(strap); // duplicate event — deduped by id
    emitDevice({ id: 'CC:DD', name: 'Wahoo TICKR', raw: {} });
    expect(c.getSnapshot().devices.map((d) => d.name)).toEqual([
      'Polar H10',
      'Wahoo TICKR',
    ]);

    await c.connectToDevice(strap);

    // Streaming started automatically, to Terra, with every data type.
    expect(streamingTokenCalls()).toBe(1);
    expect(calls.startStreaming).toEqual([
      ['BLE', STREAM_DATA_TYPES, 'rt-token-for-terra-user-1'],
    ]);
    expect(c.getSnapshot()).toMatchObject({
      phase: 'streaming',
      deviceName: 'Polar H10',
    });
    expect(STREAM_DATA_TYPES).not.toContain('LOCATION');
  });

  test('WATCH: pairs over WatchConnectivity then auto-streams', async () => {
    const { sdk, calls } = makeSdk();
    const { api } = makeApi();
    const c = new ProducerController({ sdk, api, devId: 'dev-1' });
    await c.setup('adrian');
    c.setConnectionType('WATCH');

    await c.connectDevice();

    expect(calls.connectWatch).toHaveLength(1);
    expect(c.getSnapshot().deviceName).toBe('Apple Watch');
    expect(c.getSnapshot().phase).toBe('streaming');
    expect(calls.startStreaming[0][0]).toBe('WATCH');
  });

  test('WATCH: unreachable watch surfaces guidance, no stream', async () => {
    const { sdk, calls } = makeSdk({ connectWatch: async () => false });
    const { api } = makeApi();
    const c = new ProducerController({ sdk, api, devId: 'dev-1' });
    await c.setup('adrian');
    c.setConnectionType('WATCH');

    await c.connectDevice();

    expect(c.getSnapshot().phase).toBe('ready');
    expect(c.getSnapshot().error).toMatch(/watch/i);
    expect(calls.startStreaming ?? []).toHaveLength(0);
  });

  test('failed device connect returns to scanning and resumes the scan', async () => {
    const { sdk, calls } = makeSdk({ connectToDevice: async () => false });
    const { api } = makeApi();
    const c = new ProducerController({ sdk, api, devId: 'dev-1' });
    await c.setup('adrian');
    await c.connectDevice();

    await c.connectToDevice(strap);

    expect(c.getSnapshot().phase).toBe('scanning');
    expect(c.getSnapshot().error).toContain('Polar H10');
    expect(calls.startScan).toHaveLength(2); // initial + resumed
  });

  test('stray Device events outside the scanning phase are ignored', async () => {
    const { sdk, emitDevice } = makeSdk();
    const { api } = makeApi();
    const c = new ProducerController({ sdk, api, devId: 'dev-1' });
    emitDevice(strap); // idle
    expect(c.getSnapshot().devices).toEqual([]);
  });

  test('PHONE flow: no pairing — straight to streaming', async () => {
    const { sdk, calls } = makeSdk();
    const { api } = makeApi();
    const c = new ProducerController({ sdk, api, devId: 'dev-1' });
    await c.setup('adrian');
    c.setConnectionType('PHONE');

    await c.connectDevice();

    expect(calls.startScan).toBeUndefined();
    expect(calls.startStreaming[0][0]).toBe('PHONE');
    expect(c.getSnapshot().phase).toBe('streaming');
  });

  test('cancelScan returns to ready and clears the device list', async () => {
    const { sdk, emitDevice } = makeSdk();
    const { api } = makeApi();
    const c = new ProducerController({ sdk, api, devId: 'dev-1' });
    await c.setup('adrian');
    await c.connectDevice();
    emitDevice(strap);

    await c.cancelScan();

    expect(c.getSnapshot()).toMatchObject({ phase: 'ready', devices: [] });
  });

  test('connection type is locked while connecting/streaming', async () => {
    const { sdk } = makeSdk();
    const { api } = makeApi();
    const c = new ProducerController({ sdk, api, devId: 'dev-1' });
    await c.setup('adrian');
    await c.connectDevice(); // scanning

    c.setConnectionType('PHONE');
    expect(c.getSnapshot().connectionType).toBe('BLE'); // ignored

    await c.cancelScan();
    c.setConnectionType('PHONE');
    expect(c.getSnapshot().connectionType).toBe('PHONE');
  });

  test('never streams without a Terra user_id (no silent local-only)', async () => {
    const { sdk, calls } = makeSdk({ getUserId: async () => null });
    const { api, streamingTokenCalls } = makeApi();
    const c = new ProducerController({ sdk, api, devId: 'dev-1' });
    await c.setup('adrian');
    c.setConnectionType('PHONE');

    await c.connectDevice();

    expect(streamingTokenCalls()).toBe(0);
    expect(calls.startStreaming).toBeUndefined();
    expect(c.getSnapshot().phase).toBe('deviceConnected');
    expect(c.getSnapshot().error).toContain('user_id');
  });

  test('Update events populate readings AND capped history series', async () => {
    const { sdk, emitUpdate, emitConnection } = makeSdk();
    const { api } = makeApi();
    const c = new ProducerController({ sdk, api, devId: 'dev-1' });

    emitUpdate({ type: 'HEART_RATE', ts: '2026-07-08T10:00:00Z', val: 91 });
    emitUpdate({ type: 'HEART_RATE', ts: '2026-07-08T10:00:01Z', val: 93 });
    emitUpdate({ type: 'ACCELERATION', val: undefined, d: [0.1, 0.2, 9.8] });
    emitConnection(true);

    const snap = c.getSnapshot();
    expect(snap.readings.HEART_RATE.val).toBe(93);
    expect(snap.readings.ACCELERATION.val).toBeUndefined(); // never null/0
    expect(snap.series.HEART_RATE.map((s) => s.val)).toEqual([91, 93]);
    expect(snap.series.HEART_RATE[1].seq).toBeGreaterThan(
      snap.series.HEART_RATE[0].seq,
    );
    expect(snap.series.ACCELERATION[0].d).toEqual([0.1, 0.2, 9.8]);
    expect(snap.terraSocketConnected).toBe(true);

    // History is capped (scalar cap = 120).
    for (let i = 0; i < 150; i++) {
      emitUpdate({ type: 'HEART_RATE', val: 60 + (i % 30) });
    }
    expect(c.getSnapshot().series.HEART_RATE).toHaveLength(120);
  });

  test('resetDevice returns to ready: stops stream, disconnects, clears data', async () => {
    const { sdk, calls, emitUpdate, emitDevice } = makeSdk();
    const { api } = makeApi();
    const c = new ProducerController({ sdk, api, devId: 'dev-1' });
    await c.setup('adrian');
    await c.connectDevice();
    emitDevice(strap);
    await c.connectToDevice(strap);
    emitUpdate({ type: 'HEART_RATE', val: 90 });

    await c.resetDevice();

    expect(calls.stopStreaming).toEqual([['BLE']]);
    expect(calls.disconnect).toEqual([['BLE']]);
    expect(c.getSnapshot()).toMatchObject({
      phase: 'ready',
      readings: {},
      series: {},
      deviceName: null,
    });

    // From ready, resetDevice is a no-op.
    await c.resetDevice();
    expect(calls.disconnect).toHaveLength(1);
  });

  test('cancelConnect aborts a hung connect and ignores the late result', async () => {
    let resolveConnect!: (ok: boolean) => void;
    const { sdk, calls } = makeSdk({
      connectToDevice: () =>
        new Promise<boolean>((resolve) => {
          resolveConnect = resolve;
        }),
    });
    const { api } = makeApi();
    const c = new ProducerController({ sdk, api, devId: 'dev-1' });
    await c.setup('adrian');
    await c.connectDevice(); // BLE default → scanning
    const connecting = c.connectToDevice(strap); // hangs
    expect(c.getSnapshot().phase).toBe('connectingDevice');

    await c.cancelConnect();
    expect(c.getSnapshot().phase).toBe('ready');
    expect(calls.disconnect).toHaveLength(1);

    // The hung native promise finally settles — result must be ignored.
    resolveConnect(true);
    await connecting;
    expect(c.getSnapshot().phase).toBe('ready');
    expect(c.getSnapshot().deviceName).toBeNull();
  });

  test('startRealtime failure surfaces as an error, no silent retry', async () => {
    let attempts = 0;
    const { sdk, calls } = makeSdk({
      startStreaming: async () => {
        attempts += 1;
        throw new Error('still broken');
      },
    });
    const { api } = makeApi();
    const c = new ProducerController({ sdk, api, devId: 'dev-1' });
    await c.setup('adrian');
    c.setConnectionType('PHONE');
    await c.connectDevice(); // auto-streams

    expect(attempts).toBe(1); // exactly one attempt — no hidden recovery
    expect(calls.registerDevice).toHaveLength(1); // setup only
    expect(c.getSnapshot().phase).toBe('deviceConnected');
    expect(c.getSnapshot().error).toContain('still broken');
  });

  test('stop/resume from the control surface', async () => {
    const { sdk, calls, emitDevice } = makeSdk();
    const { api } = makeApi();
    const c = new ProducerController({ sdk, api, devId: 'dev-1' });
    await c.setup('adrian');
    await c.connectDevice();
    emitDevice(strap);
    await c.connectToDevice(strap);

    await c.stopStreaming();
    expect(c.getSnapshot().phase).toBe('deviceConnected');

    await c.startStreaming();
    expect(c.getSnapshot().phase).toBe('streaming');
    expect(calls.startStreaming).toHaveLength(2);
  });
});
