/**
 * Per-domain dashboard: the score's timeline across reports plus one chart
 * per underlying metric — lab biomarker trends and wearable series.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "../../../components/shared/atoms/Badge";
import { Skeleton } from "../../../components/shared/atoms/Skeleton";
import { Meta, MetaRow } from "../../../components/shared/Meta";
import {
  ScoreGauge,
  type Domain,
} from "../../../components/pages/dashboard/DomainCard";
import { TrendChart } from "../../../components/pages/trends/TrendChart";
import { TREND_METRICS } from "../../../lib/metrics";
import {
  analysisQuery,
  labTrendsQuery,
  wearablesQuery,
  type LabTrendsOk,
  type WearablesOk,
} from "../../../lib/queries";
import { formatDate } from "../../../lib/format";

export const Route = createFileRoute("/patients/$patientId/domains/$domainKey")(
  { component: DomainDashboardPage },
);

type Contribution = Domain["contributions"][number];

function DomainDashboardPage() {
  const { patientId, domainKey } = Route.useParams();
  const analysisQ = useQuery(analysisQuery(patientId));
  const labTrendsQ = useQuery(labTrendsQuery(patientId));
  const wearablesQ = useQuery(wearablesQuery(patientId));

  if (analysisQ.isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    );
  }

  const domain = analysisQ.data?.domains.find((d) => d.key === domainKey);
  if (!domain) {
    return <p className="text-sm text-subtle-text">Unknown domain.</p>;
  }
  const history = (analysisQ.data?.history[domainKey] ?? []).filter(
    (h): h is { date: string; score: number } => h.score != null,
  );
  const poor = domain.status === "Poor" || domain.status === "Fair";

  return (
    <div className="flex flex-col gap-8">
      {/* Header: gauge + meta */}
      <div className="flex flex-wrap items-center justify-between gap-6 rounded-xl border border-border bg-white p-5">
        <div className="flex flex-col gap-3">
          <h2 className="text-2xl font-semibold text-main-black">
            {domain.label}
          </h2>
          <p className="text-sm text-secondary-text">{domain.description}</p>
          <MetaRow>
            <Meta label="Status">
              <Badge variant={domain.score == null ? "neutral" : poor ? "warning" : "emphasis"}>
                {domain.status}
              </Badge>
            </Meta>
            <Meta label="Inputs">{domain.contributions.length}</Meta>
            {history.length > 0 && (
              <Meta label="History">
                {history.length} reports, {formatDate(history[0].date)} –{" "}
                {formatDate(history[history.length - 1].date)}
              </Meta>
            )}
          </MetaRow>
        </div>
        <div className="relative flex items-center justify-center">
          <ScoreGauge score={domain.score} poor={poor} size={140} />
          <div className="absolute inset-0 flex translate-y-5 flex-col items-center justify-center">
            <span className="text-5xl font-semibold leading-tight text-main-black">
              {domain.score ?? "–"}
            </span>
          </div>
        </div>
      </div>

      {/* Score timeline */}
      <section className="flex flex-col gap-3 rounded-xl border border-border bg-white p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-main-black">
            Score over time
          </h3>
          <span className="text-xs text-subtle-text">
            Labs-only reconstruction at each report date
          </span>
        </div>
        {history.length >= 2 ? (
          <TrendChart
            data={history.map((h) => ({ date: h.date, value: h.score }))}
            scale="month"
            unit="/100"
            formatValue={(v) => String(Math.round(v))}
            showDots
          />
        ) : (
          <p className="py-8 text-center text-sm text-subtle-text">
            The score timeline appears once two or more reports cover this
            {"domain's"} biomarkers.
          </p>
        )}
      </section>

      {/* Granular metric charts */}
      <section className="flex flex-col gap-4">
        <h3 className="text-lg font-semibold text-main-black">
          Underlying metrics
        </h3>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {domain.contributions.map((c, i) => (
            <MetricPanel
              key={`${c.label}-${i}`}
              patientId={patientId}
              contribution={c}
              labTrends={labTrendsQ.data?.trends}
              wearables={wearablesQ.data}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function MetricPanel({
  patientId,
  contribution: c,
  labTrends,
  wearables,
}: {
  patientId: string;
  contribution: Contribution;
  labTrends: LabTrendsOk["trends"] | undefined;
  wearables: WearablesOk | undefined;
}) {
  const header = (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="flex items-center gap-2">
        <span className="text-base font-semibold text-main-black">
          {c.label}
        </span>
        <Badge variant="neutral" className="text-[10px]">
          {c.kind}
        </Badge>
      </div>
      <MetaRow>
        <Meta label="Latest">{c.valueText}</Meta>
        <Meta label="Subscore">{c.subscore}</Meta>
        <Meta label="Weight">×{c.weight}</Meta>
      </MetaRow>
    </div>
  );

  if (c.ref?.type === "lab") {
    const biomarkerKey = c.ref.biomarkerKey;
    const trend = labTrends?.find((t) => t.key === biomarkerKey);
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-white p-5">
        {header}
        {trend ? (
          <>
            <TrendChart
              data={trend.points.map((p) => ({ date: p.date, value: p.value }))}
              scale="month"
              unit={trend.unit}
              formatValue={(v) => String(Math.round(v * 100) / 100)}
              band={trend.latestRange ?? undefined}
              showDots
            />
            <Link
              to="/patients/$patientId/lab-trends"
              params={{ patientId }}
              search={{ biomarkers: trend.key }}
              className="self-start text-sm font-medium text-emphasis hover:underline"
            >
              Open in lab trends
            </Link>
          </>
        ) : (
          <p className="py-6 text-sm text-subtle-text">
            Only one measurement so far - a trend appears with the next report.
          </p>
        )}
      </div>
    );
  }

  if (c.ref?.type === "wearable") {
    const metric = c.ref.metric;
    const series =
      wearables?.series[metric as keyof typeof wearables.series] ?? [];
    const config = TREND_METRICS.find((m) => m.key === metric);
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-white p-5">
        {header}
        {series.length > 0 ? (
          <>
            <TrendChart
              data={series}
              scale="month"
              unit={config?.unit ?? ""}
              formatValue={config?.format ?? ((v) => String(Math.round(v)))}
              showDots={series.length <= 31}
            />
            <Link
              to="/patients/$patientId/wearables"
              params={{ patientId }}
              search={{ metric, days: 30, start: undefined, end: undefined }}
              className="self-start text-sm font-medium text-emphasis hover:underline"
            >
              Open in wearable trends
            </Link>
          </>
        ) : (
          <p className="py-6 text-sm text-subtle-text">
            No wearable data for this metric in the last 30 days.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-white p-5">
      {header}
      <p className="py-6 text-sm text-subtle-text">No trend view available.</p>
    </div>
  );
}
