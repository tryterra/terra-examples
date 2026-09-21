import type { ScoreField } from "./types";

/** Scores where a v2 variant replaces the base — if v2 is present, drop the base. */
export const V2_UPGRADES: Partial<Record<ScoreField, ScoreField>> = {
  sleep_score: "sleep_score_v2",
  total_stress_score: "total_stress_score_v2",
  respiratory_score: "respiratory_score_v2",
};

/** Filters out base variants when their v2 replacement is present. */
export function deduplicateV2Scores(entries: [ScoreField, number][]) {
  const keys = new Set(entries.map(([k]) => k));
  return entries.filter(([key]) => {
    const v2Key = V2_UPGRADES[key];
    return !(v2Key && keys.has(v2Key));
  });
}
