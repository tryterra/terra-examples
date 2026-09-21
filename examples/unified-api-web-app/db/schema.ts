import { relations, sql } from "drizzle-orm";
import type { ScoreContributors } from "../src/server/lib/terra/types-v6-override";
import {
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export * from "./auth-schema";
import { user } from "./auth-schema";

/* ---------------------------------- User Info --------------------------------------- */

export type DashboardConfig = {
  biomarkers: string[];
  scores: string[];
};

export const userInfo = pgTable("user_info", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  age: integer("age"),
  gender: text("gender"),
  heightCm: integer("height_cm"),
  weightKg: integer("weight_kg"),
  lifestyleGoals: text("lifestyle_goals"),
  dashboardConfig: jsonb("dashboard_config").$type<DashboardConfig>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const userInfoRelations = relations(userInfo, ({ one }) => ({
  user: one(user, {
    fields: [userInfo.userId],
    references: [user.id],
  }),
}));

/* ---------------------------------- Chat Index ---------------------------------------- */

export const chat = pgTable(
  "chat",
  {
    id: uuid("id")
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title"),
    lastMessageAt: timestamp("last_message_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("chat_user_last_msg_idx").on(table.userId, table.lastMessageAt),
  ],
);

export const chatRelations = relations(chat, ({ one }) => ({
  user: one(user, {
    fields: [chat.userId],
    references: [user.id],
  }),
}));

/* ---------------------------------- Terra Connections ------------------------------- */

export const terraConnection = pgTable(
  "terra_connection",
  {
    id: uuid("id")
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    terraUserId: text("terra_user_id").notNull().unique(),
    referenceId: text("reference_id").notNull(),
    provider: text("provider").notNull(),
    scopes: jsonb("scopes").$type<string[]>(),
    status: text("status", {
      enum: ["active", "revoked", "error"],
    })
      .default("active")
      .notNull(),
    lastWebhookAt: timestamp("last_webhook_at"),
    connectedAt: timestamp("connected_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("terra_connection_user_id_idx").on(table.userId)],
);

/* ---------------------------------- Summary-keyed tables ---------------------------- */

export const terraActivity = pgTable(
  "terra_activity",
  {
    summaryId: text("summary_id").primaryKey(),
    terraConnectionId: uuid("terra_connection_id")
      .notNull()
      .references(() => terraConnection.id, { onDelete: "cascade" }),
    startTime: timestamp("start_time").notNull(),
    endTime: timestamp("end_time").notNull(),
    activityType: text("activity_type"),
    distanceMeters: real("distance_meters"),
    payloadKey: text("payload_key"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("terra_activity_connection_idx").on(table.terraConnectionId),
  ],
);

export const terraSleep = pgTable(
  "terra_sleep",
  {
    summaryId: text("summary_id").primaryKey(),
    terraConnectionId: uuid("terra_connection_id")
      .notNull()
      .references(() => terraConnection.id, { onDelete: "cascade" }),
    startTime: timestamp("start_time").notNull(),
    endTime: timestamp("end_time").notNull(),
    sleepScore: real("sleep_score"),
    sleepScoreV2: real("sleep_score_v2"),
    readinessScore: real("readiness_score"),
    respiratoryScoreV2: real("respiratory_score_v2"),
    payloadKey: text("payload_key"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("terra_sleep_connection_idx").on(table.terraConnectionId)],
);

/* ---------------------------------- Date-keyed tables -------------------------------- */

export const terraDaily = pgTable(
  "terra_daily",
  {
    terraConnectionId: uuid("terra_connection_id")
      .notNull()
      .references(() => terraConnection.id, { onDelete: "cascade" }),
    date: date("date").notNull(),

    /* --- Biomarkers (standard overwrite — latest is superset) --- */
    steps: integer("steps"),
    restingHrBpm: real("resting_hr_bpm"),
    avgHrvSdnn: real("avg_hrv_sdnn"),
    vo2max: real("vo2max"),
    activeSeconds: real("active_seconds"),
    totalBurnedCalories: real("total_burned_calories"),

    /* --- Scores (COALESCE upsert — nulls never overwrite) --- */
    totalStressScore: real("total_stress_score"),
    totalStressScoreV2: real("total_stress_score_v2"),
    strainIndex: real("strain_index"),
    strainTrafficLight: text("strain_traffic_light"),
    resilienceScore: real("resilience_score"),
    cardiovascularScore: real("cardiovascular_score"),
    immuneIndex: real("immune_index"),
    respiratoryScore: real("respiratory_score"),
    stressContributors: jsonb("stress_contributors").$type<ScoreContributors>(),
    strainContributors: jsonb("strain_contributors").$type<ScoreContributors>(),

    payloadKey: text("payload_key"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.terraConnectionId, table.date] }),
    index("terra_daily_connection_idx").on(table.terraConnectionId),
  ],
);

export const terraBody = pgTable(
  "terra_body",
  {
    terraConnectionId: uuid("terra_connection_id")
      .notNull()
      .references(() => terraConnection.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    payloadKey: text("payload_key"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.terraConnectionId, table.date] }),
    index("terra_body_connection_idx").on(table.terraConnectionId),
  ],
);

export const terraNutrition = pgTable(
  "terra_nutrition",
  {
    terraConnectionId: uuid("terra_connection_id")
      .notNull()
      .references(() => terraConnection.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    payloadKey: text("payload_key"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.terraConnectionId, table.date] }),
    index("terra_nutrition_connection_idx").on(table.terraConnectionId),
  ],
);

export const terraMenstruation = pgTable(
  "terra_menstruation",
  {
    terraConnectionId: uuid("terra_connection_id")
      .notNull()
      .references(() => terraConnection.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    payloadKey: text("payload_key"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.terraConnectionId, table.date] }),
    index("terra_menstruation_connection_idx").on(table.terraConnectionId),
  ],
);

/* ---------------------------------- Webhook Events ---------------------------------- */

export const terraWebhookEvent = pgTable(
  "terra_webhook_event",
  {
    id: uuid("id")
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
    terraReference: text("terra_reference"),
    eventType: text("event_type").notNull(),
    terraUserId: text("terra_user_id"),
    status: text("status", {
      enum: ["received", "processed", "failed"],
    })
      .default("received")
      .notNull(),
    payloadKey: text("payload_key"),
    error: text("error"),
    processedAt: timestamp("processed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("terra_webhook_event_type_idx").on(table.eventType),
    index("terra_webhook_event_user_idx").on(table.terraUserId),
    uniqueIndex("terra_webhook_event_reference_uq")
      .on(table.terraReference)
      .where(sql`terra_reference IS NOT NULL`),
  ],
);

/* ---------------------------------- Terra Relations --------------------------------- */

export const terraConnectionRelations = relations(
  terraConnection,
  ({ one, many }) => ({
    user: one(user, {
      fields: [terraConnection.userId],
      references: [user.id],
    }),
    activities: many(terraActivity),
    sleep: many(terraSleep),
    body: many(terraBody),
    daily: many(terraDaily),
    nutrition: many(terraNutrition),
    menstruation: many(terraMenstruation),
  }),
);

export const terraActivityRelations = relations(terraActivity, ({ one }) => ({
  connection: one(terraConnection, {
    fields: [terraActivity.terraConnectionId],
    references: [terraConnection.id],
  }),
}));

export const terraSleepRelations = relations(terraSleep, ({ one }) => ({
  connection: one(terraConnection, {
    fields: [terraSleep.terraConnectionId],
    references: [terraConnection.id],
  }),
}));

export const terraBodyRelations = relations(terraBody, ({ one }) => ({
  connection: one(terraConnection, {
    fields: [terraBody.terraConnectionId],
    references: [terraConnection.id],
  }),
}));

export const terraDailyRelations = relations(terraDaily, ({ one }) => ({
  connection: one(terraConnection, {
    fields: [terraDaily.terraConnectionId],
    references: [terraConnection.id],
  }),
}));

export const terraNutritionRelations = relations(terraNutrition, ({ one }) => ({
  connection: one(terraConnection, {
    fields: [terraNutrition.terraConnectionId],
    references: [terraConnection.id],
  }),
}));

export const terraMenstruationRelations = relations(
  terraMenstruation,
  ({ one }) => ({
    connection: one(terraConnection, {
      fields: [terraMenstruation.terraConnectionId],
      references: [terraConnection.id],
    }),
  }),
);
