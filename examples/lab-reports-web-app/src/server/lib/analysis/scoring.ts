/**
 * Pure scoring functions. Same inputs, same output — no clock, no I/O — so
 * the analysis is reproducible in front of an audience and unit-testable.
 *
 * Lab subscore: in range → 100; out of range decays with relative deviation
 * (how far past the bound, as a fraction of the range width). Flag-only
 * results (qualitative, or no resolved range) score 100/40 on the flag.
 * Wearable subscore: piecewise-linear interpolation over the configured
 * bands of the trailing-14-day mean.
 */
import type {
  DomainConfig,
  LabInputConfig,
  WearableInputConfig,
} from "./domains";
import type { LabReportResult } from "../terra/types";

export type Severity = "normal" | "mild" | "marked";

/** Where a contribution's underlying metric lives — used to link to trends. */
export type ContributionRef =
  | { type: "lab"; biomarkerKey: string }
  | { type: "wearable"; metric: string };

export interface Contribution {
  kind: "lab" | "wearable";
  /** Deep-link target for this metric's trend view. */
  ref?: ContributionRef;
  label: string;
  valueText: string;
  /** Reference range (lab) or observation window (wearable). */
  detailText: string;
  subscore: number;
  weight: number;
  severity: Severity;
  /** Lab flag word for narrative ("high"/"low"), when applicable. */
  flag?: string;
  /** Lab flag provenance: report | computed. */
  provenance?: string;
  /** True when the subscore came from guideline cutoffs, not the report. */
  guideline?: boolean;
}

export interface DomainScore {
  key: string;
  label: string;
  description: string;
  score: number | null;
  status: "Good" | "Fair" | "Poor" | "Insufficient data";
  contributions: Contribution[];
}

const ABNORMAL_FLAGS = new Set([
  "high",
  "low",
  "critical_high",
  "critical_low",
  "borderline_high",
  "borderline_low",
  "abnormal",
]);

export function scoreStatus(score: number | null): DomainScore["status"] {
  if (score == null) return "Insufficient data";
  if (score >= 70) return "Good";
  if (score >= 40) return "Fair";
  return "Poor";
}

/** Same boundaries as the domain status (≥70 Good / ≥40 Fair). */
function labSeverity(subscore: number): Severity {
  if (subscore >= 70) return "normal";
  if (subscore >= 40) return "mild";
  return "marked";
}

/** Subscore for one lab result against its resolved range/flag. */
export function scoreLabResult(result: LabReportResult): number | null {
  const { measurement: m, interpretation: i } = result;
  const range = i.applied_range;
  const value =
    m.type === "numeric"
      ? m.numeric
      : m.type === "bounded"
        ? m.bounded?.value
        : undefined;

  if (
    value != null &&
    range &&
    (range.lower != null || range.upper != null)
  ) {
    const { lower, upper } = range;
    if ((lower == null || value >= lower) && (upper == null || value <= upper)) {
      return 100;
    }
    const nearest = value < (lower ?? -Infinity) ? lower! : upper!;
    const width =
      lower != null && upper != null
        ? upper - lower
        : Math.max(Math.abs(nearest), 1);
    const relativeDeviation = Math.abs(value - nearest) / (width || 1);
    return Math.max(0, Math.round(70 - 60 * relativeDeviation));
  }

  // No usable numeric/range — fall back to the flag alone.
  if (i.flag == null) return null;
  return ABNORMAL_FLAGS.has(i.flag) ? 40 : 100;
}

export function labValueText(result: LabReportResult): string {
  const m = result.measurement;
  const unit = m.units ? ` ${m.units}` : "";
  switch (m.type) {
    case "numeric":
      return `${m.numeric}${unit}`;
    case "bounded":
      return m.bounded
        ? `${m.bounded.operator === "lt" ? "<" : ">"}${m.bounded.value}${unit}`
        : "—";
    case "qualitative":
      return m.qualitative?.text ?? m.qualitative?.code ?? "—";
    case "text":
      return m.text ?? "—";
    default:
      return "—";
  }
}

export function labRangeText(result: LabReportResult): string {
  const r = result.interpretation.applied_range;
  if (r && (r.lower != null || r.upper != null)) {
    return `${r.lower ?? 0}–${r.upper ?? "∞"}`;
  }
  return result.source.reference_text ?? "";
}

const normalizeUnit = (u: string | undefined) =>
  (u ?? "").toLowerCase().replace(/\s/g, "");

/**
 * Guideline-cutoff fallback for reports that print no reference range and no
 * flag. Only applies when the measurement's units match the configured ones.
 */
function guidelineSubscore(
  config: LabInputConfig,
  result: LabReportResult,
): number | null {
  if (!config.bands || !config.bandsUnit) return null;
  const m = result.measurement;
  const value =
    m.type === "numeric"
      ? m.numeric
      : m.type === "bounded"
        ? m.bounded?.value
        : undefined;
  if (value == null) return null;
  if (normalizeUnit(m.units) !== normalizeUnit(config.bandsUnit)) return null;
  return interpolateBands(config.bands, value);
}

export function labContribution(
  config: LabInputConfig,
  result: LabReportResult,
  biomarkerKey?: string,
): Contribution | null {
  let subscore = scoreLabResult(result);
  let guideline = false;
  if (subscore == null) {
    subscore = guidelineSubscore(config, result);
    guideline = subscore != null;
  }
  if (subscore == null) return null;
  const flag = result.interpretation.flag;
  const flagged = flag != null && ABNORMAL_FLAGS.has(flag);
  let severity = labSeverity(subscore);
  // A lab-flagged result is never presented as "normal", however close the
  // value sits to its bound.
  if (flagged && severity === "normal") severity = "mild";
  return {
    kind: "lab",
    ref: biomarkerKey ? { type: "lab", biomarkerKey } : undefined,
    label: config.label,
    valueText: labValueText(result),
    detailText: guideline ? "" : labRangeText(result),
    subscore,
    weight: config.weight,
    severity,
    flag: flagged ? flag : undefined,
    guideline: guideline || undefined,
    provenance:
      result.interpretation.source === "computed"
        ? "computed from the reference range"
        : result.interpretation.source === "report"
          ? "flagged on the lab report"
          : guideline
            ? "guideline cutoffs — the report printed no range"
            : undefined,
  };
}

/** Piecewise-linear interpolation over sorted (value, subscore) points. */
export function interpolateBands(
  bands: Array<[number, number]>,
  value: number,
): number {
  if (bands.length === 0) return 0;
  if (value <= bands[0][0]) return bands[0][1];
  const last = bands[bands.length - 1];
  if (value >= last[0]) return last[1];
  for (let i = 1; i < bands.length; i++) {
    const [x0, y0] = bands[i - 1];
    const [x1, y1] = bands[i];
    if (value <= x1) {
      const t = (value - x0) / (x1 - x0 || 1);
      return Math.round(y0 + t * (y1 - y0));
    }
  }
  return last[1];
}

export function wearableContribution(
  config: WearableInputConfig,
  points: Array<{ date: string; value: number }>,
  windowDays = 14,
): Contribution | null {
  const recent = points.slice(-windowDays);
  if (recent.length === 0) return null;
  const mean = recent.reduce((sum, p) => sum + p.value, 0) / recent.length;
  const subscore = interpolateBands(config.bands, mean);
  const rounded =
    mean >= 100
      ? Math.round(mean).toLocaleString("en")
      : String(Math.round(mean * 10) / 10);
  return {
    kind: "wearable",
    ref: { type: "wearable", metric: config.metric },
    label: config.label,
    valueText: `${rounded} ${config.unit}`.trim(),
    detailText: `last ${recent.length} days`,
    subscore,
    weight: config.weight,
    severity: subscore >= 70 ? "normal" : subscore >= 40 ? "mild" : "marked",
  };
}

/** Weighted domain roll-up. */
export function scoreDomain(
  domain: DomainConfig,
  contributions: Contribution[],
): DomainScore {
  const minInputs = domain.minInputs ?? 2;
  let score: number | null = null;
  if (contributions.length >= minInputs) {
    const totalWeight = contributions.reduce((s, c) => s + c.weight, 0);
    score = Math.round(
      contributions.reduce((s, c) => s + c.subscore * c.weight, 0) /
        (totalWeight || 1),
    );
  }
  return {
    key: domain.key,
    label: domain.label,
    description: domain.description,
    score,
    status: scoreStatus(score),
    contributions,
  };
}
