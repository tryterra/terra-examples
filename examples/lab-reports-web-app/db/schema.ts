/**
 * Local schema — deliberately tiny. Terra is the system of record for lab
 * sessions and wearable data; we persist only what Terra cannot hold:
 *
 * - `patient`: the doctor-facing roster. Terra never stores names; a patient
 *   maps to Terra purely through `referenceId` (the only join key between
 *   lab-report sessions and wearable connections).
 * - `labSessionCache` / `wearableDayCache`: read-through caches so a warm
 *   demo run barely touches the live API.
 * - `upload`: in-flight report uploads, so the polling UI survives a refresh.
 */
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const patient = sqliteTable(
  "patient",
  {
    id: text("id").primaryKey(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    dateOfBirth: text("date_of_birth").notNull(), // YYYY-MM-DD
    sex: text("sex", { enum: ["male", "female"] }).notNull(),
    /** Terra reference_id — sent on upload + widget session, unique per patient. */
    referenceId: text("reference_id").notNull(),
    /** Doctor's per-patient watchlist, JSON:
     *  {"biomarkers": string[], "metrics": string[]} — drives the overview
     *  watchlist section. Null = not configured yet. */
    watchlist: text("watchlist"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [uniqueIndex("patient_reference_id_uq").on(t.referenceId)],
);

/**
 * Full-session cache. Only terminal sessions are written (standardized/sent/
 * failed/…): those payloads are immutable, so cache hits never go stale.
 */
export const labSessionCache = sqliteTable(
  "lab_session_cache",
  {
    // Terra snowflake IDs — TEXT on purpose; never store as numbers.
    sessionId: text("session_id").primaryKey(),
    referenceId: text("reference_id").notNull(),
    status: text("status").notNull(),
    payload: text("payload").notNull(), // full LabReportSession JSON
    fetchedAt: integer("fetched_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("lab_session_cache_ref_idx").on(t.referenceId)],
);

/**
 * Per-day wearable payload cache. Past days never change (cache forever);
 * `date === today` entries are re-fetched after a short TTL.
 */
export const wearableDayCache = sqliteTable(
  "wearable_day_cache",
  {
    userId: text("user_id").notNull(),
    resource: text("resource", {
      enum: ["daily", "sleep", "body", "activity"],
    }).notNull(),
    date: text("date").notNull(), // YYYY-MM-DD
    payload: text("payload").notNull(), // JSON array of that day's records
    fetchedAt: integer("fetched_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [primaryKey({ columns: [t.userId, t.resource, t.date] })],
);

/**
 * AI-generated content (overviews and analytics reports), produced by the
 * Claude API from the patient's labs + wearables. `inputHash` fingerprints
 * the generation inputs so unchanged data reuses the cached output instead
 * of re-generating (deterministic demo, no drift on refresh).
 */
export const aiReport = sqliteTable(
  "ai_report",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    patientId: text("patient_id")
      .notNull()
      .references(() => patient.id),
    kind: text("kind", { enum: ["overview", "report", "flag"] }).notNull(),
    model: text("model").notNull(),
    inputHash: text("input_hash").notNull(),
    content: text("content").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("ai_report_patient_kind_idx").on(t.patientId, t.kind)],
);

/**
 * In-flight report uploads. One upload can fan out to N sessions; the
 * client polls GET /api/uploads/:uploadId until every session is terminal.
 */
export const upload = sqliteTable(
  "upload",
  {
    uploadId: text("upload_id").primaryKey(),
    patientId: text("patient_id")
      .notNull()
      .references(() => patient.id),
    fileName: text("file_name").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("upload_patient_idx").on(t.patientId)],
);
