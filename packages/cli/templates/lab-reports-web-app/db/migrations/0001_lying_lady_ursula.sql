CREATE TABLE `ai_report` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`patient_id` text NOT NULL,
	`kind` text NOT NULL,
	`model` text NOT NULL,
	`input_hash` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`patient_id`) REFERENCES `patient`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ai_report_patient_kind_idx` ON `ai_report` (`patient_id`,`kind`);