import { eq, sql } from "drizzle-orm";
import type { Terra } from "terra-api";
import { z } from "zod";
import type { Terra as TerraV6 } from "./types-v6-override";
import { parseScopes } from "./sync-connections";
import {
  terraActivity,
  terraBody,
  terraConnection,
  terraDaily,
  terraMenstruation,
  terraNutrition,
  terraSleep,
  terraWebhookEvent,
  user,
} from "../../../../db/schema";
import type { Database } from "../db";

/* ---------------------------------- Table mappings ---------------------------------- */

const DATE_KEYED_TABLES: Record<string, DateKeyedTable> = {
  body: terraBody,
  nutrition: terraNutrition,
  menstruation: terraMenstruation,
};

const DATA_EVENT_TYPES = new Set([
  "activity",
  "sleep",
  "daily",
  ...Object.keys(DATE_KEYED_TABLES),
]);

/* ---------------------------------- Data handlers ----------------------------------- */

async function handleActivityData(
  db: Database,
  connectionId: string,
  items: Terra.Activity[],
  payloadKey: string | null,
) {
  if (items.length === 0) return;
  console.log(
    `Processing ${items.length} activity record(s) for connection=${connectionId}`,
  );
  await db
    .insert(terraActivity)
    .values(
      items.map((item) => {
        const { summary_id, start_time, end_time, type } = item.metadata;
        return {
          terraConnectionId: connectionId,
          summaryId: summary_id,
          startTime: new Date(start_time),
          endTime: new Date(end_time),
          activityType: type != null ? String(type) : null,
          distanceMeters:
            (
              item.distance_data?.summary as
                | { distance_meters?: number }
                | undefined
            )?.distance_meters ?? null,
          payloadKey,
        };
      }),
    )
    .onConflictDoUpdate({
      target: terraActivity.summaryId,
      set: {
        startTime: sql`excluded.start_time`,
        endTime: sql`excluded.end_time`,
        activityType: sql`excluded.activity_type`,
        distanceMeters: sql`excluded.distance_meters`,
        payloadKey: sql`excluded.payload_key`,
        updatedAt: sql`now()`,
      },
    });
}

async function handleSleepData(
  db: Database,
  connectionId: string,
  items: Terra.Sleep[],
  payloadKey: string | null,
) {
  const valid = items.filter(
    (item): item is Terra.Sleep & { metadata: { summary_id: string } } =>
      !!item.metadata.summary_id,
  );
  if (valid.length === 0) return;
  console.log(
    `Processing ${valid.length} sleep record(s) for connection=${connectionId}`,
  );
  await db
    .insert(terraSleep)
    .values(
      valid.map((item) => {
        const { summary_id, start_time, end_time } = item.metadata;
        const e = item.data_enrichment as TerraV6.Sleep["data_enrichment"];
        return {
          terraConnectionId: connectionId,
          summaryId: summary_id,
          startTime: new Date(start_time),
          endTime: new Date(end_time),
          sleepScore: e?.sleep_score ?? null,
          sleepScoreV2: e?.sleep_score_v2 ?? null,
          readinessScore: e?.readiness_score ?? null,
          respiratoryScoreV2: e?.respiratory_score_v2 ?? null,
          payloadKey,
        };
      }),
    )
    .onConflictDoUpdate({
      target: terraSleep.summaryId,
      set: {
        startTime: sql`excluded.start_time`,
        endTime: sql`excluded.end_time`,
        sleepScore: sql`COALESCE(excluded.sleep_score, terra_sleep.sleep_score)`,
        sleepScoreV2: sql`COALESCE(excluded.sleep_score_v2, terra_sleep.sleep_score_v2)`,
        readinessScore: sql`COALESCE(excluded.readiness_score, terra_sleep.readiness_score)`,
        respiratoryScoreV2: sql`COALESCE(excluded.respiratory_score_v2, terra_sleep.respiratory_score_v2)`,
        payloadKey: sql`excluded.payload_key`,
        updatedAt: sql`now()`,
      },
    });
}

type DateKeyedTable =
  | typeof terraBody
  | typeof terraNutrition
  | typeof terraMenstruation;

type DateKeyedDataModel = Terra.Body | Terra.Nutrition | Terra.Menstruation;

async function handleDateKeyedData(
  db: Database,
  connectionId: string,
  table: DateKeyedTable,
  items: DateKeyedDataModel[],
  payloadKey: string | null,
) {
  if (items.length === 0) return;
  console.log(
    `Processing ${items.length} date-keyed record(s) for connection=${connectionId}`,
  );
  await db
    .insert(table)
    .values(
      items.map((item) => ({
        terraConnectionId: connectionId,
        date: item.metadata.start_time.slice(0, 10),
        payloadKey,
      })),
    )
    .onConflictDoUpdate({
      target: [table.terraConnectionId, table.date],
      set: {
        payloadKey: sql`excluded.payload_key`,
        updatedAt: sql`now()`,
      },
    });
}

async function handleDailyData(
  db: Database,
  connectionId: string,
  items: Terra.Daily[],
  payloadKey: string | null,
) {
  if (items.length === 0) return;
  console.log(
    `Processing ${items.length} daily record(s) for connection=${connectionId}`,
  );
  await db
    .insert(terraDaily)
    .values(
      items.map((item) => {
        const e = item.data_enrichment as TerraV6.Daily["data_enrichment"];
        return {
          terraConnectionId: connectionId,
          date: item.metadata.start_time.slice(0, 10),
          steps: item.distance_data?.steps ?? null,
          restingHrBpm: item.heart_rate_data?.summary?.resting_hr_bpm ?? null,
          avgHrvSdnn: item.heart_rate_data?.summary?.avg_hrv_sdnn ?? null,
          vo2max: item.oxygen_data?.vo2max_ml_per_min_per_kg ?? null,
          activeSeconds: item.active_durations_data?.activity_seconds ?? null,
          totalBurnedCalories:
            item.calories_data?.total_burned_calories ?? null,
          totalStressScore: e?.total_stress_score ?? null,
          totalStressScoreV2: e?.total_stress_score_v2 ?? null,
          strainIndex: e?.strain_index ?? null,
          strainTrafficLight: e?.strain_traffic_light ?? null,
          resilienceScore: e?.resilience_score ?? null,
          cardiovascularScore: e?.cardiovascular_score ?? null,
          immuneIndex: e?.immune_index ?? null,
          respiratoryScore: e?.respiratory_score ?? null,
          stressContributors: e?.stress_contributors ?? null,
          strainContributors: e?.strain_contributors ?? null,
          payloadKey,
        };
      }),
    )
    .onConflictDoUpdate({
      target: [terraDaily.terraConnectionId, terraDaily.date],
      set: {
        /* Biomarkers — standard overwrite (latest is superset) */
        steps: sql`excluded.steps`,
        restingHrBpm: sql`excluded.resting_hr_bpm`,
        avgHrvSdnn: sql`excluded.avg_hrv_sdnn`,
        vo2max: sql`excluded.vo2max`,
        activeSeconds: sql`excluded.active_seconds`,
        totalBurnedCalories: sql`excluded.total_burned_calories`,
        /* Scores — COALESCE (nulls never overwrite) */
        totalStressScore: sql`COALESCE(excluded.total_stress_score, terra_daily.total_stress_score)`,
        totalStressScoreV2: sql`COALESCE(excluded.total_stress_score_v2, terra_daily.total_stress_score_v2)`,
        strainIndex: sql`COALESCE(excluded.strain_index, terra_daily.strain_index)`,
        strainTrafficLight: sql`COALESCE(excluded.strain_traffic_light, terra_daily.strain_traffic_light)`,
        resilienceScore: sql`COALESCE(excluded.resilience_score, terra_daily.resilience_score)`,
        cardiovascularScore: sql`COALESCE(excluded.cardiovascular_score, terra_daily.cardiovascular_score)`,
        immuneIndex: sql`COALESCE(excluded.immune_index, terra_daily.immune_index)`,
        respiratoryScore: sql`COALESCE(excluded.respiratory_score, terra_daily.respiratory_score)`,
        stressContributors: sql`COALESCE(excluded.stress_contributors, terra_daily.stress_contributors)`,
        strainContributors: sql`COALESCE(excluded.strain_contributors, terra_daily.strain_contributors)`,
        payloadKey: sql`excluded.payload_key`,
        updatedAt: sql`now()`,
      },
    });
}

/* ---------------------------------- Auth handlers ----------------------------------- */

async function handleAuthEvent(db: Database, payload: Terra.AuthSuccessEvent) {
  const referenceId = payload.reference_id;
  const parsed = z.string().uuid().safeParse(referenceId);
  if (!parsed.success) {
    throw new Error(`Invalid or missing reference_id: ${referenceId}`);
  }

  console.log(
    `Auth event: provider=${payload.user.provider} terraUser=${payload.user.user_id} referenceId=${referenceId}`,
  );

  const [appUser] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.id, referenceId))
    .limit(1);

  if (!appUser) {
    throw new Error(`Auth webhook reference_id not found: ${referenceId}`);
  }

  const scopes = parseScopes(payload.user.scopes);

  await db
    .insert(terraConnection)
    .values({
      userId: appUser.id,
      terraUserId: payload.user.user_id,
      referenceId,
      provider: payload.user.provider,
      scopes,
      status: "active",
    })
    .onConflictDoUpdate({
      target: terraConnection.terraUserId,
      set: {
        userId: appUser.id,
        referenceId,
        provider: payload.user.provider,
        scopes,
        status: "active",
        updatedAt: sql`now()`,
      },
    });

  console.log(
    `Connection upserted: provider=${payload.user.provider} terraUser=${payload.user.user_id} userId=${appUser.id}`,
  );
}

async function handleDeauthEvent(
  db: Database,
  payload: Terra.DeauthEvent | Terra.AccessRevokedEvent,
) {
  console.log(
    `Deauth event: type=${payload.type} terraUser=${payload.user.user_id}`,
  );
  await db
    .update(terraConnection)
    .set({ status: "revoked" })
    .where(eq(terraConnection.terraUserId, payload.user.user_id));
}

async function handleReauthEvent(db: Database, payload: Terra.UserReauthEvent) {
  console.log(
    `Reauth event: oldTerraUser=${payload.old_user.user_id} newTerraUser=${payload.new_user.user_id}`,
  );
  await db
    .update(terraConnection)
    .set({ terraUserId: payload.new_user.user_id, status: "active" })
    .where(eq(terraConnection.terraUserId, payload.old_user.user_id));
}

async function handleConnectionError(
  db: Database,
  payload: Terra.ConnectionErrorEvent,
) {
  await db
    .update(terraConnection)
    .set({ status: "error" })
    .where(eq(terraConnection.terraUserId, payload.user.user_id));
}

async function handlePermissionChange(
  db: Database,
  payload: Terra.PermissionChangeEvent,
) {
  await db
    .update(terraConnection)
    .set({ scopes: parseScopes(payload.user.scopes) })
    .where(eq(terraConnection.terraUserId, payload.user.user_id));
}

/* ---------------------------------- Event status ------------------------------------ */

export async function markEvent(
  db: Database,
  eventId: string,
  status: "processed" | "failed",
  error?: string,
) {
  await db
    .update(terraWebhookEvent)
    .set({ status, error: error ?? null, processedAt: new Date() })
    .where(eq(terraWebhookEvent.id, eventId));
}

/* ---------------------------------- Helpers ----------------------------------------- */

export function extractUserId(
  payload: Terra.WebhookEventType,
): string | undefined {
  if ("user" in payload && payload.user) {
    return (payload.user as Terra.TerraUser).user_id;
  }
  return undefined;
}

/* ---------------------------------- Main processor ---------------------------------- */

export async function processWebhookEvent(
  db: Database,
  eventId: string,
  payload: Terra.WebhookEventType,
  options?: {
    payloadKey?: string | null;
    onAuthSuccess?: (terraUserId: string, provider: string) => Promise<void>;
  },
) {
  const payloadKey = options?.payloadKey ?? null;

  if (DATA_EVENT_TYPES.has(payload.type)) {
    const terraUserId = extractUserId(payload);
    const data = "data" in payload ? (payload.data as unknown[]) : undefined;
    if (!terraUserId || !data?.length) {
      console.log(
        `Data event skipped: type=${payload.type} terraUser=${terraUserId ?? "none"} dataItems=${data?.length ?? 0}`,
      );
      await markEvent(db, eventId, "processed");
      return;
    }

    const [connection] = await db
      .select({ id: terraConnection.id })
      .from(terraConnection)
      .where(eq(terraConnection.terraUserId, terraUserId))
      .limit(1);

    if (!connection) {
      console.warn(
        `Data event failed: no connection for terraUser=${terraUserId}`,
      );
      await markEvent(
        db,
        eventId,
        "failed",
        `Unknown terra user: ${terraUserId}`,
      );
      return;
    }

    console.log(
      `Data event processing: type=${payload.type} items=${data.length} connection=${connection.id}`,
    );

    switch (payload.type) {
      case "activity":
        await handleActivityData(db, connection.id, payload.data, payloadKey);
        break;
      case "sleep":
        await handleSleepData(db, connection.id, payload.data, payloadKey);
        break;
      case "daily":
        await handleDailyData(db, connection.id, payload.data, payloadKey);
        break;
      case "body":
        await handleDateKeyedData(
          db,
          connection.id,
          terraBody,
          payload.data,
          payloadKey,
        );
        break;
      case "nutrition":
        await handleDateKeyedData(
          db,
          connection.id,
          terraNutrition,
          payload.data,
          payloadKey,
        );
        break;
      case "menstruation":
        await handleDateKeyedData(
          db,
          connection.id,
          terraMenstruation,
          payload.data,
          payloadKey,
        );
        break;
    }

    await db
      .update(terraConnection)
      .set({ lastWebhookAt: new Date(), status: "active" })
      .where(eq(terraConnection.id, connection.id));

    console.log(
      `Data event completed: type=${payload.type} connection=${connection.id}`,
    );
  } else {
    switch (payload.type) {
      case "auth":
        await handleAuthEvent(db, payload);
        await options?.onAuthSuccess?.(
          payload.user.user_id,
          payload.user.provider,
        );
        console.log(
          `Backfill requested: terraUser=${payload.user.user_id} provider=${payload.user.provider}`,
        );
        break;
      case "deauth":
      case "access_revoked":
        await handleDeauthEvent(db, payload);
        break;
      case "user_reauth":
        await handleReauthEvent(db, payload);
        break;
      case "connection_error":
        await handleConnectionError(db, payload);
        break;
      case "permission_change":
        await handlePermissionChange(db, payload);
        break;
      case "healthcheck":
        console.log("Healthcheck webhook received");
        break;
      case "processing":
      case "large_request_processing":
      case "large_request_sending":
      case "rate_limit_hit":
      case "google_no_datasource":
        console.log(`Informational event: type=${payload.type}`);
        break;
      default:
        console.warn(`Unhandled event type: ${payload.type}`);
        break;
    }
  }

  console.log(
    `Event marked processed: eventId=${eventId} type=${payload.type}`,
  );
  await markEvent(db, eventId, "processed");
}
