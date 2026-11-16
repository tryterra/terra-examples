/**
 * Full detail for one record: every parsed field, where it came from, and
 * the raw FHIR. The rows on the page stay lean because this exists.
 */
import type { ReactNode } from "react";
import { XIcon } from "@phosphor-icons/react";
import { Badge } from "../shared/atoms/Badge";
import { Button } from "../shared/atoms/Button";
import { Dialog, Heading } from "../shared/atoms/Dialog";
import { Drawer } from "../shared/Drawer";
import { JsonView } from "../shared/JsonView";
import type { RecordItem } from "../../lib/queries";
import { typeMeta } from "../../lib/clinical-types";
import { formatClinicalDate } from "../../lib/format";
import {
  displayTitle,
  sentenceCaseTitle,
  shortTestName,
} from "../../lib/record-rows";
import { ValueText } from "./RecordSection";

/** Detail labels whose values are FHIR dates, rendered at their precision. */
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

export function RecordDrawer({
  item,
  onClose,
}: {
  item: RecordItem | undefined;
  onClose: () => void;
}) {
  return (
    <Drawer isOpen={!!item} onOpenChange={(v) => !v && onClose()} isDismissable>
      <Dialog className="flex h-full flex-col p-0">
        {item && <DrawerBody item={item} onClose={onClose} />}
      </Dialog>
    </Drawer>
  );
}

function DrawerBody({
  item,
  onClose,
}: {
  item: RecordItem;
  onClose: () => void;
}) {
  const { record, summary: s } = item;
  const flagged = s.flag && s.flag.tone !== "normal";
  const componentTitles = new Set(s.components.map((c) => c.title));
  const title = displayTitle(item);

  const fields: Array<[string, ReactNode]> = [
    [s.dateLabel, formatClinicalDate(s.date)],
  ];
  if (s.status) fields.push(["Status", s.status]);
  for (const d of s.details) {
    // Panel members get their own table below.
    if (componentTitles.has(d.label)) continue;
    fields.push([
      d.label,
      DATE_DETAILS.has(d.label) && looksLikeDate(d.value)
        ? formatClinicalDate(d.value)
        : d.value,
    ]);
  }

  const source: Array<[string, ReactNode]> = [
    ["Health system", record.source_name],
    [
      "FHIR resource",
      `${record.fhir.resource_type}${record.fhir.release ? `, ${record.fhir.release}` : ""}`,
    ],
    [
      "Resource ID",
      <span className="font-mono text-xs break-all">
        {record.fhir.identifier}
      </span>,
    ],
  ];
  // Records without a clinical date already show "Received" under Details.
  if (s.dateLabel !== "Received")
    source.push(["Received", formatClinicalDate(record.received_at)]);
  if (!s.parsed && record.fhir_resource)
    source.push(["Parsing", "Not a resource type this app reads yet"]);

  return (
    <>
      <header className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-xs text-subtle-text">
            {typeMeta(record.clinical_type).singular}
          </span>
          <Heading slot="title" className="text-xl leading-snug">
            {title}
          </Heading>
          {title.toLowerCase() !== s.title.toLowerCase() && (
            <span className="text-sm text-secondary-text">{s.title}</span>
          )}
        </div>
        <Button variant="quiet" size="sm" aria-label="Close" onPress={onClose}>
          <XIcon size={18} />
        </Button>
      </header>

      <div className="flex flex-1 flex-col gap-7 overflow-y-auto px-6 py-6">
        {(s.quantity || s.value) && record.clinical_type !== "medication" && (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-2xl tabular-nums">
              <ValueText quantity={s.quantity} value={s.value} />
            </span>
            {flagged && <Badge variant="warning">{s.flag!.label}</Badge>}
          </div>
        )}
        {record.clinical_type === "medication" && s.value && (
          <p className="text-base text-main-black">{s.value}</p>
        )}

        {s.components.length > 0 && (
          <DrawerSection title="Results">
            <ul className="rounded-card border border-border">
              {s.components.map((c, i) => (
                <li
                  key={i}
                  className="flex items-center gap-4 border-b border-border px-4 py-2.5 text-sm last:border-b-0"
                >
                  <span className="min-w-0 flex-1 truncate text-main-black">
                    {sentenceCaseTitle(shortTestName(c.title))}
                  </span>
                  <span className="hidden w-28 text-right text-xs text-subtle-text tabular-nums sm:block">
                    {c.range}
                  </span>
                  <span className="w-28 text-right tabular-nums">
                    <ValueText quantity={c.quantity} value={c.value} />
                  </span>
                  <span className="flex w-14 justify-end">
                    {c.flag && c.flag.tone !== "normal" && (
                      <Badge variant="warning">{c.flag.label}</Badge>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </DrawerSection>
        )}

        <DrawerSection title="Details">
          <DefinitionList rows={fields} />
        </DrawerSection>

        <DrawerSection title="Source">
          <DefinitionList rows={source} />
        </DrawerSection>

        <DrawerSection title="Raw FHIR">
          {record.fhir_resource ? (
            <JsonView value={record.fhir_resource} />
          ) : (
            <p className="text-sm text-subtle-text">
              The health system's FHIR resource could not be retrieved, so this
              record shows Terra's summary only.
            </p>
          )}
        </DrawerSection>
      </div>
    </>
  );
}

function DrawerSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-main-black">{title}</h3>
      {children}
    </section>
  );
}

function DefinitionList({ rows }: { rows: Array<[string, ReactNode]> }) {
  return (
    <dl className="grid grid-cols-[9rem_minmax(0,1fr)] gap-x-4 gap-y-2.5 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-subtle-text">{label}</dt>
          <dd className="text-main-black">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
