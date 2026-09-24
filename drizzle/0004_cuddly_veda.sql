CREATE TABLE `resumes` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`track` text DEFAULT '' NOT NULL,
	`template` text DEFAULT 'classic' NOT NULL,
	`paper` text DEFAULT 'letter' NOT NULL,
	`data` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `resumes_updated` ON `resumes` (`updated_at`);