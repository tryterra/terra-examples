import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { resolveDataType } from "../lib/dataTypes";
import type { SeriesPoint } from "../lib/store";

const WINDOW_MS = 60_000;

/**
 * The hero chart: a scrolling 60-second window of one metric.
 *
 * Live-chart specifics worth copying:
 * - `isAnimationActive={false}` — Recharts' enter animation replays on every
 *   data update and looks broken for streaming data.
 * - The X domain is [now - 60s, now] with `allowDataOverflow`, so points
 *   scroll left and fall off the edge instead of the axis rescaling.
 * - A 1s local tick keeps the window scrolling even when data pauses — a
 *   stalled stream is visible as the line sliding off the left edge.
 */
export function LiveChart({ dataType, points }: { dataType: string; points: SeriesPoint[] }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const now = Date.now();
  const def = resolveDataType(dataType);
  const visible = points.filter((p) => p.at >= now - WINDOW_MS);

  return (
    <div className="rounded-xl border border-outline-grey bg-white p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-sm font-semibold">{def.label}</span>
        <span className="text-xs text-neutral">last 60s</span>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={visible} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="#E2EFFE" vertical={false} />
            <XAxis
              type="number"
              dataKey="at"
              domain={[now - WINDOW_MS, now]}
              allowDataOverflow
              tickFormatter={(t: number) => `-${Math.round((now - t) / 1000)}s`}
              tickCount={7}
              tick={{ fill: "#9193A3", fontSize: 12 }}
              stroke="#E0E0E0"
            />
            <YAxis
              domain={["auto", "auto"]}
              width={44}
              tick={{ fill: "#9193A3", fontSize: 12 }}
              stroke="#E0E0E0"
              tickFormatter={(v: number) => v.toFixed(def.decimals ?? 0)}
            />
            <Tooltip
              isAnimationActive={false}
              formatter={(value: number) => [
                `${value.toFixed(def.decimals ?? 0)}${def.unit ? ` ${def.unit}` : ""}`,
                def.label,
              ]}
              labelFormatter={(t: number) => `${Math.round((now - t) / 1000)}s ago`}
              contentStyle={{ borderRadius: 8, borderColor: "#E0E0E0", fontSize: 12 }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#008AFF"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
