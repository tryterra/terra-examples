/**
 * Wearable aggregation for one patient (reference_id):
 *
 *   userInfo fan-out → per-connection daily/sleep/body fetch (through the
 *   per-day cache) → metric extraction → multi-provider merge → snapshot
 *   (latest value per metric) + daily series.
 *
 * Multi-provider rule: connections are ordered by last_webhook_update
 * recency and merged first-non-null-wins per metric per day, so two devices
 * never double-count.
 */
import { and, asc, eq, inArray, ne } from "drizzle-orm";
import { createDb, schema } from "./db";
import { getAppEnv } from "./env";
import { getConnections } from "./terra/user-info";
import type { TerraClient } from "./terra/client";
import type {
  ActivityPayload,
  BodyPayload,
  DailyPayload,
  SleepPayload,
  TerraUser,
  WearableDataResponse,
} from "./terra/types";

const db = createDb();
const TODAY_TTL_MS = 10 * 60 * 1000;

/**
 * Demo wearable data: seeded rows in wearableDayCache under a synthetic
 * `demo:<referenceId>` user (see scripts/seed-wearables.ts). Used only when
 * the reference_id has no live Terra connection; served cache-only.
 */
export const DEMO_USER_PREFIX = "demo:";

export const METRIC_KEYS = [
  "restingHr",
  "hrv",
  "steps",
  "sleepDurationMin",
  "sleepEfficiency",
  "deepSleepMin",
  "remSleepMin",
  "sleepScore",
  "glucoseAvg",
  "glucoseTimeInRange",
  "bpSystolic",
  "bpDiastolic",
  // Derived from workout records (e.g. Whoop connections without daily data)
  "workoutMinutes",
  "workoutCalories",
  "workoutAvgHr",
  // Provider-native recovery/readiness score (Whoop daily scores.recovery)
  "recoveryScore",
] as const;
export type MetricKey = (typeof METRIC_KEYS)[number];

export type Series = Record<MetricKey, Array<{ date: string; value: number }>>;

export interface WearableSummary {
  connected: boolean;
  connections: TerraUser[];
  /** Latest observed value per metric (with its date), null when absent. */
  snapshot: Record<MetricKey, { value: number; date: string } | null>;
  series: Series;
  days: number;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export interface WearableWindow {
  start: string; // YYYY-MM-DD inclusive
  end: string; // YYYY-MM-DD inclusive
}

/** Trailing window ending today. */
export function windowFromDays(days: number): WearableWindow {
  const now = Date.now();
  return {
    start: isoDate(new Date(now - (days - 1) * 86_400_000)),
    end: isoDate(new Date(now)),
  };
}

/** How far back "full history" is willing to look (Garmin serves ~5y). */
const HISTORY_LIMIT_DAYS = 5 * 365;
/** Consecutive empty 4-week probe steps before concluding history ended. */
const EMPTY_STEPS_TO_STOP = 3;
const PROBE_STEP_DAYS = 28;

/**
 * Earliest day with actual wearable data across the patient's connections —
 * discovered generically, for any provider: walk backward from the newest
 * data in 4-week steps, fetching (and caching) each step, until ~3 months
 * come back empty or the 5-year bound is hit. Every step lands in the
 * per-day cache, so discovery costs once per patient and is instant after.
 */
export async function getFirstWearableDataDate(
  referenceId: string,
): Promise<string | null> {
  const { client } = getAppEnv();
  const connections = await getEffectiveConnections(client, referenceId);
  if (connections.length === 0) return null;

  const now = Date.now();
  const hardLimit = now - HISTORY_LIMIT_DAYS * 86_400_000;
  let first: string | null = null;
  let emptySteps = 0;

  // Resume from the earliest cached day (probed or not) instead of today —
  // re-walking known territory is free (cache) but pointless.
  let cursorEnd = now;
  for (const c of connections) {
    const [row] = await db
      .select({ date: schema.wearableDayCache.date })
      .from(schema.wearableDayCache)
      .where(eq(schema.wearableDayCache.userId, c.user_id))
      .orderBy(asc(schema.wearableDayCache.date))
      .limit(1);
    if (row) {
      const t = new Date(`${row.date}T00:00:00Z`).getTime();
      // Known-data floor: anything cached non-empty already bounds `first`.
      const [firstData] = await db
        .select({ date: schema.wearableDayCache.date })
        .from(schema.wearableDayCache)
        .where(
          and(
            eq(schema.wearableDayCache.userId, c.user_id),
            ne(schema.wearableDayCache.payload, "[]"),
          ),
        )
        .orderBy(asc(schema.wearableDayCache.date))
        .limit(1);
      if (firstData && (first === null || firstData.date < first)) {
        first = firstData.date;
      }
      cursorEnd = Math.min(cursorEnd, t - 86_400_000);
    }
  }

  const ordered = [...connections].sort((a, b) =>
    (b.last_webhook_update ?? "").localeCompare(a.last_webhook_update ?? ""),
  );
  while (cursorEnd > hardLimit && emptySteps < EMPTY_STEPS_TO_STOP) {
    const stepStart = Math.max(
      cursorEnd - (PROBE_STEP_DAYS - 1) * 86_400_000,
      hardLimit,
    );
    const dates = dateRange({
      start: isoDate(new Date(stepStart)),
      end: isoDate(new Date(cursorEnd)),
    });
    let found: string | null = null;
    for (const conn of ordered) {
      const perResource = await Promise.all(
        (["daily", "sleep", "body", "activity"] as const).map((resource) =>
          getRecords(client, conn.user_id, resource, dates).catch(
            () => [] as Array<{ date: string; record: unknown }>,
          ),
        ),
      );
      for (const records of perResource) {
        for (const r of records) {
          if (found === null || r.date < found) found = r.date;
        }
      }
    }
    if (found) {
      first = found;
      emptySteps = 0;
    } else {
      emptySteps += 1;
    }
    cursorEnd = stepStart - 86_400_000;
  }
  return first;
}

function dateRange(window: WearableWindow): string[] {
  const out: string[] = [];
  const start = new Date(`${window.start}T00:00:00Z`).getTime();
  const end = new Date(`${window.end}T00:00:00Z`).getTime();
  for (let t = start; t <= end; t += 86_400_000) {
    out.push(isoDate(new Date(t)));
  }
  return out;
}

type Resource = "daily" | "sleep" | "body" | "activity";

/**
 * Live Terra connections, falling back to a synthetic demo connection when
 * seeded demo wearable rows exist for the reference_id. Used by both the
 * roster (connection badges) and the wearable aggregation, so they agree.
 */
export async function getEffectiveConnections(
  client: TerraClient,
  referenceId: string,
): Promise<TerraUser[]> {
  const live = await getConnections(client, referenceId);
  if (live.length > 0) return live;
  const demoUserId = `${DEMO_USER_PREFIX}${referenceId}`;
  const [demoRow] = await db
    .select({ userId: schema.wearableDayCache.userId })
    .from(schema.wearableDayCache)
    .where(eq(schema.wearableDayCache.userId, demoUserId))
    .limit(1);
  if (!demoRow) return [];
  return [
    {
      user_id: demoUserId,
      provider: "GARMIN",
      reference_id: referenceId,
      active: true,
      last_webhook_update: new Date().toISOString(),
    },
  ];
}

/**
 * All records of one resource for one user over the window, through the
 * per-day cache. Past days are cached forever; today refreshes on a TTL.
 * Missing days are fetched in one range request and stored per day (empty
 * days included, so quiet days don't refetch).
 */
async function getRecords(
  client: TerraClient,
  userId: string,
  resource: Resource,
  dates: string[],
): Promise<Array<{ date: string; record: unknown }>> {
  const today = isoDate(new Date());
  const cached = await db
    .select()
    .from(schema.wearableDayCache)
    .where(
      and(
        eq(schema.wearableDayCache.userId, userId),
        eq(schema.wearableDayCache.resource, resource),
        inArray(schema.wearableDayCache.date, dates),
      ),
    );
  const byDate = new Map(cached.map((r) => [r.date, r]));
  const missing = dates.filter((d) => {
    const hit = byDate.get(d);
    if (!hit) return true;
    return d === today && Date.now() - hit.fetchedAt.getTime() > TODAY_TTL_MS;
  });

  // Synthetic demo users have no Terra counterpart — serve the cache as-is.
  if (userId.startsWith(DEMO_USER_PREFIX)) {
    missing.length = 0;
  }

  if (missing.length > 0) {
    // Terra rejects synchronous requests over 28 days ("large data requests
    // require to_webhook=true") — fetch the missing span in ≤28-day chunks.
    const CHUNK_DAYS = 28;
    const start = missing[0];
    const end = missing[missing.length - 1];
    const spanDays =
      Math.round(
        (new Date(`${end}T00:00:00Z`).getTime() -
          new Date(`${start}T00:00:00Z`).getTime()) /
          86_400_000,
      ) + 1;
    const chunks: Array<{ start: string; end: string }> = [];
    for (let offset = 0; offset < spanDays; offset += CHUNK_DAYS) {
      const from = new Date(
        new Date(`${start}T00:00:00Z`).getTime() + offset * 86_400_000,
      );
      const to = new Date(
        Math.min(
          from.getTime() + (CHUNK_DAYS - 1) * 86_400_000,
          new Date(`${end}T00:00:00Z`).getTime(),
        ),
      );
      chunks.push({ start: isoDate(from), end: isoDate(to) });
    }
    // Sequential, not parallel: a year-long window is ~13 chunks per
    // resource, and firing them all at once (× 4 resources) trips Terra's
    // rate limit. The per-day cache makes repeat requests instant anyway.
    // Provider rate limits (Whoop caps per-user request rates, especially
    // right after a fresh auth backfill) get a paced retry; if a chunk still
    // fails we KEEP the chunks that succeeded — their days get cached, so
    // repeated requests converge on the full window instead of restarting.
    const responses: Array<
      WearableDataResponse<{
        metadata?: { start_time?: string; end_time?: string };
      }>
    > = [];
    const completedChunks: Array<{ start: string; end: string }> = [];
    for (const chunk of chunks) {
      let attempt = 0;
      let done = false;
      while (!done) {
        try {
          responses.push(
            (await client.get(`/${resource}`, {
              user_id: userId,
              start_date: chunk.start,
              end_date: chunk.end,
              to_webhook: false,
              with_samples: false,
            })) as WearableDataResponse<{
              metadata?: { start_time?: string; end_time?: string };
            }>,
          );
          completedChunks.push(chunk);
          done = true;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (/rate limit/i.test(msg)) {
            if (attempt >= 2) break;
            attempt += 1;
            await new Promise((r) => setTimeout(r, 20_000 * attempt));
          } else if (completedChunks.length > 0) {
            break; // keep partial progress on any late-chunk failure
          } else {
            throw err;
          }
        }
      }
      if (!done) {
        console.error(
          `wearables: ${resource} for ${userId} cached ${completedChunks.length}/${chunks.length} chunks (provider rate limit) — the rest fills in on later requests`,
        );
        break;
      }
    }
    // Only days inside completed chunks may be cached — caching an
    // unfetched day as empty would permanently mask its data.
    const covered = new Set<string>();
    for (const chunk of completedChunks) {
      for (const d of dateRange(chunk)) covered.add(d);
    }
    const grouped = new Map<string, unknown[]>(
      missing.filter((d) => covered.has(d)).map((d) => [d, []]),
    );
    for (const record of responses.flatMap((res) => res.data ?? [])) {
      // Sleep sessions belong to the wake-up day; 24h windows to their start.
      const stamp =
        resource === "sleep"
          ? (record.metadata?.end_time ?? record.metadata?.start_time)
          : record.metadata?.start_time;
      if (!stamp) continue;
      const day = stamp.slice(0, 10);
      if (grouped.has(day)) grouped.get(day)!.push(record);
    }
    for (const [date, records] of grouped) {
      await db
        .insert(schema.wearableDayCache)
        .values({
          userId,
          resource,
          date,
          payload: JSON.stringify(records),
        })
        .onConflictDoUpdate({
          target: [
            schema.wearableDayCache.userId,
            schema.wearableDayCache.resource,
            schema.wearableDayCache.date,
          ],
          set: { payload: JSON.stringify(records), fetchedAt: new Date() },
        });
      byDate.set(date, {
        userId,
        resource,
        date,
        payload: JSON.stringify(records),
        fetchedAt: new Date(),
      });
    }
  }

  const out: Array<{ date: string; record: unknown }> = [];
  for (const d of dates) {
    const row = byDate.get(d);
    if (!row) continue;
    for (const record of JSON.parse(row.payload) as unknown[]) {
      out.push({ date: d, record });
    }
  }
  return out;
}

const num = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? v : undefined;

// Physiological metrics where 0 means "not measured" (Apple Health reports
// resting HR 0 on days without a reading), never a real value.
const posNum = (v: unknown): number | undefined => {
  const n = num(v);
  return n !== undefined && n > 0 ? n : undefined;
};

/** Metric values for one connection, keyed metric → date → value. */
async function extractForUser(
  client: TerraClient,
  userId: string,
  dates: string[],
): Promise<Map<MetricKey, Map<string, number>>> {
  // Per-resource resilience: some connections don't serve some resources at
  // all (e.g. REALTIME 404s on daily/sleep/body) — treat those as empty
  // rather than failing the whole aggregation.
  const [daily, sleep, body, activity] = await Promise.all(
    (["daily", "sleep", "body", "activity"] as const).map((resource) =>
      getRecords(client, userId, resource, dates).catch((err) => {
        console.error(
          `wearables: ${resource} fetch failed for ${userId}:`,
          err instanceof Error ? err.message : err,
        );
        return [] as Array<{ date: string; record: unknown }>;
      }),
    ),
  );
  const out = new Map<MetricKey, Map<string, number>>();
  // First non-missing value wins per (metric, day) — daily is processed
  // before body, so body only fills gaps (e.g. Apple resting HR).
  const put = (metric: MetricKey, date: string, value: number | undefined) => {
    if (value === undefined) return;
    if (!out.has(metric)) out.set(metric, new Map());
    if (!out.get(metric)!.has(date)) out.get(metric)!.set(date, value);
  };

  for (const { date, record } of daily) {
    const d = record as DailyPayload;
    put("restingHr", date, posNum(d.heart_rate_data?.summary?.resting_hr_bpm));
    put("hrv", date, posNum(d.heart_rate_data?.summary?.avg_hrv_rmssd));
    put("steps", date, num(d.distance_data?.steps));
    put("recoveryScore", date, posNum(d.scores?.recovery));
  }
  for (const { date, record } of sleep) {
    const s = record as SleepPayload;
    if (s.metadata?.is_nap) continue;
    // Whoop reports HRV (and resting HR) on the sleep record, not the daily
    // summary — daily is processed first, so this only fills gaps.
    put("hrv", date, posNum(s.heart_rate_data?.summary?.avg_hrv_rmssd));
    put(
      "restingHr",
      date,
      posNum(s.heart_rate_data?.summary?.resting_hr_bpm),
    );
    const asleep = s.sleep_durations_data?.asleep;
    const dur = posNum(asleep?.duration_asleep_state_seconds);
    put("sleepDurationMin", date, dur !== undefined ? dur / 60 : undefined);
    const deep = num(asleep?.duration_deep_sleep_state_seconds);
    put("deepSleepMin", date, deep !== undefined ? deep / 60 : undefined);
    const rem = num(asleep?.duration_REM_sleep_state_seconds);
    put("remSleepMin", date, rem !== undefined ? rem / 60 : undefined);
    // Whoop reports efficiency as a 0–1 fraction, others as 0–100.
    const eff = posNum(s.sleep_durations_data?.sleep_efficiency);
    put(
      "sleepEfficiency",
      date,
      eff !== undefined ? (eff <= 1.5 ? eff * 100 : eff) : undefined,
    );
    put("sleepScore", date, posNum(s.data_enrichment?.sleep_score));
  }
  // Workouts → per-day aggregates (Whoop-style connections often expose
  // workouts but no daily summaries).
  const perDayWorkouts = new Map<
    string,
    { minutes: number; calories: number; hrSum: number; hrCount: number }
  >();
  for (const { date, record } of activity) {
    const a = record as ActivityPayload;
    const agg =
      perDayWorkouts.get(date) ??
      { minutes: 0, calories: 0, hrSum: 0, hrCount: 0 };
    const seconds =
      posNum(a.active_durations_data?.activity_seconds) ??
      (a.metadata?.end_time && a.metadata?.start_time
        ? Math.max(
            0,
            (new Date(a.metadata.end_time).getTime() -
              new Date(a.metadata.start_time).getTime()) /
              1000,
          )
        : 0);
    agg.minutes += seconds / 60;
    agg.calories += num(a.calories_data?.total_burned_calories) ?? 0;
    const avgHr = posNum(a.heart_rate_data?.summary?.avg_hr_bpm);
    if (avgHr !== undefined) {
      agg.hrSum += avgHr;
      agg.hrCount += 1;
    }
    perDayWorkouts.set(date, agg);
  }
  for (const [date, agg] of perDayWorkouts) {
    if (agg.minutes > 0) put("workoutMinutes", date, Math.round(agg.minutes));
    if (agg.calories > 0) {
      put("workoutCalories", date, Math.round(agg.calories));
    }
    if (agg.hrCount > 0) {
      put("workoutAvgHr", date, Math.round(agg.hrSum / agg.hrCount));
    }
  }

  for (const { date, record } of body) {
    const b = record as BodyPayload;
    put(
      "glucoseAvg",
      date,
      posNum(b.glucose_data?.day_avg_blood_glucose_mg_per_dL),
    );
    put("glucoseTimeInRange", date, posNum(b.glucose_data?.time_in_range));
    put("bpSystolic", date, posNum(b.blood_pressure_data?.day_avg_systolic_bp));
    put(
      "bpDiastolic",
      date,
      posNum(b.blood_pressure_data?.day_avg_diastolic_bp),
    );
    // Apple surfaces resting HR under body.heart_data, not the daily summary.
    put(
      "restingHr",
      date,
      posNum(b.heart_data?.heart_rate_data?.summary?.resting_hr_bpm),
    );
    put(
      "hrv",
      date,
      posNum(b.heart_data?.heart_rate_data?.summary?.avg_hrv_rmssd),
    );
  }
  return out;
}

export async function getWearableSummary(
  referenceId: string,
  window: WearableWindow,
): Promise<WearableSummary> {
  const { client } = getAppEnv();
  const connections = await getEffectiveConnections(client, referenceId);
  const dates = dateRange(window);
  const emptySeries = Object.fromEntries(
    METRIC_KEYS.map((k) => [k, []]),
  ) as unknown as Series;
  const emptySnapshot = Object.fromEntries(
    METRIC_KEYS.map((k) => [k, null]),
  ) as unknown as WearableSummary["snapshot"];
  if (connections.length === 0) {
    return {
      connected: false,
      connections: [],
      snapshot: emptySnapshot,
      series: emptySeries,
      days: dates.length,
    };
  }
  // Most recently syncing device first; earlier entries win metric merges.
  const ordered = [...connections].sort((a, b) =>
    (b.last_webhook_update ?? "").localeCompare(a.last_webhook_update ?? ""),
  );
  const perUser = await Promise.all(
    ordered.map((u) => extractForUser(client, u.user_id, dates)),
  );

  const merged = new Map<MetricKey, Map<string, number>>();
  for (const extracted of perUser) {
    for (const [metric, values] of extracted) {
      if (!merged.has(metric)) merged.set(metric, new Map());
      const target = merged.get(metric)!;
      for (const [date, value] of values) {
        if (!target.has(date)) target.set(date, value);
      }
    }
  }

  const series = { ...emptySeries };
  const snapshot = { ...emptySnapshot };
  for (const metric of METRIC_KEYS) {
    const values = merged.get(metric);
    if (!values) continue;
    const points = dates
      .filter((d) => values.has(d))
      .map((date) => ({ date, value: values.get(date)! }));
    series[metric] = points;
    snapshot[metric] = points.length > 0 ? points[points.length - 1] : null;
  }
  return {
    connected: true,
    connections: ordered,
    snapshot,
    series,
    days: dates.length,
  };
}
