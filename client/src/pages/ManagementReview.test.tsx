// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ navigate: vi.fn(), mutate: vi.fn(), refetch: vi.fn(), invalidate: vi.fn(), toastError: vi.fn() }));
const review = {
  school: { name: "EE Afonso Pena", city: "Belo Horizonte" },
  cycle: { id: 7, year: 2026, status: "submitted", reviewNotes: null },
  items: [{ id: 1, propertyNumber: "123", description: "Armário de aço", technicalDetails: "Duas portas", conservationState: "Bom", quantity: 2, totalValue: "700.50", currentSituation: "Em uso" }],
  issues: [{ id: 2, description: "Item não localizado", issueType: "not_found", resolutionStatus: "open", pendingDescription: "Conferir a sala", measuresTaken: "Solicitada busca" }],
  documents: [{ id: 3, documentType: "opening_minutes", fileName: "ata-abertura.pdf", uploadedAt: new Date("2026-08-20"), storageUrl: "https://files.example/ata-abertura.pdf" }],
  members: [{ id: 4, name: "Ana Silva", jobTitle: "Professora", masp: "123456", isPresident: 1 }],
  notes: { problemsFound: "Sem outras divergências", quantityDivergences: null, valueDivergences: null },
};
vi.mock("wouter", () => ({ useRoute: () => [true, { cycleId: "7" }], useLocation: () => ["/gestao/analise/7", mocks.navigate] }));
vi.mock("@/lib/trpc", () => ({ trpc: { useUtils: () => ({ management: { dashboard: { invalidate: mocks.invalidate } } }), management: { reviewInventory: { useQuery: () => ({ isLoading: false, data: review, refetch: mocks.refetch }) }, changeStatus: { useMutation: () => ({ mutate: mocks.mutate, isPending: false }) } } } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: mocks.toastError } }));
import ManagementReview from "./ManagementReview";

afterEach(() => { cleanup(); mocks.navigate.mockClear(); mocks.mutate.mockClear(); mocks.toastError.mockClear(); });
describe("revisão administrativa de inventário", () => {
  it("apresenta inventário, pendências e documentos da escola para análise", () => {
    render(<ManagementReview />);
    expect(screen.getByRole("heading", { name: "EE Afonso Pena" })).toBeInTheDocument();
    expect(screen.getByText("Armário de aço")).toBeInTheDocument();
    expect(screen.getByText("Item não localizado")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abrir" })).toHaveAttribute("href", "https://files.example/ata-abertura.pdf");
  });

  it("envia uma decisão administrativa e exige justificativa para devolução", () => {
    render(<ManagementReview />);
    fireEvent.click(screen.getByRole("button", { name: "Confirmar decisão" }));
    expect(mocks.mutate).toHaveBeenCalledWith({ cycleId: 7, status: "under_review", note: null });
  });
});
