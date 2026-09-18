/**
 * Testes unitários para management.changeStatus
 *
 * Cobertos:
 *  - usuário sem role admin é bloqueado (FORBIDDEN)
 *  - ciclo inexistente retorna NOT_FOUND
 *  - transição inválida de status retorna BAD_REQUEST
 *  - status "returned" sem nota retorna BAD_REQUEST
 *  - transição para "under_review" atualiza ciclo e registra histórico, NÃO dispara arquivamento
 *  - transição para "returned" atualiza ciclo e registra histórico, NÃO dispara arquivamento
 *  - transição para "validated" atualiza ciclo, registra histórico e DISPARA archiveCycle (fire-and-forget)
 *  - falha no archiveCycle não propaga nem bloqueia a resposta da validação
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import type { TrpcContext } from "./_core/context";

// ── mock de archiveService ────────────────────────────────────────────────────

const archiveMocks = vi.hoisted(() => ({
  archiveCycle: vi.fn(async () => ({ ok: true, location: "arquivo-inventario/2026/escola-1/ciclo-10" })),
}));

vi.mock("./archiveService", () => ({ archiveCycle: archiveMocks.archiveCycle }));

// ── mock de db ────────────────────────────────────────────────────────────────

const dbMocks = vi.hoisted(() => {
  const updates: unknown[] = [];
  const history: unknown[] = [];
  const db = {
    update: vi.fn(() => ({
      set: vi.fn((data: unknown) => {
        updates.push(data);
        return { where: vi.fn(async () => undefined) };
      }),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(async (data: unknown) => {
        history.push(data);
        return undefined;
      }),
    })),
  };
  return { db, updates, history };
});

vi.mock("./db", () => ({
  findSchoolMember: vi.fn(),
  getCycleById: vi.fn(async () => ({
    id: 10,
    schoolId: 1,
    year: 2026,
    status: "submitted",
    archiveStatus: "ACTIVE",
  })),
  getManagementCycles: vi.fn(),
  getManagementControlExportData: vi.fn(),
  getManagementIssues: vi.fn(),
  getManagementItems: vi.fn(),
  getSchoolMembers: vi.fn(),
  getSchoolOverview: vi.fn(),
  getVisibleSchools: vi.fn(),
  listAssignableUsers: vi.fn(),
  requireDb: vi.fn(async () => dbMocks.db),
  userCanAccessSchool: vi.fn(async () => true),
  linkUserToSchoolByEmail: vi.fn(),
  createUserWithPassword: vi.fn(),
  verifyUserPassword: vi.fn(),
}));

// ── importação após mocks ─────────────────────────────────────────────────────

import { appRouter } from "./routers";
import { getCycleById } from "./db";

// ── helpers de contexto ───────────────────────────────────────────────────────

function adminContext(): TrpcContext {
  return {
    user: {
      id: 99,
      openId: "admin-user",
      name: "Gestor",
      email: "admin@example.com",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

function userContext(): TrpcContext {
  return {
    user: {
      id: 11,
      openId: "school-user",
      name: "Escola",
      email: "school@example.com",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

// ── testes ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  dbMocks.updates.length = 0;
  dbMocks.history.length = 0;
  // Restaura o ciclo padrão com status "submitted"
  vi.mocked(getCycleById).mockResolvedValue({
    id: 10,
    schoolId: 1,
    year: 2026,
    status: "submitted",
    archiveStatus: "ACTIVE",
  } as Awaited<ReturnType<typeof getCycleById>>);
});

describe("management.changeStatus — controle de acesso", () => {
  it("bloqueia usuário sem role admin", async () => {
    await expect(
      appRouter.createCaller(userContext()).management.changeStatus({
        cycleId: 10,
        status: "under_review",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("retorna NOT_FOUND para ciclo inexistente", async () => {
    vi.mocked(getCycleById).mockResolvedValueOnce(undefined);
    await expect(
      appRouter.createCaller(adminContext()).management.changeStatus({
        cycleId: 999,
        status: "under_review",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("management.changeStatus — validação de regras", () => {
  it("rejeita transição inválida de status", async () => {
    // draft → validated não é permitido
    vi.mocked(getCycleById).mockResolvedValueOnce({
      id: 10,
      schoolId: 1,
      year: 2026,
      status: "draft",
      archiveStatus: "ACTIVE",
    } as Awaited<ReturnType<typeof getCycleById>>);

    await expect(
      appRouter.createCaller(adminContext()).management.changeStatus({
        cycleId: 10,
        status: "validated",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(archiveMocks.archiveCycle).not.toHaveBeenCalled();
  });

  it("rejeita 'returned' sem nota de devolução", async () => {
    await expect(
      appRouter.createCaller(adminContext()).management.changeStatus({
        cycleId: 10,
        status: "returned",
        note: "",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(archiveMocks.archiveCycle).not.toHaveBeenCalled();
  });
});

describe("management.changeStatus — transições que NÃO disparam arquivamento", () => {
  it("under_review: atualiza ciclo, registra histórico e não dispara archiveCycle", async () => {
    const result = await appRouter
      .createCaller(adminContext())
      .management.changeStatus({ cycleId: 10, status: "under_review" });

    expect(result).toEqual({ success: true });
    expect(dbMocks.updates).toHaveLength(1);
    expect(dbMocks.updates[0]).toMatchObject({ status: "under_review" });
    expect(dbMocks.history).toHaveLength(1);
    expect(dbMocks.history[0]).toMatchObject({
      cycleId: 10,
      action: "under_review",
      performedByUserId: 99,
    });
    expect(archiveMocks.archiveCycle).not.toHaveBeenCalled();
  });

  it("returned: atualiza ciclo com nota, registra histórico e não dispara archiveCycle", async () => {
    const result = await appRouter
      .createCaller(adminContext())
      .management.changeStatus({ cycleId: 10, status: "returned", note: "Corrigir valores" });

    expect(result).toEqual({ success: true });
    expect(dbMocks.updates[0]).toMatchObject({ status: "returned", reviewNotes: "Corrigir valores" });
    expect(dbMocks.history[0]).toMatchObject({ action: "returned", note: "Corrigir valores" });
    expect(archiveMocks.archiveCycle).not.toHaveBeenCalled();
  });
});

describe("management.changeStatus — validated dispara arquivamento", () => {
  it("valida ciclo: atualiza status, registra histórico e chama archiveCycle com o cycleId correto", async () => {
    vi.mocked(getCycleById).mockResolvedValueOnce({
      id: 10,
      schoolId: 1,
      year: 2026,
      status: "submitted",
      archiveStatus: "ACTIVE",
    } as Awaited<ReturnType<typeof getCycleById>>);

    const result = await appRouter
      .createCaller(adminContext())
      .management.changeStatus({ cycleId: 10, status: "validated" });

    expect(result).toEqual({ success: true });
    expect(dbMocks.updates[0]).toMatchObject({ status: "validated" });
    expect(dbMocks.history[0]).toMatchObject({ action: "validated", performedByUserId: 99 });

    // archiveCycle é fire-and-forget; aguarda micro-tasks para garantir que foi chamado
    await Promise.resolve();
    expect(archiveMocks.archiveCycle).toHaveBeenCalledOnce();
    expect(archiveMocks.archiveCycle).toHaveBeenCalledWith(10);
  });

  it("falha no archiveCycle não bloqueia nem propaga erro para o chamador", async () => {
    vi.mocked(getCycleById).mockResolvedValueOnce({
      id: 10,
      schoolId: 1,
      year: 2026,
      status: "submitted",
      archiveStatus: "ACTIVE",
    } as Awaited<ReturnType<typeof getCycleById>>);
    archiveMocks.archiveCycle.mockRejectedValueOnce(new Error("R2 unavailable"));

    // A chamada deve resolver com sucesso mesmo que o arquivamento lance
    await expect(
      appRouter.createCaller(adminContext()).management.changeStatus({ cycleId: 10, status: "validated" }),
    ).resolves.toEqual({ success: true });

    await Promise.resolve();
    expect(archiveMocks.archiveCycle).toHaveBeenCalledOnce();
  });
});
