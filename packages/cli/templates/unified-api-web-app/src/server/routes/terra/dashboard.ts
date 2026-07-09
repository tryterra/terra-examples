import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import {
  terraActivity,
  terraConnection,
  terraDaily,
  terraSleep,
} from "../../../../db/schema";
import type { AuthSession, AuthUser, Env } from "../../lib/auth";
import { createDb } from "../../lib/db";
import {
  getHighestPriorityProvider,
  getProviderRank,
  sortByProviderPriority,
} from "../../lib/terra/provider-priority";
import { requireAuth } from "../../middleware/auth";

/* -------------------------------------------------------------------------- */
/*                                   Helpers                                  */
/* -------------------------------------------------------------------------- */

function timeOverlapPercent(
  a: { startTime: string; endTime: string },
  b: { startTime: string; endTime: string },
): number {
  const aStart = new Date(a.startTime).getTime();
  const aEnd = new Date(a.endTime).getTime();
  const bStart = new Date(b.startTime).getTime();
  const bEnd = new Date(b.endTime).getTime();
  const overlapStart = Math.max(aStart, bStart);
  const overlapEnd = Math.min(aEnd, bEnd);
  if (overlapEnd <= overlapStart) return 0;
  const overlap = overlapEnd - overlapStart;
  const shorter = Math.min(aEnd - aStart, bEnd - bStart);
  return shorter > 0 ? overlap / shorter : 0;
}

type ConnectionRow = Pick<
  typeof terraConnection.$inferSelect,
  "id" | "provider" | "status"
>;

type MergedActivity = {
  type: "activity" | "sleep";
  activityType: (typeof terraActivity.$inferSelect)["activityType"];
  startTime: string;
  endTime: string;
  distance: number | null;
  provider: ConnectionRow["provider"];
};

function deduplicateActivities(items: MergedActivity[]): MergedActivity[] {
  const result: MergedActivity[] = [];
  for (const item of items) {
    const existingIdx = result.findIndex(
      (existing) =>
        existing.type === item.type &&
        existing.activityType === item.activityType &&
        timeOverlapPercent(existing, item) > 0.8,
    );
    if (existingIdx < 0) {
      result.push(item);
    } else {
      const category = item.type === "sleep" ? "sleep" : "activity";
      const existingRank = getProviderRank(
        result[existingIdx].provider,
        category,
      );
      const newRank = getProviderRank(item.provider, category);
      if (newRank < existingRank) {
        result[existingIdx] = item;
      }
    }
  }
  return result;
}

type DailyRow = Pick<
  typeof terraDaily.$inferSelect,
  | "terraConnectionId"
  | "steps"
  | "restingHrBpm"
  | "avgHrvSdnn"
  | "vo2max"
  | "activeSeconds"
>;
type SleepRow = Pick<
  typeof terraSleep.$inferSelect,
  "terraConnectionId" | "startTime" | "endTime"
>;
type ProviderMap = Map<ConnectionRow["id"], ConnectionRow["provider"]>;

function pickBestBiomarkers(
  dailyRows: DailyRow[],
  latestSleep: SleepRow | null,
  providerMap: ProviderMap,
) {
  const bestFromDaily = (
    extract: (data: DailyRow) => number | undefined | null,
  ): { value: number; provider: string } | null => {
    for (const row of dailyRows) {
      const v = extract(row);
      if (v != null)
        return { value: v, provider: providerMap.get(row.terraConnectionId)! };
    }
    return null;
  };

  const sleepMinutes = latestSleep
    ? Math.round(
        (latestSleep.endTime.getTime() - latestSleep.startTime.getTime()) /
          60_000,
      )
    : null;

  return {
    lastSleep:
      sleepMinutes != null
        ? {
            value: sleepMinutes,
            provider: providerMap.get(latestSleep!.terraConnectionId)!,
          }
        : null,
    steps: bestFromDaily((d) => d.steps),
    rhr: bestFromDaily((d) => d.restingHrBpm),
    hrv: bestFromDaily((d) => d.avgHrvSdnn),
    vo2Max: bestFromDaily((d) => d.vo2max),
    activeHours: bestFromDaily((d) =>
      d.activeSeconds != null ? d.activeSeconds / 3600 : null,
    ),
  };
}

/* -------------------------------------------------------------------------- */
/*                                    Route                                   */
/* -------------------------------------------------------------------------- */

const ACTIVITIES_PAGE_SIZE = 5;

const terraDashboard = new Hono<{
  Bindings: Env;
  Variables: { user: AuthUser; session: AuthSession };
}>()
  .get(
    "/",
    requireAuth,
    zValidator(
      "query",
      z.object({
        scoreConnectionId: z.string().uuid().optional(),
        date: z.iso.date().optional(),
      }),
    ),
    async (c) => {
      try {
        const db = createDb(c.env.DATABASE_URL);
        const userId = c.get("user").id;
        const { scoreConnectionId, date } = c.req.valid("query");

        const userConnections = await db
          .select({
            id: terraConnection.id,
            provider: terraConnection.provider,
            status: terraConnection.status,
          })
          .from(terraConnection)
          .where(
            and(
              eq(terraConnection.userId, userId),
              inArray(terraConnection.status, ["active", "error"]),
            ),
          );

        if (userConnections.length === 0) {
          return c.json({
            connected: false as const,
            connections: [] as ConnectionRow[],
            scores: null,
            biomarkers: null,
          });
        }

        const connectionIds = userConnections.map((conn) => conn.id);
        const providerMap = new Map(
          userConnections.map((conn) => [conn.id, conn.provider]),
        );
        const connections = userConnections.map((conn) => ({
          id: conn.id,
          provider: conn.provider,
          status: conn.status,
        }));

        const requestedDate = date ?? new Date().toISOString().slice(0, 10);

        const dailyDateFilter = and(
          inArray(terraDaily.terraConnectionId, connectionIds),
          eq(terraDaily.date, requestedDate),
        );

        const [sleepRows, dailyRows] = await Promise.all([
          db
            .select({
              terraConnectionId: terraSleep.terraConnectionId,
              startTime: terraSleep.startTime,
              endTime: terraSleep.endTime,
              sleepScore: terraSleep.sleepScore,
              sleepScoreV2: terraSleep.sleepScoreV2,
              readinessScore: terraSleep.readinessScore,
              respiratoryScoreV2: terraSleep.respiratoryScoreV2,
            })
            .from(terraSleep)
            .where(inArray(terraSleep.terraConnectionId, connectionIds))
            .orderBy(desc(terraSleep.startTime))
            .limit(5),
          db
            .select({
              terraConnectionId: terraDaily.terraConnectionId,
              date: terraDaily.date,
              steps: terraDaily.steps,
              restingHrBpm: terraDaily.restingHrBpm,
              avgHrvSdnn: terraDaily.avgHrvSdnn,
              vo2max: terraDaily.vo2max,
              activeSeconds: terraDaily.activeSeconds,
              totalStressScore: terraDaily.totalStressScore,
              totalStressScoreV2: terraDaily.totalStressScoreV2,
              strainIndex: terraDaily.strainIndex,
              strainTrafficLight: terraDaily.strainTrafficLight,
              resilienceScore: terraDaily.resilienceScore,
              cardiovascularScore: terraDaily.cardiovascularScore,
              immuneIndex: terraDaily.immuneIndex,
              respiratoryScore: terraDaily.respiratoryScore,
              stressContributors: terraDaily.stressContributors,
              strainContributors: terraDaily.strainContributors,
            })
            .from(terraDaily)
            .where(dailyDateFilter)
            .orderBy(desc(terraDaily.date))
            .limit(connectionIds.length),
        ]);

        /* --------------------------------- Scores --------------------------------- */

        const validScoreConnectionId =
          scoreConnectionId && connectionIds.includes(scoreConnectionId)
            ? scoreConnectionId
            : (() => {
                const providers = userConnections.map((c) => c.provider);
                const best = getHighestPriorityProvider(providers, "daily");
                return best
                  ? (userConnections.find((c) => c.provider === best)?.id ??
                      null)
                  : null;
              })();

        const scoreDaily = validScoreConnectionId
          ? dailyRows.find(
              (r) => r.terraConnectionId === validScoreConnectionId,
            )
          : dailyRows[0];

        const scoreSleep = validScoreConnectionId
          ? sleepRows.find(
              (r) => r.terraConnectionId === validScoreConnectionId,
            )
          : sleepRows[0];

        const scores =
          scoreDaily || scoreSleep
            ? {
                connectionId: (scoreDaily ?? scoreSleep)!.terraConnectionId,
                daily: scoreDaily
                  ? {
                      total_stress_score: scoreDaily.totalStressScore,
                      total_stress_score_v2: scoreDaily.totalStressScoreV2,
                      strain_index: scoreDaily.strainIndex,
                      strain_traffic_light: scoreDaily.strainTrafficLight,
                      resilience_score: scoreDaily.resilienceScore,
                      cardiovascular_score: scoreDaily.cardiovascularScore,
                      immune_index: scoreDaily.immuneIndex,
                      respiratory_score: scoreDaily.respiratoryScore,
                      stress_contributors: scoreDaily.stressContributors,
                      strain_contributors: scoreDaily.strainContributors,
                    }
                  : null,
                sleep: scoreSleep
                  ? {
                      sleep_score: scoreSleep.sleepScore,
                      sleep_score_v2: scoreSleep.sleepScoreV2,
                      readiness_score: scoreSleep.readinessScore,
                      respiratory_score_v2: scoreSleep.respiratoryScoreV2,
                    }
                  : null,
              }
            : null;

        /* ------------------------------- Biomarkers ------------------------------- */

        const prioritizedDaily = sortByProviderPriority(
          dailyRows,
          (row) => providerMap.get(row.terraConnectionId)!,
          "daily",
        );
        const prioritizedSleep = sortByProviderPriority(
          sleepRows,
          (row) => providerMap.get(row.terraConnectionId)!,
          "sleep",
        );

        const biomarkers = pickBestBiomarkers(
          prioritizedDaily,
          prioritizedSleep[0] ?? null,
          providerMap,
        );

        return c.json({
          connected: true as const,
          connections,
          scores,
          biomarkers,
        });
      } catch (error) {
        console.error("Terra dashboard fetch error:", error);
        return c.json({ error: "Failed to load health data" }, 502);
      }
    },
  )
  .get(
    "/activities",
    requireAuth,
    zValidator(
      "query",
      z.object({ offset: z.coerce.number().int().min(0).default(0) }),
    ),
    async (c) => {
      try {
        const db = createDb(c.env.DATABASE_URL);
        const userId = c.get("user").id;
        const { offset } = c.req.valid("query");

        const userConnections = await db
          .select({
            id: terraConnection.id,
            provider: terraConnection.provider,
          })
          .from(terraConnection)
          .where(
            and(
              eq(terraConnection.userId, userId),
              inArray(terraConnection.status, ["active", "error"]),
            ),
          );

        if (userConnections.length === 0) {
          return c.json({ activities: [] as MergedActivity[] });
        }

        const connectionIds = userConnections.map((conn) => conn.id);
        const providerMap = new Map(
          userConnections.map((conn) => [conn.id, conn.provider]),
        );

        const [activityRows, sleepRows] = await Promise.all([
          db
            .select({
              terraConnectionId: terraActivity.terraConnectionId,
              startTime: terraActivity.startTime,
              endTime: terraActivity.endTime,
              activityType: terraActivity.activityType,
              distanceMeters: terraActivity.distanceMeters,
            })
            .from(terraActivity)
            .where(inArray(terraActivity.terraConnectionId, connectionIds))
            .orderBy(desc(terraActivity.startTime))
            .limit(50),
          db
            .select({
              terraConnectionId: terraSleep.terraConnectionId,
              startTime: terraSleep.startTime,
              endTime: terraSleep.endTime,
            })
            .from(terraSleep)
            .where(inArray(terraSleep.terraConnectionId, connectionIds))
            .orderBy(desc(terraSleep.startTime))
            .limit(25),
        ]);

        const merged: MergedActivity[] = [
          ...activityRows.map((a) => ({
            type: "activity" as const,
            activityType: a.activityType,
            startTime: a.startTime.toISOString(),
            endTime: a.endTime.toISOString(),
            distance: a.distanceMeters ?? null,
            provider: providerMap.get(a.terraConnectionId)!,
          })),
          ...sleepRows.map((s) => ({
            type: "sleep" as const,
            activityType: null,
            startTime: s.startTime.toISOString(),
            endTime: s.endTime.toISOString(),
            distance: null,
            provider: providerMap.get(s.terraConnectionId)!,
          })),
        ].sort(
          (a, b) =>
            new Date(b.startTime).getTime() - new Date(a.startTime).getTime(),
        );

        const deduped = deduplicateActivities(merged);
        const activities = deduped.slice(offset, offset + ACTIVITIES_PAGE_SIZE);

        return c.json({ activities });
      } catch (error) {
        console.error("Terra activities fetch error:", error);
        return c.json({ error: "Failed to load activities" }, 502);
      }
    },
  );

export default terraDashboard;
