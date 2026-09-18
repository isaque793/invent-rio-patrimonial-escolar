ALTER TABLE `inventoryCycles` ADD `archiveStatus` enum('ACTIVE','PENDING','ARCHIVED','ERROR') DEFAULT 'ACTIVE' NOT NULL;--> statement-breakpoint
ALTER TABLE `inventoryCycles` ADD `archivedAt` timestamp;--> statement-breakpoint
ALTER TABLE `inventoryCycles` ADD `archiveLocation` varchar(512);--> statement-breakpoint
ALTER TABLE `inventoryCycles` ADD `archiveVersion` int;--> statement-breakpoint
ALTER TABLE `inventoryCycles` ADD `archiveError` text;--> statement-breakpoint
CREATE INDEX `cycle_archive_status_idx` ON `inventoryCycles` (`archiveStatus`);