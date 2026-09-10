import XLSX from "xlsx";

const workbook = XLSX.readFile("/home/ubuntu/upload/Registro_de_Pendencias.xlsx", { cellStyles: true });
const sheet = workbook.Sheets["Registro de Pendências"];
const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
const headers = Array.from({ length: range.e.c - range.s.c + 1 }, (_, index) => sheet[XLSX.utils.encode_cell({ r: range.s.r, c: range.s.c + index })]?.v || "");
const lists = XLSX.utils.sheet_to_json(workbook.Sheets.Listas, { header: 1, defval: "" });
console.log(JSON.stringify({ ref: sheet["!ref"], headers, columns: sheet["!cols"], merges: sheet["!merges"], dataValidations: sheet["!dataValidation"], lists }, null, 2));
