// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

let usersState: Array<{ id: number; name: string; email: string; role: "admin" | "user" }> = [];
const mutate = vi.fn();
const invalidate = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/trpc", () => ({
  trpc: {
    management: {
      listUsers: { useQuery: () => ({ data: usersState, isLoading: false }) },
      setUserRole: { useMutation: () => ({ mutate, isPending: false }) },
    },
    useUtils: () => ({ management: { listUsers: { invalidate } } }),
  },
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import AdminUsers from "./AdminUsers";

afterEach(() => { cleanup(); mutate.mockClear(); invalidate.mockClear(); });

describe("painel de administradores", () => {
  it("abre a confirmação e envia a promoção de um utilizador", () => {
    usersState = [{ id: 1, name: "Gestor", email: "gestor@teste.local", role: "admin" }, { id: 2, name: "Escola Piloto", email: "escola@teste.local", role: "user" }];
    render(<AdminUsers />);
    fireEvent.click(screen.getByRole("button", { name: "Tornar administrador" }));
    expect(screen.getByRole("heading", { name: "Conceder acesso administrativo" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Conceder acesso total" }));
    expect(mutate).toHaveBeenCalledWith({ userId: 2, role: "admin" });
  });

  it("abre a confirmação e envia a revogação quando existe outro administrador", () => {
    usersState = [{ id: 1, name: "Gestor", email: "gestor@teste.local", role: "admin" }, { id: 2, name: "Coordenador", email: "coordenador@teste.local", role: "admin" }];
    render(<AdminUsers />);
    const revokeButtons = screen.getAllByRole("button", { name: "Revogar acesso" });
    fireEvent.click(revokeButtons[0]);
    expect(screen.getByRole("heading", { name: "Revogar acesso administrativo" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Revogar acesso" }));
    expect(mutate).toHaveBeenCalledWith({ userId: 1, role: "user" });
  });

  it("desativa a revogação quando há apenas um administrador", () => {
    usersState = [{ id: 1, name: "Gestor", email: "gestor@teste.local", role: "admin" }];
    render(<AdminUsers />);
    expect(screen.getByRole("button", { name: "Último administrador" })).toBeDisabled();
  });
});
