/**
 * Testes unitários para management.retryArchive
 *
 * Cobertos:
 *  - usuário sem role admin é bloqueado (FORBIDDEN)
 *  - ciclo inexistente retorna NOT_FOUND
 *  - archiveCycle retorna ok:false → propaga como INTERNAL_SERVER_ERROR
 *  - archiveCycle retorna ok:true → retorna success:true com location
 *  - ciclo com archiveStatus ERROR é reprocessado com sucesso (caso principal de retry)
 *  - ciclo com archiveStatus ARCHIVED ainda é aceito (archiveCycle trata a idempotência internamente)
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import type { TrpcContext } from "./_core/context";

// ── mock de archiveService ────────────────────────────────────────────────────

const archiveMocks = vi.hoisted(() => ({
  archiveCycle: vi.fn(async () => ({
    ok: true as const,
    location: "arquivo-inventario/2026/escola-1/ciclo-10",
  })),
}));

vi.mock("./archiveService", () => ({ archiveCycle: archiveMocks.archiveCycle }));

// ── mock de db ────────────────────────────────────────────────────────────────

vi.mock("./db", () => ({
  findSchoolMember: vi.fn(),
  getCycleById: vi.fn(async () => ({
    id: 10,
    schoolId: 1,
    year: 2026,
    status: "validated",
    archiveStatus: "ERROR",
    archiveError: "R2: timeout",
  })),
  getManagementCycles: vi.fn(),
  getManagementControlExportData: vi.fn(),
  getManagementIssues: vi.fn(),
  getManagementItems: vi.fn(),
  getSchoolMembers: vi.fn(),
  getSchoolOverview: vi.fn(),
  getVisibleSchools: vi.fn(),
  listAssignableUsers: vi.fn(),
  requireDb: vi.fn(async () => ({})),
  userCanAccessSchool: vi.fn(async () => true),
  linkUserToSchoolByEmail: vi.fn(),
  createUserWithPassword: vi.fn(),
  verifyUserPassword: vi.fn(),
}));

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
  // Restaura o mock padrão: ciclo com ERROR, archiveCycle retorna ok:true
  vi.mocked(getCycleById).mockResolvedValue({
    id: 10,
    schoolId: 1,
    year: 2026,
    status: "validated",
    archiveStatus: "ERROR",
    archiveError: "R2: timeout",
  } as Awaited<ReturnType<typeof getCycleById>>);
  archiveMocks.archiveCycle.mockResolvedValue({
    ok: true,
    location: "arquivo-inventario/2026/escola-1/ciclo-10",
  });
});

describe("management.retryArchive — controle de acesso", () => {
  it("bloqueia usuário sem role admin", async () => {
    await expect(
      appRouter.createCaller(userContext()).management.retryArchive({ cycleId: 10 }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(archiveMocks.archiveCycle).not.toHaveBeenCalled();
  });

  it("retorna NOT_FOUND quando ciclo não existe", async () => {
    vi.mocked(getCycleById).mockResolvedValueOnce(undefined);

    await expect(
      appRouter.createCaller(adminContext()).management.retryArchive({ cycleId: 999 }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(archiveMocks.archiveCycle).not.toHaveBeenCalled();
  });
});

describe("management.retryArchive — reprocessamento", () => {
  it("ciclo com ERROR é reprocessado com sucesso e retorna location", async () => {
    const result = await appRouter
      .createCaller(adminContext())
      .management.retryArchive({ cycleId: 10 });

    expect(result).toEqual({
      success: true,
      location: "arquivo-inventario/2026/escola-1/ciclo-10",
    });
    expect(archiveMocks.archiveCycle).toHaveBeenCalledOnce();
    expect(archiveMocks.archiveCycle).toHaveBeenCalledWith(10);
  });

  it("propaga INTERNAL_SERVER_ERROR quando archiveCycle retorna ok:false", async () => {
    archiveMocks.archiveCycle.mockResolvedValueOnce({
      ok: false,
      error: "R2: bucket not found",
    });

    await expect(
      appRouter.createCaller(adminContext()).management.retryArchive({ cycleId: 10 }),
    ).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: "R2: bucket not found",
    });
  });

  it("ciclo já ARCHIVED é aceito: archiveCycle lida com idempotência internamente", async () => {
    vi.mocked(getCycleById).mockResolvedValueOnce({
      id: 10,
      schoolId: 1,
      year: 2026,
      status: "validated",
      archiveStatus: "ARCHIVED",
      archiveLocation: "arquivo-inventario/2026/escola-1/ciclo-10",
    } as Awaited<ReturnType<typeof getCycleById>>);

    // archiveCycle detecta ARCHIVED e devolve ok:true sem reprocessar
    archiveMocks.archiveCycle.mockResolvedValueOnce({
      ok: true,
      location: "arquivo-inventario/2026/escola-1/ciclo-10",
    });

    const result = await appRouter
      .createCaller(adminContext())
      .management.retryArchive({ cycleId: 10 });

    expect(result).toEqual({
      success: true,
      location: "arquivo-inventario/2026/escola-1/ciclo-10",
    });
    // A rota não deve pré-filtrar o status — delega ao archiveCycle
    expect(archiveMocks.archiveCycle).toHaveBeenCalledOnce();
  });

  it("passa o cycleId correto para archiveCycle independentemente do ciclo retornado", async () => {
    await appRouter.createCaller(adminContext()).management.retryArchive({ cycleId: 42 });
    // getCycleById é chamado com 42; archiveCycle também deve receber 42
    expect(archiveMocks.archiveCycle).toHaveBeenCalledWith(42);
  });
});
