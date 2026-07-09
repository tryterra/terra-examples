import { zValidator } from "@hono/zod-validator";
import { and, between, eq, inArray, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { terraConnection, terraDaily, terraSleep } from "../../../../db/schema";
import type { AuthSession, AuthUser, Env } from "../../lib/auth";
import { createDb } from "../../lib/db";
import { sortByProviderPriority } from "../../lib/terra/provider-priority";
import { requireAuth } from "../../middleware/auth";

/* -------------------------------------------------------------------------- */
/*                              Metric definitions                            */
/* -------------------------------------------------------------------------- */

const DAILY_METRICS = {
  rhr: { column: terraDaily.restingHrBpm },
  hrv: { column: terraDaily.avgHrvSdnn },
  steps: { column: terraDaily.steps },
  vo2Max: { column: terraDaily.vo2max },
  activeHours: { column: terraDaily.activeSeconds },
  calories: { column: terraDaily.totalBurnedCalories },
  totalStressScore: { column: terraDaily.totalStressScore },
  strainIndex: { column: terraDaily.strainIndex },
  resilienceScore: { column: terraDaily.resilienceScore },
  cardiovascularScore: { column: terraDaily.cardiovascularScore },
  immuneIndex: { column: terraDaily.immuneIndex },
  respiratoryScore: { column: terraDaily.respiratoryScore },
} as const;

const SLEEP_METRICS = {
  sleepScore: { column: terraSleep.sleepScore },
  readinessScore: { column: terraSleep.readinessScore },
} as const;

const SLEEP_DERIVED = {
  lastSleep: { startTime: terraSleep.startTime, endTime: terraSleep.endTime },
} as const;

type DailyMetricKey = keyof typeof DAILY_METRICS;
type SleepMetricKey = keyof typeof SLEEP_METRICS;

const metricSchema = z.enum([
  ...Object.keys(DAILY_METRICS),
  ...Object.keys(SLEEP_METRICS),
  ...Object.keys(SLEEP_DERIVED),
] as [string, ...string[]]);

/* -------------------------------------------------------------------------- */
/*                         Intraday sample extraction                         */
/* -------------------------------------------------------------------------- */

interface Sample {
  timestamp: number;
  value: number;
}

const SAMPLE_EXTRACTORS: Partial<
  Record<DailyMetricKey, (payload: unknown) => Sample[]>
> = {
  rhr: (payload) => {
    const samples = dig(payload, [
      "data",
      0,
      "heart_rate_data",
      "detailed",
      "hr_samples",
    ]);
    if (!Array.isArray(samples)) return [];
    return samples
      .map((s: Record<string, unknown>) => ({
        timestamp: toUnixMs(s.timestamp),
        value: Number(s.bpm ?? s.value ?? 0),
      }))
      .filter((s) => s.timestamp > 0 && s.value > 0);
  },
  hrv: (payload) => {
    const samples = dig(payload, [
      "data",
      0,
      "heart_rate_data",
      "detailed",
      "hrv_samples_sdnn",
    ]);
    if (!Array.isArray(samples)) return [];
    return samples
      .map((s: Record<string, unknown>) => ({
        timestamp: toUnixMs(s.timestamp),
        value: Number(s.hrv ?? s.value ?? 0),
      }))
      .filter((s) => s.timestamp > 0 && s.value > 0);
  },
};

function dig(obj: unknown, path: (string | number)[]): unknown {
  let current: unknown = obj;
  for (const key of path) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string | number, unknown>)[key];
  }
  return current;
}

function toUnixMs(value: unknown): number {
  if (typeof value === "number") return value > 1e12 ? value : value * 1000;
  if (typeof value === "string") {
    const ms = new Date(value).getTime();
    return Number.isNaN(ms) ? 0 : ms;
  }
  return 0;
}

/* -------------------------------------------------------------------------- */
/*                                    Route                                   */
/* -------------------------------------------------------------------------- */

const terraTrends = new Hono<{
  Bindings: Env;
  Variables: { user: AuthUser; session: AuthSession };
}>()
  /* --- Available metrics --- */
  .get("/available", requireAuth, async (c) => {
    try {
      const db = createDb(c.env.DATABASE_URL);
      const userId = c.get("user").id;

      const userConnections = await db
        .select({ id: terraConnection.id })
        .from(terraConnection)
        .where(
          and(
            eq(terraConnection.userId, userId),
            inArray(terraConnection.status, ["active", "error"]),
          ),
        );

      if (userConnections.length === 0) {
        return c.json({ available: [] as string[] });
      }

      const connectionIds = userConnections.map((conn) => conn.id);

      const buildAvailSelect = (metrics: Record<string, { column: unknown }>) =>
        Object.fromEntries(
          Object.entries(metrics).map(([key, { column }]) => [
            key,
            sql<boolean>`bool_or(${column} IS NOT NULL)`.as(key),
          ]),
        );

      const sleepFilter = inArray(terraSleep.terraConnectionId, connectionIds);

      const [dailyAvail, sleepAvail, sleepHasRows] = await Promise.all([
        db
          .select(buildAvailSelect(DAILY_METRICS))
          .from(terraDaily)
          .where(inArray(terraDaily.terraConnectionId, connectionIds)),
        db
          .select(buildAvailSelect(SLEEP_METRICS))
          .from(terraSleep)
          .where(sleepFilter),
        db
          .select({ exists: sql<boolean>`count(*) > 0` })
          .from(terraSleep)
          .where(sleepFilter),
      ]);

      const available: string[] = [];
      const dailyRow = dailyAvail[0] as Record<string, boolean> | undefined;
      if (dailyRow) {
        for (const key of Object.keys(DAILY_METRICS)) {
          if (dailyRow[key]) available.push(key);
        }
      }
      const sleepRow = sleepAvail[0] as Record<string, boolean> | undefined;
      if (sleepRow) {
        for (const key of Object.keys(SLEEP_METRICS)) {
          if (sleepRow[key]) available.push(key);
        }
      }
      if (sleepHasRows[0]?.exists) {
        available.push(...Object.keys(SLEEP_DERIVED));
      }

      return c.json({ available });
    } catch (error) {
      console.error("Trends available fetch error:", error);
      return c.json({ error: "Failed to load available metrics" }, 502);
    }
  })

  /* --- Trend data --- */
  .get(
    "/",
    requireAuth,
    zValidator(
      "query",
      z.object({
        metric: metricSchema,
        startDate: z.iso.date(),
        endDate: z.iso.date(),
        scale: z.enum(["day", "week", "month"]),
      }),
    ),
    async (c) => {
      try {
        const db = createDb(c.env.DATABASE_URL);
        const userId = c.get("user").id;
        const { metric, startDate, endDate, scale } = c.req.valid("query");

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
          return c.json({
            dataPoints: [] as { date: string; value: number }[],
          });
        }

        const connectionIds = userConnections.map((conn) => conn.id);
        const providerMap = new Map(
          userConnections.map((conn) => [conn.id, conn.provider]),
        );

        /* --- Sleep duration (raw start/end — client computes minutes) --- */
        if (metric === "lastSleep") {
          const rows = await db
            .select({
              terraConnectionId: terraSleep.terraConnectionId,
              startTime: terraSleep.startTime,
              endTime: terraSleep.endTime,
            })
            .from(terraSleep)
            .where(
              and(
                inArray(terraSleep.terraConnectionId, connectionIds),
                sql`${terraSleep.startTime}::date BETWEEN ${startDate} AND ${endDate}`,
              ),
            )
            .orderBy(terraSleep.startTime);

          const prioritized = sortByProviderPriority(
            rows,
            (row) => providerMap.get(row.terraConnectionId)!,
            "sleep",
          );

          const seen = new Set<string>();
          const dataPoints: {
            date: string;
            startTime: string;
            endTime: string;
          }[] = [];
          for (const row of prioritized) {
            const dateKey = row.startTime.toISOString().slice(0, 10);
            if (seen.has(dateKey)) continue;
            seen.add(dateKey);
            dataPoints.push({
              date: dateKey,
              startTime: row.startTime.toISOString(),
              endTime: row.endTime.toISOString(),
            });
          }
          dataPoints.sort((a, b) => a.date.localeCompare(b.date));

          return c.json({ dataPoints });
        }

        /* --- Sleep column metrics (from terraSleep) --- */
        if (metric in SLEEP_METRICS) {
          const { column } = SLEEP_METRICS[metric as SleepMetricKey];

          const rows = await db
            .select({
              terraConnectionId: terraSleep.terraConnectionId,
              startTime: terraSleep.startTime,
              value: column,
            })
            .from(terraSleep)
            .where(
              and(
                inArray(terraSleep.terraConnectionId, connectionIds),
                sql`${terraSleep.startTime}::date BETWEEN ${startDate} AND ${endDate}`,
              ),
            )
            .orderBy(terraSleep.startTime);

          const prioritized = sortByProviderPriority(
            rows,
            (row) => providerMap.get(row.terraConnectionId)!,
            "sleep",
          );

          const seen = new Set<string>();
          const dataPoints: { date: string; value: number }[] = [];
          for (const row of prioritized) {
            const dateKey = row.startTime.toISOString().slice(0, 10);
            if (seen.has(dateKey) || row.value == null) continue;
            seen.add(dateKey);
            dataPoints.push({ date: dateKey, value: row.value });
          }
          dataPoints.sort((a, b) => a.date.localeCompare(b.date));

          return c.json({ dataPoints });
        }

        /* --- Daily metrics --- */
        const dailyMeta = DAILY_METRICS[metric as DailyMetricKey];

        /* Day scale with intraday samples */
        if (scale === "day" && metric in SAMPLE_EXTRACTORS) {
          const [dailyRow] = await db
            .select({
              terraConnectionId: terraDaily.terraConnectionId,
              payloadKey: terraDaily.payloadKey,
              value: dailyMeta.column,
            })
            .from(terraDaily)
            .where(
              and(
                inArray(terraDaily.terraConnectionId, connectionIds),
                eq(terraDaily.date, startDate),
              ),
            )
            .limit(1);

          if (!dailyRow?.payloadKey || !c.env.TERRA_WEBHOOKS_BUCKET) {
            const fallback =
              dailyRow?.value != null
                ? [
                    {
                      date: startDate,
                      value: transformValue(metric, dailyRow.value),
                    },
                  ]
                : [];
            return c.json({ dataPoints: fallback });
          }

          const obj = await c.env.TERRA_WEBHOOKS_BUCKET.get(
            dailyRow.payloadKey,
          );
          if (!obj) {
            const fallback =
              dailyRow.value != null
                ? [
                    {
                      date: startDate,
                      value: transformValue(metric, dailyRow.value),
                    },
                  ]
                : [];
            return c.json({ dataPoints: fallback });
          }

          const payload = await obj.json();
          const extractor = SAMPLE_EXTRACTORS[metric as DailyMetricKey]!;
          const samples = extractor(payload);

          if (samples.length === 0 && dailyRow.value != null) {
            return c.json({
              dataPoints: [
                {
                  date: startDate,
                  value: transformValue(metric, dailyRow.value),
                },
              ],
            });
          }

          return c.json({ dataPoints: samples });
        }

        /* Week/Month scale — daily aggregates */
        const rows = await db
          .select({
            terraConnectionId: terraDaily.terraConnectionId,
            date: terraDaily.date,
            value: dailyMeta.column,
          })
          .from(terraDaily)
          .where(
            and(
              inArray(terraDaily.terraConnectionId, connectionIds),
              between(terraDaily.date, startDate, endDate),
            ),
          )
          .orderBy(terraDaily.date);

        const prioritized = sortByProviderPriority(
          rows,
          (row) => providerMap.get(row.terraConnectionId)!,
          "daily",
        );

        const seen = new Set<string>();
        const dataPoints: { date: string; value: number }[] = [];
        for (const row of prioritized) {
          if (seen.has(row.date) || row.value == null) continue;
          seen.add(row.date);
          dataPoints.push({
            date: row.date,
            value: transformValue(metric, row.value),
          });
        }
        dataPoints.sort((a, b) => a.date.localeCompare(b.date));

        return c.json({ dataPoints });
      } catch (error) {
        console.error("Trends data fetch error:", error);
        return c.json({ error: "Failed to load trend data" }, 502);
      }
    },
  );

/** Transform raw DB values for display (e.g. seconds → hours). */
function transformValue(metric: string, value: number): number {
  if (metric === "activeHours") return value / 3600;
  return value;
}

export default terraTrends;
