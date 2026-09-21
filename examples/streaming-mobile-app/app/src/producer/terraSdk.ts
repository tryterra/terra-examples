/**
 * Thin adapter around the terra-rt native SDK. It exists so demo mode can
 * swap in a synthetic implementation (demoSdkAdapter.ts) behind the same
 * interface. Native module — requires a development build, not Expo Go.
 *
 * Docs:
 *   Connect a wearable: https://docs.tryterra.co/streaming-api/connect-wearable-to-sdk/react-native
 *   Stream to Terra:    https://docs.tryterra.co/streaming-api/your-app-greater-than-terra/react-native
 */

import * as rt from 'terra-rt';
import { normalizeUpdateType } from './normalizeType';
import { ConnectionType, ProducerSdkAdapter } from './ProducerController';

const toConnection = (c: ConnectionType): rt.ConnectionInput => {
  switch (c) {
    case 'PHONE':
      return 'PHONE';
    case 'WATCH':
      return rt.Connections.WATCH_OS;
    case 'WEAR':
      return rt.Connections.WEAR_OS;
    default:
      return rt.Connections.BLE;
  }
};

/** terra-rt resolves { success: false } instead of rejecting — normalize. */
function throwIfFailed(result: rt.SuccessMessage, action: string): void {
  if (result && result.success === false) {
    throw new Error(String(result.error ?? `${action} failed`));
  }
}

export function createSdkAdapter(): ProducerSdkAdapter {
  return {
    async initialize(devId, referenceId) {
      throwIfFailed(await rt.initTerra(devId, referenceId), 'initTerra');
    },

    async registerDevice(token) {
      throwIfFailed(await rt.initConnection(token), 'initConnection');
    },

    async getUserId() {
      const result = await rt.getUserId();
      return result?.userId ? String(result.userId) : null;
    },

    async startScan(connection) {
      // Permissions are requested by the wrapper; missing ones reject.
      throwIfFailed(
        await rt.startDeviceScanWithCallback(toConnection(connection)),
        'startDeviceScanWithCallback',
      );
    },

    async stopScan(connection) {
      throwIfFailed(await rt.stopDeviceScan(toConnection(connection)), 'stopDeviceScan');
    },

    async connectToDevice(device) {
      const result = await rt.connectDevice(device.raw as rt.Device);
      return result?.success !== false;
    },

    async connectWatch() {
      // Requires the watch app installed and open — WatchConnectivity
      // sessions need both sides alive.
      const result = await rt.connectWithWatchOS();
      return result?.success !== false;
    },

    async startStreaming(connection, dataTypes, token) {
      await rt.startRealtime(toConnection(connection), dataTypes as rt.DataTypes[], token);
    },

    async stopStreaming(connection) {
      await rt.stopRealtime(toConnection(connection));
    },

    async disconnect(connection) {
      await rt.disconnect(toConnection(connection));
    },

    onDeviceFound(cb) {
      return rt.onDeviceFound((d) => {
        if (!d.id) return; // unconnectable without an id
        cb({
          id: String(d.id),
          name: String(d.name ?? '') || 'Unknown device',
          raw: d,
        });
      });
    },

    onUpdate(cb) {
      return rt.onUpdate((u) =>
        cb({
          type: u.type != null ? normalizeUpdateType(String(u.type)) : undefined,
          ts: u.ts != null ? String(u.ts) : undefined,
          val: u.val ?? undefined,
          d: u.d ?? undefined,
        }),
      );
    },

    onConnectionUpdate(cb) {
      return rt.onConnectionUpdate(cb);
    },
  };
}
