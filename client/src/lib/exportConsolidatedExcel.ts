import * as XLSX from "xlsx-js-style";

export type ConsolidatedExportLine = {
  expenseCode: string;
  quantity: number;
  totalValue: number | string;
};

export const SCHOOL_CONTROL_TEMPLATE_HEADERS = [
  "Escola", "Codigo INEP", "Municipio", "N. patrimonio", "Descricao do bem", "Detalhes tecnicos", "Codigo de despesa", "Codigo de conservacao", "Estado de conservacao", "Quantidade", "Valor unitario (R$)", "Valor total (R$)", "Situacao atual", "Presidente da subcomissao", "Cargo do presidente", "MASP do presidente", "Membro 2", "Cargo membro 2", "MASP membro 2", "Membro 3", "Cargo membro 3", "MASP membro 3", "Ata de Abertura", "Termo de Responsabilidade", "Ata de Encerramento", "Status da validacao", "Pendencias / ocorrencias", "Problemas / divergencias", "Seq. escola", "Chave de busca",
];

type SchoolControlItem = { propertyNumber: string; description: string; technicalDetails: string | null; expenseCode: string; conservationCode: string | null; conservationState: string; quantity: number; unitValue: number | string; currentSituation: string };
type SchoolControlMember = { name: string; jobTitle: string; masp: string; isPresident: number };
type SchoolControlIssue = { description: string; pendingDescription: string; resolutionStatus: "open" | "in_progress" | "resolved" };
type SchoolControlDocument = { documentType: "opening_minutes" | "responsibility_term" | "closing_minutes" };

export type SchoolControlExportRecord = {
  school: { name: string; schoolCode: string | null; city: string | null };
  cycle: { status: "draft" | "submitted" | "under_review" | "returned" | "validated" } | null;
  items: SchoolControlItem[];
  members: SchoolControlMember[];
  issues: SchoolControlIssue[];
  documents: SchoolControlDocument[];
  notes: { problemsFound: string | null; quantityDivergences: string | null; valueDivergences: string | null } | null;
};

const cycleStatusLabels: Record<NonNullable<SchoolControlExportRecord["cycle"]>["status"], string> = {
  draft: "Em preparação",
  submitted: "Submetido",
  under_review: "Em análise",
  returned: "Devolvido",
  validated: "Validado",
};

const issueStatusLabels: Record<SchoolControlIssue["resolutionStatus"], string> = {
  open: "Aberta",
  in_progress: "Em andamento",
  resolved: "Resolvida",
};

const darkHeaderStyle = {
  fill: { patternType: "solid", fgColor: { rgb: "0B5D4B" } },
  font: { bold: true, color: { rgb: "FFFFFF" } },
  alignment: { horizontal: "center", vertical: "center", wrapText: true },
};

const paleHeaderStyle = {
  fill: { patternType: "solid", fgColor: { rgb: "DDEBE6" } },
  font: { bold: true, color: { rgb: "173B30" } },
  alignment: { horizontal: "center", vertical: "center", wrapText: true },
};

function documentStatus(documents: SchoolControlDocument[], type: SchoolControlDocument["documentType"]) {
  return documents.some(document => document.documentType === type) ? "Enviado" : "Pendente";
}

function committeeSlots(members: SchoolControlMember[]) {
  const president = members.find(member => Boolean(member.isPresident)) ?? members[0];
  const otherMembers = members.filter(member => member !== president);
  return [president, otherMembers[0], otherMembers[1]];
}

function setStyle(sheet: XLSX.WorkSheet, address: string, style: NonNullable<XLSX.CellObject["s"]>) {
  const cell = sheet[address] ?? { t: "z", v: "" };
  cell.s = style;
  sheet[address] = cell;
}

export function buildSchoolControlTemplateRows(records: SchoolControlExportRecord[]) {
  return records.flatMap(record => {
    const [president, member2, member3] = committeeSlots(record.members);
    const pendingSummary = record.issues.map(issue => `${issueStatusLabels[issue.resolutionStatus]} — ${issue.description}: ${issue.pendingDescription}`).join("\n");
    const problemsSummary = [
      record.notes?.problemsFound,
      record.notes?.quantityDivergences ? `Divergências de quantidade: ${record.notes.quantityDivergences}` : null,
      record.notes?.valueDivergences ? `Divergências de valor: ${record.notes.valueDivergences}` : null,
    ].filter(Boolean).join("\n");
    const shared = [record.school.name, record.school.schoolCode ?? "", record.school.city ?? ""];
    const followUp = [
      president?.name ?? "", president?.jobTitle ?? "", president?.masp ?? "",
      member2?.name ?? "", member2?.jobTitle ?? "", member2?.masp ?? "",
      member3?.name ?? "", member3?.jobTitle ?? "", member3?.masp ?? "",
      documentStatus(record.documents, "opening_minutes"),
      documentStatus(record.documents, "responsibility_term"),
      documentStatus(record.documents, "closing_minutes"),
      record.cycle ? cycleStatusLabels[record.cycle.status] : "Não iniciado",
      pendingSummary,
      problemsSummary,
    ];
    const itemRows = record.items.length ? record.items : [null];
    return itemRows.map(item => [
      ...shared,
      item?.propertyNumber ?? "",
      item?.description ?? "",
      item?.technicalDetails ?? "",
      item?.expenseCode ?? "",
      item?.conservationCode ?? "",
      item?.conservationState ?? "",
      item?.quantity ?? "",
      item ? Number(item.unitValue) : "",
      "",
      item?.currentSituation ?? "",
      ...followUp,
    ]);
  });
}

function createSchoolLookupSheet() {
  const searchSheet = XLSX.utils.aoa_to_sheet([
    ["LOCALIZAR ESCOLA"],
    [],
    ["Digite parte do nome da escola:"],
    [""],
    [],
    ["Escola encontrada"],
    ["Codigo INEP"],
    ["Municipio"],
    ["Presidente"],
    ["Cargo"],
    ["MASP"],
    ["Status da validacao"],
    ["Pendencias / ocorrencias"],
    ["Problemas / divergencias"],
    ["Quantidade de registros"],
    ["Valor total registrado"],
    [],
    ["BENS PATRIMONIAIS DA ESCOLA LOCALIZADA"],
    ["N. patrimonio", "Descricao do bem", "Codigo de despesa", "Estado de conservacao", "Quantidade", "Valor unitario (R$)", "Valor total (R$)", "Situacao atual", "Chave"],
  ]);
  const lookupFormulas: Record<string, string> = {
    B6: 'IF($A$4="","",IFERROR(INDEX(\'Escolas e Inventario\'!$A$2:$A$1001,MATCH("*"&$A$4&"*",\'Escolas e Inventario\'!$A$2:$A$1001,0)),"ESCOLA NAO ENCONTRADA"))',
    B7: 'IF(OR($B$6="",$B$6="ESCOLA NAO ENCONTRADA"),"",IFERROR(INDEX(\'Escolas e Inventario\'!$B$2:$B$1001,MATCH($B$6,\'Escolas e Inventario\'!$A$2:$A$1001,0)),""))',
    B8: 'IF(OR($B$6="",$B$6="ESCOLA NAO ENCONTRADA"),"",IFERROR(INDEX(\'Escolas e Inventario\'!$C$2:$C$1001,MATCH($B$6,\'Escolas e Inventario\'!$A$2:$A$1001,0)),""))',
    B9: 'IF(OR($B$6="",$B$6="ESCOLA NAO ENCONTRADA"),"",IFERROR(INDEX(\'Escolas e Inventario\'!$N$2:$N$1001,MATCH($B$6,\'Escolas e Inventario\'!$A$2:$A$1001,0)),""))',
    B10: 'IF(OR($B$6="",$B$6="ESCOLA NAO ENCONTRADA"),"",IFERROR(INDEX(\'Escolas e Inventario\'!$O$2:$O$1001,MATCH($B$6,\'Escolas e Inventario\'!$A$2:$A$1001,0)),""))',
    B11: 'IF(OR($B$6="",$B$6="ESCOLA NAO ENCONTRADA"),"",IFERROR(INDEX(\'Escolas e Inventario\'!$P$2:$P$1001,MATCH($B$6,\'Escolas e Inventario\'!$A$2:$A$1001,0)),""))',
    B12: 'IF(OR($B$6="",$B$6="ESCOLA NAO ENCONTRADA"),"",IFERROR(INDEX(\'Escolas e Inventario\'!$Z$2:$Z$1001,MATCH($B$6,\'Escolas e Inventario\'!$A$2:$A$1001,0)),""))',
    B13: 'IF(OR($B$6="",$B$6="ESCOLA NAO ENCONTRADA"),"",IFERROR(INDEX(\'Escolas e Inventario\'!$AA$2:$AA$1001,MATCH($B$6,\'Escolas e Inventario\'!$A$2:$A$1001,0)),""))',
    B14: 'IF(OR($B$6="",$B$6="ESCOLA NAO ENCONTRADA"),"",IFERROR(INDEX(\'Escolas e Inventario\'!$AB$2:$AB$1001,MATCH($B$6,\'Escolas e Inventario\'!$A$2:$A$1001,0)),""))',
    B15: 'IF(OR($B$6="",$B$6="ESCOLA NAO ENCONTRADA"),"",COUNTIF(\'Escolas e Inventario\'!$A$2:$A$1001,$B$6))',
    B16: 'IF(OR($B$6="",$B$6="ESCOLA NAO ENCONTRADA"),"",SUMIF(\'Escolas e Inventario\'!$A$2:$A$1001,$B$6,\'Escolas e Inventario\'!$L$2:$L$1001))',
  };
  Object.entries(lookupFormulas).forEach(([address, formula]) => {
    searchSheet[address] = { t: "s", v: "", f: formula, z: address === "B16" ? "R$ #,##0.00" : "General" };
  });

  for (let row = 20; row <= 69; row += 1) {
    const sourceColumns = ["D", "E", "G", "I", "J", "K", "L", "M"];
    sourceColumns.forEach((sourceColumn, index) => {
      const address = `${XLSX.utils.encode_col(index)}${row}`;
      const format = index === 4 ? "0" : index === 5 || index === 6 ? "R$ #,##0.00" : "General";
      searchSheet[address] = { t: "s", v: "", f: `IFERROR(INDEX('Escolas e Inventario'!$${sourceColumn}$2:$${sourceColumn}$1001,MATCH($I${row},'Escolas e Inventario'!$AD$2:$AD$1001,0)),"")`, z: format };
    });
    searchSheet[`I${row}`] = { t: "s", v: "", f: `IF(OR($B$6="",$B$6="ESCOLA NAO ENCONTRADA"),"",$B$6&"|"&ROWS($I$20:I${row}))` };
  }

  searchSheet["!ref"] = "A1:I69";
  searchSheet["!merges"] = [
    XLSX.utils.decode_range("A1:F1"),
    XLSX.utils.decode_range("A4:D4"),
    XLSX.utils.decode_range("A18:F20"),
    XLSX.utils.decode_range("A18:H18"),
  ];
  searchSheet["!cols"] = [18, 32, 22, 21, 12, 18, 18, 18, 2].map(wch => ({ wch }));
  const lookupRows = Array.from({ length: 19 }, () => ({}));
  lookupRows[0] = { hpt: 32 };
  lookupRows[17] = { hpt: 26 };
  lookupRows[18] = { hpt: 32 };
  searchSheet["!rows"] = lookupRows;

  ["A1", "B1", "C1", "D1", "E1", "F1", "A18", "B18", "C18", "D18", "E18", "F18", "G18", "H18"].forEach(address => setStyle(searchSheet, address, darkHeaderStyle));
  Array.from({ length: 11 }, (_, index) => `A${index + 6}`).forEach(address => setStyle(searchSheet, address, { ...paleHeaderStyle, alignment: { horizontal: "left", vertical: "center", wrapText: true } }));
  ["A4", "B4", "C4", "D4"].forEach(address => setStyle(searchSheet, address, { fill: { patternType: "solid", fgColor: { rgb: "F5F8F5" } }, alignment: { vertical: "center" } }));
  ["A19", "B19", "C19", "D19", "E19", "F19", "G19", "H19"].forEach(address => setStyle(searchSheet, address, paleHeaderStyle));
  for (let row = 20; row <= 69; row += 1) {
    for (let column = 0; column <= 8; column += 1) {
      const address = `${XLSX.utils.encode_col(column)}${row}`;
      const baseStyle = { alignment: { vertical: "top", wrapText: true } };
      setStyle(searchSheet, address, row === 20 && column <= 5 ? { ...baseStyle, fill: { patternType: "solid", fgColor: { rgb: "F5F8F5" } } } : baseStyle);
    }
  }
  return searchSheet;
}

export function buildSchoolControlWorkbook(records: SchoolControlExportRecord[]) {
  const rows = buildSchoolControlTemplateRows(records);
  const worksheet = XLSX.utils.aoa_to_sheet([SCHOOL_CONTROL_TEMPLATE_HEADERS, ...rows]);
  const reservedRowCount = Math.max(rows.length, 1000);
  worksheet["!ref"] = `A1:AD${reservedRowCount + 1}`;
  worksheet["!cols"] = [30, 14, 20, 18, 30, 36, 22, 22, 20, 12, 18, 18, 18, 28, 22, 18, 24, 20, 16, 24, 20, 16, 18, 24, 20, 20, 36, 36, 3, 3].map(wch => ({ wch }));
  worksheet["!rows"] = [{ hpt: 40 }];
  SCHOOL_CONTROL_TEMPLATE_HEADERS.forEach((_, index) => setStyle(worksheet, XLSX.utils.encode_cell({ r: 0, c: index }), index < 28 ? darkHeaderStyle : paleHeaderStyle));

  for (let rowIndex = 0; rowIndex < reservedRowCount; rowIndex += 1) {
    const excelRow = rowIndex + 2;
    for (let columnIndex = 0; columnIndex < SCHOOL_CONTROL_TEMPLATE_HEADERS.length; columnIndex += 1) {
      setStyle(worksheet, XLSX.utils.encode_cell({ r: rowIndex + 1, c: columnIndex }), { alignment: { vertical: "top", wrapText: true } });
    }
    ["K", "L"].forEach(column => {
      const address = `${column}${excelRow}`;
      const cell = worksheet[address] ?? { t: "z", v: "" };
      cell.z = "R$ #,##0.00";
      worksheet[address] = cell;
    });
    worksheet[`L${excelRow}`] = { t: "n", v: "", f: `IF(OR(J${excelRow}="",K${excelRow}=""),"",J${excelRow}*K${excelRow})`, z: "R$ #,##0.00", s: { alignment: { vertical: "top", wrapText: true } } };
    worksheet[`AC${excelRow}`] = { t: "n", v: "", f: `IF(A${excelRow}="","",COUNTIF($A$2:A${excelRow},A${excelRow}))`, s: { alignment: { vertical: "top", wrapText: true } } };
    worksheet[`AD${excelRow}`] = { t: "s", v: "", f: `IF(A${excelRow}="","",A${excelRow}&"|"&AC${excelRow})`, s: { alignment: { vertical: "top", wrapText: true } } };
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Escolas e Inventario");
  XLSX.utils.book_append_sheet(workbook, createSchoolLookupSheet(), "Localizar Escola");
  return workbook;
}

export function exportSchoolControlWorkbook({ year, records }: { year: number; records: SchoolControlExportRecord[] }) {
  if (!records.length) return false;
  XLSX.writeFile(buildSchoolControlWorkbook(records), `resumo-consolidado-inventario-${year}.xlsx`);
  return true;
}

export function buildConsolidatedExcelRows({ year, lines, categoryNames }: { year: number; lines: ConsolidatedExportLine[]; categoryNames: Record<string, string> }) {
  const totalQuantity = lines.reduce((total, line) => total + Number(line.quantity || 0), 0);
  const totalValue = lines.reduce((total, line) => total + Number(line.totalValue || 0), 0);
  return [
    ["CONSOLIDADO DO INVENTÁRIO PATRIMONIAL — TODAS AS ESCOLAS"],
    ["Ano do inventário", year],
    ["Abrangência", "Todas as escolas cadastradas"],
    [],
    ["Código de despesa", "Elemento / item de despesa", "Quantidade", "Valor total (R$)"],
    ...lines.map(line => [line.expenseCode, categoryNames[line.expenseCode] || "Não classificado", Number(line.quantity || 0), Number(line.totalValue || 0)]),
    ["TOTAL GLOBAL", "", totalQuantity, totalValue],
  ];
}

export function exportConsolidatedSchoolsExcel({ year, lines, categoryNames }: { year: number; lines: ConsolidatedExportLine[]; categoryNames: Record<string, string> }) {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(buildConsolidatedExcelRows({ year, lines, categoryNames }));
  sheet["!merges"] = [XLSX.utils.decode_range("A1:D1")];
  sheet["!cols"] = [{ wch: 22 }, { wch: 42 }, { wch: 14 }, { wch: 20 }];
  for (let row = 6; row <= lines.length + 6; row += 1) {
    const cell = sheet[`D${row}`];
    if (cell) cell.z = "R$ #,##0.00";
  }
  XLSX.utils.book_append_sheet(workbook, sheet, "Consolidado Geral");
  XLSX.writeFile(workbook, `consolidado-inventario-escolas-${year}.xlsx`);
}

export function exportAdministrativeRowsAsExcel({ title, rows, fileName }: { title: string; rows: Array<Record<string, unknown>>; fileName: string }) {
  if (!rows.length) return false;
  const headers = Object.keys(rows[0]);
  const values = rows.map(row => headers.map(header => row[header] ?? ""));
  const quantityColumn = headers.findIndex(header => header === "Quantidade");
  const valueColumn = headers.findIndex(header => header.includes("Valor total"));
  const totalQuantity = quantityColumn >= 0 ? values.reduce((total, row) => total + Number(row[quantityColumn] || 0), 0) : null;
  const totalValue = valueColumn >= 0 ? values.reduce((total, row) => total + Number(row[valueColumn] || 0), 0) : null;
  const totalRow = headers.map((_, index) => index === 0 ? "TOTAL GLOBAL" : index === quantityColumn ? totalQuantity : index === valueColumn ? totalValue : "");
  const sheet = XLSX.utils.aoa_to_sheet([[title], [], headers, ...values, ...(totalQuantity !== null || totalValue !== null ? [totalRow] : [])]);
  sheet["!merges"] = [XLSX.utils.decode_range(`A1:${XLSX.utils.encode_col(Math.max(headers.length - 1, 0))}1`)];
  sheet["!cols"] = headers.map(header => ({ wch: Math.max(16, Math.min(42, header.length + 12)) }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Consolidado Geral");
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
  return true;
}

export const PENDING_TEMPLATE_HEADERS = ["Tipo de ocorrência", "Estado de acompanhamento", "Descrição resumida", "N.º de patrimônio", "Quantidade", "Estado de conservação", "Local / bloco", "Valor total (R$)", "Órgão de origem", "Situação atual", "Pendência identificada", "Medidas adotadas e resultados"];

export function buildPendingIssuesTemplateRows(rows: Array<Record<string, unknown>>) {
  return rows.map(row => [
    row.Tipo || "Outro",
    row.Situação || "Aberta",
    `Escola: ${row.Escola || "Não informada"}\n${row.Descrição || "Não informado"}`,
    row.Património || "Não informado",
    row.Quantidade ?? "Não informado",
    row["Estado de conservação"] || "Não informado",
    row["Local / bloco"] || "Não informado",
    Number(row["Valor total (R$)"] || 0),
    row["Órgão de origem"] || "Não informado",
    row["Situação atual"] || "Não informado",
    row.Pendência || "Não informado",
    row.Medidas || "Não informado",
  ]);
}

export function buildPendingIssuesWorkbook(rows: Array<Record<string, unknown>>) {
  const dataRows = buildPendingIssuesTemplateRows(rows);
  const worksheet = XLSX.utils.aoa_to_sheet([PENDING_TEMPLATE_HEADERS, ...dataRows]);
  worksheet["!cols"] = [23, 24, 38, 19, 12, 22, 20, 18, 24, 34, 42, 46].map(wch => ({ wch }));
  worksheet["!autofilter"] = { ref: `A1:L${dataRows.length + 1}` };
  worksheet["!freeze"] = { xSplit: 0, ySplit: 1 };
  PENDING_TEMPLATE_HEADERS.forEach((_, index) => setStyle(worksheet, XLSX.utils.encode_cell({ r: 0, c: index }), darkHeaderStyle));
  dataRows.forEach((_, rowIndex) => {
    for (let columnIndex = 0; columnIndex < PENDING_TEMPLATE_HEADERS.length; columnIndex += 1) {
      setStyle(worksheet, XLSX.utils.encode_cell({ r: rowIndex + 1, c: columnIndex }), { alignment: { vertical: "top", wrapText: true } });
    }
    const valueCell = worksheet[XLSX.utils.encode_cell({ r: rowIndex + 1, c: 7 })];
    if (valueCell) valueCell.z = "R$ #,##0.00";
  });
  const lists = XLSX.utils.aoa_to_sheet([["Tipo de ocorrência", "Estado de acompanhamento", "Estado de conservação"], ["Bem não localizado", "Aberta", "Novo"], ["Bem sem identificação patrimonial", "Em andamento", "Bom"], ["Divergência de patrimônio", "Aguardando providência", "Regular"], ["Bem danificado", "Resolvida", "Ruim"], ["Outro", "Cancelada", "Inservível"], ["", "", "Não informado"]]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Registro de Pendências");
  XLSX.utils.book_append_sheet(workbook, lists, "Listas");
  if (workbook.Workbook?.Sheets?.[1]) workbook.Workbook.Sheets[1].Hidden = 1;
  return workbook;
}

export function exportPendingIssuesTemplate({ rows, fileName }: { rows: Array<Record<string, unknown>>; fileName: string }) {
  if (!rows.length) return false;
  XLSX.writeFile(buildPendingIssuesWorkbook(rows), `${fileName}.xlsx`);
  return true;
}
