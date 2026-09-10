import XLSX from "xlsx";

const workbook = XLSX.readFile("/home/ubuntu/upload/Controle_Escolas_Inventario.xlsx", { cellStyles: true, cellFormula: true, cellNF: true });
const sheet = workbook.Sheets["Escolas e Inventário"];
const headerCells = Array.from({ length: 27 }, (_, column) => {
  const address = XLSX.utils.encode_cell({ r: 0, c: column });
  const cell = sheet[address];
  return { address, value: cell?.v, style: cell?.s, format: cell?.z };
});
console.log(JSON.stringify({ ref: sheet["!ref"], merges: sheet["!merges"], columns: sheet["!cols"], rows: sheet["!rows"], autoFilter: sheet["!autofilter"], dataValidations: sheet["!dataValidation"], headerCells }, null, 2));
