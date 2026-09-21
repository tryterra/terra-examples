import { useEffect, useRef, useState } from 'react';
import {
  getSession,
  getTokenProvider,
  hasValidSession,
  onSessionChange,
} from '../auth';
import { TERRA_DEV_ID } from '../config';
import { createDemoSdkAdapter } from './demoSdkAdapter';
import { ProducerController, ProducerSnapshot } from './ProducerController';
import { createSdkAdapter } from './terraSdk';

// Singleton: the producer's device connection must survive tab switches
// and component remounts.
let controller: ProducerController | null = null;
let controllerIsDemo = false;

function getController(): ProducerController {
  if (!controller) {
    const demo = getSession()?.demo === true;
    controllerIsDemo = demo;
    controller = new ProducerController({
      sdk: demo ? createDemoSdkAdapter() : createSdkAdapter(),
      // Scanned QR payload wins; .env is a dev convenience.
      devId: getSession()?.devId ?? TERRA_DEV_ID,
      // Resolved per call so a re-pair takes effect without restart.
      api: {
        fetchSdkToken: () => getTokenProvider().fetchSdkToken(),
        fetchStreamingToken: (uid) => getTokenProvider().fetchStreamingToken(uid),
        mapUser: (uid, ref) => getTokenProvider().mapUser(uid, ref),
      },
    });
  }
  return controller;
}

// Session changes drive the producer's lifecycle: unpairing tears it down
// completely (stop streaming, drop the device, dispose); a re-pair rebuilds
// it when idle so the new dev-id takes effect.
onSessionChange(() => {
  if (!controller) return;
  const demoNow = hasValidSession() && getSession()?.demo === true;
  // Also tear down when flipping between demo and real sessions mid-stream —
  // a real QR scanned during a demo must kill the synthetic producer.
  if (!hasValidSession() || demoNow !== controllerIsDemo) {
    const old = controller;
    controller = null; // next useProducer() builds fresh from the new session
    void (async () => {
      try {
        await old.resetDevice(); // stops the stream + disconnects the device
      } catch {
        // tearing down a dead session is best-effort
      }
      old.dispose();
    })();
    return;
  }
  if (['idle', 'unavailable'].includes(controller.getSnapshot().phase)) {
    controller.dispose();
    controller = null;
  }
});

export interface ProducerState extends ProducerSnapshot {
  controller: ProducerController;
}

/** Producer updates arrive many times per second (accelerometer, ECG) —
 * coalesce snapshot updates into render ticks. */
const RENDER_TICK_MS = 250;

export function useProducer(): ProducerState {
  const c = getController();
  const [snapshot, setSnapshot] = useState(c.getSnapshot());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsubscribe = c.subscribe((next) => {
      // Phase/error/device-list changes render immediately; high-frequency
      // data ticks are coalesced.
      setSnapshot((prev) => {
        if (
          prev.phase !== next.phase ||
          prev.error !== next.error ||
          prev.devices !== next.devices ||
          prev.terraSocketConnected !== next.terraSocketConnected
        ) {
          return next;
        }
        if (!timerRef.current) {
          timerRef.current = setTimeout(() => {
            timerRef.current = null;
            setSnapshot(c.getSnapshot());
          }, RENDER_TICK_MS);
        }
        return prev;
      });
    });
    return () => {
      unsubscribe();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [c]);

  return { ...snapshot, controller: c };
}
