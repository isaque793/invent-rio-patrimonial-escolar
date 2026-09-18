/**
 * Testes unitários para server/archiveService.ts
 *
 * Cobertos:
 *  - ciclo não existe
 *  - ciclo não validado é rejeitado
 *  - ciclo PENDING retorna erro imediato (evita concorrência)
 *  - ciclo já ARCHIVED é retornado com sucesso sem reprocessar (idempotência)
 *  - falha ao copiar documento → archiveStatus = ERROR, nada é apagado
 *  - falha ao verificar documento copiado → archiveStatus = ERROR
 *  - falha ao verificar manifest → archiveStatus = ERROR
 *  - sucesso completo → ARCHIVED com location, archivedAt, archiveVersion
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

// ── helpers para construir o banco falso ─────────────────────────────────────

type DbRow = Record<string, unknown>;

function buildDb(cycleRow: DbRow, extras: {
  schools?: DbRow[];
  items?: DbRow[];
  issues?: DbRow[];
  notes?: DbRow[];
  committee?: DbRow[];
  history?: DbRow[];
  documents?: DbRow[];
} = {}) {
  const updates: DbRow[] = [];

  // Respostas sequenciais para cobrir todas as consultas de archiveCycle.
  const selectQueue: DbRow[][] = [
    [cycleRow],                            // 0 – SELECT cycle
    extras.schools ?? [],                  // 1 – SELECT school
    extras.items ?? [],                    // 2 – SELECT items
    extras.issues ?? [],                   // 3 – SELECT issues
    extras.notes ?? [],                    // 4 – SELECT notes
    extras.committee ?? [],                // 5 – SELECT committee
    extras.history ?? [],                  // 6 – SELECT history
    extras.documents ?? [],                // 7 – SELECT documents
  ];

  // Constrói um objeto de query encadeável:
  //   .select().from().where()          → thenable que também expõe .limit()
  //   .select().from().where().limit()  → consome um item da fila
  //   .select().from().limit()          → consome um item da fila (sem .where)
  //
  // archiveCycle usa sempre .where().limit(1) para a consulta do ciclo,
  // e .where() (sem limit) para todas as consultas em paralelo subsequentes.
  // Portanto o .where() NÃO deve consumir a fila; só o .limit() consome.
  // Para as consultas paralelas (sem .limit), o .where() devolve Promise diretamente.
  function makeQuery() {
    return {
      from: vi.fn(() => ({
        // .where() retorna uma Promise que também tem .limit()
        where: vi.fn(() => {
          // Captura o próximo item apenas quando .limit() é chamado;
          // se ninguém chamar .limit(), este where age como Promise via then/catch/finally.
          let consumed = false;
          let data: DbRow[] | undefined;

          const ensureConsumed = () => {
            if (!consumed) { consumed = true; data = selectQueue.shift() ?? []; }
            return data!;
          };

          const promise = {
            then: (resolve: (v: DbRow[]) => unknown) => Promise.resolve(ensureConsumed()).then(resolve),
            catch: (reject: (e: unknown) => unknown) => Promise.resolve(ensureConsumed()).catch(reject),
            finally: (cb: () => unknown) => Promise.resolve(ensureConsumed()).finally(cb),
            limit: async (_n: number) => {
              // .limit() após .where(): a fila ainda não foi consumida pelo .where()
              // (porque ninguém chamou .then antes), então consumimos aqui.
              if (!consumed) { consumed = true; data = selectQueue.shift() ?? []; }
              return data!;
            },
          } as unknown as Promise<DbRow[]> & { limit: (n: number) => Promise<DbRow[]> };

          return promise;
        }),
        limit: vi.fn(async () => selectQueue.shift() ?? []),
      })),
    };
  }

  const db = {
    select: vi.fn(() => makeQuery()),
    update: vi.fn(() => ({
      set: vi.fn((data: DbRow) => {
        updates.push(data);
        return { where: vi.fn(async () => undefined) };
      }),
    })),
  };

  return { db, updates };
}

// ── mock de storage ──────────────────────────────────────────────────────────

const storageMocks = vi.hoisted(() => ({
  storagePutExact: vi.fn(async () => ({ key: "ok" })),
  storageCopy: vi.fn(async () => ({ key: "ok" })),
  storageVerify: vi.fn(async () => ({ exists: true, size: 1024 })),
}));

vi.mock("./storage", () => ({
  storagePutExact: storageMocks.storagePutExact,
  storageCopy: storageMocks.storageCopy,
  storageVerify: storageMocks.storageVerify,
}));

// ── mock de requireDb – configurado por teste ────────────────────────────────

const dbMock = vi.hoisted(() => ({ current: null as ReturnType<typeof buildDb> | null }));

vi.mock("./db", () => ({
  requireDb: vi.fn(async () => dbMock.current!.db),
  // outros exports usados por routers.ts (não necessários aqui mas
  // vi.mock substitui o módulo inteiro)
  getDb: vi.fn(),
  getUserByOpenId: vi.fn(),
  getCycleById: vi.fn(),
  getSchoolOverview: vi.fn(),
  getVisibleSchools: vi.fn(),
  getManagementCycles: vi.fn(),
  getManagementItems: vi.fn(),
  getManagementIssues: vi.fn(),
  listAssignableUsers: vi.fn(),
  userCanAccessSchool: vi.fn(),
  requireSchool: vi.fn(),
  findSchoolMember: vi.fn(),
  getSchoolMembers: vi.fn(),
  getManagementControlExportData: vi.fn(),
  linkUserToSchoolByEmail: vi.fn(),
  createUserWithPassword: vi.fn(),
  verifyUserPassword: vi.fn(),
}));

// ── importação após os mocks ─────────────────────────────────────────────────

import { archiveCycle } from "./archiveService";

// ── constantes de fixture ────────────────────────────────────────────────────

const VALIDATED_CYCLE: DbRow = {
  id: 45,
  schoolId: 123,
  year: 2026,
  status: "validated",
  archiveStatus: "ACTIVE",
  archiveLocation: null,
};

const SINGLE_DOCUMENT: DbRow = {
  id: 7,
  cycleId: 45,
  documentType: "opening_minutes",
  fileName: "abertura.pdf",
  storageKey: "inventarios/escola-123/2026/opening_minutes/1234-abertura.pdf",
};

// ── testes ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  storageMocks.storagePutExact.mockResolvedValue({ key: "ok" });
  storageMocks.storageCopy.mockResolvedValue({ key: "ok" });
  storageMocks.storageVerify.mockResolvedValue({ exists: true, size: 1024 });
});

describe("archiveCycle", () => {
  it("retorna erro quando o ciclo não existe", async () => {
    dbMock.current = buildDb({} as DbRow);
    // Sobrescreve a fila: primeira consulta retorna array vazio (ciclo não encontrado)
    dbMock.current.db.select.mockReturnValueOnce({
      from: vi.fn(() => ({
        where: vi.fn(() => {
          const p = Promise.resolve([]) as Promise<DbRow[]> & { limit: (n: number) => Promise<DbRow[]> };
          p.limit = async () => [];
          return p;
        }),
        limit: vi.fn(async () => []),
      })),
    });

    const result = await archiveCycle(99);
    expect(result).toEqual({ ok: false, error: "Ciclo não encontrado." });
  });

  it("rejeita ciclo com status diferente de 'validated'", async () => {
    const cycle = { ...VALIDATED_CYCLE, status: "submitted", archiveStatus: "ACTIVE" };
    dbMock.current = buildDb(cycle);

    const result = await archiveCycle(45);
    expect(result).toEqual({ ok: false, error: "Somente ciclos validados podem ser arquivados." });
  });

  it("retorna sucesso imediatamente quando ciclo já está ARCHIVED (idempotência)", async () => {
    const cycle = { ...VALIDATED_CYCLE, archiveStatus: "ARCHIVED", archiveLocation: "arquivo-inventario/2026/escola-123/ciclo-45" };
    dbMock.current = buildDb(cycle);

    const result = await archiveCycle(45);
    expect(result).toEqual({ ok: true, location: "arquivo-inventario/2026/escola-123/ciclo-45" });
    // Não deve ter chamado storage nem update
    expect(storageMocks.storagePutExact).not.toHaveBeenCalled();
    expect(dbMock.current.updates).toHaveLength(0);
  });

  it("rejeita ciclo com archiveStatus PENDING para evitar concorrência", async () => {
    const cycle = { ...VALIDATED_CYCLE, archiveStatus: "PENDING" };
    dbMock.current = buildDb(cycle);

    const result = await archiveCycle(45);
    expect(result).toEqual({ ok: false, error: "Arquivamento já em andamento para este ciclo." });
    expect(storageMocks.storagePutExact).not.toHaveBeenCalled();
  });

  it("sucesso completo: grava JSONs, copia documentos, verifica, grava manifest e marca ARCHIVED", async () => {
    dbMock.current = buildDb(VALIDATED_CYCLE, { documents: [SINGLE_DOCUMENT] });

    const result = await archiveCycle(45);

    expect(result).toEqual({ ok: true, location: "arquivo-inventario/2026/escola-123/ciclo-45" });

    // Deve ter marcado PENDING primeiro, depois ARCHIVED
    expect(dbMock.current.updates[0]).toMatchObject({ archiveStatus: "PENDING" });
    expect(dbMock.current.updates[1]).toMatchObject({
      archiveStatus: "ARCHIVED",
      archiveVersion: 1,
      archiveLocation: "arquivo-inventario/2026/escola-123/ciclo-45",
      archivedAt: expect.any(Date),
    });

    // 6 JSONs de dados + 1 manifest = 7 chamadas a storagePutExact
    expect(storageMocks.storagePutExact).toHaveBeenCalledTimes(7);

    // 1 documento copiado
    expect(storageMocks.storageCopy).toHaveBeenCalledTimes(1);
    expect(storageMocks.storageCopy).toHaveBeenCalledWith(
      SINGLE_DOCUMENT.storageKey,
      expect.stringContaining("arquivo-inventario/2026/escola-123/ciclo-45/documentos/"),
    );

    // Verifica documento + manifest = 2 chamadas a storageVerify
    expect(storageMocks.storageVerify).toHaveBeenCalledTimes(2);
  });

  it("sucesso sem documentos: não chama storageCopy, apenas grava JSONs e manifest", async () => {
    dbMock.current = buildDb(VALIDATED_CYCLE, { documents: [] });

    const result = await archiveCycle(45);
    expect(result.ok).toBe(true);
    expect(storageMocks.storageCopy).not.toHaveBeenCalled();
    // 6 JSONs + manifest
    expect(storageMocks.storagePutExact).toHaveBeenCalledTimes(7);
    // Apenas verifica manifest
    expect(storageMocks.storageVerify).toHaveBeenCalledTimes(1);
  });

  it("falha ao copiar documento → archiveStatus = ERROR, nenhum conteúdo operacional é removido", async () => {
    dbMock.current = buildDb(VALIDATED_CYCLE, { documents: [SINGLE_DOCUMENT] });
    storageMocks.storageCopy.mockRejectedValueOnce(new Error("R2: access denied"));

    const result = await archiveCycle(45);

    expect(result).toMatchObject({ ok: false, error: expect.stringContaining("R2: access denied") });
    // O último update deve marcar ERROR com a mensagem
    const lastUpdate = dbMock.current.updates.at(-1);
    expect(lastUpdate).toMatchObject({ archiveStatus: "ERROR", archiveError: expect.stringContaining("R2: access denied") });
    // Não deve ter marcado ARCHIVED em nenhum momento
    expect(dbMock.current.updates.some((u) => u.archiveStatus === "ARCHIVED")).toBe(false);
  });

  it("falha na verificação de documento copiado → archiveStatus = ERROR", async () => {
    dbMock.current = buildDb(VALIDATED_CYCLE, { documents: [SINGLE_DOCUMENT] });
    // storageVerify retorna exists: false para o documento
    storageMocks.storageVerify.mockResolvedValueOnce({ exists: false });

    const result = await archiveCycle(45);

    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ error: expect.stringContaining("Falha ao verificar documento arquivado") });
    const lastUpdate = dbMock.current.updates.at(-1);
    expect(lastUpdate).toMatchObject({ archiveStatus: "ERROR" });
  });

  it("falha na verificação do manifest → archiveStatus = ERROR", async () => {
    dbMock.current = buildDb(VALIDATED_CYCLE, { documents: [] });
    // storageVerify retorna exists: false para o manifest
    storageMocks.storageVerify.mockResolvedValueOnce({ exists: false });

    const result = await archiveCycle(45);

    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ error: expect.stringContaining("manifest") });
    const lastUpdate = dbMock.current.updates.at(-1);
    expect(lastUpdate).toMatchObject({ archiveStatus: "ERROR" });
  });

  it("falha ao gravar JSONs de dados → archiveStatus = ERROR", async () => {
    dbMock.current = buildDb(VALIDATED_CYCLE);
    storageMocks.storagePutExact.mockRejectedValueOnce(new Error("R2: quota exceeded"));

    const result = await archiveCycle(45);

    expect(result.ok).toBe(false);
    const lastUpdate = dbMock.current.updates.at(-1);
    expect(lastUpdate).toMatchObject({ archiveStatus: "ERROR", archiveError: expect.stringContaining("R2: quota exceeded") });
  });

  it("manifest contém os campos corretos", async () => {
    dbMock.current = buildDb(VALIDATED_CYCLE, {
      items: [{ id: 1 }, { id: 2 }],
      documents: [SINGLE_DOCUMENT],
    });

    await archiveCycle(45);

    // Encontra a chamada que grava o manifest.json (última storagePutExact)
    const manifestCall = storageMocks.storagePutExact.mock.calls.find(([key]) =>
      (key as string).endsWith("manifest.json"),
    );
    expect(manifestCall).toBeDefined();
    const manifest = JSON.parse(manifestCall![1] as string);
    expect(manifest).toMatchObject({
      version: 1,
      schoolId: 123,
      cycleId: 45,
      year: 2026,
      items: 2,
      documents: 1,
      archiveStatus: "completed",
      archivedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    });
  });
});
