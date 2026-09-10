import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function schoolUserContext(): TrpcContext {
  return {
    user: { id: 10, openId: "school-user", name: "Utilizador da escola", email: "school@example.com", loginMethod: "manus", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("management.reviewInventory", () => {
  it("bloqueia o acesso de utilizadores sem perfil administrativo", async () => {
    const caller = appRouter.createCaller(schoolUserContext());
    await expect(caller.management.reviewInventory({ cycleId: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
