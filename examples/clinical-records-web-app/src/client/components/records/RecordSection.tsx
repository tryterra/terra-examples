/**
 * One section per clinical type: an h2 and a single card of rows. Each row
 * shows only what a clinician scans for; everything else lives in the detail
 * drawer that opens on click.
 */
import { useState, type ReactNode } from "react";
import { CaretDownIcon, CaretRightIcon } from "@phosphor-icons/react";
import { Badge } from "../shared/atoms/Badge";
import { Sparkline } from "../shared/Sparkline";
import type { RecordItem } from "../../lib/queries";
import { formatClinicalDate, formatMonthYear } from "../../lib/format";
import {
  alignDecimals,
  detail,
  displayTitle,
  notableStatus,
  sentenceCaseTitle,
  shortTestName,
  trendValues,
  type RecordGroup,
} from "../../lib/record-rows";

type Summary = RecordItem["summary"];
type Flag = Summary["flag"];
type Quantity = Summary["quantity"];

export type OpenRecord = (recordId: string) => void;

export function RecordSection({
  title,
  type,
  groups,
  onOpen,
  first,
}: {
  title: string;
  type: string;
  groups: RecordGroup[];
  onOpen: OpenRecord;
  first: boolean;
}) {
  const measured = type === "lab_result" || type === "vital_sign";
  return (
    <section
      className={`flex min-w-0 flex-col gap-4 ${first ? "" : "border-t border-border pt-8"}`}
    >
      <h2 className="text-xl font-semibold text-main-black">
        {title}
        <span className="ml-2 text-base font-normal text-subtle-text">
          {groups.length}
        </span>
      </h2>
      {measured ? (
        <MeasurementCard groups={groups} onOpen={onOpen} />
      ) : (
        <Card>
          {groups.map((g) => (
            <li key={g.key} className={ROW_ITEM}>
              <SimpleRow item={g.latest} type={type} onOpen={onOpen} />
            </li>
          ))}
        </Card>
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*                                 Primitives                                  */
/* -------------------------------------------------------------------------- */

const ROW_ITEM = "border-b border-border last:border-b-0";

function Card({ children }: { children: ReactNode }) {
  return (
    <ul className="overflow-hidden rounded-card border border-border bg-white">
      {children}
    </ul>
  );
}

function Row({
  title,
  sub,
  trailing,
  onPress,
  expanded,
  nested = false,
}: {
  title: ReactNode;
  sub?: ReactNode;
  trailing?: ReactNode;
  onPress: () => void;
  /** Set for rows that expand instead of opening the drawer. */
  expanded?: boolean;
  nested?: boolean;
}) {
  const expandable = expanded !== undefined;
  return (
    <button
      type="button"
      onClick={onPress}
      aria-expanded={expandable ? expanded : undefined}
      className={`flex w-full cursor-pointer items-center gap-3 py-3 sm:gap-4 text-left outline-none transition-colors hover:bg-black/2 focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-inset ${
        nested ? "pr-4 pl-8 sm:pr-5 sm:pl-9" : "px-4 sm:px-5"
      }`}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span
          className={`text-sm text-main-black sm:truncate ${nested ? "" : "font-medium"}`}
        >
          {title}
        </span>
        {sub && (
          <span className="text-xs text-pretty text-subtle-text">{sub}</span>
        )}
      </span>
      {trailing}
      {expandable ? (
        <CaretDownIcon
          size={16}
          className={`shrink-0 text-subtle-text transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
        />
      ) : (
        <CaretRightIcon size={16} className="shrink-0 text-subtle-text" />
      )}
    </button>
  );
}

/** Only abnormal flags are shown; "Normal" on every row is noise. */
function flagLabel(flag: Flag): string | null {
  return flag && flag.tone !== "normal" ? flag.label : null;
}

export function ValueText({
  quantity,
  value,
}: {
  quantity: Quantity;
  value: string | null;
}) {
  if (quantity) {
    return (
      <>
        <span className="font-medium text-main-black">{quantity.value}</span>
        {quantity.unit && (
          <span className="text-subtle-text"> {quantity.unit}</span>
        )}
      </>
    );
  }
  return <span className="font-medium text-main-black">{value ?? "-"}</span>;
}

/* -------------------------------------------------------------------------- */
/*                           Lab results and vitals                            */
/* -------------------------------------------------------------------------- */

interface Columns {
  trend: boolean;
  flag: boolean;
}

function MeasurementCard({
  groups,
  onOpen,
}: {
  groups: RecordGroup[];
  onOpen: OpenRecord;
}) {
  // Columns only appear when some row has something to put there, so a
  // vitals card without flags doesn't carry an empty gutter.
  const abnormal = (f: Flag) => !!f && f.tone !== "normal";
  const cols: Columns = {
    trend: groups.some((g) => g.readings.length > 1),
    flag: groups.some(
      (g) =>
        g.readings.some((r) => abnormal(r.summary.flag)) ||
        g.latest.summary.components.some((c) => abnormal(c.flag)),
    ),
  };
  return (
    <Card>
      {groups.map((g) => (
        <li key={g.key} className={ROW_ITEM}>
          <MeasurementGroup group={g} cols={cols} onOpen={onOpen} />
        </li>
      ))}
    </Card>
  );
}

function MeasurementCells({
  cols,
  trend,
  range,
  value,
  flag,
}: {
  cols: Columns;
  trend?: ReactNode;
  range: string | null;
  value: ReactNode;
  /** Flag text ("High", "1 flagged"): a badge on wide screens, inline text on phones. */
  flag: string | null;
}) {
  return (
    <>
      {cols.trend && (
        <span className="hidden w-24 shrink-0 justify-end text-xs text-subtle-text sm:flex">
          {trend}
        </span>
      )}
      {/* Value over its reference range, mirroring name over date. */}
      <span className="flex shrink-0 flex-col items-end gap-0.5 tabular-nums sm:w-32">
        <span className="text-sm">{value}</span>
        {range && <span className="text-xs text-subtle-text">{range}</span>}
        {flag && (
          <span className="text-xs font-medium text-warning sm:hidden">
            {flag}
          </span>
        )}
      </span>
      {cols.flag && (
        <span className="hidden w-24 shrink-0 justify-end sm:flex">
          {flag && <Badge variant="warning">{flag}</Badge>}
        </span>
      )}
    </>
  );
}

function Trend({ group }: { group: RecordGroup }) {
  const values = trendValues(group);
  if (values.length >= 3) {
    const flagged =
      group.latest.summary.flag && group.latest.summary.flag.tone !== "normal";
    return (
      <Sparkline values={values} width={72} height={22} warn={!!flagged} />
    );
  }
  if (group.readings.length < 2) return null;
  const [, prev] = alignDecimals(
    group.readings.map(
      (r) => r.summary.quantity?.value ?? r.summary.value ?? "",
    ),
  );
  return <span className="tabular-nums">prev {prev}</span>;
}

function MeasurementGroup({
  group,
  cols,
  onOpen,
}: {
  group: RecordGroup;
  cols: Columns;
  onOpen: OpenRecord;
}) {
  const [open, setOpen] = useState(false);
  const { latest, readings } = group;
  const s = latest.summary;
  const id = latest.record.record_id;
  const date = formatClinicalDate(s.date);

  // Panels (CBC, metabolic panel...): one row, expands to its members.
  if (s.components.length > 0) {
    const flagged = s.components.filter(
      (c) => c.flag && c.flag.tone !== "normal",
    ).length;
    return (
      <>
        <Row
          title={displayTitle(latest)}
          sub={date}
          expanded={open}
          onPress={() => setOpen((v) => !v)}
          trailing={
            <MeasurementCells
              cols={cols}
              range={null}
              value={
                <span className="text-subtle-text">
                  {s.components.length} results
                </span>
              }
              flag={flagged > 0 ? `${flagged} flagged` : null}
            />
          }
        />
        {open && (
          <ul className="border-t border-border bg-bg-grey/60">
            {s.components.map((c, i) => (
              <li key={i} className={ROW_ITEM}>
                <Row
                  nested
                  title={sentenceCaseTitle(shortTestName(c.title))}
                  onPress={() => onOpen(id)}
                  trailing={
                    <MeasurementCells
                      cols={cols}
                      range={c.range}
                      value={
                        <ValueText quantity={c.quantity} value={c.value} />
                      }
                      flag={flagLabel(c.flag)}
                    />
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </>
    );
  }

  // History rows share one precision and drop the range when it never
  // changed - repeating "4-5.6 %" on every line is noise.
  const aligned = alignDecimals(
    readings.map((r) => r.summary.quantity?.value ?? r.summary.value ?? ""),
  );
  const sameRange = readings.every((r) => r.summary.range === s.range);
  const cells = (item: RecordItem, i: number, nested = false) => {
    const q = item.summary.quantity;
    return (
      <MeasurementCells
        cols={cols}
        trend={!nested && i === 0 ? <Trend group={group} /> : undefined}
        range={nested && sameRange ? null : item.summary.range}
        value={
          <ValueText
            quantity={q ? { ...q, value: aligned[i] } : null}
            value={item.summary.value}
          />
        }
        flag={flagLabel(item.summary.flag)}
      />
    );
  };

  if (readings.length === 1) {
    return (
      <Row
        title={displayTitle(latest)}
        sub={date}
        onPress={() => onOpen(id)}
        trailing={cells(latest, 0)}
      />
    );
  }

  // Repeated test: latest value up front, history one click away.
  return (
    <>
      <Row
        title={displayTitle(latest)}
        sub={date}
        expanded={open}
        onPress={() => setOpen((v) => !v)}
        trailing={cells(latest, 0)}
      />
      {open && (
        <ul className="border-t border-border bg-bg-grey/60">
          {readings.map((r, i) => (
            <li key={r.record.record_id} className={ROW_ITEM}>
              <Row
                nested
                title={formatClinicalDate(r.summary.date)}
                onPress={() => onOpen(r.record.record_id)}
                trailing={cells(r, i, true)}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*                              Everything else                                */
/* -------------------------------------------------------------------------- */

function Aside({ children }: { children: ReactNode }) {
  return (
    <span className="hidden shrink-0 text-right text-sm text-secondary-text sm:block">
      {children}
    </span>
  );
}

function SimpleRow({
  item,
  type,
  onOpen,
}: {
  item: RecordItem;
  type: string;
  onOpen: OpenRecord;
}) {
  const s = item.summary;
  const open = () => onOpen(item.record.record_id);
  const status = notableStatus(s.status);

  switch (type) {
    case "condition": {
      const resolved = detail(item, "Resolved");
      const since =
        s.dateLabel === "Onset"
          ? resolved && /^\d{4}/.test(resolved)
            ? `${formatMonthYear(s.date)} to ${formatMonthYear(resolved)}`
            : `Since ${formatMonthYear(s.date)}`
          : `Recorded ${formatMonthYear(s.date)}`;
      return (
        <Row
          title={displayTitle(item)}
          sub={since}
          onPress={open}
          trailing={status && <Badge variant="neutral">{status}</Badge>}
        />
      );
    }
    case "medication": {
      const prescriber = detail(item, "Prescriber");
      return (
        <Row
          title={displayTitle(item)}
          sub={
            s.value && <span className="text-secondary-text">{s.value}</span>
          }
          onPress={open}
          trailing={
            <>
              {status && <Badge variant="neutral">{status}</Badge>}
              <Aside>{prescriber ?? `Since ${formatMonthYear(s.date)}`}</Aside>
            </>
          }
        />
      );
    }
    case "allergy": {
      const reaction = s.value?.replace(/^Reaction:\s*/, "");
      const severity = detail(item, "Severity")?.toLowerCase();
      return (
        <Row
          title={displayTitle(item)}
          sub={[reaction, severity].filter(Boolean).join(", ") || undefined}
          onPress={open}
          trailing={s.flag && <Badge variant="warning">{s.flag.label}</Badge>}
        />
      );
    }
    default: {
      const unavailable =
        item.record.fhir_resource_error === "fhir_resource_unavailable";
      return (
        <Row
          title={displayTitle(item)}
          sub={
            unavailable
              ? "Content not available from the health system"
              : undefined
          }
          onPress={open}
          trailing={
            <>
              {s.flag && s.flag.tone !== "normal" && (
                <Badge variant="warning">{s.flag.label}</Badge>
              )}
              <Aside>{formatClinicalDate(s.date)}</Aside>
            </>
          }
        />
      );
    }
  }
}
