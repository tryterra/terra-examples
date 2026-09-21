CREATE TABLE `lab_session_cache` (
	`session_id` text PRIMARY KEY NOT NULL,
	`reference_id` text NOT NULL,
	`status` text NOT NULL,
	`payload` text NOT NULL,
	`fetched_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `lab_session_cache_ref_idx` ON `lab_session_cache` (`reference_id`);--> statement-breakpoint
CREATE TABLE `patient` (
	`id` text PRIMARY KEY NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`date_of_birth` text NOT NULL,
	`sex` text NOT NULL,
	`reference_id` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `patient_reference_id_uq` ON `patient` (`reference_id`);--> statement-breakpoint
CREATE TABLE `upload` (
	`upload_id` text PRIMARY KEY NOT NULL,
	`patient_id` text NOT NULL,
	`file_name` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`patient_id`) REFERENCES `patient`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `upload_patient_idx` ON `upload` (`patient_id`);--> statement-breakpoint
CREATE TABLE `wearable_day_cache` (
	`user_id` text NOT NULL,
	`resource` text NOT NULL,
	`date` text NOT NULL,
	`payload` text NOT NULL,
	`fetched_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `resource`, `date`)
);
