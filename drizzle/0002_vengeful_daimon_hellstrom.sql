ALTER TABLE `jobs` ADD `cities` text;--> statement-breakpoint
ALTER TABLE `jobs` ADD `states` text;--> statement-breakpoint
ALTER TABLE `jobs` ADD `metros` text;--> statement-breakpoint
ALTER TABLE `jobs` ADD `remote` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `jobs_metros` ON `jobs` (`metros`);--> statement-breakpoint
CREATE INDEX `jobs_role` ON `jobs` (`role`);