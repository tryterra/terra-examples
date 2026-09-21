/**
 * TanStack Query definitions over the typed Hono RPC client. Response types
 * are inferred from the server route chain — no hand-written DTOs.
 */
import { queryOptions } from "@tanstack/react-query";
import type { InferResponseType } from "hono/client";
import { api, unwrap } from "./api";

export type PatientsOk = InferResponseType<typeof api.api.patients.$get, 200>;
export type PatientRow = PatientsOk["patients"][number];

export const patientsQuery = queryOptions({
  queryKey: ["patients"],
  queryFn: async () => unwrap<PatientsOk>(await api.api.patients.$get()),
  staleTime: 30_000,
});

export type PatientOk = InferResponseType<
  (typeof api.api.patients)[":id"]["$get"],
  200
>;

export const patientQuery = (id: string) =>
  queryOptions({
    queryKey: ["patients", id],
    queryFn: async () =>
      unwrap<PatientOk>(await api.api.patients[":id"].$get({ param: { id } })),
    staleTime: 30_000,
  });

export type LabReportsOk = InferResponseType<
  (typeof api.api.patients)[":id"]["lab-reports"]["$get"],
  200
>;
export type SessionSummary = LabReportsOk["sessions"][number];

export const labReportsQuery = (patientId: string) =>
  queryOptions({
    queryKey: ["lab-reports", patientId],
    queryFn: async () =>
      unwrap<LabReportsOk>(
        await api.api.patients[":id"]["lab-reports"].$get({
          param: { id: patientId },
        }),
      ),
    staleTime: 30_000,
  });

export type SessionOk = InferResponseType<
  (typeof api.api)["lab-reports"][":sessionId"]["$get"],
  200
>;

export const sessionQuery = (sessionId: string) =>
  queryOptions({
    queryKey: ["session", sessionId],
    queryFn: async () =>
      unwrap<SessionOk>(
        await api.api["lab-reports"][":sessionId"].$get({
          param: { sessionId },
        }),
      ),
    // Terminal sessions are immutable — cache generously.
    staleTime: 10 * 60_000,
  });

export type SessionFilesOk = InferResponseType<
  (typeof api.api)["lab-reports"][":sessionId"]["files"]["$get"],
  200
>;

export const sessionFilesQuery = (sessionId: string) =>
  queryOptions({
    queryKey: ["session-files", sessionId],
    queryFn: async () =>
      unwrap<SessionFilesOk>(
        await api.api["lab-reports"][":sessionId"].files.$get({
          param: { sessionId },
        }),
      ),
    // Presigned URLs expire — don't reuse stale ones.
    staleTime: 0,
    gcTime: 0,
  });

export type LabTrendsOk = InferResponseType<
  (typeof api.api.patients)[":id"]["lab-trends"]["$get"],
  200
>;
export type BiomarkerTrend = LabTrendsOk["trends"][number];

export const labTrendsQuery = (patientId: string) =>
  queryOptions({
    queryKey: ["lab-trends", patientId],
    queryFn: async () =>
      unwrap<LabTrendsOk>(
        await api.api.patients[":id"]["lab-trends"].$get({
          param: { id: patientId },
        }),
      ),
    staleTime: 5 * 60_000,
  });

export type WearablesOk = InferResponseType<
  (typeof api.api.patients)[":id"]["wearables"]["$get"],
  200
>;

export interface WearableRange {
  /** Trailing days, or "full" for everything since the first recorded day. */
  days?: number | "full";
  start?: string; // YYYY-MM-DD
  end?: string; // YYYY-MM-DD
}

export const wearablesQuery = (
  patientId: string,
  range: WearableRange = { days: 30 },
) =>
  queryOptions({
    queryKey: ["wearables", patientId, range],
    queryFn: async () =>
      unwrap<WearablesOk>(
        await api.api.patients[":id"].wearables.$get({
          param: { id: patientId },
          query:
            range.start && range.end
              ? { start: range.start, end: range.end }
              : { days: String(range.days ?? 30) },
        }),
      ),
    staleTime: 5 * 60_000,
  });

export type AnalysisOk = InferResponseType<
  (typeof api.api.patients)[":id"]["analysis"]["$get"],
  200
>;

export const analysisQuery = (patientId: string) =>
  queryOptions({
    queryKey: ["analysis", patientId],
    queryFn: async () =>
      unwrap<AnalysisOk>(
        await api.api.patients[":id"].analysis.$get({
          param: { id: patientId },
        }),
      ),
    staleTime: 5 * 60_000,
  });

export type AiOverviewOk = InferResponseType<
  (typeof api.api.patients)[":id"]["ai"]["overview"]["$get"],
  200
>;

export const aiOverviewQuery = (patientId: string) =>
  queryOptions({
    queryKey: ["ai-overview", patientId],
    queryFn: async () =>
      unwrap<AiOverviewOk>(
        await api.api.patients[":id"].ai.overview.$get({
          param: { id: patientId },
        }),
      ),
    staleTime: 5 * 60_000,
    retry: false, // generation is expensive — surface errors, don't hammer
  });

export type UploadStatusOk = InferResponseType<
  (typeof api.api.uploads)[":uploadId"]["$get"],
  200
>;

export const uploadStatusQuery = (uploadId: string) =>
  queryOptions({
    queryKey: ["upload", uploadId],
    queryFn: async () =>
      unwrap<UploadStatusOk>(
        await api.api.uploads[":uploadId"].$get({ param: { uploadId } }),
      ),
    refetchInterval: (query) => (query.state.data?.done ? false : 4000),
  });

export type FlagInsightOk = InferResponseType<
  (typeof api.api.patients)[":id"]["flag-insight"]["$get"],
  200
>;
export type FlagInsight = Extract<
  FlagInsightOk,
  { enabled: true }
>["insight"];

export const flagInsightQuery = (patientId: string, biomarkerKey: string) =>
  queryOptions({
    queryKey: ["flag-insight", patientId, biomarkerKey],
    queryFn: async () =>
      unwrap<FlagInsightOk>(
        await api.api.patients[":id"]["flag-insight"].$get({
          param: { id: patientId },
          query: { biomarker: biomarkerKey },
        }),
      ),
    staleTime: 10 * 60_000,
    retry: false,
  });

export type DrawContextOk = InferResponseType<
  (typeof api.api.patients)[":id"]["draw-context"]["$get"],
  200
>;
export type DrawContext = DrawContextOk["contexts"][number];

export const drawContextQuery = (patientId: string) =>
  queryOptions({
    queryKey: ["draw-context", patientId],
    queryFn: async () =>
      unwrap<DrawContextOk>(
        await api.api.patients[":id"]["draw-context"].$get({
          param: { id: patientId },
        }),
      ),
    staleTime: 5 * 60_000,
  });

export interface Watchlist {
  biomarkers: string[];
  metrics: string[];
}

export function parseWatchlist(raw: string | null | undefined): Watchlist {
  if (!raw) return { biomarkers: [], metrics: [] };
  try {
    const parsed = JSON.parse(raw) as Partial<Watchlist>;
    return {
      biomarkers: Array.isArray(parsed.biomarkers) ? parsed.biomarkers : [],
      metrics: Array.isArray(parsed.metrics) ? parsed.metrics : [],
    };
  } catch {
    return { biomarkers: [], metrics: [] };
  }
}

export async function saveWatchlist(patientId: string, watchlist: Watchlist) {
  return unwrap(
    await api.api.patients[":id"].watchlist.$put({
      param: { id: patientId },
      json: watchlist,
    }),
  );
}

export type HealthOk = InferResponseType<typeof api.api.health.$get, 200>;

/** Server mode flags: demo (no Terra creds) and ai (Anthropic key present). */
export const healthQuery = queryOptions({
  queryKey: ["health"],
  queryFn: async () => unwrap<HealthOk>(await api.api.health.$get()),
  staleTime: Infinity,
});
