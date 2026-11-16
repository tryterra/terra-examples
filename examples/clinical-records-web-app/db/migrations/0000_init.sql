CREATE TABLE `clinical_record` (
	`record_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`clinical_type` text NOT NULL,
	`source_name` text NOT NULL,
	`received_at` text NOT NULL,
	`payload` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `clinical_record_user_idx` ON `clinical_record` (`user_id`,`clinical_type`);--> statement-breakpoint
CREATE TABLE `terra_user` (
	`user_id` text PRIMARY KEY NOT NULL,
	`reference_id` text,
	`provider` text DEFAULT 'APPLE' NOT NULL,
	`sync_cursor` text,
	`last_synced_at` integer,
	`last_sync_error` text,
	`last_webhook_at` integer,
	`created_at` integer NOT NULL
);
