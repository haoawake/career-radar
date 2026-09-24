ALTER TABLE `jobs` ADD `level` text;--> statement-breakpoint
ALTER TABLE `jobs` ADD `visa` text;--> statement-breakpoint
ALTER TABLE `jobs` ADD `visa_note` text;--> statement-breakpoint
CREATE INDEX `jobs_level` ON `jobs` (`level`);--> statement-breakpoint
CREATE INDEX `jobs_visa` ON `jobs` (`visa`);