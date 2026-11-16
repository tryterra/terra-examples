/**
 * Demo mode: load the synthetic fixtures into the local database through the
 * same upserts webhooks and backfills use. Idempotent - safe on every boot.
 */
import { DEMO_RECORDS, DEMO_USERS } from "./demo-fixtures";
import { getDb, type Db } from "./lib/db";
import { upsertRecords, upsertUser } from "./lib/store";

export async function seedDemoData(db: Db = getDb()) {
  for (const user of DEMO_USERS) {
    await upsertUser(user, db);
    await upsertRecords(user.user_id, DEMO_RECORDS[user.user_id] ?? [], db);
  }
}
