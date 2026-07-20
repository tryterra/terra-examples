import { memo } from "react";
import { formatValue, resolveDataType } from "../lib/dataTypes";
import type { Series } from "../lib/store";
import { Sparkline } from "./Sparkline";
import { TimeAgo } from "./TimeAgo";

// One stat card per (user, data type): label, latest value + unit, a 60-point
// sparkline, and a freshness line. Memoized so only cards whose series object
// changed re-render on a store update. Clicking selects the hero metric.
export const StatCard = memo(function StatCard({
  dataType,
  series,
  selected,
  onSelect,
}: {
  dataType: string;
  series: Series;
  selected: boolean;
  onSelect: (dataType: string) => void;
}) {
  const def = resolveDataType(dataType);
  return (
    <button
      type="button"
      onClick={() => onSelect(dataType)}
      className={`rounded-xl border bg-white p-4 text-left transition-colors ${
        selected ? "border-primary" : "border-outline-grey hover:border-neutral"
      }`}
    >
      <div className="text-sm font-semibold">{def.label}</div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div className="flex shrink-0 items-baseline gap-1">
          <span className="text-3xl font-bold">{formatValue(def, series.latest)}</span>
          {def.unit && <span className="text-sm text-neutral">{def.unit}</span>}
        </div>
        {/* min-w-0 + grow lets the sparkline shrink instead of forcing the
            card (and the whole grid) wider than the hero chart above it. */}
        <div className="h-9 min-w-0 max-w-[120px] grow">
          <Sparkline points={series.points.slice(-60).map((p) => p.value)} />
        </div>
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-xs text-neutral">
        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
        updated <TimeAgo at={series.lastAt} />
      </div>
    </button>
  );
});
