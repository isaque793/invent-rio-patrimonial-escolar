import XLSX from "xlsx";
import { desc, eq } from "drizzle-orm";
import { inventoryCycles, inventoryIssues, schools } from "../drizzle/schema";
import { getDb } from "../server/db";
import { buildPendingIssuesWorkbook, PENDING_TEMPLATE_HEADERS } from "../client/src/lib/exportConsolidatedExcel";

const db = await getDb();
if (!db) throw new Error("Base de dados indisponível para validar a exportação.");

const rows = await db.select({
  Escola: schools.name,
  Tipo: inventoryIssues.issueType,
  Situação: inventoryIssues.resolutionStatus,
  Descrição: inventoryIssues.description,
  Património: inventoryIssues.propertyNumber,
  Quantidade: inventoryIssues.quantity,
  "Estado de conservação": inventoryIssues.conservationState,
  "Local / bloco": inventoryIssues.location,
  "Valor total (R$)": inventoryIssues.totalValue,
  "Órgão de origem": inventoryIssues.originBody,
  "Situação atual": inventoryIssues.currentSituation,
  Pendência: inventoryIssues.pendingDescription,
  Medidas: inventoryIssues.measuresTaken,
}).from(inventoryIssues).innerJoin(inventoryCycles, eq(inventoryCycles.id, inventoryIssues.cycleId)).innerJoin(schools, eq(schools.id, inventoryCycles.schoolId)).orderBy(desc(inventoryIssues.id)).limit(1);

if (!rows.length) throw new Error("Não há pendência real disponível para validar a exportação.");

const workbook = buildPendingIssuesWorkbook(rows);
const output = "/home/ubuntu/Downloads/validacao-registro-pendencias.xlsx";
XLSX.writeFile(workbook, output);
const check = XLSX.readFile(output, { cellNF: true });
const header = XLSX.utils.sheet_to_json(check.Sheets["Registro de Pendências"], { header: 1 })[0];
if (JSON.stringify(header) !== JSON.stringify(PENDING_TEMPLATE_HEADERS)) throw new Error("Cabeçalhos não correspondem ao modelo.");
if (!check.SheetNames.includes("Listas")) throw new Error("Aba auxiliar Listas não foi criada.");
const currencyCell = check.Sheets["Registro de Pendências"]["H2"];
if (!currencyCell || currencyCell.t !== "n") throw new Error("Valor monetário não foi gravado como número.");
console.log(JSON.stringify({ success: true, output, sheets: check.SheetNames, headers: header.length, currencyFormat: currencyCell.z ?? "padrão", firstIssue: rows[0].Descrição }, null, 2));
