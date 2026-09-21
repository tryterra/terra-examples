import { useEffect, useState } from 'react';
import { ProducerState } from '../producer/useProducer';

/**
 * Grace periods before "streaming" with no readings counts as stalled.
 * A device that has NEVER sent anything is called out quickly (likely not
 * a supported device at all); one that sent data and paused gets longer —
 * sparse types (steps, floors) legitimately go quiet between updates.
 */
const NEVER_SENT_AFTER_MS = 6_000;
const WENT_QUIET_AFTER_MS = 15_000;

/**
 * True when the stream is nominally running but the device has sent
 * nothing for a while — strap not worn, sensor asleep, or a device that
 * doesn't provide any of the readings we ask for (the BLE scan is
 * unfiltered, so "connectable" ≠ "useful").
 */
export function useStreamStalled(producer: ProducerState, demo: boolean): boolean {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 2_000);
    return () => clearInterval(id);
  }, []);

  const lastDataAt = Math.max(
    0,
    ...Object.values(producer.readings).map((r) => r.receivedAt),
  );

  // streamingSince lives on the singleton controller, so the grace period
  // survives tab switches (screens unmount when tabs change).
  if (producer.phase !== 'streaming' || demo || producer.streamingSince === null) {
    return false;
  }
  const neverSent = lastDataAt === 0;
  const quietFor = now - Math.max(lastDataAt, producer.streamingSince);
  return quietFor > (neverSent ? NEVER_SENT_AFTER_MS : WENT_QUIET_AFTER_MS);
}
