/**
 * Longitudinal assessment per biomarker: chronicity (abnormal since when,
 * across how many consecutive draws), trajectory shape, and the personal
 * baseline. Deterministic, judged the same way the score engine judges
 * values (report flag when printed, guideline bands otherwise) — the point
 * is that "LDL 141, elevated in every draw since Sep 2022" reads completely
 * differently to a physician than "LDL 141, first abnormal draw".
 */
import { DOMAINS, type LabInputConfig } from "./domains";
import { interpolateBands } from "./scoring";
import { getBiomarkerTrends } from "../lab-trends";

const normalizeUnit = (u: string | undefined) =>
  (u ?? "").toLowerCase().replace(/\s/g, "");

/** biomarkerKey → lab config (first registry match wins). */
const CONFIG_BY_KEY = new Map<string, LabInputConfig>();
for (const domain of DOMAINS) {
  for (const input of domain.labInputs) {
    for (const key of input.biomarkerKeys) {
      if (!CONFIG_BY_KEY.has(key)) CONFIG_BY_KEY.set(key, input);
    }
  }
}

export type Chronicity = "chronic" | "recurrent" | "new" | "insufficient";
export type Trajectory = "rising" | "falling" | "stable" | "fluctuating";

export interface LabHistoryAssessment {
  biomarkerKey: string;
  label: string;
  unit: string;
  totalDraws: number;
  /** Most recent draw that could be judged at all (some reports print no
   *  ranges, leaving newer values unjudgeable). */
  lastJudged: { date: string; value: number; abnormal: boolean } | null;
  /** First-ever measurement — the personal baseline. */
  baseline: { date: string; value: number };
  latest: { date: string; value: number };
  /** Latest vs baseline, percent (positive = higher than baseline). */
  changeFromBaselinePct: number | null;
  chronicity: Chronicity;
  /** First draw of the current consecutive abnormal run, when chronic. */
  abnormalSince: string | null;
  consecutiveAbnormal: number;
  trajectory: Trajectory;
  /** History span in years, first to latest draw. */
  spanYears: number;
}

/** abnormal / normal / unknown for one historical point. */
function judge(
  value: number,
  flag: string | null,
  unit: string,
  config: LabInputConfig | undefined,
): "abnormal" | "normal" | "unknown" {
  if (flag === "high" || flag === "low") return "abnormal";
  if (flag === "normal") return "normal";
  if (
    config?.bands &&
    config.bandsUnit &&
    normalizeUnit(unit) === normalizeUnit(config.bandsUnit)
  ) {
    // Same threshold the engine uses: subscore ≥ 70 reads as normal.
    return interpolateBands(config.bands, value) >= 70
      ? "normal"
      : "abnormal";
  }
  return "unknown";
}

function classifyTrajectory(values: number[]): Trajectory {
  if (values.length < 3) return "stable";
  const mean = values.reduce((a, v) => a + v, 0) / values.length;
  const range = Math.max(...values) - Math.min(...values);
  if (mean !== 0 && range / Math.abs(mean) < 0.075) return "stable";
  const tolerance = Math.abs(mean) * 0.02;
  const nonDecreasing = values.every(
    (v, i) => i === 0 || v >= values[i - 1] - tolerance,
  );
  const nonIncreasing = values.every(
    (v, i) => i === 0 || v <= values[i - 1] + tolerance,
  );
  if (nonDecreasing && !nonIncreasing) return "rising";
  if (nonIncreasing && !nonDecreasing) return "falling";
  return "fluctuating";
}

export async function assessLabHistory(
  referenceId: string,
): Promise<Record<string, LabHistoryAssessment>> {
  const trends = await getBiomarkerTrends(referenceId);
  const out: Record<string, LabHistoryAssessment> = {};
  for (const t of trends) {
    if (t.points.length < 2) continue;
    const config = CONFIG_BY_KEY.get(t.key);
    const judged = t.points.map((p) =>
      judge(p.value, p.flag, t.unit, config),
    );

    let lastJudged: LabHistoryAssessment["lastJudged"] = null;
    for (let i = judged.length - 1; i >= 0; i--) {
      if (judged[i] !== "unknown") {
        lastJudged = {
          date: t.points[i].date,
          value: t.points[i].value,
          abnormal: judged[i] === "abnormal",
        };
        break;
      }
    }

    // Consecutive abnormal run ending at the latest draw (unknowns break it).
    let run = 0;
    for (let i = judged.length - 1; i >= 0 && judged[i] === "abnormal"; i--) {
      run++;
    }
    const earlierAbnormal = judged
      .slice(0, judged.length - run)
      .some((j) => j === "abnormal");
    const chronicity: Chronicity =
      run === 0
        ? "insufficient"
        : run >= 2
          ? "chronic"
          : earlierAbnormal
            ? "recurrent"
            : judged.length >= 2
              ? "new"
              : "insufficient";

    const baseline = t.points[0];
    const latest = t.points[t.points.length - 1];
    const spanYears =
      (new Date(latest.date).getTime() - new Date(baseline.date).getTime()) /
      31_557_600_000;

    out[t.key] = {
      biomarkerKey: t.key,
      label: t.displayName,
      unit: t.unit,
      totalDraws: t.points.length,
      lastJudged,
      baseline: { date: baseline.date, value: baseline.value },
      latest: { date: latest.date, value: latest.value },
      changeFromBaselinePct:
        baseline.value !== 0
          ? Math.round(
              ((latest.value - baseline.value) / Math.abs(baseline.value)) *
                100,
            )
          : null,
      chronicity,
      abnormalSince:
        run > 0 ? t.points[t.points.length - run].date : null,
      consecutiveAbnormal: run,
      trajectory: classifyTrajectory(t.points.map((p) => p.value)),
      spanYears: Math.round(spanYears * 10) / 10,
    };
  }
  return out;
}
