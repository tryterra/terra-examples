CREATE TABLE "chat" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text,
	"last_message_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "terra_activity" (
	"summary_id" text PRIMARY KEY NOT NULL,
	"terra_connection_id" uuid NOT NULL,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp NOT NULL,
	"activity_type" text,
	"distance_meters" real,
	"payload_key" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "terra_body" (
	"terra_connection_id" uuid NOT NULL,
	"date" date NOT NULL,
	"payload_key" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "terra_body_terra_connection_id_date_pk" PRIMARY KEY("terra_connection_id","date")
);
--> statement-breakpoint
CREATE TABLE "terra_connection" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"terra_user_id" text NOT NULL,
	"reference_id" text NOT NULL,
	"provider" text NOT NULL,
	"scopes" jsonb,
	"status" text DEFAULT 'active' NOT NULL,
	"last_webhook_at" timestamp,
	"connected_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "terra_connection_terra_user_id_unique" UNIQUE("terra_user_id")
);
--> statement-breakpoint
CREATE TABLE "terra_daily" (
	"terra_connection_id" uuid NOT NULL,
	"date" date NOT NULL,
	"steps" integer,
	"resting_hr_bpm" real,
	"avg_hrv_sdnn" real,
	"vo2max" real,
	"active_seconds" real,
	"total_burned_calories" real,
	"total_stress_score" real,
	"total_stress_score_v2" real,
	"strain_index" real,
	"strain_traffic_light" text,
	"resilience_score" real,
	"cardiovascular_score" real,
	"immune_index" real,
	"respiratory_score" real,
	"stress_contributors" jsonb,
	"strain_contributors" jsonb,
	"payload_key" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "terra_daily_terra_connection_id_date_pk" PRIMARY KEY("terra_connection_id","date")
);
--> statement-breakpoint
CREATE TABLE "terra_menstruation" (
	"terra_connection_id" uuid NOT NULL,
	"date" date NOT NULL,
	"payload_key" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "terra_menstruation_terra_connection_id_date_pk" PRIMARY KEY("terra_connection_id","date")
);
--> statement-breakpoint
CREATE TABLE "terra_nutrition" (
	"terra_connection_id" uuid NOT NULL,
	"date" date NOT NULL,
	"payload_key" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "terra_nutrition_terra_connection_id_date_pk" PRIMARY KEY("terra_connection_id","date")
);
--> statement-breakpoint
CREATE TABLE "terra_sleep" (
	"summary_id" text PRIMARY KEY NOT NULL,
	"terra_connection_id" uuid NOT NULL,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp NOT NULL,
	"sleep_score" real,
	"sleep_score_v2" real,
	"readiness_score" real,
	"respiratory_score_v2" real,
	"payload_key" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "terra_webhook_event" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"terra_reference" text,
	"event_type" text NOT NULL,
	"terra_user_id" text,
	"status" text DEFAULT 'received' NOT NULL,
	"payload_key" text,
	"error" text,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_info" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"age" integer,
	"gender" text,
	"height_cm" integer,
	"weight_kg" integer,
	"lifestyle_goals" text,
	"dashboard_config" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" uuid NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"onboarding_step" text DEFAULT 'profile' NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat" ADD CONSTRAINT "chat_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terra_activity" ADD CONSTRAINT "terra_activity_terra_connection_id_terra_connection_id_fk" FOREIGN KEY ("terra_connection_id") REFERENCES "public"."terra_connection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terra_body" ADD CONSTRAINT "terra_body_terra_connection_id_terra_connection_id_fk" FOREIGN KEY ("terra_connection_id") REFERENCES "public"."terra_connection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terra_connection" ADD CONSTRAINT "terra_connection_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terra_daily" ADD CONSTRAINT "terra_daily_terra_connection_id_terra_connection_id_fk" FOREIGN KEY ("terra_connection_id") REFERENCES "public"."terra_connection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terra_menstruation" ADD CONSTRAINT "terra_menstruation_terra_connection_id_terra_connection_id_fk" FOREIGN KEY ("terra_connection_id") REFERENCES "public"."terra_connection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terra_nutrition" ADD CONSTRAINT "terra_nutrition_terra_connection_id_terra_connection_id_fk" FOREIGN KEY ("terra_connection_id") REFERENCES "public"."terra_connection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terra_sleep" ADD CONSTRAINT "terra_sleep_terra_connection_id_terra_connection_id_fk" FOREIGN KEY ("terra_connection_id") REFERENCES "public"."terra_connection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_info" ADD CONSTRAINT "user_info_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_user_last_msg_idx" ON "chat" USING btree ("user_id","last_message_at");--> statement-breakpoint
CREATE INDEX "terra_activity_connection_idx" ON "terra_activity" USING btree ("terra_connection_id");--> statement-breakpoint
CREATE INDEX "terra_body_connection_idx" ON "terra_body" USING btree ("terra_connection_id");--> statement-breakpoint
CREATE INDEX "terra_connection_user_id_idx" ON "terra_connection" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "terra_daily_connection_idx" ON "terra_daily" USING btree ("terra_connection_id");--> statement-breakpoint
CREATE INDEX "terra_menstruation_connection_idx" ON "terra_menstruation" USING btree ("terra_connection_id");--> statement-breakpoint
CREATE INDEX "terra_nutrition_connection_idx" ON "terra_nutrition" USING btree ("terra_connection_id");--> statement-breakpoint
CREATE INDEX "terra_sleep_connection_idx" ON "terra_sleep" USING btree ("terra_connection_id");--> statement-breakpoint
CREATE INDEX "terra_webhook_event_type_idx" ON "terra_webhook_event" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "terra_webhook_event_user_idx" ON "terra_webhook_event" USING btree ("terra_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "terra_webhook_event_reference_uq" ON "terra_webhook_event" USING btree ("terra_reference") WHERE terra_reference IS NOT NULL;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");