import type { Terra as BaseTerra } from "terra-api";

/**
 * Temporary extensions to Terra SDK types to match v6 proto fields
 * not yet in the SDK (which aligns with v5). Remove this file once
 * the SDK is updated and change imports back to "terra-api".
 * See docs/terra-score-fields.md for the full comparison.
 */

/**
 * Proto `map<string, float>` — the v6 proto uses flat key→score maps
 * for all contributor fields. The SDK's `DataContributor[]` is stale.
 */
export type ScoreContributors = Record<string, number>;

type DailyContributorKeys =
  | "cardiovascular_contributors"
  | "immune_contributors"
  | "readiness_contributors"
  | "respiratory_contributors"
  | "stress_contributors";

export interface DailyDataEnrichment extends Omit<
  BaseTerra.DailyDataEnrichment,
  DailyContributorKeys
> {
  cardiovascular_contributors?: ScoreContributors;
  immune_contributors?: ScoreContributors;
  readiness_contributors?: ScoreContributors;
  respiratory_contributors?: ScoreContributors;
  stress_contributors?: ScoreContributors;
  resilience_score?: number;
  resilience_contributors?: ScoreContributors;
  strain_index?: number;
  strain_traffic_light?: string;
  strain_contributors?: ScoreContributors;
  total_stress_score_v2?: number;
  total_stress_score_v2_contributors?: ScoreContributors;
}

export interface SleepDataEnrichment extends Omit<
  BaseTerra.SleepDataEnrichment,
  "sleep_contributors"
> {
  sleep_contributors?: ScoreContributors;
  readiness_score?: number;
  readiness_contributors?: ScoreContributors;
  sleep_score_v2?: number;
  sleep_score_v2_contributors?: ScoreContributors;
  respiratory_score_v2?: number;
  respiratory_score_v2_contributors?: ScoreContributors;
}

export interface ActivityDataEnrichment extends BaseTerra.DataEnrichment {
  efficiency_score?: number;
  efficiency_contributors?: ScoreContributors;
  strain_score?: number;
  strain_contributors?: ScoreContributors;
  rcrs_score?: number;
  rcrs_contributors?: ScoreContributors;
  trimp_score?: number;
  trimp_contributors?: ScoreContributors;
}

// Re-export as Terra namespace so consumers use Terra.Daily, Terra.Sleep, etc.
// When the SDK catches up, just swap the import back to "terra-api".
export declare namespace Terra {
  interface Daily extends Omit<BaseTerra.Daily, "data_enrichment"> {
    data_enrichment?: DailyDataEnrichment;
  }
  interface Sleep extends Omit<BaseTerra.Sleep, "data_enrichment"> {
    data_enrichment?: SleepDataEnrichment;
  }
  interface Activity extends Omit<BaseTerra.Activity, "data_enrichment"> {
    data_enrichment?: ActivityDataEnrichment;
  }
  type Body = BaseTerra.Body;
  type Nutrition = BaseTerra.Nutrition;
  type Menstruation = BaseTerra.Menstruation;
}
