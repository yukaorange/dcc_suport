CREATE TABLE `advices` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`plan_id` text,
	`round_index` integer NOT NULL,
	`content` text NOT NULL,
	`timestamp_ms` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_advices_session` ON `advices` (`session_id`);--> statement-breakpoint
CREATE TABLE `plans` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`goal` text NOT NULL,
	`reference_summary` text NOT NULL,
	`steps` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_plans_session` ON `plans` (`session_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`goal` text NOT NULL,
	`reference_image_path` text NOT NULL,
	`display_id` text NOT NULL,
	`display_name` text DEFAULT '' NOT NULL,
	`started_at` text DEFAULT (datetime('now')) NOT NULL,
	`ended_at` text
);
