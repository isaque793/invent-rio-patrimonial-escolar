import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import {
  buildSchoolControlTemplateRows,
  buildSchoolControlWorkbook,
  filterSchoolControlRecords,
  isSchoolRelevantForExport,
  SCHOOL_CONTROL_TEMPLATE_HEADERS,
} from "./exportSchoolControlExcel";

const emptySchool = {
  school: { name: "EE Sem Movimento", schoolCode: "999", city: "Belo Horizonte" },
  cycle: { status: "draft" as const },
  items: [],
  members: [],
  issues: [],
  documents: [],
  notes: null,
};

describe("exportação estruturada do controle escolar", () => {
  it("ignora escolas sem patrimônio, pendências ou divergências", () => {
    expect(isSchoolRelevantForExport(emptySchool)).toBe(false);
    expect(filterSchoolControlRecords([emptySchool])).toEqual([]);
    expect(buildSchoolControlTemplateRows([emptySchool])).toEqual([]);
  });

  it("mantém escola que possui apenas uma pendência", () => {
    const record = {
      ...emptySchool,
      issues: [
        {
          description: "Armário não localizado",
          pendingDescription: "Conferir sala 03",
          resolutionStatus: "open" as const,
        },
      ],
    };

    expect(isSchoolRelevantForExport(record)).toBe(true);
    const [row] = buildSchoolControlTemplateRows([record]);
    expect(row[0]).toBe("EE Sem Movimento");
    expect(row[3]).toBe("");
    expect(row[26]).toBe("Aberta — Armário não localizado: Conferir sala 03");
  });

  it("monta o workbook somente com linhas reais e com cabeçalho separado dos dados", () => {
    const record = {
      school: { name: "EE Afonso Pena", schoolCode: "264", city: "Belo Horizonte" },
      cycle: { status: "validated" as const },
      items: [
        {
          propertyNumber: "123",
          description: "Armário de aço",
          technicalDetails: "Duas portas",
          expenseCode: "52.14",
          conservationCode: "2",
          conservationState: "Bom",
          quantity: 2,
          unitValue: "350.25",
          currentSituation: "Em uso",
        },
      ],
      members: [{ name: "Presidente", jobTitle: "Professor", masp: "123456", isPresident: 1 }],
      issues: [],
      documents: [],
      notes: null,
    };

    const workbook = buildSchoolControlWorkbook([emptySchool, record], 2026);
    const sheet = workbook.Sheets["Escolas e Inventario"];
    const values = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

    expect(workbook.SheetNames).toEqual(["Escolas e Inventario", "Localizar Escola"]);
    expect(values[0]).toEqual(["RESUMO CONSOLIDADO DO INVENTÁRIO PATRIMONIAL"]);
    expect(values[1]?.[0]).toContain("Ano do inventário: 2026");
    expect(values[3]).toEqual([...SCHOOL_CONTROL_TEMPLATE_HEADERS]);
    expect(values[4]?.slice(0, 13)).toEqual([
      "EE Afonso Pena",
      "264",
      "Belo Horizonte",
      "123",
      "Armário de aço",
      "Duas portas",
      "52.14",
      "2",
      "Bom",
      2,
      350.25,
      null,
      "Em uso",
    ]);
    expect(sheet["!ref"]).toBe("A1:AD5");
    expect(sheet["!autofilter"]).toEqual({ ref: "A4:AD5" });
    expect(sheet["!cols"]?.[28]?.hidden).toBe(true);
    expect(sheet["!cols"]?.[29]?.hidden).toBe(true);
    expect(sheet["L5"]?.f).toBe('IF(OR(J5="",K5=""),"",J5*K5)');
    expect(sheet["K5"]?.z).toBe("R$ #,##0.00");
    expect(sheet["L5"]?.z).toBe("R$ #,##0.00");

    const lookup = workbook.Sheets["Localizar Escola"];
    expect(lookup["B6"]?.f).toContain("$A$5:$A$5");
    expect(lookup["I20"]?.f).toContain('$B$6&"|"&ROWS($I$20:I20)');
    expect(lookup["!merges"]).toEqual([
      XLSX.utils.decode_range("A1:I1"),
      XLSX.utils.decode_range("A2:I2"),
      XLSX.utils.decode_range("A4:D4"),
      XLSX.utils.decode_range("A18:I18"),
    ]);
  });
});
