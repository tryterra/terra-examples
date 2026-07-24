/**
 * Local schema — deliberately tiny. Vantage is the system of record for
 * orders and results ("query Vantage, don't mirror it"); we persist only
 * what Vantage cannot hold for us:
 *
 * Glossary: a `patient` here is the app's end user — the person Vantage
 * calls the order `recipient` at order time and the `test_taker` once a kit
 * is activated (test_taker_id is Vantage's identifier for them).
 */
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/** Demo end-users. In a real product this is your users table. */
export const patient = sqliteTable("patient", {
  id: text("id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull(),
  phoneNumber: text("phone_number").notNull(),
  countryCode: text("country_code"), // legacy split field; new rows store E.164 in phoneNumber only
  dateOfBirth: text("date_of_birth").notNull(),
  genderAtBirth: text("gender_at_birth", {
    enum: ["male", "female"],
  }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

/**
 * Maps our patient to Vantage order items. Created from the POST /orders
 * response; test_taker_id is filled by the results.kit_activated webhook or
 * recovered via GET /orders/{id} (reconcile).
 */
export const patientOrderItem = sqliteTable(
  "patient_order_item",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    patientId: text("patient_id")
      .notNull()
      .references(() => patient.id),
    // Vantage snowflake IDs — TEXT on purpose; never store as numbers.
    orderId: text("order_id").notNull(),
    orderItemId: text("order_item_id").notNull(),
    testTakerId: text("test_taker_id"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("patient_order_item_item_uq").on(t.orderItemId),
    index("patient_order_item_patient_idx").on(t.patientId),
  ],
);

/**
 * Inbound webhook log: dedup + the ops inbox. Delivery is at-least-once, so
 * event_id carries a unique index — a redelivered event is a no-op insert.
 */
export const webhookEvent = sqliteTable(
  "webhook_event",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    eventId: text("event_id").notNull(),
    eventType: text("event_type").notNull(),
    status: text("status").notNull(),
    orderId: text("order_id"),
    orderItemId: text("order_item_id"),
    signatureValid: integer("signature_valid", { mode: "boolean" }).notNull(),
    payload: text("payload").notNull(),
    receivedAt: integer("received_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("webhook_event_event_id_uq").on(t.eventId),
    index("webhook_event_received_idx").on(t.receivedAt),
  ],
);
