import XLSX from "xlsx";
import { getManagementControlExportData } from "../server/db";
import { buildSchoolControlWorkbook, SCHOOL_CONTROL_TEMPLATE_HEADERS } from "../client/src/lib/exportConsolidatedExcel";

const year = Number(process.argv[2] ?? new Date().getFullYear());
const records = await getManagementControlExportData(year);
if (!records.length) throw new Error("Não há escolas cadastradas para validar a exportação consolidada.");

const outputPath = `/tmp/resumo-consolidado-inventario-${year}.xlsx`;
XLSX.writeFile(buildSchoolControlWorkbook(records), outputPath);
const workbook = XLSX.readFile(outputPath, { cellFormula: true, cellNF: true, cellStyles: true });
const sheet = workbook.Sheets["Escolas e Inventario"];
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
const firstItemRow = rows.findIndex((row, index) => index > 0 && row[9] !== "" && row[10] !== "");

if (workbook.SheetNames.join("|") !== "Escolas e Inventario|Localizar Escola") throw new Error("As abas do modelo consolidado não foram preservadas.");
if (JSON.stringify(rows[0]) !== JSON.stringify(SCHOOL_CONTROL_TEMPLATE_HEADERS)) throw new Error("Os 30 cabeçalhos do modelo não foram preservados.");
if (sheet["!ref"] !== "A1:AD1001") throw new Error("A área de mil registros e as colunas auxiliares do modelo não foram preservadas.");
if (!sheet["K2"]?.z || !sheet["L2"]?.z) throw new Error("A formatação monetária não foi aplicada ao modelo.");
if (firstItemRow >= 0 && !sheet[`L${firstItemRow + 1}`]?.f) throw new Error("A fórmula de valor total não foi aplicada a um item patrimonial real.");
if (!sheet["AC2"]?.f || !sheet["AD2"]?.f) throw new Error("As fórmulas auxiliares de sequência e busca não foram preservadas.");
const lookupSheet = workbook.Sheets["Localizar Escola"];
if (lookupSheet["!ref"] !== "A1:I69" || !lookupSheet["B6"]?.f?.includes("'Escolas e Inventario'!$A$2:$A$1001")) throw new Error("A aba de localização não contém a busca dinâmica do modelo.");
if (lookupSheet["B16"]?.z !== "R$ #,##0.00") throw new Error("O valor total da aba de localização não preserva a formatação monetária.");
if (!lookupSheet["A20"]?.f?.includes("'Escolas e Inventario'!$D$2:$D$1001") || !lookupSheet["I20"]?.f) throw new Error("A listagem de bens da escola localizada não foi preservada.");

console.log(JSON.stringify({ year, schools: records.length, exportedRows: rows.length - 1, firstItemRow: firstItemRow >= 0 ? firstItemRow + 1 : null, sheets: workbook.SheetNames, lookupFormula: lookupSheet["A7"]?.f, headers: rows[0] }, null, 2));
process.exit(0);
