import XLSX from "xlsx";

const workbook = XLSX.readFile("/home/ubuntu/upload/Resumo_consolidado.xlsx", { cellStyles: true, cellFormula: true, cellNF: true });

function cellInfo(sheet, row, col) {
  const cell = sheet[XLSX.utils.encode_cell({ r: row, c: col })];
  if (!cell) return null;
  return { address: XLSX.utils.encode_cell({ r: row, c: col }), value: cell.v, formula: cell.f, format: cell.z, style: cell.s };
}

function inspectSheet(name) {
  const sheet = workbook.Sheets[name];
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
  const rows = [];
  for (let row = range.s.r; row <= Math.min(range.e.r, range.s.r + 20); row += 1) {
    rows.push(Array.from({ length: range.e.c - range.s.c + 1 }, (_, index) => cellInfo(sheet, row, range.s.c + index)));
  }
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
    sampleRows: rows,
    formulas: formulas.slice(0, 80),
    formulaCount: formulas.length,
  };
}

console.log(JSON.stringify(Object.fromEntries(workbook.SheetNames.map(name => [name, inspectSheet(name)])), null, 2));
