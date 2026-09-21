/**
 * Per-patient watchlist: the doctor picks the biomarkers and wearable
 * metrics they're actively managing, and this strip tracks exactly those —
 * latest value, delta vs the previous draw (labs), and a sparkline. Persisted
 * on the patient row, so it drives what the overview leads with.
 */
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CaretDownIcon, CaretUpIcon, XIcon } from "@phosphor-icons/react";
import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts";
import { Button } from "../../shared/atoms/Button";
import { ComboBox, ComboBoxItem } from "../../shared/atoms/ComboBox";
import { toastQueue } from "../../shared/atoms/Toast";
import { TREND_METRICS } from "../../../lib/metrics";
import { formatDate } from "../../../lib/format";
import {
  analysisQuery,
  labTrendsQuery,
  parseWatchlist,
  patientQuery,
  saveWatchlist,
  wearablesQuery,
  type Watchlist as WatchlistData,
} from "../../../lib/queries";

const WEARABLE_PREFIX = "metric:";
const LAB_PREFIX = "biomarker:";

export function Watchlist({ patientId }: { patientId: string }) {
  const queryClient = useQueryClient();
  const patientQ = useQuery(patientQuery(patientId));
  const trendsQ = useQuery(labTrendsQuery(patientId));
  const wearablesQ = useQuery(wearablesQuery(patientId, { days: 90 }));
  const [inputValue, setInputValue] = useState("");

  const analysisQ = useQuery(analysisQuery(patientId));

  const watchlist = parseWatchlist(patientQ.data?.patient.watchlist);
  const trends = trendsQ.data?.trends ?? [];
  const series = wearablesQ.data?.series;
  // Report flags are often absent (no printed ranges) — the deterministic
  // engine is the flag source, same as the flagged-values section.
  const engineFlagged = new Set(
    (analysisQ.data?.domains ?? [])
      .flatMap((d) => d.contributions)
      .filter((c) => c.severity !== "normal" && c.ref?.type === "lab")
      .map((c) => (c.ref as { biomarkerKey: string }).biomarkerKey),
  );

  const save = useMutation({
    mutationFn: (next: WatchlistData) => saveWatchlist(patientId, next),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: patientQuery(patientId).queryKey,
      }),
    onError: (err) => toastQueue.add({ title: err.message, variant: "error" }),
  });

  const metricConfigs = TREND_METRICS.filter(
    (m) => (series?.[m.key as keyof typeof series] ?? []).length > 0,
  );

  const add = (id: string) => {
    const next: WatchlistData = {
      biomarkers: [...watchlist.biomarkers],
      metrics: [...watchlist.metrics],
    };
    if (id.startsWith(LAB_PREFIX)) {
      const key = id.slice(LAB_PREFIX.length);
      if (!next.biomarkers.includes(key)) next.biomarkers.push(key);
    } else if (id.startsWith(WEARABLE_PREFIX)) {
      const key = id.slice(WEARABLE_PREFIX.length);
      if (!next.metrics.includes(key)) next.metrics.push(key);
    }
    save.mutate(next);
  };
  const remove = (kind: "biomarkers" | "metrics", key: string) => {
    save.mutate({
      ...watchlist,
      [kind]: watchlist[kind].filter((k) => k !== key),
    });
  };

  const empty =
    watchlist.biomarkers.length === 0 && watchlist.metrics.length === 0;

  return (
    <section className="flex flex-col gap-4 border-t border-border pt-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold text-main-black">Watchlist</h2>
          <p className="text-sm text-secondary-text">
            The markers you're actively following for this patient.
          </p>
        </div>
        <ComboBox
          aria-label="Add to watchlist"
          placeholder="Add a marker…"
          selectedKey={null}
          inputValue={inputValue}
          onInputChange={setInputValue}
          onSelectionChange={(k) => {
            if (k == null) return;
            setInputValue("");
            add(String(k));
          }}
          className="min-w-72"
        >
          {trends.map((t) => (
            <ComboBoxItem
              key={LAB_PREFIX + t.key}
              id={LAB_PREFIX + t.key}
              textValue={t.displayName}
            >
              {t.displayName}
              <span className="ml-2 text-xs text-subtle-text">lab</span>
            </ComboBoxItem>
          ))}
          {metricConfigs.map((m) => (
            <ComboBoxItem
              key={WEARABLE_PREFIX + m.key}
              id={WEARABLE_PREFIX + m.key}
              textValue={m.label}
            >
              {m.label}
              <span className="ml-2 text-xs text-subtle-text">wearable</span>
            </ComboBoxItem>
          ))}
        </ComboBox>
      </div>

      {empty ? (
        <p className="text-sm text-subtle-text">
          Nothing on the watchlist yet - add the biomarkers and wearable
          metrics you want to manage for this patient.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {watchlist.biomarkers.map((key) => {
            const t = trends.find((t) => t.key === key);
            if (!t) return null;
            const last = t.points[t.points.length - 1];
            const prev =
              t.points.length >= 2 ? t.points[t.points.length - 2] : null;
            return (
              <WatchCard
                key={LAB_PREFIX + key}
                title={t.displayName}
                kindLabel="Lab"
                value={`${last.value} ${t.unit}`}
                values={t.points.map((p) => p.value)}
                warn={
                  engineFlagged.has(key) ||
                  last.flag === "high" ||
                  last.flag === "low"
                }
                subline={
                  prev && prev.value !== last.value ? (
                    <>
                      {last.value > prev.value ? (
                        <CaretUpIcon size={10} weight="fill" />
                      ) : (
                        <CaretDownIcon size={10} weight="fill" />
                      )}
                      from {prev.value} {t.unit} · {formatDate(prev.date)}
                    </>
                  ) : (
                    `${t.points.length} draws`
                  )
                }
                link={{
                  to: "/patients/$patientId/lab-trends",
                  search: { biomarkers: key },
                }}
                patientId={patientId}
                onRemove={() => remove("biomarkers", key)}
              />
            );
          })}
          {watchlist.metrics.map((key) => {
            const m = TREND_METRICS.find((m) => m.key === key);
            const s = series?.[key as keyof typeof series] ?? [];
            if (!m || s.length === 0) return null;
            const last = s[s.length - 1];
            const avg = s.reduce((sum, p) => sum + p.value, 0) / s.length;
            return (
              <WatchCard
                key={WEARABLE_PREFIX + key}
                title={m.label}
                kindLabel="Wearable · 90d"
                value={`${m.format(last.value)} ${m.unit}`}
                values={s.map((p) => p.value)}
                warn={false}
                subline={`90-day avg ${m.format(avg)} ${m.unit}`}
                link={{
                  to: "/patients/$patientId/wearables",
                  search: { metric: key, days: 90 },
                }}
                patientId={patientId}
                onRemove={() => remove("metrics", key)}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}

function WatchCard({
  title,
  kindLabel,
  value,
  values,
  warn,
  subline,
  link,
  patientId,
  onRemove,
}: {
  title: string;
  kindLabel: string;
  value: string;
  values: number[];
  warn: boolean;
  /** Small context line under the value (delta vs previous draw, 90d avg…). */
  subline?: React.ReactNode;
  link: { to: string; search: Record<string, unknown> };
  patientId: string;
  onRemove: () => void;
}) {
  const stroke = warn ? "var(--color-warning)" : "var(--color-emphasis)";
  const gradientId = `watch-${title.replace(/\W+/g, "-")}`;
  const data = values.map((v, i) => ({ i, v }));
  return (
    <div className="group relative flex flex-col overflow-hidden rounded-lg border border-border bg-white transition hover:border-emphasis-secondary">
      <Button
        variant="quiet"
        size="sm"
        className="absolute top-2 right-2 z-10 aspect-square bg-white/80 px-0 opacity-0 transition-opacity group-hover:opacity-100"
        aria-label={`Remove ${title} from watchlist`}
        onPress={onRemove}
      >
        <XIcon size={14} />
      </Button>
      <Link
        to={link.to}
        params={{ patientId }}
        search={link.search}
        className="flex flex-1 flex-col"
      >
        <div className="flex flex-col gap-1 p-4 pb-2">
          <span className="flex items-center justify-between text-[11px] font-medium tracking-wide text-subtle-text uppercase">
            {kindLabel}
            {warn && (
              <span className="rounded-full bg-warning-bg px-2 py-0.5 font-semibold text-warning normal-case">
                Flagged
              </span>
            )}
          </span>
          <span className="text-sm text-secondary-text">{title}</span>
          <span
            className={`text-2xl leading-tight font-semibold ${warn ? "text-warning" : "text-main-black"}`}
          >
            {value}
          </span>
          {subline && (
            <span className="flex items-center gap-1 text-xs text-subtle-text">
              {subline}
            </span>
          )}
        </div>
        {/* Full-bleed mini trend along the bottom edge */}
        <div className="mt-auto h-14 w-full">
          {data.length >= 2 && (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data}
                margin={{ top: 6, right: 0, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={stroke} stopOpacity={0.18} />
                    <stop offset="100%" stopColor={stroke} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <YAxis hide domain={["dataMin", "dataMax"]} padding={{ top: 2, bottom: 2 }} />
                <Area
                  dataKey="v"
                  type="monotone"
                  stroke={stroke}
                  strokeWidth={1.5}
                  fill={`url(#${gradientId})`}
                  dot={false}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </Link>
    </div>
  );
}
