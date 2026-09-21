import { CaretLeftIcon } from "@phosphor-icons/react/CaretLeft";
import { CaretRightIcon } from "@phosphor-icons/react/CaretRight";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Toolbar } from "react-aria-components";
import { Button } from "@/client/components/shared/atoms/Button";
import { EmptyState } from "@/client/components/shared/atoms/EmptyState";
import { TrendChart } from "@/client/components/pages/trends/TrendChart";
import {
  TimeScaleToggle,
  type TimeScale,
} from "@/client/components/pages/trends/TimeScaleToggle";
import { TrendChartSkeleton } from "@/client/components/pages/trends/TrendsSkeletons";
import {
  terraTrendsQueryOpts,
  useTerraTrends,
} from "@/client/hooks/useTerraQueries";
import { queryClient } from "@/client/lib/query-client";
import { METRICS, type MetricKey } from "@/client/lib/metrics/config";
import { sleepDurationMinutes } from "@/client/lib/metrics/helpers";

export const Route = createFileRoute("/_authenticated/trends/$metric")({
  component: TrendDetailPage,
  beforeLoad: ({ params }) => {
    if (!(params.metric in METRICS)) {
      throw redirect({ to: "/trends" });
    }
  },
  loader: ({ params }) => {
    const today = new Date().toISOString().slice(0, 10);
    const startDate = addDays(today, -6);
    queryClient.prefetchQuery(
      terraTrendsQueryOpts({
        metric: params.metric as MetricKey,
        startDate,
        endDate: today,
        scale: "week",
      }),
    );
  },
});

/* -------------------------------------------------------------------------- */
/*                                  Helpers                                   */
/* -------------------------------------------------------------------------- */

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function getDateRange(
  referenceDate: string,
  scale: TimeScale,
): { startDate: string; endDate: string } {
  if (scale === "day")
    return { startDate: referenceDate, endDate: referenceDate };
  if (scale === "week")
    return { startDate: addDays(referenceDate, -6), endDate: referenceDate };
  return { startDate: addDays(referenceDate, -29), endDate: referenceDate };
}

function getStepDays(scale: TimeScale): number {
  if (scale === "day") return 1;
  if (scale === "week") return 7;
  return 30;
}

function formatDateRange(
  startDate: string,
  endDate: string,
  scale: TimeScale,
): string {
  if (scale === "day") {
    const d = new Date(startDate + "T12:00:00");
    const today = new Date().toISOString().slice(0, 10);
    if (startDate === today) return "Today";
    const yesterday = addDays(today, -1);
    if (startDate === yesterday) return "Yesterday";
    return d.toLocaleDateString(undefined, {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  }
  const start = new Date(startDate + "T12:00:00");
  const end = new Date(endDate + "T12:00:00");
  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  return `${fmt(start)} – ${fmt(end)}`;
}

/* -------------------------------------------------------------------------- */
/*                                    Page                                    */
/* -------------------------------------------------------------------------- */

function TrendDetailPage() {
  const { metric } = Route.useParams();
  const config = METRICS[metric as MetricKey]!;

  const [scale, setScale] = useState<TimeScale>("week");
  const [referenceDate, setReferenceDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );

  const { startDate, endDate } = useMemo(
    () => getDateRange(referenceDate, scale),
    [referenceDate, scale],
  );

  const { data, isLoading } = useTerraTrends({
    metric: metric as MetricKey,
    startDate,
    endDate,
    scale,
  });

  const chartData = useMemo(() => {
    if (!data?.dataPoints) return [];
    if (metric === "lastSleep") {
      return (
        data.dataPoints as {
          date: string;
          startTime: string;
          endTime: string;
        }[]
      )
        .map((p) => ({
          date: p.date,
          value: sleepDurationMinutes(p.startTime, p.endTime),
        }))
        .filter((p) => p.value > 0);
    }
    return data.dataPoints as { date: string; value: number }[];
  }, [data, metric]);

  const today = new Date().toISOString().slice(0, 10);
  const isAtPresent = endDate >= today;
  const step = getStepDays(scale);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 md:gap-16 px-4 py-16">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-emphasis-bg">
            <config.icon size={20} className="text-emphasis" />
          </span>
          <h1 className="text-4xl font-semibold leading-none text-main-black">
            {config.title}
          </h1>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-6 border-t border-border pt-16">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <TimeScaleToggle
            value={scale}
            onChange={(s) => {
              setScale(s);
              setReferenceDate(today);
            }}
            disableDay={!config.hasIntraday}
          />

          <Toolbar
            aria-label="Date range navigation"
            orientation="horizontal"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-white"
          >
            <Button
              variant="quiet"
              size="sm"
              aria-label="Previous period"
              onPress={() => setReferenceDate(addDays(referenceDate, -step))}
              className="w-auto! px-4! rounded-full"
            >
              <CaretLeftIcon size={16} weight="bold" />
            </Button>
            <span className="min-w-36 text-sm font-medium select-none text-center text-main-black">
              {formatDateRange(startDate, endDate, scale)}
            </span>
            <Button
              variant="quiet"
              size="sm"
              aria-label="Next period"
              isDisabled={isAtPresent}
              onPress={() => setReferenceDate(addDays(referenceDate, step))}
              className="w-auto! px-4! rounded-full"
            >
              <CaretRightIcon size={16} weight="bold" />
            </Button>
          </Toolbar>
        </div>

        {/* Chart */}
        {isLoading ? (
          <TrendChartSkeleton />
        ) : chartData.length > 0 ? (
          <TrendChart
            data={chartData}
            scale={scale}
            unit={config.unit}
            formatValue={config.format}
          />
        ) : (
          <EmptyState>No data for this period</EmptyState>
        )}
      </div>
    </div>
  );
}
