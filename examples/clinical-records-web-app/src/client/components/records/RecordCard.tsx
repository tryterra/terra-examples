import { BuildingsIcon, WarningIcon } from "@phosphor-icons/react";
import { Badge } from "../shared/atoms/Badge";
import {
  Disclosure,
  DisclosureHeader,
  DisclosurePanel,
} from "../shared/atoms/Disclosure";
import { JsonView } from "../shared/JsonView";
import { Meta } from "../shared/Meta";
import type { RecordItem } from "../../lib/queries";
import { formatClinicalDate } from "../../lib/format";

/** Details whose values are dates, so they render at FHIR precision. */
const DATE_DETAILS = new Set([
  "Onset",
  "Resolved",
  "Recorded",
  "Ended",
  "Asserted",
]);

function looksLikeDate(v: string) {
  return /^\d{4}(-\d{2}){0,2}(T.*)?$/.test(v);
}

export function RecordCard({ item }: { item: RecordItem }) {
  const { record, summary } = item;
  const unavailable =
    record.fhir_resource_error === "fhir_resource_unavailable";
  const flagged = summary.flag && summary.flag.tone !== "normal";

  return (
    <article className="flex flex-col gap-3 rounded-card border border-border bg-white p-4">
      <header className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 font-medium text-main-black">{summary.title}</h3>
        <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
          {summary.flag && (
            <Badge variant={flagged ? "warning" : "neutral"}>
              {summary.flag.label}
            </Badge>
          )}
          {summary.status && !summary.flag && (
            <Badge variant="neutral">{summary.status}</Badge>
          )}
        </div>
      </header>

      {summary.value && (
        <p className="text-xl font-semibold leading-snug text-main-black">
          {summary.value}
        </p>
      )}

      {unavailable && (
        <p className="flex items-start gap-2 rounded-lg border border-warning bg-warning-bg px-3 py-2 text-sm text-warning">
          <WarningIcon size={16} weight="bold" className="mt-0.5 shrink-0" />
          The health system's FHIR resource could not be retrieved. Showing
          Terra's summary only.
        </p>
      )}

      <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
        <Meta label={summary.dateLabel}>
          {formatClinicalDate(summary.date)}
        </Meta>
        {summary.flag && summary.status && (
          <Meta label="Status">{summary.status}</Meta>
        )}
        {summary.details.map((d) => (
          <Meta key={d.label} label={d.label}>
            {DATE_DETAILS.has(d.label) && looksLikeDate(d.value)
              ? formatClinicalDate(d.value)
              : d.value}
          </Meta>
        ))}
      </div>

      <footer className="mt-auto flex flex-col gap-2 border-t border-border pt-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-secondary-text">
          <span className="flex min-w-0 items-center gap-1.5">
            <BuildingsIcon size={14} className="shrink-0 text-subtle-text" />
            <span className="truncate">{record.source_name}</span>
          </span>
          <span className="font-mono text-[11px] text-subtle-text">
            {record.fhir.resource_type}
            {record.fhir.release ? ` · ${record.fhir.release}` : ""}
            {!summary.parsed && !unavailable ? " · not parsed" : ""}
          </span>
        </div>
        {record.fhir_resource && (
          <Disclosure>
            <DisclosureHeader>View raw FHIR</DisclosureHeader>
            <DisclosurePanel>
              <div className="-mx-4">
                <JsonView value={record.fhir_resource} />
              </div>
            </DisclosurePanel>
          </Disclosure>
        )}
      </footer>
    </article>
  );
}
