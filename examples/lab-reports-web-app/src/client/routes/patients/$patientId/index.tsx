import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CaretDownIcon,
  CaretRightIcon,
  CaretUpIcon,
  UploadSimpleIcon,
} from "@phosphor-icons/react";
import { Button } from "../../../components/shared/atoms/Button";
import {
  GridList,
  GridListItem,
} from "../../../components/shared/atoms/GridList";
import { Skeleton } from "../../../components/shared/atoms/Skeleton";
import { KpiCard } from "../../../components/shared/KpiCard";
import { Meta } from "../../../components/shared/Meta";
import { StatusBadge } from "../../../components/shared/StatusBadge";
import { FlagInsightPanel } from "../../../components/pages/dashboard/FlagInsightPanel";
import { IntelligenceBrief } from "../../../components/pages/dashboard/IntelligenceBrief";
import { TimelineSpine } from "../../../components/pages/dashboard/TimelineSpine";
import { Watchlist } from "../../../components/pages/dashboard/Watchlist";
import {
  DomainCard,
  type Domain,
} from "../../../components/pages/dashboard/DomainCard";
import { WearableSnapshot } from "../../../components/pages/dashboard/WearableSnapshot";
import {
  analysisQuery,
  healthQuery,
  labReportsQuery,
  labTrendsQuery,
  wearablesQuery,
} from "../../../lib/queries";
import { formatDate } from "../../../lib/format";

export const Route = createFileRoute("/patients/$patientId/")({
  component: PatientOverview,
});

/** "Chronic · since Sep 2022 · falling" line for a flagged card. */
function chronicityLabel(
  a:
    | {
        chronicity: string;
        abnormalSince: string | null;
        trajectory: string;
      }
    | undefined,
): string | null {
  if (!a) return null;
  const base =
    a.chronicity === "chronic"
      ? `Chronic · since ${formatDate(a.abnormalSince ?? undefined)}`
      : a.chronicity === "recurrent"
        ? "Recurrent"
        : a.chronicity === "new"
          ? "New this draw"
          : null;
  if (!base) return null;
  return a.trajectory !== "stable" ? `${base} · ${a.trajectory}` : base;
}

/** Flagged lab contributions across domains, worst first, deduped by label. */
function flaggedLabs(domains: Domain[]): Domain["contributions"] {
  const seen = new Set<string>();
  return domains
    .flatMap((d) => d.contributions)
    .filter((c) => c.kind === "lab" && c.severity !== "normal")
    .sort((a, b) => a.subscore - b.subscore)
    .filter((c) => {
      if (seen.has(c.label)) return false;
      seen.add(c.label);
      return true;
    });
}

function PatientOverview() {
  const { patientId } = Route.useParams();
  const navigate = useNavigate();
  const analysisQ = useQuery(analysisQuery(patientId));
  const reportsQ = useQuery(labReportsQuery(patientId));
  const wearablesQ = useQuery(wearablesQuery(patientId));
  const trendsQ = useQuery(labTrendsQuery(patientId));
  const healthQ = useQuery(healthQuery);

  // Warm the full wearable history in the background once the page's own
  // data has had first go at the network — the trends page's Full toggle
  // (and its server-side day cache) are then already hot.
  const queryClient = useQueryClient();
  useEffect(() => {
    const t = setTimeout(() => {
      void queryClient.prefetchQuery(
        wearablesQuery(patientId, { days: "full" }),
      );
    }, 1500);
    return () => clearTimeout(t);
  }, [patientId, queryClient]);

  // "Since last report" delta for a flagged biomarker (last two draws).
  const deltaFor = (biomarkerKey?: string) => {
    const t = trendsQ.data?.trends.find((t) => t.key === biomarkerKey);
    if (!t || t.points.length < 2) return null;
    const [prev, last] = t.points.slice(-2);
    if (last.value === prev.value) return null;
    return {
      dir: last.value > prev.value ? ("up" as const) : ("down" as const),
      prevValue: prev.value,
      prevDate: prev.date,
      unit: t.unit,
    };
  };

  const analysis = analysisQ.data;
  const sessions = reportsQ.data?.sessions ?? [];
  const flagged = analysis ? flaggedLabs(analysis.domains) : [];
  // Only biomarkers with trend data can be analyzed against wearables.
  const trendKeys = new Set(
    (trendsQ.data?.trends ?? []).map((t) => t.key),
  );

  // Cards = engine-flagged domain inputs (worst first), plus any other
  // biomarker whose most recent JUDGEABLE draw was abnormal — reports that
  // print no ranges leave newer values unjudgeable, so the last judged draw
  // is shown with its date.
  const engineKeys = new Set(
    flagged
      .map((c) => (c.ref?.type === "lab" ? c.ref.biomarkerKey : null))
      .filter(Boolean),
  );
  const extraFlagged = Object.values(analysis?.labAssessments ?? {})
    .filter(
      (a) => a.lastJudged?.abnormal && !engineKeys.has(a.biomarkerKey),
    )
    .sort((x, y) =>
      (y.lastJudged?.date ?? "").localeCompare(x.lastJudged?.date ?? ""),
    );
  const flaggedTotal = flagged.length + extraFlagged.length;
  const flagCards = [
    ...flagged.map((c) => ({
      id: c.label,
      label: c.label,
      valueText: c.valueText,
      biomarkerKey: c.ref?.type === "lab" ? c.ref.biomarkerKey : undefined,
      detailText: c.detailText,
      drawDate: undefined as string | undefined,
    })),
    ...extraFlagged.map((a) => ({
      id: a.biomarkerKey,
      label: a.label,
      valueText: `${a.lastJudged!.value} ${a.unit}`,
      biomarkerKey: a.biomarkerKey as string | undefined,
      detailText: undefined as string | undefined,
      drawDate: a.lastJudged!.date as string | undefined,
    })),
  ].slice(0, 8);

  // Clickdown state: which flagged card is expanded. The last-opened panel
  // stays mounted through the collapse so the close animates smoothly.
  const [openKey, setOpenKey] = useState<string | null>(null);
  const lastOpenRef = useRef<string | null>(null);
  if (openKey) lastOpenRef.current = openKey;
  const shownKey = openKey ?? lastOpenRef.current;

  // Function-Health-style totals for the latest report: engine-flagged count
  // vs everything else on the report (report flags are absent when the PDF
  // prints no ranges, so the deterministic engine is the source of truth).
  const latestSession = [...sessions]
    .filter((s) => s.results_count != null)
    .sort((a, b) =>
      (b.collection_date ?? b.report_date ?? "").localeCompare(
        a.collection_date ?? a.report_date ?? "",
      ),
    )[0];
  const inRangeCount =
    latestSession?.results_count != null && analysis
      ? Math.max(0, latestSession.results_count - flaggedTotal)
      : null;

  return (
    <div className="flex flex-col gap-10">
      {/* Intelligence brief + inline chat */}
      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold text-main-black">
          Health assessment
        </h2>
        <IntelligenceBrief patientId={patientId} />
      </section>

      {/* Flagged lab KPIs + wearable-context clickdowns */}
      {flagCards.length > 0 && (
        <section className="flex flex-col gap-4 border-t border-border pt-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-main-black">
              Flagged lab values
            </h2>
            <div className="flex items-center gap-2">
              {inRangeCount != null && (
                <span className="rounded-full border border-border bg-white px-3 py-1 text-xs font-medium text-secondary-text">
                  {inRangeCount} in range
                </span>
              )}
              <span className="rounded-full border border-warning bg-warning-bg px-3 py-1 text-xs font-medium text-warning">
                {flaggedTotal} need attention
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {flagCards.map((c) => {
              const biomarkerKey = c.biomarkerKey;
              const canAnalyze =
                biomarkerKey != null && trendKeys.has(biomarkerKey);
              const isOpen = openKey != null && openKey === biomarkerKey;
              const delta = deltaFor(biomarkerKey);
              const chronicityText = chronicityLabel(
                biomarkerKey
                  ? analysis?.labAssessments?.[biomarkerKey]
                  : undefined,
              );
              return (
                <KpiCard
                  key={c.id}
                  label={c.label}
                  value={c.valueText}
                  warn
                  sublabel={
                    <span className="flex flex-col gap-0.5">
                      {c.drawDate && (
                        <span className="text-subtle-text">
                          Draw {formatDate(c.drawDate)} · newest with a range
                        </span>
                      )}
                      {chronicityText && (
                        <span className="font-medium text-warning">
                          {chronicityText}
                        </span>
                      )}
                      {delta && (
                        <span className="flex items-center gap-1 text-secondary-text">
                          {delta.dir === "up" ? (
                            <CaretUpIcon size={10} weight="fill" />
                          ) : (
                            <CaretDownIcon size={10} weight="fill" />
                          )}
                          from {delta.prevValue} {delta.unit} ·{" "}
                          {formatDate(delta.prevDate)}
                        </span>
                      )}
                      {canAnalyze ? (
                        <span className="flex items-center gap-1">
                          Wearable signals
                          <CaretDownIcon
                            size={12}
                            weight="bold"
                            className={`transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
                          />
                        </span>
                      ) : c.detailText ? (
                        `Reference ${c.detailText}`
                      ) : (
                        "View trend"
                      )}
                    </span>
                  }
                  onClick={
                    canAnalyze
                      ? () => setOpenKey(isOpen ? null : biomarkerKey)
                      : undefined
                  }
                  active={isOpen}
                  link={
                    !canAnalyze && biomarkerKey
                      ? {
                          to: "/patients/$patientId/lab-trends",
                          params: { patientId },
                          search: { biomarkers: biomarkerKey },
                        }
                      : undefined
                  }
                />
              );
            })}
          </div>
          <div
            className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${
              openKey && shownKey ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
            }`}
          >
            <div className="overflow-hidden">
              {shownKey && (
                <FlagInsightPanel
                  patientId={patientId}
                  biomarkerKey={shownKey}
                />
              )}
            </div>
          </div>
        </section>
      )}

      {/* Doctor's per-patient watchlist */}
      <Watchlist patientId={patientId} />

      {/* Lab reports */}
      <section className="flex flex-col gap-4 border-t border-border pt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-main-black">
            Lab reports
          </h2>
          <div className="flex items-center gap-4">
            <Link
              to="/patients/$patientId/lab-trends"
              params={{ patientId }}
              search={{ biomarkers: "" }}
              className="text-sm font-medium text-emphasis hover:underline"
            >
              Lab trends
            </Link>
            {healthQ.data?.demo ? (
              <Button variant="primary" isDisabled>
                <UploadSimpleIcon size={18} weight="bold" /> Upload (demo)
              </Button>
            ) : (
              <Link to="/patients/$patientId/upload" params={{ patientId }}>
                <Button variant="primary">
                  <UploadSimpleIcon size={18} weight="bold" /> Upload report
                </Button>
              </Link>
            )}
          </div>
        </div>
        {reportsQ.isLoading ? (
          <div className="flex flex-col gap-2">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-subtle-text">
            No lab reports yet - upload one to see it standardized here.
          </p>
        ) : (
          <GridList
            aria-label="Lab reports"
            onAction={(key) =>
              navigate({
                to: "/patients/$patientId/reports/$sessionId",
                params: { patientId, sessionId: String(key) },
              })
            }
          >
            {sessions.map((s) => (
              <GridListItem
                key={s.session_id}
                id={s.session_id}
                textValue={s.lab_name ?? s.session_id}
              >
                <span className="min-w-0 flex-1 truncate font-medium text-main-black">
                  {s.lab_name ?? "Lab report"}
                </span>
                {/* Fixed-width columns keep every row aligned */}
                <div className="w-32 shrink-0">
                  <Meta label={s.collection_date ? "Collected" : "Reported"}>
                    {formatDate(s.collection_date ?? s.report_date)}
                  </Meta>
                </div>
                <div className="hidden w-20 shrink-0 sm:block">
                  <Meta label="Results">{s.results_count ?? "-"}</Meta>
                </div>
                <div className="w-24 shrink-0">
                  <StatusBadge status={s.current_status} />
                </div>
                <CaretRightIcon size={20} className="shrink-0 text-subtle-text" />
              </GridListItem>
            ))}
          </GridList>
        )}
      </section>

      {/* Timeline spine — lab draws over wearable trends */}
      <section className="flex flex-col gap-4 border-t border-border pt-8">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold text-main-black">
            Patient timeline
          </h2>
          <p className="text-sm text-secondary-text">
            Lab draws over wearable trends, and what happened between tests.
          </p>
        </div>
        <TimelineSpine patientId={patientId} />
      </section>

      {/* Domain scores */}
      <section className="flex flex-col gap-4 border-t border-border pt-8">
        <h2 className="text-xl font-semibold text-main-black">
          Domain scores
        </h2>
        {analysisQ.isLoading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-72 rounded-[10px]" />
            ))}
          </div>
        ) : analysisQ.isError ? (
          <p className="text-sm text-warning">
            Couldn't compute the scores: {analysisQ.error.message}
          </p>
        ) : analysis ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {analysis.domains.map((domain) => (
              <DomainCard
                key={domain.key}
                domain={domain}
                patientId={patientId}
                history={analysis.history[domain.key]}
              />
            ))}
          </div>
        ) : null}
      </section>

      {/* Wearable snapshot */}
      <section className="flex flex-col gap-4 border-t border-border pt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-main-black">
            Wearable snapshot
          </h2>
          {wearablesQ.data?.connected && (
            <Link
              to="/patients/$patientId/wearables"
              params={{ patientId }}
              search={{ metric: "restingHr", days: 30, start: undefined, end: undefined }}
              className="text-sm font-medium text-emphasis hover:underline"
            >
              View trends
            </Link>
          )}
        </div>
        <WearableSnapshot
          patientId={patientId}
          wearables={wearablesQ.data}
          isLoading={wearablesQ.isLoading}
        />
      </section>
    </div>
  );
}
