-- Referência manual. O ideal é gerar esta migração com:
--   DATABASE_URL=... pnpm drizzle-kit generate
-- rodando localmente com pnpm install feito e acesso ao schema.ts atualizado,
-- para que drizzle atualize também drizzle/meta/_journal.json corretamente.
-- Este arquivo documenta o SQL esperado caso a geração automática não esteja
-- disponível no seu ambiente.

ALTER TABLE `inventoryCycles` ADD `archiveStatus` enum('ACTIVE','PENDING','ARCHIVED','ERROR') NOT NULL DEFAULT 'ACTIVE';--> statement-breakpoint
ALTER TABLE `inventoryCycles` ADD `archivedAt` timestamp;--> statement-breakpoint
ALTER TABLE `inventoryCycles` ADD `archiveLocation` varchar(512);--> statement-breakpoint
ALTER TABLE `inventoryCycles` ADD `archiveVersion` int;--> statement-breakpoint
ALTER TABLE `inventoryCycles` ADD `archiveError` text;--> statement-breakpoint
CREATE INDEX `cycle_archive_status_idx` ON `inventoryCycles` (`archiveStatus`);
