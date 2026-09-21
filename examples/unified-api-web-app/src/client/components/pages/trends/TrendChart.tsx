import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TimeScale } from "./TimeScaleToggle";

/* -------------------------------------------------------------------------- */
/*                                  Tooltip                                   */
/* -------------------------------------------------------------------------- */

function formatTooltipLabel(value: number | string, scale: TimeScale): string {
  if (scale === "day" && typeof value === "number") {
    return new Date(value).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  }
  const date =
    typeof value === "string" ? new Date(value + "T12:00:00") : new Date(value);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function ChartTooltip({
  active,
  payload,
  label,
  scale,
  unit,
  formatValue,
}: {
  active?: boolean;
  payload?: Array<{ value?: number | string | null }>;
  label?: number | string;
  scale: TimeScale;
  unit: string;
  formatValue: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  if (entry.value == null) return null;

  return (
    <div className="rounded-lg bg-main-black px-3 py-2 shadow-card">
      <p className="text-xs text-white/60">
        {formatTooltipLabel(label as number | string, scale)}
      </p>
      <p className="text-base font-semibold text-white">
        {formatValue(entry.value as number)}{" "}
        <span className="text-sm font-normal text-white/60">{unit}</span>
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                   Chart                                    */
/* -------------------------------------------------------------------------- */

interface DataPoint {
  date?: string;
  timestamp?: number;
  value: number;
}

function formatTimeTick(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDateTick(d: string): string {
  return new Date(d + "T12:00:00").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function TrendChart({
  data,
  scale,
  unit,
  formatValue,
}: {
  data: DataPoint[];
  scale: TimeScale;
  unit: string;
  formatValue: (v: number) => string;
}) {
  if (data.length === 0) return null;

  const isIntraday = scale === "day" && data[0].timestamp != null;
  const dataKey = isIntraday ? "timestamp" : "date";
  const xAxisType = isIntraday ? ("number" as const) : ("category" as const);

  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = Math.max((max - min) * 0.1, 1);

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--color-border)"
            vertical={false}
          />
          <XAxis
            dataKey={dataKey}
            type={xAxisType}
            {...(isIntraday
              ? { scale: "time", domain: ["dataMin", "dataMax"] }
              : {})}
            tickFormatter={
              isIntraday
                ? (v: number) => formatTimeTick(v)
                : (v: string) => formatDateTick(v)
            }
            tick={{ fontSize: 12, fill: "var(--color-subtle-text)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--color-border)" }}
          />
          <YAxis
            domain={[Math.floor(min - padding), Math.ceil(max + padding)]}
            tickCount={5}
            tick={{ fontSize: 12, fill: "var(--color-subtle-text)" }}
            tickLine={false}
            axisLine={false}
            width={64}
          />
          <Tooltip
            content={
              <ChartTooltip
                scale={scale}
                unit={unit}
                formatValue={formatValue}
              />
            }
            cursor={{
              stroke: "var(--color-emphasis-secondary)",
              strokeDasharray: "4 4",
            }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--color-emphasis)"
            strokeWidth={2}
            dot={false}
            activeDot={{
              r: 5,
              fill: "var(--color-emphasis)",
              stroke: "white",
              strokeWidth: 2,
            }}
            isAnimationActive={!isIntraday}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
