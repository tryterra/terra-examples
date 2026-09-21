/**
 * Clickdown body for a flagged lab value: Terra AI reviews the patient's
 * wearable history against this biomarker's draws, writes a short overview,
 * and picks the wearable metrics worth charting (each rendered as a real
 * overlay chart from deterministic series). "No significant signals" renders
 * as an honest answer, not an error.
 */
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { PulseIcon } from "@phosphor-icons/react";
import { Skeleton } from "../../shared/atoms/Skeleton";
import { Meta, MetaRow } from "../../shared/Meta";
import { flagInsightQuery } from "../../../lib/queries";
import { formatDate } from "../../../lib/format";
import { OverlayChart } from "./OverlayChart";

const STRENGTH_STYLE: Record<string, string> = {
  notable: "border-warning bg-warning-bg text-warning",
  moderate: "border-border bg-white text-secondary-text",
  weak: "border-border bg-white text-subtle-text",
};

export function FlagInsightPanel({
  patientId,
  biomarkerKey,
}: {
  patientId: string;
  biomarkerKey: string;
}) {
  const insightQ = useQuery(flagInsightQuery(patientId, biomarkerKey));

  if (insightQ.isLoading) {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-white p-5">
        <span className="flex items-center gap-2 text-sm font-medium text-secondary-text">
          <PulseIcon size={16} weight="bold" className="animate-pulse" />
          Terra AI is reviewing the wearable data for this marker…
        </span>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-40 w-full rounded-lg" />
      </div>
    );
  }
  if (insightQ.isError) {
    return (
      <p className="rounded-lg border border-border bg-white p-5 text-sm text-warning">
        Couldn't analyze this marker: {insightQ.error.message}
      </p>
    );
  }
  const data = insightQ.data;
  if (!data || !data.enabled) return null;
  const insight = data.insight;

  // Personal baseline: the earliest draw of this biomarker (often years
  // before the wearable era) is the reference every later value reads
  // against.
  const baseline = insight.lab[0];
  const latest = insight.lab[insight.lab.length - 1];
  const changePct =
    baseline && latest && baseline.value !== 0
      ? Math.round(
          ((latest.value - baseline.value) / Math.abs(baseline.value)) * 100,
        )
      : null;

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <span className="flex items-center gap-2 text-base font-semibold text-main-black">
          <PulseIcon size={16} weight="bold" className="text-secondary-text" />
          {insight.biomarkerLabel} × wearable signals
        </span>
        <Link
          to="/patients/$patientId/lab-trends"
          params={{ patientId }}
          search={{ biomarkers: insight.biomarkerKey }}
          className="text-sm font-medium text-emphasis hover:underline"
        >
          Full lab trend
        </Link>
      </div>

      {baseline && latest && baseline.date !== latest.date && (
        <MetaRow>
          <Meta label={`Baseline · ${formatDate(baseline.date)}`}>
            {baseline.value} {insight.unit}
          </Meta>
          <Meta label={`Latest · ${formatDate(latest.date)}`}>
            {latest.value} {insight.unit}
          </Meta>
          {changePct != null && (
            <Meta label="Since baseline">
              {changePct > 0 ? "+" : ""}
              {changePct}%
            </Meta>
          )}
          <Meta label="Draws">{insight.lab.length}</Meta>
        </MetaRow>
      )}

      <p className="text-sm leading-relaxed text-secondary-text">
        {insight.overview}
      </p>

      {insight.noSignificantFindings || insight.signals.length === 0 ? (
        <p className="rounded-lg bg-bg-grey px-4 py-3 text-sm text-subtle-text">
          No significant wearable signals for this marker in the available
          data.
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {insight.signals.map((s) => (
            <div key={s.metric} className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-main-black">
                  {s.metricLabel}
                </span>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${STRENGTH_STYLE[s.strength] ?? STRENGTH_STYLE.weak}`}
                >
                  {s.strength} signal
                </span>
                <span className="flex items-center gap-4 text-xs text-subtle-text">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-warning" />
                    {insight.biomarkerLabel} ({insight.unit})
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emphasis-secondary" />
                    {s.metricLabel} ({s.metricUnit})
                  </span>
                </span>
              </div>
              <OverlayChart
                lab={insight.lab}
                weekly={s.weekly}
                labLabel={insight.biomarkerLabel}
                labUnit={insight.unit}
                metricLabel={s.metricLabel}
                metricUnit={s.metricUnit}
              />
              <p className="text-sm text-secondary-text">{s.explanation}</p>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-subtle-text">
        Generated by Terra AI from this patient's own data. Observed
        associations for context, not a clinical finding.
      </p>
    </div>
  );
}
