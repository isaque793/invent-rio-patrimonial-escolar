import { describe, expect, it } from "vitest";
import { getInventorySubmissionRequirements } from "./inventorySubmission";

describe("requisitos de submissão do inventário", () => {
  it("lista claramente todos os requisitos ausentes", () => {
    expect(getInventorySubmissionRequirements({ itemCount: 0, memberCount: 0, documentTypes: [] })).toEqual({
      ready: false,
      missing: ["Ao menos um item patrimonial", "Ao menos um integrante da subcomissão", "Ata de Abertura assinada", "Termo de Responsabilidade assinado", "Ata de Encerramento assinada"],
    });
  });

  it("libera a submissão com item, um integrante ou mais e os três documentos", () => {
    expect(getInventorySubmissionRequirements({ itemCount: 1, memberCount: 1, documentTypes: ["opening_minutes", "responsibility_term", "closing_minutes"] })).toEqual({ ready: true, missing: [] });
    expect(getInventorySubmissionRequirements({ itemCount: 1, memberCount: 25, documentTypes: ["opening_minutes", "responsibility_term", "closing_minutes"] })).toEqual({ ready: true, missing: [] });
  });
});
