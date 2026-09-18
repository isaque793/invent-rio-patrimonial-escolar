import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx-js-style";
import { buildConsolidatedExcelRows, buildPendingIssuesTemplateRows, buildPendingIssuesWorkbook, buildSchoolControlWorkbook, buildSchoolControlTemplateRows, exportAdministrativeRowsAsExcel, PENDING_TEMPLATE_HEADERS, SCHOOL_CONTROL_TEMPLATE_HEADERS } from "./exportConsolidatedExcel";

describe("exportação Excel do consolidado", () => {
  it("estrutura todas as linhas, os valores e o total global do consolidado", () => {
    const rows = buildConsolidatedExcelRows({
      year: 2026,
      categoryNames: { "52.14": "Material permanente", "52.07": "Equipamentos" },
      lines: [
        { expenseCode: "52.14", quantity: 3, totalValue: "600.50" },
        { expenseCode: "52.07", quantity: 2, totalValue: "1400.00" },
      ],
    });
    expect(rows[0]).toEqual(["CONSOLIDADO DO INVENTÁRIO PATRIMONIAL — TODAS AS ESCOLAS"]);
    expect(rows[4]).toEqual(["Código de despesa", "Elemento / item de despesa", "Quantidade", "Valor total (R$)"]);
    expect(rows[5]).toEqual(["52.14", "Material permanente", 3, 600.5]);
    expect(rows.at(-1)).toEqual(["TOTAL GLOBAL", "", 5, 2000.5]);
  });

  it("recusa a exportação quando não há linhas consolidadas", () => {
    expect(exportAdministrativeRowsAsExcel({ title: "Consolidado", rows: [], fileName: "consolidado" })).toBe(false);
  });

  it("reorganiza pendências conforme as 12 colunas do modelo fornecido", () => {
    const [row] = buildPendingIssuesTemplateRows([{ Escola: "EE Afonso Pena", Tipo: "Bem não localizado", Situação: "Aberta", Descrição: "Armário de aço", Património: "123", Pendência: "Bem não encontrado", Medidas: "Solicitada conferência" }]);
    expect(PENDING_TEMPLATE_HEADERS).toHaveLength(12);
    expect(row).toEqual(["Bem não localizado", "Aberta", "Escola: EE Afonso Pena\nArmário de aço", "123", "Não informado", "Não informado", "Não informado", 0, "Não informado", "Não informado", "Bem não encontrado", "Solicitada conferência"]);
  });

  it("cria a aba de pendências sem a aba Listas, com título, subtítulo e cabeçalhos na estrutura correta", () => {
    const workbook = buildPendingIssuesWorkbook([{ Escola: "EE Afonso Pena", Tipo: "Bem não localizado", Situação: "Aberta", Descrição: "Armário", Património: "123", Pendência: "Não localizado" }]);
    // Apenas a aba de dados — aba "Listas" removida
    expect(workbook.SheetNames).toEqual(["Registro de Pendências"]);
    const values = XLSX.utils.sheet_to_json(workbook.Sheets["Registro de Pendências"], { header: 1 }) as unknown[][];
    // Linha 1: título
    expect(String(values[0]?.[0])).toContain("REGISTRO DE PENDÊNCIAS");
    // Linha 2: subtítulo com contagem
    expect(String(values[1]?.[0])).toContain("Total de ocorrências: 1");
    // Linha 3: cabeçalhos das colunas
    expect(values[2]).toEqual(PENDING_TEMPLATE_HEADERS);
    // Linha 4: primeira linha de dados — formato monetário na coluna H (índice 7)
    expect(workbook.Sheets["Registro de Pendências"]["H4"]?.z).toBe("R$ #,##0.00");
  });

  it("cria o resumo consolidado no formato de controle por escola e bem patrimonial", () => {
    const records = [{
      school: { name: "EE Afonso Pena", schoolCode: "284", city: "Belo Horizonte" },
      cycle: { status: "validated" as const },
      items: [{ propertyNumber: "123", description: "Armário de aço", technicalDetails: "Duas portas", expenseCode: "52.14", conservationCode: "2", conservationState: "Bom", quantity: 2, unitValue: "350.25", currentSituation: "Em uso" }],
      members: [{ name: "Presidente", jobTitle: "Professor", masp: "123456", isPresident: 1 }, { name: "Membro 2", jobTitle: "Especialista", masp: "234567", isPresident: 0 }, { name: "Membro 3", jobTitle: "Servidor", masp: "345678", isPresident: 0 }],
      issues: [{ description: "Item conferido", pendingDescription: "Acompanhar baixa", resolutionStatus: "in_progress" as const }],
      documents: [{ documentType: "opening_minutes" as const }, { documentType: "responsibility_term" as const }, { documentType: "closing_minutes" as const }],
      notes: { problemsFound: "Sem divergências", quantityDivergences: null, valueDivergences: null },
    }];
    const [row] = buildSchoolControlTemplateRows(records);
    const workbook = buildSchoolControlWorkbook(records);
    expect(SCHOOL_CONTROL_TEMPLATE_HEADERS).toHaveLength(30);
    expect(row).toHaveLength(28);
    expect(row.slice(0, 13)).toEqual(["EE Afonso Pena", "284", "Belo Horizonte", "123", "Armário de aço", "Duas portas", "52.14", "2", "Bom", 2, 350.25, "", "Em uso"]);
    expect(row.slice(13)).toEqual(["Presidente", "Professor", "123456", "Membro 2", "Especialista", "234567", "Membro 3", "Servidor", "345678", "Enviado", "Enviado", "Enviado", "Validado", "Em andamento — Item conferido: Acompanhar baixa", "Sem divergências"]);
    expect(workbook.SheetNames).toEqual(["Escolas e Inventario", "Localizar Escola"]);
    expect(XLSX.utils.sheet_to_json(workbook.Sheets["Escolas e Inventario"], { header: 1 })[0]).toEqual(SCHOOL_CONTROL_TEMPLATE_HEADERS);
    expect(workbook.Sheets["Escolas e Inventario"]["K2"]?.z).toBe("R$ #,##0.00");
    expect(workbook.Sheets["Escolas e Inventario"]["L2"]?.z).toBe("R$ #,##0.00");
    expect(workbook.Sheets["Escolas e Inventario"]["L2"]?.f).toBe('IF(OR(J2="",K2=""),"",J2*K2)');
    expect(workbook.Sheets["Escolas e Inventario"]["L1001"]?.f).toBe('IF(OR(J1001="",K1001=""),"",J1001*K1001)');
    expect(workbook.Sheets["Escolas e Inventario"]["AC2"]?.f).toBe('IF(A2="","",COUNTIF($A$2:A2,A2))');
    expect(workbook.Sheets["Escolas e Inventario"]["AD2"]?.f).toBe('IF(A2="","",A2&"|"&AC2)');
    expect(workbook.Sheets["Escolas e Inventario"]["!ref"]).toBe("A1:AD1001");
    expect(workbook.Sheets["Escolas e Inventario"]["!cols"]?.[0]?.wch).toBe(30);
    expect(workbook.Sheets["Escolas e Inventario"]["!rows"]?.[0]?.hpt).toBe(40);
    expect(workbook.Sheets["Localizar Escola"]["!ref"]).toBe("A1:I69");
    expect(workbook.Sheets["Localizar Escola"]["!merges"]).toEqual([XLSX.utils.decode_range("A1:F1"), XLSX.utils.decode_range("A4:D4"), XLSX.utils.decode_range("A18:F20"), XLSX.utils.decode_range("A18:H18")]);
    expect(workbook.Sheets["Localizar Escola"]["B6"]?.f).toContain("'Escolas e Inventario'!$A$2:$A$1001");
    expect(workbook.Sheets["Localizar Escola"]["B16"]?.z).toBe("R$ #,##0.00");
    expect(workbook.Sheets["Localizar Escola"]["A20"]?.f).toContain("'Escolas e Inventario'!$D$2:$D$1001");
    expect(workbook.Sheets["Localizar Escola"]["I20"]?.f).toContain('$B$6&"|"&ROWS($I$20:I20)');
    expect(workbook.Sheets["Localizar Escola"]["G20"]?.z).toBe("R$ #,##0.00");
  });
});
