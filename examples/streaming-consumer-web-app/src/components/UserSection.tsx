import { useState } from "react";
import { resolveDataType, valueOf } from "../lib/dataTypes";
import type { UserStreams } from "../lib/store";
import { LiveChart } from "./LiveChart";
import { StatCard } from "./StatCard";
import { TimeAgo } from "./TimeAgo";

// Everything streamed by one Terra user: a hero chart with a metric selector,
// then one stat card per data type received. `name` is a friendly label
// ("User 1", by arrival order); the raw Terra uid stays visible but small.
export function UserSection({
  uid,
  name,
  streams,
}: {
  uid: string;
  name: string;
  streams: UserStreams;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  const dataTypes = Object.keys(streams.series).sort();
  // Only types that produce chartable numbers can be the hero metric
  // (LOCATION/ACTIVITY render as cards but have nothing to plot).
  const chartable = dataTypes.filter((t) => {
    const series = streams.series[t];
    return series.points.length > 0 || valueOf(resolveDataType(t), series.latest) !== undefined;
  });
  const heroType =
    selected && chartable.includes(selected)
      ? selected
      : chartable.includes("HEART_RATE")
        ? "HEART_RATE"
        : chartable[0];

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="truncate text-sm font-semibold" title={uid}>
          {name}
          <span className="ml-2 font-mono text-xs font-medium text-neutral">
            {uid.length > 14 ? `${uid.slice(0, 8)}…${uid.slice(-4)}` : uid}
          </span>
        </h2>
        <span className="shrink-0 text-xs text-neutral">
          last seen <TimeAgo at={streams.lastSeenAt} />
        </span>
      </div>

      {heroType && (
        <>
          <div className="mb-3 flex flex-wrap gap-2">
            {chartable.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setSelected(t)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  t === heroType
                    ? "border-primary bg-primary text-white"
                    : "border-outline-grey bg-white text-neutral hover:border-neutral"
                }`}
              >
                {resolveDataType(t).label}
              </button>
            ))}
          </div>
          <LiveChart dataType={heroType} points={streams.series[heroType].points} />
        </>
      )}

      <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {dataTypes.map((t) => (
          <StatCard
            key={t}
            dataType={t}
            series={streams.series[t]}
            selected={t === heroType}
            onSelect={setSelected}
          />
        ))}
      </div>
    </section>
  );
}
