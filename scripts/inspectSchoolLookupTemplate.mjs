import XLSX from "xlsx";

const workbook = XLSX.readFile("/home/ubuntu/upload/Controle_Escolas_Inventario.xlsx", { cellStyles: true, cellFormula: true, cellNF: true });
const sheet = workbook.Sheets["Localizar Escola"];
const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
const cells = [];
for (let row = range.s.r; row <= range.e.r; row += 1) {
  for (let column = range.s.c; column <= range.e.c; column += 1) {
    const address = XLSX.utils.encode_cell({ r: row, c: column });
    const cell = sheet[address];
    if (cell) cells.push({ address, value: cell.v, formula: cell.f, format: cell.z, style: cell.s });
  }
}
console.log(JSON.stringify({ ref: sheet["!ref"], merges: sheet["!merges"], columns: sheet["!cols"], rows: sheet["!rows"], autoFilter: sheet["!autofilter"], dataValidations: sheet["!dataValidation"], cells }, null, 2));
