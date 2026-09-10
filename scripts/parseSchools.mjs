import { readFileSync, writeFileSync } from "node:fs";

const sourcePath = "/home/ubuntu/upload/pasted_content.txt";
const outputPath = "/home/ubuntu/inventario-patrimonial-escolas/scripts/schools-import.json";
const reportPath = "/home/ubuntu/inventario-patrimonial-escolas/scripts/schools-import-report.md";
const lines = readFileSync(sourcePath, "utf8").split(/\r?\n/).map(line => line.trim()).filter(Boolean);
const entries = [];

for (let index = 0; index < lines.length; index += 1) {
  if (!/^\d+\.$/.test(lines[index])) continue;
  const raw = lines[index + 1];
  if (raw) entries.push({ sequence: Number(lines[index].slice(0, -1)), raw });
}

function parseEntry(raw) {
  const text = raw.replace(/\s+/g, " ").trim();
  const patterns = [
    /^(.*?)\s*-\s*(\d+)\s*-\s*(.+)$/,
    /^(.*?)\s+(\d+)\s*-\s*(.+)$/,
    /^(.*?)\s*-\s*(\d+)\s+(.+)$/,
    /^(.*?\D)(\d{1,8})\s*-\s*(.+)$/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return { name: match[1].trim(), schoolCode: match[2].trim(), city: match[3].trim(), raw };
  }
  return null;
}

const schools = [];
const malformed = [];
for (const entry of entries) {
  const parsed = parseEntry(entry.raw);
  if (parsed) schools.push({ sequence: entry.sequence, ...parsed });
  else malformed.push(entry);
}

const duplicates = schools.reduce((acc, school) => {
  const key = school.schoolCode;
  acc.set(key, [...(acc.get(key) ?? []), school]);
  return acc;
}, new Map());
const duplicateCodes = [...duplicates.entries()].filter(([, rows]) => rows.length > 1).map(([code, rows]) => ({ code, rows }));

writeFileSync(outputPath, `${JSON.stringify(schools, null, 2)}\n`);
const report = [
  "# Relatório de importação de escolas",
  "",
  `- Registos identificados na lista: ${entries.length}`,
  `- Registos estruturados: ${schools.length}`,
  `- Linhas que exigem revisão: ${malformed.length}`,
  `- Códigos INEP repetidos na fonte: ${duplicateCodes.length}`,
  "",
  "## Linhas que exigem revisão",
  "",
  ...(malformed.length ? malformed.map(item => `- ${item.sequence}. ${item.raw}`) : ["- Nenhuma."]),
  "",
  "## Códigos INEP repetidos na fonte",
  "",
  ...(duplicateCodes.length ? duplicateCodes.flatMap(group => [`- **${group.code}**`, ...group.rows.map(row => `  - ${row.sequence}. ${row.name} — ${row.city}`)]) : ["- Nenhum."]),
].join("\n");
writeFileSync(reportPath, `${report}\n`);
console.log(JSON.stringify({ identified: entries.length, structured: schools.length, malformed: malformed.length, duplicateCodes: duplicateCodes.length }));
