/**
 * The timeline spine — the doctor-facing centrepiece. One shared time axis:
 * lab draws as clickable event markers across the top, wearable trends as
 * stacked lanes underneath (weekly rollups), so "what happened between
 * draws" is the layout itself, not a feature. Hovering is synchronised
 * across lanes (recharts syncId).
 */
import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Button as RacButton,
  Dialog as RacDialog,
  DialogTrigger,
} from "react-aria-components";
import { CaretRightIcon } from "@phosphor-icons/react";
import { Popover } from "../../shared/atoms/Popover";
import {
  Area,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Skeleton } from "../../shared/atoms/Skeleton";
import { labReportsQuery, wearablesQuery } from "../../../lib/queries";

const dayMs = 86_400_000;
const ts = (d: string) => new Date(`${d}T00:00:00Z`).getTime();
const isoDate = (t: number) => new Date(t).toISOString().slice(0, 10);
/** How far back the spine looks (bounded; Whoop history is ~16 months). */
const LOOKBACK_DAYS = 500;

interface LaneConfig {
  key: "restingHr" | "hrv" | "sleepDurationMin" | "workoutMinutes";
  label: string;
  unit: string;
  agg: "avg" | "sum";
  kind: "line" | "area";
  format: (v: number) => string;
}

const LANES: LaneConfig[] = [
  {
    key: "restingHr",
    label: "Resting HR",
    unit: "bpm",
    agg: "avg",
    kind: "line",
    format: (v) => String(Math.round(v)),
  },
  {
    key: "hrv",
    label: "HRV",
    unit: "ms",
    agg: "avg",
    kind: "line",
    format: (v) => String(Math.round(v)),
  },
  {
    key: "sleepDurationMin",
    label: "Sleep",
    unit: "h/night",
    agg: "avg",
    kind: "line",
    format: (v) => (v / 60).toFixed(1),
  },
  {
    key: "workoutMinutes",
    label: "Training",
    unit: "min/wk",
    agg: "sum",
    kind: "area",
    format: (v) => String(Math.round(v)),
  },
];

function weeklyRollup(
  series: Array<{ date: string; value: number }>,
  agg: "avg" | "sum",
): Array<{ ts: number; value: number }> {
  const byWeek = new Map<number, { total: number; days: number }>();
  for (const p of series) {
    const t = ts(p.date);
    const day = new Date(t).getUTCDay();
    const monday = t - ((day + 6) % 7) * dayMs;
    const b = byWeek.get(monday) ?? { total: 0, days: 0 };
    b.total += p.value;
    b.days += 1;
    byWeek.set(monday, b);
  }
  return [...byWeek.entries()]
    .map(([week, b]) => ({
      ts: week,
      value: agg === "sum" ? b.total : b.total / b.days,
    }))
    .sort((a, b) => a.ts - b.ts);
}

function chipDate(d: string): string {
  return new Date(ts(d)).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

function monthTick(t: number): string {
  return new Date(t).toLocaleDateString(undefined, {
    month: "short",
    year: "2-digit",
  });
}

function LaneTooltip({
  active,
  payload,
  label,
  lane,
}: {
  active?: boolean;
  payload?: Array<{ value?: number }>;
  label?: number;
  lane: LaneConfig;
}) {
  if (!active || !payload?.length || payload[0].value == null) return null;
  return (
    <div className="rounded-lg bg-main-black px-3 py-1.5 shadow-card">
      <p className="text-xs text-white/60">
        Week of{" "}
        {new Date(label as number).toLocaleDateString(undefined, {
          day: "numeric",
          month: "short",
        })}
      </p>
      <p className="text-sm font-semibold text-white">
        {lane.format(payload[0].value)}{" "}
        <span className="font-normal text-white/60">{lane.unit}</span>
      </p>
    </div>
  );
}

export function TimelineSpine({ patientId }: { patientId: string }) {
  const window = useMemo(() => {
    const now = Date.now();
    return {
      start: isoDate(now - (LOOKBACK_DAYS - 1) * dayMs),
      end: isoDate(now),
    };
  }, []);
  const wearablesQ = useQuery(wearablesQuery(patientId, window));
  const reportsQ = useQuery(labReportsQuery(patientId));

  const start = ts(window.start);
  const end = ts(window.end);

  const sessions = reportsQ.data?.sessions ?? [];
  const dated = sessions
    .map((s) => ({
      sessionId: s.session_id,
      date: s.collection_date ?? s.report_date,
    }))
    .filter((s): s is { sessionId: string; date: string } => Boolean(s.date))
    .sort((a, b) => a.date.localeCompare(b.date));
  const draws = dated.filter((s) => ts(s.date) >= start);

  // Draws that sit close together on the axis merge into ONE chip (with a
  // popover listing each report) — no stacked or overlapping pills.
  const CLUSTER_PCT = 7;
  const clusters: Array<{ pct: number; draws: typeof draws }> = [];
  for (const d of draws) {
    const pct = ((ts(d.date) - start) / (end - start)) * 100;
    const last = clusters[clusters.length - 1];
    if (last && pct - last.pct < CLUSTER_PCT) {
      last.draws.push(d);
      // Anchor the merged chip between its members.
      last.pct =
        last.draws.reduce(
          (sum, m) => sum + ((ts(m.date) - start) / (end - start)) * 100,
          0,
        ) / last.draws.length;
    } else {
      clusters.push({ pct, draws: [d] });
    }
  }

  const lanes = LANES.map((lane) => ({
    lane,
    weekly: weeklyRollup(wearablesQ.data?.series[lane.key] ?? [], lane.agg),
  })).filter((l) => l.weekly.length > 0);

  if (wearablesQ.isLoading || reportsQ.isLoading) {
    return <Skeleton className="h-96 w-full rounded-xl" />;
  }
  if (lanes.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-white p-5 text-sm text-subtle-text">
        The timeline appears once a wearable is connected for this patient.
      </p>
    );
  }

  return (
    <div className="flex flex-col rounded-xl border border-border bg-white p-5">
      {/* Draw event markers, positioned on the same axis as the lanes */}
      <div className="flex">
        <div className="w-36 shrink-0 pt-1 text-xs font-medium tracking-wide text-subtle-text uppercase">
          Lab draws
        </div>
        {/* mr-3 mirrors the lanes' 12px right chart margin so chip positions
            stay aligned with the ReferenceLines below. */}
        <div className="relative mr-3 h-8 min-w-0 flex-1">
          {clusters.map((cluster) =>
            cluster.draws.length === 1 ? (
              <Link
                key={cluster.draws[0].sessionId}
                to="/patients/$patientId/reports/$sessionId"
                params={{ patientId, sessionId: cluster.draws[0].sessionId }}
                className="absolute top-0 -translate-x-1/2 rounded-full border border-warning bg-warning-bg px-2.5 py-0.5 text-xs font-medium whitespace-nowrap text-warning transition hover:bg-warning hover:text-white"
                style={{ left: `${cluster.pct}%` }}
              >
                {chipDate(cluster.draws[0].date)}
              </Link>
            ) : (
              <DialogTrigger key={cluster.draws[0].sessionId}>
                <RacButton
                  className="absolute top-0 -translate-x-1/2 cursor-pointer rounded-full border border-warning bg-warning-bg px-2.5 py-0.5 text-xs font-medium whitespace-nowrap text-warning transition hover:bg-warning hover:text-white"
                  style={{ left: `${cluster.pct}%` }}
                >
                  {chipDate(cluster.draws[0].date)} ·{" "}
                  {chipDate(cluster.draws[cluster.draws.length - 1].date)}
                </RacButton>
                <Popover className="min-w-52">
                  <RacDialog className="flex flex-col p-1 outline-none">
                    {cluster.draws.map((d) => (
                      <Link
                        key={d.sessionId}
                        to="/patients/$patientId/reports/$sessionId"
                        params={{ patientId, sessionId: d.sessionId }}
                        className="flex items-center justify-between gap-4 rounded-lg px-3 py-2 text-sm text-main-black transition hover:bg-hover-grey"
                      >
                        Report ·{" "}
                        {new Date(ts(d.date)).toLocaleDateString(undefined, {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                        <CaretRightIcon
                          size={14}
                          className="text-subtle-text"
                        />
                      </Link>
                    ))}
                  </RacDialog>
                </Popover>
              </DialogTrigger>
            ),
          )}
        </div>
      </div>

      {lanes.map(({ lane, weekly }, i) => {
        const isLast = i === lanes.length - 1;
        const latest = weekly[weekly.length - 1];
        const values = weekly.map((w) => w.value);
        const lo = Math.min(...values);
        const hi = Math.max(...values);
        const pad = (hi - lo) * 0.15 || 1;
        return (
          <div key={lane.key} className="flex border-t border-border/60">
            <div className="flex w-36 shrink-0 flex-col justify-center gap-0.5 py-2">
              <span className="text-sm font-medium text-main-black">
                {lane.label}
              </span>
              <span className="text-xs text-subtle-text">
                {lane.format(latest.value)} {lane.unit}
              </span>
            </div>
            <div className={`min-w-0 flex-1 ${isLast ? "h-28" : "h-20"}`}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={weekly}
                  syncId="timeline-spine"
                  margin={{ top: 6, right: 12, left: 0, bottom: 0 }}
                >
                  <XAxis
                    dataKey="ts"
                    type="number"
                    scale="time"
                    domain={[start, end]}
                    hide={!isLast}
                    tickFormatter={monthTick}
                    tick={{ fontSize: 11, fill: "var(--color-subtle-text)" }}
                    tickLine={false}
                    axisLine={{ stroke: "var(--color-border)" }}
                    minTickGap={64}
                    tickMargin={6}
                  />
                  <YAxis hide domain={[lo - pad, hi + pad]} />
                  <Tooltip
                    content={<LaneTooltip lane={lane} />}
                    cursor={{
                      stroke: "var(--color-emphasis-secondary)",
                      strokeDasharray: "4 4",
                    }}
                  />
                  {draws.map((d) => (
                    <ReferenceLine
                      key={d.sessionId}
                      x={ts(d.date)}
                      stroke="var(--color-warning)"
                      strokeDasharray="4 4"
                      strokeOpacity={0.45}
                    />
                  ))}
                  {lane.kind === "area" ? (
                    <Area
                      dataKey="value"
                      type="monotone"
                      stroke="var(--color-emphasis-secondary)"
                      strokeWidth={1.5}
                      fill="var(--color-emphasis-bg)"
                      fillOpacity={0.9}
                      isAnimationActive={false}
                    />
                  ) : (
                    <Line
                      dataKey="value"
                      type="monotone"
                      stroke="var(--color-emphasis)"
                      strokeWidth={1.5}
                      dot={false}
                      activeDot={{
                        r: 4,
                        fill: "var(--color-emphasis)",
                        stroke: "white",
                        strokeWidth: 2,
                      }}
                      isAnimationActive={false}
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      })}
    </div>
  );
}
