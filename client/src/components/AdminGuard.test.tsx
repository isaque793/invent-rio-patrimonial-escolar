// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

let role: "admin" | "user" = "user";
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ loading: false, user: { role } }) }));
import { AdminGuard } from "./AdminGuard";

afterEach(cleanup);
describe("AdminGuard", () => {
  it("carrega conteúdo administrativo para administradores", () => {
    role = "admin"; render(<AdminGuard><div>Gestão carregada</div></AdminGuard>);
    expect(screen.getByText("Gestão carregada")).toBeInTheDocument();
  });
  it("bloqueia conteúdo administrativo para utilizadores de escola", () => {
    role = "user"; render(<AdminGuard><div>Gestão carregada</div></AdminGuard>);
    expect(screen.queryByText("Gestão carregada")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Acesso reservado à equipa gestora" })).toBeInTheDocument();
  });
});
