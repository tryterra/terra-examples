/**
 * Local schema - deliberately small. Terra is the system of record; this
 * app keeps a read model so the dashboard renders without re-paging the API:
 *
 * - `terraUser`: Terra users the app tracks, plus the pull-API resume cursor.
 * - `clinicalRecord`: one row per Terra `record_id`, the full record as JSON.
 *   Webhooks and backfills both upsert here; a later `received_at` wins.
 */
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const terraUser = sqliteTable("terra_user", {
  userId: text("user_id").primaryKey(),
  referenceId: text("reference_id"),
  provider: text("provider").notNull().default("APPLE"),
  /** next_cursor from the last pull-API page; resume here on the next sync. */
  syncCursor: text("sync_cursor"),
  lastSyncedAt: integer("last_synced_at", { mode: "timestamp" }),
  lastSyncError: text("last_sync_error"),
  lastWebhookAt: integer("last_webhook_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const clinicalRecord = sqliteTable(
  "clinical_record",
  {
    recordId: text("record_id").primaryKey(),
    userId: text("user_id").notNull(),
    clinicalType: text("clinical_type").notNull(),
    sourceName: text("source_name").notNull(),
    receivedAt: text("received_at").notNull(), // ISO 8601, as Terra sends it
    payload: text("payload").notNull(), // full ClinicalRecord JSON
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("clinical_record_user_idx").on(t.userId, t.clinicalType)],
);
