import XLSX from "xlsx";

const workbook = XLSX.readFile("/home/ubuntu/upload/Controle_Escolas_Inventario.xlsx", { cellStyles: true, cellFormula: true, cellNF: true });
const summarizeSheet = (name) => {
  const sheet = workbook.Sheets[name];
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
  const sampleRows = [];
  for (let row = range.s.r; row <= Math.min(range.e.r, range.s.r + 9); row += 1) {
    sampleRows.push(Array.from({ length: range.e.c - range.s.c + 1 }, (_, index) => {
      const cell = sheet[XLSX.utils.encode_cell({ r: row, c: range.s.c + index })];
      return cell ? { value: cell.v, formula: cell.f, format: cell.z, style: cell.s } : null;
    }));
  }
  return { ref: sheet["!ref"], sampleRows, columns: sheet["!cols"], rows: sheet["!rows"], merges: sheet["!merges"], dataValidations: sheet["!dataValidation"] };
};

console.log(JSON.stringify(Object.fromEntries(workbook.SheetNames.map(name => [name, summarizeSheet(name)])), null, 2));
