import XLSX from "xlsx";

const workbook = XLSX.readFile("/home/ubuntu/upload/Controle_Escolas_Inventario.xlsx");
const sheet = workbook.Sheets["Escolas e Inventário"];
const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
const headers = Array.from({ length: range.e.c - range.s.c + 1 }, (_, index) => sheet[XLSX.utils.encode_cell({ r: range.s.r, c: range.s.c + index })]?.v || "");
const lookup = workbook.Sheets["Localizar Escola"];
const lookupHeaders = Array.from({ length: 8 }, (_, index) => lookup[XLSX.utils.encode_cell({ r: 5, c: index })]?.v || "");
console.log(headers.map((header, index) => `${String.fromCharCode(65 + index)}: ${header}`).join("\n"));
console.log("\nLocalizar Escola:\n" + lookupHeaders.join(" | "));
