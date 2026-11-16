/**
 * Read model over SQLite. Backfills and webhooks share `upsertRecords`, so
 * a record lands the same way whichever path delivered it. Upserts are
 * idempotent (keyed on Terra's record_id) and order-safe: a row is only
 * replaced by a receipt at least as new as the one stored.
 */
import { and, count, eq, max, sql } from "drizzle-orm";
import { backfillClinicalRecords } from "./clinical/sync";
import type { ClinicalRecord, TerraUser } from "./clinical/types";
import { getDb, schema, type Db } from "./db";
import type { TerraClient } from "./terra/client";

export async function upsertUser(
  user: Pick<TerraUser, "user_id"> & Partial<TerraUser>,
  db: Db = getDb(),
) {
  await db
    .insert(schema.terraUser)
    .values({
      userId: user.user_id,
      referenceId: user.reference_id ?? null,
      provider: user.provider ?? "APPLE",
    })
    .onConflictDoUpdate({
      target: schema.terraUser.userId,
      set: {
        // Keep a known reference_id if a later payload omits it.
        referenceId: sql`coalesce(excluded.reference_id, ${schema.terraUser.referenceId})`,
        provider: sql`excluded.provider`,
      },
    });
}

export async function upsertRecords(
  userId: string,
  records: ClinicalRecord[],
  db: Db = getDb(),
): Promise<number> {
  if (records.length === 0) return 0;
  const now = new Date();
  await db
    .insert(schema.clinicalRecord)
    .values(
      records.map((r) => ({
        recordId: r.record_id,
        userId,
        clinicalType: r.clinical_type,
        sourceName: r.source_name,
        receivedAt: r.received_at,
        payload: JSON.stringify(r),
        updatedAt: now,
      })),
    )
    .onConflictDoUpdate({
      target: schema.clinicalRecord.recordId,
      set: {
        clinicalType: sql`excluded.clinical_type`,
        sourceName: sql`excluded.source_name`,
        receivedAt: sql`excluded.received_at`,
        payload: sql`excluded.payload`,
        updatedAt: sql`excluded.updated_at`,
      },
      setWhere: sql`excluded.received_at >= ${schema.clinicalRecord.receivedAt}`,
    });
  return records.length;
}

export async function listUsers(db: Db = getDb()) {
  const users = await db
    .select()
    .from(schema.terraUser)
    .orderBy(schema.terraUser.createdAt);
  const stats = await db
    .select({
      userId: schema.clinicalRecord.userId,
      records: count(),
      sources: sql<number>`count(distinct ${schema.clinicalRecord.sourceName})`,
      lastReceivedAt: max(schema.clinicalRecord.receivedAt),
    })
    .from(schema.clinicalRecord)
    .groupBy(schema.clinicalRecord.userId);
  const byUser = new Map(stats.map((s) => [s.userId, s]));
  return users.map((u) => ({
    ...u,
    records: byUser.get(u.userId)?.records ?? 0,
    sources: byUser.get(u.userId)?.sources ?? 0,
    lastReceivedAt: byUser.get(u.userId)?.lastReceivedAt ?? null,
  }));
}

export async function getUser(userId: string, db: Db = getDb()) {
  const [user] = await db
    .select()
    .from(schema.terraUser)
    .where(eq(schema.terraUser.userId, userId))
    .limit(1);
  return user;
}

export async function getUserRecords(
  userId: string,
  db: Db = getDb(),
): Promise<ClinicalRecord[]> {
  const rows = await db
    .select({ payload: schema.clinicalRecord.payload })
    .from(schema.clinicalRecord)
    .where(and(eq(schema.clinicalRecord.userId, userId)));
  return rows.map((r) => JSON.parse(r.payload) as ClinicalRecord);
}

export async function markWebhook(userId: string, db: Db = getDb()) {
  await db
    .update(schema.terraUser)
    .set({ lastWebhookAt: new Date() })
    .where(eq(schema.terraUser.userId, userId));
}

/**
 * Page the pull API from the stored cursor (full backfill on first run) and
 * persist records + cursor after every page, so an interrupted sync resumes
 * where it stopped instead of starting over.
 */
export async function syncUser(
  client: TerraClient,
  userId: string,
  db: Db = getDb(),
) {
  const user = await getUser(userId, db);
  try {
    const result = await backfillClinicalRecords(client, {
      userId,
      cursor: user?.syncCursor,
      onPage: async (records, nextCursor) => {
        await upsertRecords(userId, records, db);
        await db
          .update(schema.terraUser)
          .set({ syncCursor: nextCursor || null })
          .where(eq(schema.terraUser.userId, userId));
      },
    });
    await db
      .update(schema.terraUser)
      .set({ lastSyncedAt: new Date(), lastSyncError: null })
      .where(eq(schema.terraUser.userId, userId));
    return result;
  } catch (err) {
    await db
      .update(schema.terraUser)
      .set({
        lastSyncError: err instanceof Error ? err.message : String(err),
      })
      .where(eq(schema.terraUser.userId, userId));
    throw err;
  }
}
