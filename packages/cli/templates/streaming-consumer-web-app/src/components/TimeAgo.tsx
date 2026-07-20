import { useEffect, useState } from "react";

/**
 * "3s ago" that updates itself. Owns its own 1s interval so only this leaf
 * re-renders every second — never the stat cards or the grid around it.
 */
export function TimeAgo({ at }: { at: number }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, []);
  const seconds = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (seconds < 1) return <>just now</>;
  if (seconds < 60) return <>{seconds}s ago</>;
  const minutes = Math.floor(seconds / 60);
  return <>{minutes}m ago</>;
}
