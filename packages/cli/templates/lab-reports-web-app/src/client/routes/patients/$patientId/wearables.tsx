import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { parseDate, today, getLocalTimeZone } from "@internationalized/date";
import { ToggleButton } from "../../../components/shared/atoms/ToggleButton";
import { ToggleButtonGroup } from "../../../components/shared/atoms/ToggleButtonGroup";
import { DateRangePicker } from "../../../components/shared/atoms/DateRangePicker";
import { Skeleton } from "../../../components/shared/atoms/Skeleton";
import { TrendChart } from "../../../components/pages/trends/TrendChart";
import { TREND_METRICS } from "../../../lib/metrics";
import { labReportsQuery, wearablesQuery } from "../../../lib/queries";

const METRIC_KEYS = new Set(TREND_METRICS.map((m) => m.key));
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const Route = createFileRoute("/patients/$patientId/wearables")({
  validateSearch: (search: Record<string, unknown>) => ({
    metric: METRIC_KEYS.has(String(search.metric))
      ? String(search.metric)
      : "restingHr",
    days:
      search.days === "full"
        ? ("full" as const)
        : [7, 30, 90].includes(Number(search.days))
          ? Number(search.days)
          : 30,
    // Explicit calendar range (overrides the days preset when both valid)
    start:
      typeof search.start === "string" && DATE.test(search.start)
        ? search.start
        : undefined,
    end:
      typeof search.end === "string" && DATE.test(search.end)
        ? search.end
        : undefined,
  }),
  component: WearableTrendsPage,
});

function WearableTrendsPage() {
  const { patientId } = Route.useParams();
  const { metric, days, start, end } = Route.useSearch();
  const navigate = Route.useNavigate();
  const hasRange = Boolean(start && end);
  const wearablesQ = useQuery(
    wearablesQuery(patientId, hasRange ? { start, end } : { days }),
  );
  const reportsQ = useQuery(labReportsQuery(patientId));

  // Warm the full-history window in the background (after the visible
  // window has had first go at the network) so the Full toggle is instant.
  const queryClient = useQueryClient();
  useEffect(() => {
    const t = setTimeout(() => {
      void queryClient.prefetchQuery(
        wearablesQuery(patientId, { days: "full" }),
      );
    }, 1500);
    return () => clearTimeout(t);
  }, [patientId, queryClient]);

  const config = TREND_METRICS.find((m) => m.key === metric)!;
  const series =
    wearablesQ.data?.series[metric as keyof typeof wearablesQ.data.series] ??
    [];
  // Lab draws as event markers on the physiology, keyed by collection_date.
  // Draws that land within ~3% of the window of each other keep their line
  // but drop the label, so "Lab draw" text never overlaps itself.
  const drawDates = [
    ...new Set(
      (reportsQ.data?.sessions ?? [])
        .map((s) => s.collection_date ?? s.report_date)
        .filter((d): d is string => Boolean(d)),
    ),
  ].sort();
  const spanMs =
    series.length >= 2
      ? new Date(series[series.length - 1].date).getTime() -
        new Date(series[0].date).getTime()
      : 0;
  let lastLabeled = -Infinity;
  const labMarkers = drawDates.map((date) => {
    const t = new Date(date).getTime();
    const labeled = spanMs === 0 || t - lastLabeled > spanMs * 0.03;
    if (labeled) lastLabeled = t;
    return { date, label: labeled ? "Lab draw" : "" };
  });

  const maxDate = today(getLocalTimeZone());

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-xl font-semibold text-main-black">
          Wearable trends
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <ToggleButtonGroup
            selectionMode="single"
            selectedKeys={hasRange ? [] : [String(days)]}
            onSelectionChange={(keys) => {
              const key = String([...keys][0]);
              const next =
                key === "full" ? ("full" as const) : Number(key);
              if (next === "full" || !Number.isNaN(next)) {
                void navigate({
                  search: { metric, days: next, start: undefined, end: undefined },
                });
              }
            }}
          >
            {[7, 30, 90].map((d) => (
              <ToggleButton key={d} id={String(d)}>
                {d}d
              </ToggleButton>
            ))}
            {/* Everything since the patient's first recorded wearable day */}
            <ToggleButton id="full">Full</ToggleButton>
          </ToggleButtonGroup>
          <DateRangePicker
            aria-label="Custom date range"
            maxValue={maxDate}
            value={
              hasRange
                ? { start: parseDate(start!), end: parseDate(end!) }
                : null
            }
            onChange={(range) => {
              if (!range) return;
              void navigate({
                search: {
                  metric,
                  days,
                  start: range.start.toString(),
                  end: range.end.toString(),
                },
              });
            }}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {TREND_METRICS.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() =>
              void navigate({ search: { metric: m.key, days, start, end } })
            }
            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              m.key === metric
                ? "border-emphasis bg-emphasis-bg text-emphasis"
                : "border-border bg-white text-secondary-text hover:border-emphasis"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-white p-5">
        {wearablesQ.isLoading ? (
          <Skeleton className="h-80 w-full rounded-lg" />
        ) : wearablesQ.isError ? (
          // An error is not "no wearable" — say what happened.
          <p className="py-16 text-center text-sm text-warning">
            Couldn't load wearable data: {wearablesQ.error.message} - try
            again, or pick a shorter range.
          </p>
        ) : !wearablesQ.data?.connected ? (
          <p className="py-16 text-center text-sm text-subtle-text">
            No wearable connected for this patient.
          </p>
        ) : series.length === 0 ? (
          <p className="py-16 text-center text-sm text-subtle-text">
            No {config.label} data in this window.
          </p>
        ) : (
          <TrendChart
            data={series}
            scale="month"
            unit={config.unit}
            formatValue={config.format}
            markers={labMarkers}
          />
        )}
      </div>
    </div>
  );
}
