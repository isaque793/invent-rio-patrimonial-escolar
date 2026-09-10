import { describe, expect, it } from "vitest";
import { calculateLineTotal, canChangeAdminRole, canTransitionStatus, consolidateExpenseItems, hasSchoolAccess, missingDocumentTypes, safeFileName } from "./inventoryUtils";

describe("regras do inventário patrimonial", () => {
  it("calcula o valor total de uma linha com precisão monetária", () => {
    expect(calculateLineTotal(3, 199.9)).toBe("599.70");
    expect(calculateLineTotal(1, 0)).toBe("0.00");
  });

  it("rejeita quantidades e valores inválidos", () => {
    expect(() => calculateLineTotal(0, 20)).toThrow("quantidade");
    expect(() => calculateLineTotal(2, -1)).toThrow("valor unitário");
  });

  it("identifica exatamente os documentos obrigatórios que faltam", () => {
    expect(missingDocumentTypes(["opening_minutes", "closing_minutes"])).toEqual(["responsibility_term"]);
    expect(missingDocumentTypes(["opening_minutes", "responsibility_term", "closing_minutes"])).toEqual([]);
  });

  it("só permite transições válidas durante a validação", () => {
    expect(canTransitionStatus("draft", "submitted")).toBe(true);
    expect(canTransitionStatus("submitted", "validated")).toBe(true);
    expect(canTransitionStatus("validated", "draft")).toBe(false);
    expect(canTransitionStatus("returned", "under_review")).toBe(false);
  });

  it("distingue o acesso administrativo do acesso de uma escola atribuída", () => {
    expect(hasSchoolAccess("admin", false)).toBe(true);
    expect(hasSchoolAccess("user", true)).toBe(true);
    expect(hasSchoolAccess("user", false)).toBe(false);
  });

  it("protege a revogação do último administrador", () => {
    expect(canChangeAdminRole("admin", "user", 1)).toBe(false);
    expect(canChangeAdminRole("admin", "user", 2)).toBe(true);
    expect(canChangeAdminRole("user", "admin", 1)).toBe(true);
  });

  it("consolida quantidade e valor por código de despesa", () => {
    expect(consolidateExpenseItems([
      { expenseCode: "52.14", quantity: 2, totalValue: "400.00" },
      { expenseCode: "52.07", quantity: 1, totalValue: "1850.00" },
      { expenseCode: "52.14", quantity: 3, totalValue: "250.00" },
    ])).toEqual([
      { expenseCode: "52.07", quantity: 1, totalValue: 1850 },
      { expenseCode: "52.14", quantity: 5, totalValue: 650 },
    ]);
  });

  it("normaliza nomes de documentos para armazenamento seguro", () => {
    expect(safeFileName("Ata de Abertura – Escola São João.pdf")).toBe("Ata-de-Abertura-Escola-Sao-Joao.pdf");
  });
});
