/**
 * Wearable snapshot card grid for the patient overview. Degrades cleanly:
 * no connection → connect hint; connected but a metric absent → dash card.
 */
import { useNavigate } from "@tanstack/react-router";
import { WatchIcon } from "@phosphor-icons/react";
import { BiomarkerCard } from "./BiomarkerCard";
import { Skeleton } from "../../shared/atoms/Skeleton";
import { SNAPSHOT_METRICS, WORKOUT_METRICS } from "../../../lib/metrics";
import type { WearablesOk } from "../../../lib/queries";
import { capitalize, formatDate } from "../../../lib/format";

export function WearableSnapshot({
  patientId,
  wearables,
  isLoading,
}: {
  patientId: string;
  wearables: WearablesOk | undefined;
  isLoading: boolean;
}) {
  const navigate = useNavigate();
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-32 rounded-lg" />
        ))}
      </div>
    );
  }
  if (!wearables || !wearables.connected) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-dashed border-border bg-white p-6">
        <WatchIcon size={24} className="text-subtle-text" />
        <p className="text-sm text-secondary-text">
          No wearable connected - use “Connect wearable” above to link a
          device and see daily physiology alongside the labs.
        </p>
      </div>
    );
  }
  // REALTIME connections stream live sessions but serve no daily history —
  // credit the snapshot to a provider that actually supplies it.
  const provider =
    wearables.connections.find((c) => c.provider !== "REALTIME")?.provider ??
    wearables.connections[0]?.provider;
  // Show the metrics this connection actually has (e.g. Whoop → workouts,
  // no daily/sleep); fall back to the standard set when nothing has data.
  const withData = [...SNAPSHOT_METRICS, ...WORKOUT_METRICS].filter(
    (m) => wearables.snapshot[m.key as keyof typeof wearables.snapshot] != null,
  );
  const metrics = withData.length > 0 ? withData : SNAPSHOT_METRICS;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {metrics.map((m) => {
        const point =
          wearables.snapshot[m.key as keyof typeof wearables.snapshot];
        return (
          <BiomarkerCard
            key={m.key}
            icon={<m.icon size={14} weight="bold" />}
            title={m.label}
            value={point ? m.format(point.value) : null}
            unit={m.unit}
            s={point ? (m.good(point.value) ? "Good" : "Poor") : null}
            source={
              point
                ? `${provider ? capitalize(provider.toLowerCase()) : "Wearable"}, ${formatDate(point.date)}`
                : undefined
            }
            onTrends={() =>
              navigate({
                to: "/patients/$patientId/wearables",
                params: { patientId },
                search: { metric: m.key, days: 30, start: undefined, end: undefined },
              })
            }
          />
        );
      })}
    </div>
  );
}
