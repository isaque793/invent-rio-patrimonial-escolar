import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => {
  const updates: unknown[] = [];
  const selectResults: unknown[][] = [];

  function whereResult() {
    const next = () => selectResults.shift() ?? [];
    return {
      limit: vi.fn(async () => next()),
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(next()).then(resolve, reject),
      catch: (reject: (e: unknown) => unknown) => Promise.resolve(next()).catch(reject),
    };
  }

  const db = {
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => whereResult()) })) })),
    update: vi.fn(() => ({
      set: vi.fn((data: unknown) => {
        updates.push(data);
        return { where: vi.fn(async () => undefined) };
      }),
    })),
  };

  return { db, updates, selectResults };
});

vi.mock("./db", () => ({
  requireDb: vi.fn(async () => mocks.db),
}));

const storageMocks = vi.hoisted(() => ({
  storageCopy: vi.fn(async (_source: string, dest: string) => ({ key: dest })),
  storagePutExact: vi.fn(async (key: string) => ({ key })),
  storageVerify: vi.fn(async () => ({ exists: true, size: 123 })),
}));

vi.mock("./storage", () => storageMocks);

import { archiveCycle } from "./archiveService";

function baseCycle(overrides: Record<string, unknown> = {}) {
  return {
    id: 45,
    schoolId: 123,
    year: 2026,
    status: "validated",
    archiveStatus: "ACTIVE",
    archiveLocation: null,
    ...overrides,
  };
}

beforeEach(() => {
  mocks.updates.length = 0;
  mocks.selectResults.length = 0;
  storageMocks.storageCopy.mockClear();
  storageMocks.storagePutExact.mockClear();
  storageMocks.storageVerify.mockClear();
  storageMocks.storageVerify.mockResolvedValue({ exists: true, size: 123 });
  storageMocks.storageCopy.mockImplementation(async (_source: string, dest: string) => ({ key: dest }));
});

function queueHappyPath(cycle: ReturnType<typeof baseCycle>, documents: unknown[] = []) {
  mocks.selectResults.push(
    [cycle], // cycleRows
    [{ id: cycle.schoolId, name: "Escola Modelo" }], // school
    [{ id: 1 }], // items
    [], // issues
    [], // notes
    [], // committee
    [], // history
    documents, // documents
  );
}

describe("archiveCycle", () => {
  it("retorna erro quando o ciclo não existe", async () => {
    mocks.selectResults.push([]); // cycleRows vazio

    const result = await archiveCycle(999);

    expect(result).toEqual({ ok: false, error: "Ciclo não encontrado." });
    expect(mocks.updates).toHaveLength(0);
  });

  it("recusa arquivar um ciclo que ainda não foi validado", async () => {
    mocks.selectResults.push([baseCycle({ status: "under_review" })]);

    const result = await archiveCycle(45);

    expect(result).toEqual({ ok: false, error: "Somente ciclos validados podem ser arquivados." });
    expect(mocks.updates).toHaveLength(0);
  });

  it("é idempotente: um ciclo já arquivado retorna sucesso sem reprocessar nem tocar no storage", async () => {
    mocks.selectResults.push([baseCycle({ archiveStatus: "ARCHIVED", archiveLocation: "arquivo-inventario/2026/escola-123/ciclo-45" })]);

    const result = await archiveCycle(45);

    expect(result).toEqual({ ok: true, location: "arquivo-inventario/2026/escola-123/ciclo-45" });
    expect(mocks.updates).toHaveLength(0);
    expect(storageMocks.storageCopy).not.toHaveBeenCalled();
    expect(storageMocks.storagePutExact).not.toHaveBeenCalled();
  });

  it("impede duas execuções simultâneas do mesmo ciclo (archiveStatus PENDING)", async () => {
    mocks.selectResults.push([baseCycle({ archiveStatus: "PENDING" })]);

    const result = await archiveCycle(45);

    expect(result).toEqual({ ok: false, error: "Arquivamento já em andamento para este ciclo." });
    expect(mocks.updates).toHaveLength(0);
  });

  it("arquiva com sucesso um ciclo validado: exporta dados, copia documentos, verifica e só então registra ARCHIVED", async () => {
    const documents = [{ id: 1, documentType: "opening_minutes", fileName: "abertura.pdf", storageKey: "inventarios/escola-123/2026/opening_minutes/123-abertura.pdf" }];
    queueHappyPath(baseCycle(), documents);

    const result = await archiveCycle(45);

    expect(result).toEqual({ ok: true, location: "arquivo-inventario/2026/escola-123/ciclo-45" });

    // Ordem: PENDING primeiro (bloqueia execuções concorrentes), ARCHIVED só no final.
    expect(mocks.updates).toHaveLength(2);
    expect(mocks.updates[0]).toMatchObject({ archiveStatus: "PENDING", archiveError: null });
    expect(mocks.updates[1]).toMatchObject({
      archiveStatus: "ARCHIVED",
      archiveLocation: "arquivo-inventario/2026/escola-123/ciclo-45",
      archiveVersion: 1,
      archiveError: null,
    });
    expect(mocks.updates[1]).toHaveProperty("archivedAt");

    // Os 6 JSONs de dados + o manifest.json.
    expect(storageMocks.storagePutExact).toHaveBeenCalledTimes(7);
    const putKeys = storageMocks.storagePutExact.mock.calls.map(call => call[0]);
    expect(putKeys).toEqual(
      expect.arrayContaining([
        "arquivo-inventario/2026/escola-123/ciclo-45/dados/ciclo.json",
        "arquivo-inventario/2026/escola-123/ciclo-45/dados/itens.json",
        "arquivo-inventario/2026/escola-123/ciclo-45/dados/ocorrencias.json",
        "arquivo-inventario/2026/escola-123/ciclo-45/dados/observacoes.json",
        "arquivo-inventario/2026/escola-123/ciclo-45/dados/comissao.json",
        "arquivo-inventario/2026/escola-123/ciclo-45/dados/validacoes.json",
        "arquivo-inventario/2026/escola-123/ciclo-45/manifest.json",
      ]),
    );

    // Cópia do documento assinado para dentro do pacote (server-side copy, sem baixar/reenviar).
    expect(storageMocks.storageCopy).toHaveBeenCalledWith(
      "inventarios/escola-123/2026/opening_minutes/123-abertura.pdf",
      "arquivo-inventario/2026/escola-123/ciclo-45/documentos/opening_minutes-1-abertura.pdf",
    );

    // Verificação de integridade: o documento copiado e o manifest.
    expect(storageMocks.storageVerify).toHaveBeenCalledWith("arquivo-inventario/2026/escola-123/ciclo-45/documentos/opening_minutes-1-abertura.pdf");
    expect(storageMocks.storageVerify).toHaveBeenCalledWith("arquivo-inventario/2026/escola-123/ciclo-45/manifest.json");

    // O manifest.json segue o formato descrito no plano (seção 8).
    const manifestCall = storageMocks.storagePutExact.mock.calls.find(call => call[0].endsWith("manifest.json"));
    const manifest = JSON.parse(manifestCall![1] as string);
    expect(manifest).toMatchObject({ version: 1, schoolId: 123, cycleId: 45, year: 2026, items: 1, documents: 1, archiveStatus: "completed" });
  });

  it("arquivar não é apagar: se a verificação de um documento falhar, o ciclo fica com archiveStatus ERROR e nada é removido do lado operacional", async () => {
    const documents = [{ id: 1, documentType: "opening_minutes", fileName: "abertura.pdf", storageKey: "inventarios/escola-123/2026/opening_minutes/123-abertura.pdf" }];
    queueHappyPath(baseCycle(), documents);
    storageMocks.storageVerify.mockResolvedValueOnce({ exists: false });

    const result = await archiveCycle(45);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Falha ao verificar documento arquivado");

    expect(mocks.updates).toHaveLength(2);
    expect(mocks.updates[0]).toMatchObject({ archiveStatus: "PENDING" });
    expect(mocks.updates[1]).toMatchObject({ archiveStatus: "ERROR" });
    expect(mocks.updates[1]).toHaveProperty("archiveError");
  });

  it("registra ERROR e permite nova tentativa quando a cópia de um documento falha (storage indisponível)", async () => {
    const documents = [{ id: 1, documentType: "opening_minutes", fileName: "abertura.pdf", storageKey: "inventarios/escola-123/2026/opening_minutes/123-abertura.pdf" }];
    queueHappyPath(baseCycle(), documents);
    storageMocks.storageCopy.mockRejectedValueOnce(new Error("R2 indisponível"));

    const result = await archiveCycle(45);

    expect(result).toEqual({ ok: false, error: "R2 indisponível" });
    expect(mocks.updates[1]).toMatchObject({ archiveStatus: "ERROR", archiveError: "R2 indisponível" });
  });
});
