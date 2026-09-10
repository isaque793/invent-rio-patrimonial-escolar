// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { canQueryInventoryOverview } from "./inventoryAccess";

describe("acesso ao inventário", () => {
  it("não permite consultar inventário sem escola selecionada ou vinculada", () => {
    expect(canQueryInventoryOverview(null, [])).toBe(false);
    expect(canQueryInventoryOverview(10, [])).toBe(false);
    expect(canQueryInventoryOverview(10, [11, 12])).toBe(false);
  });

  it("permite consultar somente uma escola visível ao utilizador", () => {
    expect(canQueryInventoryOverview(12, [11, 12])).toBe(true);
  });
});
