import type { InferResponseType } from "hono/client";
import { api } from "@/client/lib/api";

export type DashboardResponse = InferResponseType<
  typeof api.api.terra.dashboard.$get,
  200
>;

type ActivitiesResponse = InferResponseType<
  typeof api.api.terra.dashboard.activities.$get,
  200
>;
export type Activity = ActivitiesResponse["activities"][number];
type Scores = NonNullable<DashboardResponse["scores"]>;
export type ScoreField =
  | keyof NonNullable<Scores["daily"]>
  | keyof NonNullable<Scores["sleep"]>;
export type BiomarkerKey = keyof NonNullable<DashboardResponse["biomarkers"]>;
