import XLSX from "xlsx";

const workbook = XLSX.readFile("/home/ubuntu/upload/Controle_Escolas_Inventario.xlsx", { cellFormula: true, cellNF: true });
const sheet = workbook.Sheets["Escolas e Inventário"];
const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
const headers = Array.from({ length: range.e.c - range.s.c + 1 }, (_, index) => sheet[XLSX.utils.encode_cell({ r: range.s.r, c: range.s.c + index })]?.v || "");
const firstRecord = Array.from({ length: headers.length }, (_, index) => sheet[XLSX.utils.encode_cell({ r: range.s.r + 1, c: range.s.c + index })] || null).map(cell => cell ? { value: cell.v, formula: cell.f, format: cell.z } : null);
const lookup = workbook.Sheets["Localizar Escola"];
const lookupRows = XLSX.utils.sheet_to_json(lookup, { header: 1, defval: "" }).slice(0, 8);
console.log(JSON.stringify({ headers, columns: sheet["!cols"], firstRecord, formulas: Object.entries(sheet).filter(([key, cell]) => !key.startsWith("!") && cell?.f).map(([address, cell]) => ({ address, formula: cell.f })).slice(0, 40), lookupRows }, null, 2));
