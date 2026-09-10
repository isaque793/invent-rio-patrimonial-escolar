// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ loading: false, user: { id: 10, name: "Administrador promovido", role: "admin" }, logout: vi.fn() }) }));
const device = vi.hoisted(() => ({ mobile: false }));
const sidebar = vi.hoisted(() => ({ state: "expanded" as "expanded" | "collapsed" }));
vi.mock("@/hooks/useMobile", () => ({ useIsMobile: () => device.mobile }));
vi.mock("@/const", () => ({ startLogin: vi.fn() }));
vi.mock("wouter", () => ({ useLocation: () => ["/", vi.fn()] }));
vi.mock("@/components/ui/sidebar", () => ({
  SidebarProvider: ({ children }: any) => <div>{children}</div>, Sidebar: ({ children }: any) => <aside>{children}</aside>, SidebarContent: ({ children }: any) => <div>{children}</div>, SidebarFooter: ({ children }: any) => <div>{children}</div>, SidebarHeader: ({ children }: any) => <div>{children}</div>, SidebarInset: ({ children }: any) => <div>{children}</div>, SidebarMenu: ({ children }: any) => <nav>{children}</nav>, SidebarMenuItem: ({ children }: any) => <div>{children}</div>, SidebarMenuButton: ({ children, onClick, tooltip }: any) => <button data-tooltip={typeof tooltip === "string" ? tooltip : ""} onClick={onClick}>{children}</button>, SidebarTrigger: () => <button>Menu</button>, useSidebar: () => ({ state: sidebar.state, toggleSidebar: vi.fn() }),
}));
vi.mock("@/components/ui/avatar", () => ({ Avatar: ({ children }: any) => <div>{children}</div>, AvatarFallback: ({ children }: any) => <span>{children}</span> }));
vi.mock("@/components/ui/dropdown-menu", () => ({ DropdownMenu: ({ children }: any) => <div>{children}</div>, DropdownMenuContent: ({ children }: any) => <div>{children}</div>, DropdownMenuItem: ({ children }: any) => <button>{children}</button>, DropdownMenuTrigger: ({ children }: any) => <div>{children}</div> }));

import DashboardLayout from "./DashboardLayout";

afterEach(() => { cleanup(); device.mobile = false; sidebar.state = "expanded"; });

describe("DashboardLayout administrativo", () => {
  it("mostra todas as abas para qualquer utilizador com perfil administrador", () => {
    render(<DashboardLayout><div>Conteúdo protegido</div></DashboardLayout>);
    expect(screen.getByRole("button", { name: /Gestão e consolidação/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Escolas/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Administradores/ })).toBeInTheDocument();
    expect(screen.getByText("Conteúdo protegido")).toBeInTheDocument();
  });

  it("não monta Tooltips ocultos quando a sidebar está expandida", () => {
    render(<DashboardLayout><div>Conteúdo protegido</div></DashboardLayout>);
    expect(screen.getByRole("button", { name: /Gestão e consolidação/ })).toHaveAttribute("data-tooltip", "");
  });

  it("mantém o Tooltip disponível quando a sidebar está recolhida", () => {
    sidebar.state = "collapsed";
    render(<DashboardLayout><div>Conteúdo protegido</div></DashboardLayout>);
    expect(screen.getByRole("button", { name: /Gestão e consolidação/ })).toHaveAttribute("data-tooltip", "Gestão e consolidação");
  });

  it("mostra atalhos de todas as abas no menu móvel do administrador", () => {
    device.mobile = true;
    render(<DashboardLayout><div>Conteúdo protegido</div></DashboardLayout>);
    const mobileNavigation = screen.getByRole("navigation", { name: "Navegação móvel" });
    expect(within(mobileNavigation).getByRole("button", { name: "Gestão e consolidação" })).toBeInTheDocument();
    expect(within(mobileNavigation).getByRole("button", { name: "Escolas" })).toBeInTheDocument();
    expect(within(mobileNavigation).getByRole("button", { name: "Administradores" })).toBeInTheDocument();
  });
});
