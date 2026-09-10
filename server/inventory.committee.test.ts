import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => {
  const inserted: unknown[][] = [];
  const db = {
    delete: vi.fn(() => ({ where: vi.fn(async () => undefined) })),
    insert: vi.fn(() => ({ values: vi.fn(async (rows: unknown[]) => { inserted.push(rows); return undefined; }) })),
  };
  return { db, inserted };
});

vi.mock("./db", () => ({
  findSchoolMember: vi.fn(),
  getCycleById: vi.fn(async () => ({ id: 88, schoolId: 4, year: 2026, status: "draft" })),
  getManagementCycles: vi.fn(),
  getManagementControlExportData: vi.fn(),
  getManagementIssues: vi.fn(),
  getManagementItems: vi.fn(),
  getSchoolMembers: vi.fn(),
  getSchoolOverview: vi.fn(),
  getVisibleSchools: vi.fn(),
  listAssignableUsers: vi.fn(),
  requireDb: vi.fn(async () => mocks.db),
  userCanAccessSchool: vi.fn(async () => true),
}));

import { appRouter } from "./routers";

function userContext(): TrpcContext {
  return {
    user: { id: 11, openId: "school-user", name: "Escola", email: "school@example.com", loginMethod: "manus", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

const member = (index: number) => ({ name: `Integrante ${index}`, jobTitle: "Servidor", masp: `MASP${index}`, isPresident: index === 1 });

describe("inventory.setCommittee", () => {
  it("aceita uma subcomissão com um integrante e com até 25 integrantes", async () => {
    const caller = appRouter.createCaller(userContext());
    await expect(caller.inventory.setCommittee({ cycleId: 88, members: [member(1)] })).resolves.toEqual({ success: true });
    await expect(caller.inventory.setCommittee({ cycleId: 88, members: Array.from({ length: 25 }, (_, index) => member(index + 1)) })).resolves.toEqual({ success: true });
    expect(mocks.inserted).toHaveLength(2);
    expect(mocks.inserted[0]).toHaveLength(1);
    expect(mocks.inserted[1]).toHaveLength(25);
  });

  it("rejeita mais de 25 integrantes", async () => {
    await expect(appRouter.createCaller(userContext()).inventory.setCommittee({ cycleId: 88, members: Array.from({ length: 26 }, (_, index) => member(index + 1)) })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
