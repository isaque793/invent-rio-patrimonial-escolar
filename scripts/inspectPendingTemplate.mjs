import XLSX from "xlsx";

const workbook = XLSX.readFile("/home/ubuntu/upload/Registro_de_Pendencias.xlsx", { cellStyles: true });
const result = Object.fromEntries(workbook.SheetNames.map(name => {
  const sheet = workbook.Sheets[name];
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
  const cells = [];
  for (let row = range.s.r; row <= range.e.r; row += 1) {
    cells.push(Array.from({ length: range.e.c - range.s.c + 1 }, (_, index) => {
      const cell = sheet[XLSX.utils.encode_cell({ r: row, c: range.s.c + index })];
      return cell ? { value: cell.v, type: cell.t, format: cell.z, style: cell.s } : null;
    }));
  }
  return [name, { ref: sheet["!ref"], rows: cells, columns: sheet["!cols"], merges: sheet["!merges"], dataValidations: sheet["!dataValidation"] }];
}));
console.log(JSON.stringify(result, null, 2));
