import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  CaretDownIcon,
  CaretUpIcon,
  FilePdfIcon,
  MinusIcon,
} from "@phosphor-icons/react";
import { TooltipTrigger, Focusable } from "react-aria-components";
import { Button } from "../../../components/shared/atoms/Button";
import { SearchField } from "../../../components/shared/atoms/SearchField";
import { Skeleton } from "../../../components/shared/atoms/Skeleton";
import { Tooltip } from "../../../components/shared/atoms/Tooltip";
import { DrawContextChips } from "../../../components/shared/DrawContextChips";
import { Meta, MetaRow } from "../../../components/shared/Meta";
import { StatusBadge } from "../../../components/shared/StatusBadge";
import { FlaggedBanner } from "../../../components/pages/report/FlaggedBanner";
import {
  FlagBadge,
  RangeBar,
  ResultValue,
} from "../../../components/pages/report/result-display";
import {
  labTrendsQuery,
  sessionFilesQuery,
  sessionQuery,
  type LabTrendsOk,
  type SessionOk,
} from "../../../lib/queries";
import { capitalize, formatDate } from "../../../lib/format";

export const Route = createFileRoute(
  "/patients/$patientId/reports/$sessionId",
)({ component: ReportDetailPage });

type Session = SessionOk["session"];
type Result = NonNullable<Session["results"]>[number];

const ABNORMAL = (r: Result) =>
  r.interpretation.flag != null && r.interpretation.flag !== "normal";

/** Fixed column templates so every panel section aligns identically. */
const ROW_GRID =
  "grid grid-cols-[minmax(0,1.6fr)_8rem_10rem_9rem_6.5rem_2rem] items-center gap-3 max-lg:grid-cols-[minmax(0,1.5fr)_7rem_6rem_2rem]";

/** Change vs the previous report of the same biomarker. */
interface Delta {
  dir: "up" | "down" | "same";
  prevValue: number;
  prevDate: string;
}

function deltaFor(
  trends: LabTrendsOk["trends"] | undefined,
  biomarkerKey: string | null,
  sessionId: string,
): Delta | null {
  if (!trends || biomarkerKey == null) return null;
  const trend = trends.find((t) => t.key === biomarkerKey);
  if (!trend) return null;
  const idx = trend.points.findIndex((p) => p.sessionId === sessionId);
  if (idx < 1) return null; // first report of this marker, or not in trend
  const current = trend.points[idx];
  const prev = trend.points[idx - 1];
  const dir =
    Math.abs(current.value - prev.value) < 1e-9
      ? "same"
      : current.value > prev.value
        ? "up"
        : "down";
  return { dir, prevValue: prev.value, prevDate: prev.date };
}

function DeltaIndicator({ delta }: { delta: Delta | null }) {
  if (!delta) return <span className="inline-flex w-4" aria-hidden />;
  const Icon =
    delta.dir === "up"
      ? CaretUpIcon
      : delta.dir === "down"
        ? CaretDownIcon
        : MinusIcon;
  const color =
    delta.dir === "up"
      ? "text-green-600"
      : delta.dir === "down"
        ? "text-red-600"
        : "text-subtle-text";
  const label =
    delta.dir === "same"
      ? `Unchanged from the previous report (${delta.prevValue} on ${formatDate(delta.prevDate)})`
      : `${delta.dir === "up" ? "Up" : "Down"} from ${delta.prevValue} on ${formatDate(delta.prevDate)}`;
  return (
    <TooltipTrigger delay={200} closeDelay={0}>
      <Focusable>
        <span
          role="img"
          aria-label={label}
          className={`inline-flex w-4 cursor-default justify-center ${color}`}
        >
          <Icon size={16} weight="fill" />
        </span>
      </Focusable>
      <Tooltip>{label}</Tooltip>
    </TooltipTrigger>
  );
}

/** Group results by panel (via biomarker.panel_id); unmatched rows last. */
function groupResults(session: Session): Array<{
  title: string;
  results: Result[];
  unmatched?: boolean;
}> {
  const results = session.results ?? [];
  const panels = new Map(
    (session.panels ?? []).map((p) => [p.id, p.name ?? p.key ?? "Panel"]),
  );
  const groups = new Map<string, Result[]>();
  const unmatched: Result[] = [];
  for (const r of results) {
    // `biomarker.key === null` is the sole "not standardized" signal — keep
    // these rows visible (verbatim from the report), never drop them.
    if (r.biomarker.key == null) {
      unmatched.push(r);
      continue;
    }
    const title =
      (r.biomarker.panel_id != null
        ? panels.get(r.biomarker.panel_id)
        : undefined) ??
      r.source.panel ??
      "Other results";
    groups.set(title, [...(groups.get(title) ?? []), r]);
  }
  const out: Array<{ title: string; results: Result[]; unmatched?: boolean }> =
    [...groups.entries()].map(([title, rs]) => ({ title, results: rs }));
  if (unmatched.length > 0) {
    out.push({
      title: "Unmatched results",
      results: unmatched,
      unmatched: true,
    });
  }
  return out;
}

function ReportDetailPage() {
  const { patientId, sessionId } = Route.useParams();
  const sessionQ = useQuery(sessionQuery(sessionId));
  const trendsQ = useQuery(labTrendsQuery(patientId));
  const [search, setSearch] = useState("");
  const session = sessionQ.data?.session;

  if (sessionQ.isLoading || !session) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  const results = session.results ?? [];
  const flagged = results.filter(ABNORMAL).length;
  const query = search.trim().toLowerCase();
  const matches = (r: Result) =>
    !query ||
    `${r.biomarker.display_name ?? ""} ${r.source.name ?? ""} ${r.biomarker.key ?? ""}`
      .toLowerCase()
      .includes(query);
  const groups = groupResults(session)
    .map((g) => ({ ...g, results: g.results.filter(matches) }))
    .filter((g) => g.results.length > 0);

  return (
    <div className="flex flex-col gap-6">
      <FlaggedBanner flaggedCount={flagged} />

      <div className="flex flex-col gap-4 rounded-xl border border-border bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-lg font-semibold text-main-black">
            {session.lab_name ?? "Lab report"}
          </span>
          <StatusBadge status={session.current_status} />
        </div>
        <MetaRow>
          {session.collection_date && (
            <Meta label="Collected">{formatDate(session.collection_date)}</Meta>
          )}
          {session.report_date && (
            <Meta label="Reported">{formatDate(session.report_date)}</Meta>
          )}
          {session.patient_age_at_collection != null && (
            <Meta label="Age at collection">
              {session.patient_age_at_collection}
            </Meta>
          )}
          {session.patient_sex && (
            <Meta label="Sex">{capitalize(session.patient_sex)}</Meta>
          )}
          <Meta label="Results">{results.length}</Meta>
          {session.report_locale && (
            <Meta label="Locale" mono>
              {session.report_locale}
            </Meta>
          )}
        </MetaRow>
        {session.report_notes && (
          <p className="text-sm text-secondary-text">{session.report_notes}</p>
        )}
        <DrawContextChips patientId={patientId} sessionId={sessionId} />
      </div>

      <SearchField
        aria-label="Search results"
        placeholder="Search this report's markers…"
        value={search}
        onChange={setSearch}
        className="max-w-md"
      />
      {groups.length === 0 && query && (
        <p className="text-sm text-subtle-text">
          No markers match “{search}”.
        </p>
      )}

      {groups.map((group) => (
        <section
          key={group.title}
          className="flex flex-col gap-1 rounded-xl border border-border bg-white p-5"
        >
          <h2 className="mb-2 text-lg font-semibold text-main-black">
            {group.title}
            <span className="ml-2 text-sm font-normal text-subtle-text">
              {group.results.length}
            </span>
          </h2>
          {group.unmatched && (
            <p className="-mt-2 mb-2 text-xs text-subtle-text">
              Terra couldn't map these to a canonical biomarker - shown
              verbatim from the report.
            </p>
          )}
          <div
            className={`${ROW_GRID} border-b border-border pb-2 text-xs font-medium text-subtle-text`}
          >
            <span>Marker</span>
            <span>Result</span>
            <span className="max-lg:hidden">Range</span>
            <span className="max-lg:hidden">Reference</span>
            <span>Flag</span>
            <span />
          </div>
          {group.results.map((r, i) => (
            <ResultRow
              key={`${r.biomarker.key ?? r.source.name}-${i}`}
              r={r}
              patientId={patientId}
              delta={deltaFor(trendsQ.data?.trends, r.biomarker.key, sessionId)}
            />
          ))}
        </section>
      ))}

      <OriginalReport sessionId={sessionId} />
    </div>
  );
}

function referenceText(r: Result): string {
  const range = r.interpretation.applied_range;
  if (range && (range.lower != null || range.upper != null)) {
    return `${range.lower ?? 0} – ${range.upper ?? "∞"}`;
  }
  return r.source.reference_text ?? "-";
}

function ResultRow({
  r,
  patientId,
  delta,
}: {
  r: Result;
  patientId: string;
  delta: Delta | null;
}) {
  const name = r.biomarker.display_name ?? r.source.name ?? "Unknown marker";
  return (
    <div
      className={`${ROW_GRID} border-b border-border py-3 text-sm last:border-b-0`}
    >
      <div className="flex min-w-0 flex-col">
        {r.biomarker.key != null ? (
          <Link
            to="/patients/$patientId/lab-trends"
            params={{ patientId }}
            search={{ biomarkers: r.biomarker.key }}
            className="truncate font-medium text-main-black hover:text-emphasis hover:underline"
          >
            {name}
          </Link>
        ) : (
          <span className="truncate font-medium text-main-black">{name}</span>
        )}
        {r.biomarker.loinc_code && (
          <span className="font-mono text-[10px] text-subtle-text">
            LOINC {r.biomarker.loinc_code}
          </span>
        )}
      </div>
      <ResultValue measurement={r.measurement} />
      <div className="max-lg:hidden">
        <RangeBar measurement={r.measurement} interpretation={r.interpretation} />
      </div>
      <span className="text-secondary-text max-lg:hidden">
        {referenceText(r)}
      </span>
      <FlagBadge interpretation={r.interpretation} />
      <DeltaIndicator delta={delta} />
    </div>
  );
}

function OriginalReport({ sessionId }: { sessionId: string }) {
  const [open, setOpen] = useState(false);
  const filesQ = useQuery({ ...sessionFilesQuery(sessionId), enabled: open });
  const files = filesQ.data?.files ?? [];

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-main-black">
          Original report
        </h2>
        {!open && (
          <Button variant="secondary" onPress={() => setOpen(true)}>
            <FilePdfIcon size={18} /> View original
          </Button>
        )}
      </div>
      {open &&
        (filesQ.isLoading ? (
          <Skeleton className="h-96 rounded-lg" />
        ) : files.length === 0 ? (
          <p className="text-sm text-subtle-text">
            The original file isn't available right now.
          </p>
        ) : (
          files.map((f, i) => (
            <div key={i} className="flex flex-col gap-2">
              <object
                data={f.presigned_url}
                type="application/pdf"
                className="h-[32rem] w-full rounded-lg border border-border"
              >
                {/* Non-PDF uploads (photos) and object fallback */}
                <img
                  src={f.presigned_url}
                  alt={f.filename ?? "Original report"}
                  className="max-h-[32rem] rounded-lg object-contain"
                />
              </object>
              <a
                href={f.presigned_url}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-emphasis hover:underline"
              >
                Open {f.filename ?? "file"} in a new tab
              </a>
            </div>
          ))
        ))}
    </section>
  );
}
