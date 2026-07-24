CREATE TABLE `patient` (
	`id` text PRIMARY KEY NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`email` text NOT NULL,
	`phone_number` text NOT NULL,
	`country_code` text NOT NULL,
	`date_of_birth` text NOT NULL,
	`gender_at_birth` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `patient_order_item` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`patient_id` text NOT NULL,
	`order_id` text NOT NULL,
	`order_item_id` text NOT NULL,
	`test_taker_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`patient_id`) REFERENCES `patient`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `patient_order_item_item_uq` ON `patient_order_item` (`order_item_id`);--> statement-breakpoint
CREATE INDEX `patient_order_item_patient_idx` ON `patient_order_item` (`patient_id`);--> statement-breakpoint
CREATE TABLE `webhook_event` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_id` text NOT NULL,
	`event_type` text NOT NULL,
	`status` text NOT NULL,
	`order_id` text,
	`order_item_id` text,
	`signature_valid` integer NOT NULL,
	`payload` text NOT NULL,
	`received_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `webhook_event_event_id_uq` ON `webhook_event` (`event_id`);--> statement-breakpoint
CREATE INDEX `webhook_event_received_idx` ON `webhook_event` (`received_at`);