ALTER TABLE `sources` ADD `cursor` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `sources` ADD `run_started` text;--> statement-breakpoint
ALTER TABLE `sources` ADD `run_total` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `sources` ADD `run_count` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `sources` ADD `fingerprint` text;--> statement-breakpoint
ALTER TABLE `sources` ADD `warning` text;