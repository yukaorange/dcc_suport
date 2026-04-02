CREATE TABLE `session_images` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`file_path` text NOT NULL,
	`label` text DEFAULT '' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`image_type` text DEFAULT 'reference' NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_session_images_session` ON `session_images` (`session_id`);
--> statement-breakpoint
-- 既存データの移行: reference_image_path を session_images に移す
INSERT INTO `session_images` (`id`, `session_id`, `file_path`, `label`, `sort_order`, `image_type`)
SELECT
	lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))),
	`id`,
	`reference_image_path`,
	'',
	0,
	'reference'
FROM `sessions`
WHERE `reference_image_path` IS NOT NULL AND `reference_image_path` != '';
--> statement-breakpoint
-- SQLiteではALTER TABLE DROP COLUMNがサポートされているのは3.35.0+
ALTER TABLE `sessions` DROP COLUMN `reference_image_path`;
