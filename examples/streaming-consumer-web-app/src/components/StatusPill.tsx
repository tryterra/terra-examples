import type { StreamStatus } from "../lib/consumer";

// Connection-state pill: colored dot + label. A plain class map keeps this
// readable — the state → color mapping IS the component.
const STYLES: Record<StreamStatus, { dot: string; text: string; label: string }> = {
  idle: { dot: "bg-neutral", text: "text-neutral", label: "Idle" },
  token: { dot: "bg-neutral animate-pulse", text: "text-neutral", label: "Connecting…" },
  connecting: { dot: "bg-neutral animate-pulse", text: "text-neutral", label: "Connecting…" },
  ready: { dot: "bg-primary", text: "text-primary", label: "Live" },
  reconnecting: { dot: "bg-warning animate-pulse", text: "text-warning", label: "Reconnecting…" },
  error: { dot: "bg-failure", text: "text-failure", label: "Disconnected" },
};

export function StatusPill({ status }: { status: StreamStatus }) {
  const style = STYLES[status];
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border border-outline-grey bg-white px-3 py-1 text-sm font-medium ${style.text}`}
    >
      <span className={`h-2 w-2 rounded-full ${style.dot}`} />
      {style.label}
    </span>
  );
}
