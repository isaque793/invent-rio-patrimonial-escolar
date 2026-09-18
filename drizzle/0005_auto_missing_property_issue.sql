-- Regra de negócio: qualquer bem marcado como "Não se aplica" no número
-- de patrimônio gera automaticamente uma pendência do tipo outside_register.
-- Itens existentes são retroativamente incluídos e, quando o patrimônio é
-- regularizado, a pendência automática correspondente é marcada como resolvida.

INSERT INTO `inventoryIssues` (
  `cycleId`, `issueType`, `propertyNumber`, `quantity`, `description`,
  `conservationState`, `location`, `totalValue`, `originBody`,
  `currentSituation`, `pendingDescription`, `measuresTaken`, `resolutionStatus`
)
SELECT
  item.`cycleId`,
  'outside_register',
  NULL,
  item.`quantity`,
  CONCAT('Bem sem número de patrimônio: ', item.`description`),
  item.`conservationState`,
  NULL,
  item.`totalValue`,
  NULL,
  item.`currentSituation`,
  'Bem inserido sem número de patrimônio. Regularizar a identificação patrimonial.',
  NULL,
  'open'
FROM `inventoryItems` item
WHERE item.`propertyNumber` = 'Não se aplica'
  AND NOT EXISTS (
    SELECT 1
    FROM `inventoryIssues` issue
    WHERE issue.`cycleId` = item.`cycleId`
      AND issue.`issueType` = 'outside_register'
      AND issue.`propertyNumber` IS NULL
      AND issue.`description` = CONCAT('Bem sem número de patrimônio: ', item.`description`)
  );--> statement-breakpoint

CREATE TRIGGER inventory_items_missing_property_after_insert
AFTER INSERT ON `inventoryItems`
FOR EACH ROW
INSERT INTO `inventoryIssues` (
  `cycleId`, `issueType`, `propertyNumber`, `quantity`, `description`,
  `conservationState`, `location`, `totalValue`, `originBody`,
  `currentSituation`, `pendingDescription`, `measuresTaken`, `resolutionStatus`
)
SELECT
  NEW.`cycleId`,
  'outside_register',
  NULL,
  NEW.`quantity`,
  CONCAT('Bem sem número de patrimônio: ', NEW.`description`),
  NEW.`conservationState`,
  NULL,
  NEW.`totalValue`,
  NULL,
  NEW.`currentSituation`,
  'Bem inserido sem número de patrimônio. Regularizar a identificação patrimonial.',
  NULL,
  'open'
WHERE NEW.`propertyNumber` = 'Não se aplica';--> statement-breakpoint

CREATE TRIGGER inventory_items_missing_property_after_update
AFTER UPDATE ON `inventoryItems`
FOR EACH ROW
INSERT INTO `inventoryIssues` (
  `cycleId`, `issueType`, `propertyNumber`, `quantity`, `description`,
  `conservationState`, `location`, `totalValue`, `originBody`,
  `currentSituation`, `pendingDescription`, `measuresTaken`, `resolutionStatus`
)
SELECT
  NEW.`cycleId`,
  'outside_register',
  NULL,
  NEW.`quantity`,
  CONCAT('Bem sem número de patrimônio: ', NEW.`description`),
  NEW.`conservationState`,
  NULL,
  NEW.`totalValue`,
  NULL,
  NEW.`currentSituation`,
  'Bem inserido sem número de patrimônio. Regularizar a identificação patrimonial.',
  NULL,
  'open'
WHERE OLD.`propertyNumber` <> 'Não se aplica' AND NEW.`propertyNumber` = 'Não se aplica';--> statement-breakpoint

CREATE TRIGGER inventory_items_missing_property_resolved_after_update
AFTER UPDATE ON `inventoryItems`
FOR EACH ROW
UPDATE `inventoryIssues`
SET
  `resolutionStatus` = 'resolved',
  `measuresTaken` = 'Número de patrimônio regularizado no inventário.'
WHERE OLD.`propertyNumber` = 'Não se aplica'
  AND NEW.`propertyNumber` <> 'Não se aplica'
  AND `inventoryIssues`.`cycleId` = NEW.`cycleId`
  AND `inventoryIssues`.`issueType` = 'outside_register'
  AND `inventoryIssues`.`propertyNumber` IS NULL
  AND `inventoryIssues`.`description` = CONCAT('Bem sem número de patrimônio: ', OLD.`description`)
  AND `inventoryIssues`.`resolutionStatus` <> 'resolved';
