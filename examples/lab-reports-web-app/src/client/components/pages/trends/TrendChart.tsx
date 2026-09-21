import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type TimeScale = "day" | "week" | "month";

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
  trendWindow,
}: {
  active?: boolean;
  payload?: Array<{ dataKey?: string; value?: number | string | null }>;
  label?: number | string;
  scale: TimeScale;
  unit: string;
  formatValue: (v: number) => string;
  trendWindow?: number;
}) {
  if (!active || !payload?.length) return null;
  const daily = payload.find((p) => p.dataKey === "value");
  const trend = payload.find((p) => p.dataKey === "trend");
  if (daily?.value == null) return null;

  return (
    <div className="rounded-lg bg-main-black px-3 py-2 shadow-card">
      <p className="text-xs text-white/60">
        {formatTooltipLabel(label as number | string, scale)}
      </p>
      <p className="text-base font-semibold text-white">
        {formatValue(daily.value as number)}{" "}
        <span className="text-sm font-normal text-white/60">{unit}</span>
      </p>
      {trend?.value != null && trendWindow != null && (
        <p className="text-xs text-white/60">
          {trendWindow}-day avg {formatValue(trend.value as number)}
        </p>
      )}
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

function formatDateTick(d: string, withYear: boolean): string {
  return new Date(d + "T12:00:00").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(withYear ? { year: "numeric" } : {}),
  });
}

export function TrendChart({
  data,
  scale,
  unit,
  formatValue,
  markers = [],
  band,
  showDots = false,
}: {
  data: DataPoint[];
  scale: TimeScale;
  unit: string;
  formatValue: (v: number) => string;
  /** Vertical event markers (e.g. lab draw dates) on the date axis. */
  markers?: Array<{ date: string; label: string }>;
  /** Horizontal reference band (e.g. a lab normal range). */
  band?: { lower?: number; upper?: number };
  /** Render a dot per point — for sparse series (one point per report). */
  showDots?: boolean;
}) {
  if (data.length === 0) return null;

  const isIntraday = scale === "day" && data[0].timestamp != null;
  const dataKey = isIntraday ? "timestamp" : "date";
  const xAxisType = isIntraday ? ("number" as const) : ("category" as const);

  // Dense series get a centered rolling-average trend overlay — the daily
  // line drops to a light tone so the trend reads first on long windows.
  const trendWindow =
    data.length >= 180 ? 28 : data.length >= 30 ? 7 : null;
  const rows = trendWindow
    ? data.map((d, i) => {
        const half = Math.floor(trendWindow / 2);
        const slice = data.slice(
          Math.max(0, i - half),
          Math.min(data.length, i + half + 1),
        );
        return {
          ...d,
          trend:
            Math.round(
              (slice.reduce((s, p) => s + p.value, 0) / slice.length) * 100,
            ) / 100,
        };
      })
    : data;

  const values = data.map((d) => d.value);
  const bandValues = band
    ? [band.lower, band.upper].filter((v): v is number => v != null)
    : [];
  const min = Math.min(...values, ...bandValues);
  const max = Math.max(...values, ...bandValues);
  // Pad relative to the data's magnitude — a fixed ±1 flattens series whose
  // whole range is < 1 (e.g. creatinine 0.8–0.9 mg/dL).
  const padding =
    Math.max((max - min) * 0.15, Math.abs(max) * 0.05) || 1;

  return (
    <div className="flex h-80 w-full flex-col">
      {trendWindow && (
        <div className="flex justify-end gap-4 pb-1 text-xs text-subtle-text">
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded bg-emphasis-secondary" />
            Daily
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded bg-emphasis" />
            {trendWindow}-day average
          </span>
        </div>
      )}
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={rows}
          // Extra headroom so ReferenceLine labels ("Lab draw") don't clip.
          margin={{ top: markers.length > 0 ? 22 : 8, right: 16, left: 0, bottom: 0 }}
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
                : (v: string) =>
                    // Multi-year series (labs across years) need the year.
                    formatDateTick(
                      v,
                      (data[0]?.date ?? "").slice(0, 4) !==
                        (data[data.length - 1]?.date ?? "").slice(0, 4),
                    )
            }
            tick={{ fontSize: 12, fill: "var(--color-subtle-text)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--color-border)" }}
            // Thin out crowded date labels; even spacing, first/last kept.
            minTickGap={48}
            interval="preserveStartEnd"
            tickMargin={8}
          />
          <YAxis
            // No floor/ceil — integer rounding flattens sub-1 ranges.
            domain={[min - padding, max + padding]}
            tickCount={5}
            tickFormatter={(v: number) => String(Math.round(v * 100) / 100)}
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
                trendWindow={trendWindow ?? undefined}
              />
            }
            cursor={{
              stroke: "var(--color-emphasis-secondary)",
              strokeDasharray: "4 4",
            }}
          />
          {band && (band.lower != null || band.upper != null) && (
            <ReferenceArea
              y1={band.lower ?? Math.floor(min - padding)}
              y2={band.upper ?? Math.ceil(max + padding)}
              fill="var(--color-emphasis-bg)"
              fillOpacity={0.6}
              stroke="var(--color-emphasis-secondary)"
              strokeDasharray="4 4"
            />
          )}
          {!isIntraday &&
            markers
              .filter((m) => data.some((d) => d.date === m.date))
              .map((m) => (
                <ReferenceLine
                  key={m.date}
                  x={m.date}
                  stroke="var(--color-warning)"
                  strokeDasharray="4 4"
                  label={{
                    value: m.label,
                    position: "top",
                    dy: -4,
                    fill: "var(--color-warning)",
                    fontSize: 11,
                  }}
                />
              ))}
          {trendWindow && (
            <Line
              type="monotone"
              dataKey="trend"
              stroke="var(--color-emphasis)"
              strokeWidth={2.5}
              dot={false}
              activeDot={false}
              isAnimationActive={false}
            />
          )}
          <Line
            type="monotone"
            dataKey="value"
            stroke={
              trendWindow
                ? "var(--color-emphasis-secondary)"
                : "var(--color-emphasis)"
            }
            strokeWidth={trendWindow ? 1.25 : 2}
            dot={
              showDots
                ? {
                    r: 4,
                    fill: "var(--color-emphasis)",
                    stroke: "white",
                    strokeWidth: 2,
                  }
                : false
            }
            activeDot={{
              r: 5,
              fill: "var(--color-emphasis)",
              stroke: "white",
              strokeWidth: 2,
            }}
            // Animation stalls mid-draw on category axes (line freezes at a
            // fraction of the series) — keep it off for reliability.
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
