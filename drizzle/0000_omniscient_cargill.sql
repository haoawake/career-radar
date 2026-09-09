CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`company` text NOT NULL,
	`title` text NOT NULL,
	`location` text NOT NULL,
	`url` text NOT NULL,
	`description` text NOT NULL,
	`role` text NOT NULL,
	`kind` text NOT NULL,
	`first_seen` text NOT NULL,
	`last_seen` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`starred` integer DEFAULT 0 NOT NULL,
	`applied` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `jobs_source` ON `jobs` (`source`);--> statement-breakpoint
CREATE INDEX `jobs_first_seen` ON `jobs` (`first_seen`);--> statement-breakpoint
CREATE TABLE `sources` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`last_success` text,
	`last_attempt` text,
	`error` text,
	`count` integer DEFAULT 0,
	`lease_until` integer DEFAULT 0
);
