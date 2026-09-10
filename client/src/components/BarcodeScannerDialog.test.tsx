// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BarcodeScannerDialog } from "./BarcodeScannerDialog";

let detectedCallback: ((result: { codeResult: { code: string | null } }) => void) | undefined;
let initError: Error | null = null;

vi.mock("@ericblade/quagga2", () => ({
  default: {
    init: vi.fn((_config: unknown, callback: (error: Error | null) => void) => callback(initError)),
    onDetected: vi.fn((callback: typeof detectedCallback) => { detectedCallback = callback; }),
    offDetected: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  },
}));

describe("BarcodeScannerDialog", () => {
  afterEach(() => cleanup());
  beforeEach(() => { initError = null; detectedCallback = undefined; });

  it("ativa a câmera e retorna o código lido", async () => {
    const onDetected = vi.fn();
    render(<BarcodeScannerDialog open onOpenChange={vi.fn()} onDetected={onDetected} />);
    expect(await screen.findByText("Câmera ativa. Aponte o código de barras para a linha central.")).toBeTruthy();
    detectedCallback?.({ codeResult: { code: "PAT-12345" } });
    expect(onDetected).toHaveBeenCalledWith("PAT-12345");
  });

  it("informa que a digitação manual continua disponível quando a câmera falha", async () => {
    initError = new Error("permission denied");
    render(<BarcodeScannerDialog open onOpenChange={vi.fn()} onDetected={vi.fn()} />);
    expect(await screen.findByText("Não foi possível acessar a câmera. Autorize o uso ou digite o código manualmente.")).toBeTruthy();
    expect(screen.getByText("Entrada manual disponível")).toBeTruthy();
  });

  it("permite fechar o leitor", () => {
    const onOpenChange = vi.fn();
    render(<BarcodeScannerDialog open onOpenChange={onOpenChange} onDetected={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Fechar câmera" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
