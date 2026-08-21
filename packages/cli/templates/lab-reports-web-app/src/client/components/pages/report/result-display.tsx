/**
 * Rendering rules for a normalised lab result. `measurement` is a
 * discriminated union — always switch on `type`; a bounded "<0.04" is not a
 * number, a qualitative "Non-Reactive" gets a chip, never a range bar.
 */
import { TooltipTrigger, Focusable } from "react-aria-components";
import { Badge } from "../../shared/atoms/Badge";
import { Tooltip } from "../../shared/atoms/Tooltip";

export interface Measurement {
  type: string;
  numeric?: number;
  bounded?: { operator: "lt" | "gt"; value: number };
  qualitative?: { text?: string; code?: string };
  text?: string;
  absent_reason?: string;
  units?: string;
}

export interface Interpretation {
  flag: string | null;
  flag_raw?: string;
  source: string;
  applied_range?: { lower?: number; upper?: number };
}

/** Compact value text for any measurement type. */
export function measurementText(m: Measurement): string {
  switch (m.type) {
    case "numeric":
      return m.numeric != null ? String(m.numeric) : "-";
    case "bounded":
      return m.bounded
        ? `${m.bounded.operator === "lt" ? "<" : ">"} ${m.bounded.value}`
        : "-";
    case "qualitative":
      return m.qualitative?.text ?? m.qualitative?.code ?? "-";
    case "text":
      return m.text ?? "-";
    case "absent":
      return "-";
    default:
      return "-";
  }
}

export function ResultValue({ measurement: m }: { measurement: Measurement }) {
  if (m.type === "qualitative") {
    return <Badge variant="neutral">{measurementText(m)}</Badge>;
  }
  if (m.type === "absent") {
    return (
      <span className="text-sm text-subtle-text">
        {m.absent_reason ? `Not reported (${m.absent_reason})` : "-"}
      </span>
    );
  }
  return (
    <span className="text-main-black">
      {measurementText(m)}
      {m.units && m.type !== "text" ? (
        <span className="text-subtle-text"> {m.units}</span>
      ) : null}
    </span>
  );
}

const FLAG_VARIANT: Record<string, "emphasis" | "warning" | "neutral"> = {
  normal: "emphasis",
  high: "warning",
  low: "warning",
  critical_high: "warning",
  critical_low: "warning",
  borderline_high: "warning",
  borderline_low: "warning",
  abnormal: "warning",
};

const PROVENANCE_COPY: Record<string, string> = {
  report: "Flag printed on the lab report",
  computed: "Computed by Terra from the reference range",
};

/** Flag badge with provenance tooltip (report-printed vs Terra-computed). */
export function FlagBadge({
  interpretation: i,
}: {
  interpretation: Interpretation;
}) {
  // No flag → nothing. An em-dash badge on every unflagged row is noise.
  if (i.flag == null) return <span aria-hidden />;
  const label = i.flag.replaceAll("_", " ");
  const provenance = PROVENANCE_COPY[i.source];
  const badge = (
    <Badge variant={FLAG_VARIANT[i.flag] ?? "neutral"}>{label}</Badge>
  );
  if (!provenance) return badge;
  return (
    <TooltipTrigger delay={200} closeDelay={0}>
      <Focusable>
        <span role="presentation" className="inline-flex cursor-default">
          {badge}
        </span>
      </Focusable>
      <Tooltip>
        {provenance}
        {i.flag_raw ? ` (report printed "${i.flag_raw}")` : ""}
      </Tooltip>
    </TooltipTrigger>
  );
}

/**
 * Horizontal reference-range bar: in-range band on a wider track, dot at the
 * value (clamped to the track edges when far out of range). Only rendered
 * for numeric/bounded values with a resolved applied_range.
 */
export function RangeBar({
  measurement: m,
  interpretation: i,
}: {
  measurement: Measurement;
  interpretation: Interpretation;
}) {
  const range = i.applied_range;
  const value =
    m.type === "numeric"
      ? m.numeric
      : m.type === "bounded"
        ? m.bounded?.value
        : undefined;
  if (!range || value == null) return null;
  const { lower, upper } = range;
  if (lower == null && upper == null) return null;

  // Display domain: the range padded 40% each side; one-sided ranges use the
  // bound and the value to size a sensible window.
  const lo = lower ?? Math.min(value, upper as number);
  const hi = upper ?? Math.max(value, lower as number);
  const span = hi - lo || Math.abs(hi) * 0.2 || 1;
  const domainMin = lo - span * 0.4;
  const domainMax = hi + span * 0.4;
  const pct = (x: number) =>
    Math.min(98, Math.max(2, ((x - domainMin) / (domainMax - domainMin)) * 100));

  const inRange = i.flag === "normal" || i.flag == null;
  return (
    <div
      className="relative h-2.5 w-full max-w-40 rounded-full bg-bg-grey"
      aria-hidden
    >
      <div
        className="absolute inset-y-0 rounded-full bg-emphasis-bg ring-1 ring-emphasis-secondary ring-inset"
        style={{
          left: `${lower != null ? pct(lower) : 0}%`,
          right: `${upper != null ? 100 - pct(upper) : 0}%`,
        }}
      />
      <span
        className={`absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-sm ${
          inRange ? "bg-emphasis" : "bg-warning"
        }`}
        style={{ left: `${pct(value)}%` }}
      />
    </div>
  );
}
