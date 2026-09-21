import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/* ---------------------------------- Types ---------------------------------------- */

export interface ChartSeries {
  dataKey: string;
  name?: string;
  type?: "line" | "bar" | "area" | "scatter";
  color?: string;
  yAxisId?: "left" | "right";
  stackId?: string;
}

export interface ChartReferenceLine {
  axis?: "x" | "y";
  value: string | number;
  label?: string;
  color?: string;
}

export interface ChartData {
  title: string;
  chartType?: "cartesian" | "pie";
  data: Array<Record<string, string | number | null>>;
  series: ChartSeries[];
  xAxisDataKey?: string;
  yAxisLabel?: string;
  yAxisRightLabel?: string;
  unit?: string;
  referenceLines?: ChartReferenceLine[];
  nameKey?: string;
  donut?: boolean;
}

/* --------------------------------- Palette ---------------------------------------- */

const PALETTE: Record<string, string> = {
  blue: "#4269d0",
  yellow: "#efb118",
  coral: "#ff725c",
  teal: "#6cc5b0",
  green: "#3ca951",
  pink: "#ff8ab7",
  purple: "#a463f2",
  skyblue: "#97bbf5",
  brown: "#9c6b4e",
  grey: "#9498a0",
};

const PALETTE_ORDER = Object.values(PALETTE);

function resolveColor(name: string | undefined, index: number): string {
  if (name && name in PALETTE) return PALETTE[name];
  return PALETTE_ORDER[index % PALETTE_ORDER.length];
}

/* ----------------------------- Hoisted Constants --------------------------------- */

const CHART_MARGIN = { top: 8, right: 12, left: 0, bottom: 0 } as const;
const TICK_STYLE = { fontSize: 11, fill: "var(--color-subtle-text)" } as const;
const AXIS_LINE_STYLE = { stroke: "var(--color-border)" } as const;

function makeActiveDot(color: string) {
  return { r: 4, fill: color, stroke: "white", strokeWidth: 2 };
}

function formatTickValue(value: number | string): string {
  if (typeof value !== "number") return String(value);
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `${(value / 1_000).toFixed(0)}k`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(value);
}

/* --------------------------------- Helpers ---------------------------------------- */

function inferXAxisKey(
  data: ChartData["data"],
  series: ChartSeries[],
): string | undefined {
  if (!data[0]) return undefined;
  const seriesKeys = new Set(series.map((s) => s.dataKey));
  return Object.keys(data[0]).find(
    (k) => !seriesKeys.has(k) && typeof data[0][k] === "string",
  );
}

function computeDomain(
  data: ChartData["data"],
  seriesKeys: string[],
): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (const row of data) {
    for (const key of seriesKeys) {
      const v = row[key];
      if (typeof v === "number") {
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
  }
  if (!isFinite(min)) return [0, 100];
  const padding = Math.max((max - min) * 0.1, 1);
  return [Math.floor(min - padding), Math.ceil(max + padding)];
}

/* -------------------------------- Tooltips ---------------------------------------- */

function ChartTooltip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  payload?: Array<{
    value?: number | string | null;
    name?: string;
    color?: string;
  }>;
  label?: string;
  unit?: string;
}) {
  if (!active || !payload?.length) return null;
  const entries = payload.filter((e) => e.value != null);
  if (entries.length === 0) return null;

  return (
    <div className="rounded-lg bg-main-black px-3 py-2 shadow-card">
      {label != null && <p className="mb-1 text-xs text-white/60">{label}</p>}
      {entries.map((entry, i) => (
        <div key={i} className="flex items-center gap-2">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <p className="text-sm text-white">
            {entries.length > 1 && entry.name && (
              <span className="font-normal text-white/60">{entry.name}: </span>
            )}
            <span className="font-semibold">
              {entry.value}
              {unit && (
                <span className="font-normal text-white/60"> {unit}</span>
              )}
            </span>
          </p>
        </div>
      ))}
    </div>
  );
}

function PieTooltip({
  active,
  payload,
  unit,
}: {
  active?: boolean;
  payload?: Array<{
    name?: string;
    value?: number | string | null;
    payload?: { fill?: string };
  }>;
  unit?: string;
}) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  if (entry.value == null) return null;

  return (
    <div className="rounded-lg bg-main-black px-3 py-2 shadow-card">
      <p className="text-xs text-white/60">{entry.name}</p>
      <p className="text-base font-semibold text-white">
        {entry.value}
        {unit && (
          <span className="text-sm font-normal text-white/60"> {unit}</span>
        )}
      </p>
    </div>
  );
}

/* ----------------------------- Chart Content ------------------------------------- */

function CartesianChartContent({ chartData }: { chartData: ChartData }) {
  const { data, series, unit, referenceLines } = chartData;
  const xKey = chartData.xAxisDataKey ?? inferXAxisKey(data, series);

  const leftKeys: string[] = [];
  const rightKeys: string[] = [];
  for (const s of series) {
    if (s.yAxisId === "right") rightKeys.push(s.dataKey);
    else leftKeys.push(s.dataKey);
  }
  const hasRightAxis = rightKeys.length > 0;
  const leftDomain = computeDomain(data, leftKeys);
  const rightDomain = computeDomain(data, rightKeys);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={CHART_MARGIN}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="var(--color-border)"
          vertical={false}
        />
        {xKey && (
          <XAxis
            dataKey={xKey}
            tick={TICK_STYLE}
            tickLine={false}
            axisLine={AXIS_LINE_STYLE}
          />
        )}
        <YAxis
          yAxisId="left"
          domain={leftDomain}
          tickCount={4}
          tick={TICK_STYLE}
          tickFormatter={formatTickValue}
          tickLine={false}
          axisLine={false}
          width={52}
        />
        {hasRightAxis && (
          <YAxis
            yAxisId="right"
            orientation="right"
            domain={rightDomain}
            tickCount={4}
            tick={TICK_STYLE}
            tickFormatter={formatTickValue}
            tickLine={false}
            axisLine={false}
            width={52}
          />
        )}
        <Tooltip content={<ChartTooltip unit={unit} />} />
        {series.length > 1 && <Legend />}
        {referenceLines?.map((rl, i) => (
          <ReferenceLine
            key={i}
            {...(rl.axis === "x" ? { x: rl.value } : { y: rl.value })}
            yAxisId={rl.axis === "x" ? undefined : "left"}
            stroke={
              rl.color
                ? (PALETTE[rl.color] ?? rl.color)
                : "var(--color-subtle-text)"
            }
            strokeDasharray="4 4"
            label={
              rl.label
                ? {
                    value: rl.label,
                    position: "insideTopRight",
                    style: {
                      fontSize: 10,
                      fill: rl.color
                        ? (PALETTE[rl.color] ?? rl.color)
                        : "var(--color-subtle-text)",
                    },
                  }
                : undefined
            }
          />
        ))}
        {series.map((s, i) => {
          const color = resolveColor(s.color, i);
          const type = s.type ?? "line";
          const commonProps = {
            key: s.dataKey,
            dataKey: s.dataKey,
            name: s.name ?? s.dataKey,
            yAxisId: s.yAxisId ?? "left",
            stackId: s.stackId,
          };
          switch (type) {
            case "bar": {
              const stackSiblings = series.filter(
                (other) => other.stackId === s.stackId,
              );
              const isTopOfStack =
                !s.stackId || s === stackSiblings[stackSiblings.length - 1];
              return (
                <Bar
                  {...commonProps}
                  fill={color}
                  radius={isTopOfStack ? [4, 4, 0, 0] : 0}
                />
              );
            }
            case "area":
              return (
                <Area
                  {...commonProps}
                  type="monotone"
                  stroke={color}
                  fill={color}
                  fillOpacity={0.15}
                  strokeWidth={2}
                  dot={false}
                  activeDot={makeActiveDot(color)}
                />
              );
            case "scatter":
              return <Scatter {...commonProps} fill={color} />;
            default:
              return (
                <Line
                  {...commonProps}
                  type="monotone"
                  stroke={color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={makeActiveDot(color)}
                />
              );
          }
        })}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function PieChartContent({ chartData }: { chartData: ChartData }) {
  const { data, series, unit, nameKey = "name", donut = false } = chartData;
  const valueKey = series[0]?.dataKey ?? "value";

  const coloredData = data.map((d, i) => ({
    ...d,
    fill: PALETTE_ORDER[i % PALETTE_ORDER.length],
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={coloredData}
          dataKey={valueKey}
          nameKey={nameKey}
          cx="50%"
          cy="50%"
          innerRadius={donut ? "55%" : 0}
          outerRadius="80%"
          paddingAngle={2}
        />
        <Tooltip content={<PieTooltip unit={unit} />} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------ Main Export --------------------------------------- */

export function ChatChart({ data: chartData }: { data: ChartData }) {
  const { title, chartType = "cartesian", data, series } = chartData;

  if (!data || data.length === 0) return null;

  const needsMoreHeight = chartType === "pie" || (series && series.length > 1);
  const heightClass = needsMoreHeight ? "h-64" : "h-48";

  return (
    <div className="my-2 rounded-xl border border-border bg-white p-4">
      <p className="mb-3 text-sm font-semibold text-main-black">{title}</p>
      <div className={`${heightClass} w-full`}>
        {chartType === "pie" ? (
          <PieChartContent chartData={chartData} />
        ) : (
          <CartesianChartContent chartData={chartData} />
        )}
      </div>
    </div>
  );
}
