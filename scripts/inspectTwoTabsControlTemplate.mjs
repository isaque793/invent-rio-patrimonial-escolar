import XLSX from "xlsx";

const workbook = XLSX.readFile("/home/ubuntu/upload/Controle_Escolas_2_Abas_Bens_na_Busca.xlsx", { cellStyles: true, cellFormula: true, cellNF: true });

function cellInfo(sheet, row, col) {
  const address = XLSX.utils.encode_cell({ r: row, c: col });
  const cell = sheet[address];
  return cell ? { address, value: cell.v, formula: cell.f, format: cell.z, style: cell.s } : null;
}

function inspectSheet(name) {
  const sheet = workbook.Sheets[name];
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
  const formulas = [];
  for (let row = range.s.r; row <= range.e.r; row += 1) {
    for (let col = range.s.c; col <= range.e.c; col += 1) {
      const cell = cellInfo(sheet, row, col);
      if (cell?.formula) formulas.push(cell);
    }
  }
  return {
    ref: sheet["!ref"],
    autoFilter: sheet["!autofilter"],
    columns: sheet["!cols"],
    rowSettings: sheet["!rows"],
    merges: sheet["!merges"],
    dataValidations: sheet["!dataValidation"],
    frozenPanes: sheet["!freeze"],
    sampleRows: Array.from({ length: Math.min(range.e.r - range.s.r + 1, 28) }, (_, index) => Array.from({ length: range.e.c - range.s.c + 1 }, (_, column) => cellInfo(sheet, range.s.r + index, range.s.c + column))),
    formulaCount: formulas.length,
    formulas: formulas.slice(0, 120),
  };
}

console.log(JSON.stringify(Object.fromEntries(workbook.SheetNames.map(name => [name, inspectSheet(name)])), null, 2));
