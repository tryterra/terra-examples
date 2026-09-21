import type { InferResponseType } from "hono/client";
import { api } from "@/client/lib/api";

export type TrendsResponse = InferResponseType<
  typeof api.api.terra.trends.$get,
  200
>;

export type TrendsAvailableResponse = InferResponseType<
  typeof api.api.terra.trends.available.$get,
  200
>;
