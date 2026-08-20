/**
 * The labs × wearables overlay: weekly wearable volume as a soft area with
 * the biomarker's lab draws as a dotted line on a second axis, both on one
 * real time axis. This is the "joined data" visual — the whole point of the
 * correlation clickdown.
 */
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const ts = (d: string) => new Date(`${d}T00:00:00Z`).getTime();

function monthTick(t: number): string {
  return new Date(t).toLocaleDateString(undefined, {
    month: "short",
    year: "2-digit",
  });
}

function fullDate(t: number): string {
  return new Date(t).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

interface Row {
  ts: number;
  metric?: number;
  lab?: number;
}

function OverlayTooltip({
  active,
  payload,
  label,
  labLabel,
  labUnit,
  metricLabel,
  metricUnit,
}: {
  active?: boolean;
  payload?: Array<{ dataKey?: string; value?: number }>;
  label?: number;
  labLabel: string;
  labUnit: string;
  metricLabel: string;
  metricUnit: string;
}) {
  if (!active || !payload?.length) return null;
  const lab = payload.find((p) => p.dataKey === "lab" && p.value != null);
  const metric = payload.find((p) => p.dataKey === "metric" && p.value != null);
  return (
    <div className="rounded-lg bg-main-black px-3 py-2 shadow-card">
      <p className="text-xs text-white/60">{fullDate(label as number)}</p>
      {lab && (
        <p className="text-sm font-semibold text-white">
          {labLabel}: {lab.value}{" "}
          <span className="font-normal text-white/60">{labUnit}</span>
        </p>
      )}
      {metric && (
        <p className="text-sm text-white">
          {metricLabel}: {metric.value}{" "}
          <span className="text-white/60">{metricUnit}</span>
        </p>
      )}
    </div>
  );
}

export function OverlayChart({
  lab,
  weekly,
  labLabel,
  labUnit,
  metricLabel,
  metricUnit,
}: {
  lab: Array<{ date: string; value: number }>;
  weekly: Array<{ date: string; value: number }>;
  labLabel: string;
  labUnit: string;
  metricLabel: string;
  metricUnit: string;
}) {
  if (weekly.length === 0) return null;

  const start = ts(weekly[0].date);
  const end = Math.max(
    ts(weekly[weekly.length - 1].date),
    ...lab.map((p) => ts(p.date)),
  );
  const labIn = lab.filter((p) => ts(p.date) >= start);

  const rows: Row[] = [
    ...weekly.map((w) => ({ ts: ts(w.date), metric: w.value })),
    ...labIn.map((p) => ({ ts: ts(p.date), lab: p.value })),
  ].sort((a, b) => a.ts - b.ts);

  const labValues = labIn.map((p) => p.value);
  const labMin = Math.min(...labValues);
  const labMax = Math.max(...labValues);
  // Generous padding keeps the near-flat lab line vertically centred instead
  // of hugging an edge (two draws often differ by only a few units).
  const pad = Math.max((labMax - labMin) * 0.8, Math.abs(labMax) * 0.08) || 1;
  // Nice 5-tick domains: integer lab bounds with a span divisible by 4
  // (sub-10 spans stay raw — creatinine-sized ranges must not flatten), and
  // a round metric ceiling.
  let labLo = labMin - pad;
  let labHi = labMax + pad;
  if (labHi - labLo >= 8) {
    labLo = Math.floor(labLo);
    labHi = labLo + Math.ceil((labHi - labLo) / 4) * 4;
  }
  const metricMax = Math.max(...weekly.map((w) => w.value)) * 1.25;
  const metricUnitStep = metricMax > 400 ? 100 : metricMax > 40 ? 10 : 1;
  const metricHi =
    Math.ceil(metricMax / (4 * metricUnitStep)) * 4 * metricUnitStep;

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={rows}
          margin={{ top: 8, right: 0, left: 0, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--color-border)"
            vertical={false}
          />
          <XAxis
            dataKey="ts"
            type="number"
            scale="time"
            domain={[start, end]}
            tickFormatter={monthTick}
            tick={{ fontSize: 12, fill: "var(--color-subtle-text)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--color-border)" }}
            minTickGap={48}
            tickMargin={8}
          />
          <YAxis
            yAxisId="lab"
            domain={[labLo, labHi]}
            tickCount={5}
            tickFormatter={(v: number) => String(Math.round(v * 10) / 10)}
            tick={{ fontSize: 12, fill: "var(--color-subtle-text)" }}
            tickLine={false}
            axisLine={false}
            width={56}
          />
          <YAxis
            yAxisId="metric"
            orientation="right"
            domain={[0, metricHi]}
            tickCount={5}
            tick={{ fontSize: 12, fill: "var(--color-subtle-text)" }}
            tickLine={false}
            axisLine={false}
            width={48}
          />
          <Tooltip
            content={
              <OverlayTooltip
                labLabel={labLabel}
                labUnit={labUnit}
                metricLabel={metricLabel}
                metricUnit={metricUnit}
              />
            }
            cursor={{
              stroke: "var(--color-emphasis-secondary)",
              strokeDasharray: "4 4",
            }}
          />
          <Area
            yAxisId="metric"
            dataKey="metric"
            type="monotone"
            connectNulls
            stroke="var(--color-emphasis-secondary)"
            strokeWidth={1.5}
            fill="var(--color-emphasis-bg)"
            fillOpacity={0.9}
            isAnimationActive={false}
          />
          {labIn.map((p) => (
            <ReferenceLine
              key={p.date}
              yAxisId="lab"
              x={ts(p.date)}
              stroke="var(--color-warning)"
              strokeDasharray="4 4"
              strokeOpacity={0.5}
            />
          ))}
          <Line
            yAxisId="lab"
            dataKey="lab"
            type="monotone"
            connectNulls
            stroke="var(--color-warning)"
            strokeWidth={2}
            dot={{
              r: 5,
              fill: "var(--color-warning)",
              stroke: "white",
              strokeWidth: 2,
            }}
            activeDot={{
              r: 6,
              fill: "var(--color-warning)",
              stroke: "white",
              strokeWidth: 2,
            }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
