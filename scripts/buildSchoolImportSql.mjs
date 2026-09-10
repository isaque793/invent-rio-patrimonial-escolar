import { readFileSync, writeFileSync } from "node:fs";

const schools = JSON.parse(readFileSync("/home/ubuntu/inventario-patrimonial-escolas/scripts/schools-import.json", "utf8"));
const quote = value => `'${String(value).replaceAll("'", "''")}'`;
const values = schools.map(school => `(${quote(school.name)}, ${quote(school.schoolCode)}, ${quote(school.city)})`);
const sql = `INSERT INTO schools (name, schoolCode, city) VALUES\n${values.join(",\n")};\n`;
writeFileSync("/home/ubuntu/inventario-patrimonial-escolas/scripts/import-schools.sql", sql);
console.log(`Prepared ${schools.length} school rows.`);
