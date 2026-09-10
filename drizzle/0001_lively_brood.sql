CREATE TABLE `committeeMembers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cycleId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`jobTitle` varchar(160) NOT NULL,
	`masp` varchar(32) NOT NULL,
	`isPresident` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `committeeMembers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inventoryCycles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`schoolId` int NOT NULL,
	`year` int NOT NULL,
	`status` enum('draft','submitted','under_review','returned','validated') NOT NULL DEFAULT 'draft',
	`submittedAt` timestamp,
	`reviewedAt` timestamp,
	`reviewNotes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `inventoryCycles_id` PRIMARY KEY(`id`),
	CONSTRAINT `cycle_school_year_unique` UNIQUE(`schoolId`,`year`)
);
--> statement-breakpoint
CREATE TABLE `inventoryDocuments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cycleId` int NOT NULL,
	`documentType` enum('opening_minutes','responsibility_term','closing_minutes') NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`mimeType` varchar(120) NOT NULL,
	`fileSize` int NOT NULL,
	`storageKey` varchar(512) NOT NULL,
	`storageUrl` varchar(512) NOT NULL,
	`uploadedByUserId` int NOT NULL,
	`uploadedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `inventoryDocuments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inventoryIssues` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cycleId` int NOT NULL,
	`issueType` enum('not_found','outside_register','new_equipment','transfer','donation','guard_term','other') NOT NULL,
	`propertyNumber` varchar(80),
	`quantity` int,
	`description` text NOT NULL,
	`conservationState` varchar(80),
	`location` varchar(160),
	`totalValue` decimal(14,2),
	`originBody` varchar(255),
	`currentSituation` varchar(160),
	`pendingDescription` text NOT NULL,
	`measuresTaken` text,
	`resolutionStatus` enum('open','in_progress','resolved') NOT NULL DEFAULT 'open',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `inventoryIssues_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inventoryItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cycleId` int NOT NULL,
	`propertyNumber` varchar(80) NOT NULL,
	`quantity` int NOT NULL,
	`description` text NOT NULL,
	`technicalDetails` text,
	`expenseCode` varchar(16) NOT NULL,
	`conservationCode` varchar(32),
	`conservationState` varchar(80) NOT NULL,
	`unitValue` decimal(14,2) NOT NULL,
	`totalValue` decimal(14,2) NOT NULL,
	`currentSituation` varchar(160) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `inventoryItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inventoryNotes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cycleId` int NOT NULL,
	`problemsFound` text,
	`quantityDivergences` text,
	`valueDivergences` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `inventoryNotes_id` PRIMARY KEY(`id`),
	CONSTRAINT `inventoryNotes_cycleId_unique` UNIQUE(`cycleId`)
);
--> statement-breakpoint
CREATE TABLE `schoolMemberships` (
	`id` int AUTO_INCREMENT NOT NULL,
	`schoolId` int NOT NULL,
	`userId` int NOT NULL,
	`accessRole` enum('coordinator','contributor') NOT NULL DEFAULT 'contributor',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `schoolMemberships_id` PRIMARY KEY(`id`),
	CONSTRAINT `school_user_unique` UNIQUE(`schoolId`,`userId`)
);
--> statement-breakpoint
CREATE TABLE `schools` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`schoolCode` varchar(64),
	`city` varchar(120),
	`regionalOffice` varchar(160),
	`email` varchar(320),
	`phone` varchar(40),
	`responsibleName` varchar(255),
	`responsibleMasp` varchar(32),
	`responsibleRole` varchar(120),
	`directorName` varchar(255),
	`directorMasp` varchar(32),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `schools_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `validationHistory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cycleId` int NOT NULL,
	`action` enum('submitted','under_review','returned','validated') NOT NULL,
	`note` text,
	`performedByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `validationHistory_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `committee_cycle_idx` ON `committeeMembers` (`cycleId`);--> statement-breakpoint
CREATE INDEX `cycle_school_idx` ON `inventoryCycles` (`schoolId`);--> statement-breakpoint
CREATE INDEX `cycle_status_idx` ON `inventoryCycles` (`status`);--> statement-breakpoint
CREATE INDEX `document_cycle_type_idx` ON `inventoryDocuments` (`cycleId`,`documentType`);--> statement-breakpoint
CREATE INDEX `issue_cycle_idx` ON `inventoryIssues` (`cycleId`);--> statement-breakpoint
CREATE INDEX `issue_status_idx` ON `inventoryIssues` (`resolutionStatus`);--> statement-breakpoint
CREATE INDEX `item_cycle_idx` ON `inventoryItems` (`cycleId`);--> statement-breakpoint
CREATE INDEX `item_expense_idx` ON `inventoryItems` (`expenseCode`);--> statement-breakpoint
CREATE INDEX `notes_cycle_idx` ON `inventoryNotes` (`cycleId`);--> statement-breakpoint
CREATE INDEX `membership_school_idx` ON `schoolMemberships` (`schoolId`);--> statement-breakpoint
CREATE INDEX `membership_user_idx` ON `schoolMemberships` (`userId`);--> statement-breakpoint
CREATE INDEX `validation_cycle_idx` ON `validationHistory` (`cycleId`);