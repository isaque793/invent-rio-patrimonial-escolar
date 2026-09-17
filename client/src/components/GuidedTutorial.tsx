import { CheckCircle2, ChevronRight, GraduationCap, Sparkles } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { activateTutorial, completeTutorial } from "@/lib/tutorialSandbox";

type Step = {
  id: string;
  title: string;
  description: string;
  selector?: string;
  mode: "click" | "input" | "ack" | "file" | "welcome" | "finish";
  placement?: "top" | "bottom" | "left" | "right";
  continueLabel?: string;
};

const steps: Step[] = [
  { id: "welcome", title: "Vamos começar o treinamento", description: "Você vai aprender usando o próprio sistema. Tudo o que fizer nesta demonstração é fictício e não será gravado no banco de dados.", mode: "welcome" },
  { id: "year", title: "Confirme o ano do inventário", description: "Este seletor define o período do inventário. Abra o campo, confira o ano e depois clique em Continuar.", selector: "year", mode: "ack", placement: "bottom", continueLabel: "Continuar" },
  { id: "start-cycle", title: "Inicie o inventário", description: "Agora vamos abrir um inventário de demonstração. Clique no botão destacado para começar.", selector: "start-cycle", mode: "click", placement: "top" },
  { id: "add-item", title: "Cadastre um bem patrimonial", description: "Clique em Adicionar item. O formulário que aparecerá é o mesmo que você usará no inventário real.", selector: "add-item", mode: "click", placement: "bottom" },
  { id: "description", title: "Informe a descrição do bem", description: "Descreva o bem de forma clara. Neste treinamento, escreva algo como Computador de demonstração e clique em Continuar.", selector: "description", mode: "input", placement: "bottom", continueLabel: "Continuar" },
  { id: "property", title: "Entenda a regra do patrimônio", description: "Quando um bem não possui número de patrimônio, selecione Não se aplica. O sistema transformará essa situação em uma pendência automaticamente.", selector: "property", mode: "click", placement: "bottom" },
  { id: "unit-value", title: "Informe o valor unitário", description: "Preencha o valor do bem e clique em Continuar. Os demais campos já possuem valores de demonstração adequados para seguir o fluxo.", selector: "unit-value", mode: "input", placement: "top", continueLabel: "Continuar" },
  { id: "save-item", title: "Salve o bem", description: "Agora salve o item. O cadastro será realizado somente dentro do ambiente de demonstração.", selector: "save-item", mode: "click", placement: "top" },
  { id: "pending", title: "Veja a pendência automática", description: "Como o patrimônio foi marcado como Não se aplica, uma pendência de falta de patrimônio foi criada automaticamente. No sistema real, essa pendência acompanhará a regularização.", selector: "pending", mode: "ack", placement: "top", continueLabel: "Entendi" },
  { id: "edit-item", title: "Edite um item", description: "Os bens podem ser corrigidos enquanto o inventário estiver editável. Clique em Editar no bem que acabamos de registrar.", selector: "edit-item", mode: "click", placement: "top" },
  { id: "edit-description", title: "Corrija uma informação", description: "Altere a descrição do bem, por exemplo acrescentando Revisado, e clique em Continuar.", selector: "description", mode: "input", placement: "bottom", continueLabel: "Continuar" },
  { id: "save-edit", title: "Confirme a alteração", description: "Salve a correção para atualizar o item de demonstração.", selector: "save-edit", mode: "click", placement: "top" },
  { id: "edit-committee", title: "Cadastre a subcomissão", description: "A subcomissão identifica quem participou da conferência. Clique em Editar na área Subcomissão.", selector: "edit-committee", mode: "click", placement: "top" },
  { id: "committee-name", title: "Informe o nome do integrante", description: "Digite um nome de demonstração e clique em Continuar.", selector: "committee-name", mode: "input", placement: "bottom", continueLabel: "Continuar" },
  { id: "committee-job", title: "Informe o cargo", description: "Digite o cargo do integrante e clique em Continuar.", selector: "committee-job", mode: "input", placement: "bottom", continueLabel: "Continuar" },
  { id: "committee-masp", title: "Informe o MASP", description: "Digite um MASP fictício para concluir o cadastro do integrante e clique em Continuar.", selector: "committee-masp", mode: "input", placement: "bottom", continueLabel: "Continuar" },
  { id: "save-committee", title: "Salve a subcomissão", description: "Clique em Guardar subcomissão para registrar a demonstração.", selector: "save-committee", mode: "click", placement: "top" },
  { id: "document-opening", title: "Anexe a Ata de Abertura", description: "Clique em Enviar e escolha um arquivo de teste. O arquivo ficará somente no ambiente de demonstração e não será enviado para o servidor.", selector: "document-opening", mode: "file", placement: "top" },
  { id: "document-responsibility", title: "Anexe o Termo de Responsabilidade", description: "Repita a operação para o Termo de Responsabilidade. Escolha um arquivo de teste.", selector: "document-responsibility", mode: "file", placement: "top" },
  { id: "document-closing", title: "Anexe a Ata de Encerramento", description: "Agora envie um arquivo de teste para a Ata de Encerramento.", selector: "document-closing", mode: "file", placement: "top" },
  { id: "submit", title: "Submeta o inventário", description: "Com bem, subcomissão e os três documentos preenchidos, a submissão pode ser feita. Clique no botão destacado.", selector: "submit", mode: "click", placement: "top" },
  { id: "finish", title: "Treinamento concluído", description: "Você realizou o fluxo principal do inventário sem alterar nenhum dado real. Ao continuar, a demonstração será descartada e o sistema real será liberado.", mode: "finish" },
];

function textMatches(element: Element, expected: string) {
  return (element.textContent || "").replace(/\s+/g, " ").trim().toLowerCase().includes(expected.toLowerCase());
}

function visible(element: Element | null): element is HTMLElement {
  if (!(element instanceof HTMLElement)) return false;
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
}

function findByText(selector: string, text: string, predicate?: (element: Element) => boolean) {
  return Array.from(document.querySelectorAll(selector)).find(element => visible(element) && textMatches(element, text) && (!predicate || predicate(element))) as HTMLElement | undefined;
}

function findTarget(id: string): HTMLElement | null {
  switch (id) {
    case "year":
      return Array.from(document.querySelectorAll('button[role="combobox"]')).find(element => visible(element)) as HTMLElement | null;
    case "start-cycle":
      return findByText("button", "Iniciar inventário");
    case "add-item":
      return findByText("button", "Adicionar item", element => !element.closest('[role="dialog"]'));
    case "description": {
      const inputs = Array.from(document.querySelectorAll('input[name="description"]'));
      return inputs.find(element => visible(element)) as HTMLElement | null;
    }
    case "property":
      return findByText("button", "Não se aplica", element => Boolean(element.closest('[role="dialog"]')));
    case "unit-value":
      return Array.from(document.querySelectorAll('input[name="unitValue"]')).find(element => visible(element)) as HTMLElement | null;
    case "save-item":
      return findByText('[role="dialog"] button', "Adicionar item");
    case "pending":
      return findByText("h3", "Pendências e ocorrências") || findByText("div", "Pendências e ocorrências");
    case "edit-item":
      return document.querySelector('button[aria-label="Editar item"]') as HTMLElement | null;
    case "save-edit":
      return findByText('[role="dialog"] button', "Guardar alterações");
    case "edit-committee": {
      return Array.from(document.querySelectorAll("button")).find(button => {
        if (!visible(button) || !textMatches(button, "Editar")) return false;
        let parent: HTMLElement | null = button.parentElement;
        for (let level = 0; parent && level < 5; level += 1, parent = parent.parentElement) {
          if (textMatches(parent, "Subcomissão")) return true;
        }
        return false;
      }) as HTMLElement | null;
    }
    case "committee-name":
    case "committee-job":
    case "committee-masp": {
      const inputs = Array.from(document.querySelectorAll('[role="dialog"] input')).filter(element => visible(element)) as HTMLInputElement[];
      const index = id === "committee-name" ? 0 : id === "committee-job" ? 1 : 2;
      return inputs[index] || null;
    }
    case "save-committee":
      return findByText('[role="dialog"] button', "Guardar subcomissão");
    case "document-opening":
      return Array.from(document.querySelectorAll("label")).find(label => visible(label) && textMatches(label, "Ata de Abertura")) as HTMLElement | null;
    case "document-responsibility":
      return Array.from(document.querySelectorAll("label")).find(label => visible(label) && textMatches(label, "Termo de Responsabilidade")) as HTMLElement | null;
    case "document-closing":
      return Array.from(document.querySelectorAll("label")).find(label => visible(label) && textMatches(label, "Ata de Encerramento")) as HTMLElement | null;
    case "submit":
      return Array.from(document.querySelectorAll("button")).find(button => visible(button) && (textMatches(button, "Submeter para validação") || textMatches(button, "Concluir exigências para submeter"))) as HTMLElement | null;
    default:
      return null;
  }
}

export default function GuidedTutorial() {
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const step = steps[stepIndex];

  useEffect(() => {
    activateTutorial();
  }, []);

  const target = useMemo(() => step.selector ? findTarget(step.id) : null, [step.id, step.selector]);

  const refreshTarget = useCallback(() => {
    const element = step.selector ? findTarget(step.id) : null;
    if (!element) {
      setTargetRect(null);
      return;
    }
    element.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
    const update = () => setTargetRect(element.getBoundingClientRect());
    update();
    const frame = window.requestAnimationFrame(update);
    return () => window.cancelAnimationFrame(frame);
  }, [step.id, step.selector]);

  useEffect(() => {
    const cleanup = refreshTarget();
    const update = () => refreshTarget();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    return () => {
      cleanup?.();
      observer.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [refreshTarget]);

  useEffect(() => {
    if (!target || !visible(target)) return;
    const next = () => setStepIndex(index => Math.min(index + 1, steps.length - 1));
    const onClick = () => { if (step.mode === "click") window.setTimeout(next, 120); };
    const onInput = () => {
      if (step.mode !== "input") return;
      const input = target as HTMLInputElement;
      if (input.value.trim()) setTargetRect(input.getBoundingClientRect());
    };
    const onChange = () => {
      if (step.mode === "file") window.setTimeout(next, 120);
    };
    target.addEventListener("click", onClick, true);
    target.addEventListener("input", onInput, true);
    target.addEventListener("change", onChange, true);
    return () => {
      target.removeEventListener("click", onClick, true);
      target.removeEventListener("input", onInput, true);
      target.removeEventListener("change", onChange, true);
    };
  }, [target, step.mode]);

  useEffect(() => {
    const onDocumentChange = (event: Event) => {
      if (step.mode !== "file") return;
      const element = event.target;
      if (element instanceof HTMLInputElement && element.type === "file" && element.files?.length) {
        window.setTimeout(() => setStepIndex(index => Math.min(index + 1, steps.length - 1)), 120);
      }
    };
    document.addEventListener("change", onDocumentChange, true);
    return () => document.removeEventListener("change", onDocumentChange, true);
  }, [step.mode]);

  const continueStep = () => setStepIndex(index => Math.min(index + 1, steps.length - 1));
  const finish = () => {
    completeTutorial();
    window.location.reload();
  };

  const tooltipStyle = useMemo<React.CSSProperties>(() => {
    if (!targetRect) {
      return { left: "50%", top: "50%", width: "min(430px, calc(100vw - 32px))", transform: "translate(-50%, -50%)" };
    }
    const width = Math.min(390, window.innerWidth - 32);
    const gap = 18;
    let left = targetRect.left + targetRect.width / 2 - width / 2;
    let top = targetRect.bottom + gap;
    if (step.placement === "top") top = targetRect.top - 230 - gap;
    if (step.placement === "left") { left = targetRect.left - width - gap; top = targetRect.top; }
    if (step.placement === "right") { left = targetRect.right + gap; top = targetRect.top; }
    left = Math.max(16, Math.min(left, window.innerWidth - width - 16));
    top = Math.max(16, Math.min(top, window.innerHeight - 245));
    return { left, top, width };
  }, [step.placement, targetRect]);

  const highlighted = targetRect && step.selector;
  const inputReady = step.mode === "input" && target instanceof HTMLInputElement && target.value.trim().length > 0;

  return <>
    <div className="fixed inset-0 z-[40] bg-black/50" style={{ pointerEvents: highlighted ? "auto" : "auto" }}>
      {highlighted && targetRect ? <>
        <div className="absolute left-0 top-0 w-full bg-black/50" style={{ height: Math.max(targetRect.top - 8, 0) }} />
        <div className="absolute bottom-0 left-0 w-full bg-black/50" style={{ height: Math.max(window.innerHeight - targetRect.bottom - 8, 0) }} />
        <div className="absolute left-0 bg-black/50" style={{ top: Math.max(targetRect.top - 8, 0), width: Math.max(targetRect.left - 8, 0), height: targetRect.height + 16 }} />
        <div className="absolute right-0 bg-black/50" style={{ top: Math.max(targetRect.top - 8, 0), width: Math.max(window.innerWidth - targetRect.right - 8, 0), height: targetRect.height + 16 }} />
      </> : null}
    </div>

    {highlighted && targetRect && <div className="pointer-events-none fixed z-[45] rounded-xl border-2 border-[#f2d98c] shadow-[0_0_28px_rgba(242,217,140,.45)]" style={{ left: targetRect.left - 5, top: targetRect.top - 5, width: targetRect.width + 10, height: targetRect.height + 10 }} />}

    <div className="fixed z-[50]" style={tooltipStyle}>
      <div className="rounded-2xl border border-[#d8e3db] bg-white p-5 shadow-[0_22px_70px_rgba(15,45,35,.24)]">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#eaf3ee] text-[#0b5d4b]"><GraduationCap className="size-5" /></div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#597566]">Orientação</p>
            <h2 className="mt-1 text-lg font-semibold text-[#173b30]">{step.title}</h2>
          </div>
        </div>
        <p className="mt-3 text-sm leading-6 text-[#65796e]">{step.description}</p>
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-xs font-medium text-[#7b897f]">{stepIndex + 1}/{steps.length}</p>
          {step.mode === "welcome" && <button type="button" onClick={continueStep} className="inline-flex items-center rounded-lg bg-[#0b5d4b] px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#083f34]">Começar <ChevronRight className="ml-1 size-4" /></button>}
          {step.mode === "ack" && <button type="button" onClick={continueStep} className="inline-flex items-center rounded-lg bg-[#0b5d4b] px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#083f34]">{step.continueLabel || "Continuar"} <ChevronRight className="ml-1 size-4" /></button>}
          {step.mode === "input" && <button type="button" disabled={!inputReady} onClick={continueStep} className="inline-flex items-center rounded-lg bg-[#0b5d4b] px-3 py-2 text-xs font-semibold text-white shadow-sm enabled:hover:bg-[#083f34] disabled:cursor-not-allowed disabled:opacity-40">{step.continueLabel || "Continuar"} <ChevronRight className="ml-1 size-4" /></button>}
          {step.mode === "click" && <p className="text-xs font-semibold text-[#567064]">Realize a ação destacada</p>}
          {step.mode === "file" && <p className="text-xs font-semibold text-[#567064]">Selecione um arquivo para continuar</p>}
          {step.mode === "finish" && <button type="button" onClick={finish} className="inline-flex items-center rounded-lg bg-[#0b5d4b] px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#083f34]"><CheckCircle2 className="mr-1 size-4" />Liberar sistema</button>}
        </div>
      </div>
    </div>
  </>;
}
