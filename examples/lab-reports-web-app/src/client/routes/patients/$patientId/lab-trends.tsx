/**
 * Lab trends — one full-width chart for the selected biomarker, picked via
 * the searchable combobox. Deep links from report rows/KPIs land here with
 * that biomarker pre-selected (`?biomarkers=` / legacy `?biomarker=`; only
 * the first key is used).
 */
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "../../../components/shared/atoms/Badge";
import {
  ComboBox,
  ComboBoxItem,
} from "../../../components/shared/atoms/ComboBox";
import { Skeleton } from "../../../components/shared/atoms/Skeleton";
import { Meta, MetaRow } from "../../../components/shared/Meta";
import { TrendChart } from "../../../components/pages/trends/TrendChart";
import { labTrendsQuery, type BiomarkerTrend } from "../../../lib/queries";
import { formatDate } from "../../../lib/format";

export const Route = createFileRoute("/patients/$patientId/lab-trends")({
  validateSearch: (search: Record<string, unknown>) => ({
    biomarkers:
      typeof search.biomarkers === "string"
        ? search.biomarkers
        : typeof search.biomarker === "string"
          ? search.biomarker
          : "",
  }),
  component: LabTrendsPage,
});

function LabTrendsPage() {
  const { patientId } = Route.useParams();
  const { biomarkers } = Route.useSearch();
  const navigate = Route.useNavigate();
  const trendsQ = useQuery(labTrendsQuery(patientId));
  const [inputValue, setInputValue] = useState("");
  const trends = trendsQ.data?.trends ?? [];

  // One chart at a time; nothing picked yet → the richest trend.
  const selectedKey = biomarkers.split(",").filter(Boolean)[0];
  const trend =
    trends.find((t) => t.key === selectedKey) ?? trends[0];

  if (trendsQ.isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-10 w-96" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  if (trends.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold text-main-black">Lab trends</h2>
        <p className="text-sm text-subtle-text">
          Trends appear once the same biomarker shows up in two or more
          reports. Upload another report to start building history.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold text-main-black">Lab trends</h2>
          <p className="text-sm text-secondary-text">
            {trends.length} biomarkers appear in two or more reports.
          </p>
        </div>
        <ComboBox
          aria-label="Select biomarker"
          placeholder={trend?.displayName ?? "Search biomarkers…"}
          selectedKey={null}
          inputValue={inputValue}
          onInputChange={setInputValue}
          onSelectionChange={(k) => {
            if (k == null) return;
            setInputValue("");
            void navigate({ search: { biomarkers: String(k) } });
          }}
          className="min-w-72"
        >
          {trends.map((t) => (
            <ComboBoxItem key={t.key} id={t.key} textValue={t.displayName}>
              {t.displayName}
              <span className="ml-2 text-xs text-subtle-text">
                {t.panelName ? `${t.panelName}, ` : ""}
                {t.points.length} results
              </span>
            </ComboBoxItem>
          ))}
        </ComboBox>
      </div>

      {trend && <TrendCard trend={trend} />}
    </div>
  );
}

function TrendCard({ trend }: { trend: BiomarkerTrend }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-white p-5">
      <div className="flex items-center gap-2">
        <span className="text-base font-semibold text-main-black">
          {trend.displayName}
        </span>
        {trend.panelName && <Badge variant="neutral">{trend.panelName}</Badge>}
      </div>
      <MetaRow>
        <Meta label="Results">{trend.points.length}</Meta>
        <Meta label="Period">
          {formatDate(trend.points[0]?.date)} –{" "}
          {formatDate(trend.points[trend.points.length - 1]?.date)}
        </Meta>
        <Meta label="Latest">
          {trend.points[trend.points.length - 1]?.value} {trend.unit}
        </Meta>
        {trend.latestRange && (
          <Meta label="Reference range">
            {trend.latestRange.lower ?? 0}–{trend.latestRange.upper ?? "∞"}{" "}
            {trend.unit}
          </Meta>
        )}
      </MetaRow>
      <TrendChart
        data={trend.points.map((p) => ({ date: p.date, value: p.value }))}
        scale="month"
        unit={trend.unit}
        formatValue={(v) => String(Math.round(v * 100) / 100)}
        band={trend.latestRange ?? undefined}
        showDots
      />
      {trend.droppedUnitMismatch > 0 && (
        <p className="text-xs text-subtle-text">
          {trend.droppedUnitMismatch} result(s) hidden - reported in different
          units than the latest report.
        </p>
      )}
    </div>
  );
}
