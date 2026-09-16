ALTER TABLE `schools` ADD CONSTRAINT `school_code_unique` UNIQUE(`schoolCode`);--> statement-breakpoint
ALTER TABLE `schools` ADD CONSTRAINT `school_email_unique` UNIQUE(`email`);