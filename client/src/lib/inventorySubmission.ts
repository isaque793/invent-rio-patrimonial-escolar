export const REQUIRED_INVENTORY_DOCUMENT_TYPES = ["opening_minutes", "responsibility_term", "closing_minutes"] as const;

const documentLabels: Record<(typeof REQUIRED_INVENTORY_DOCUMENT_TYPES)[number], string> = {
  opening_minutes: "Ata de Abertura assinada",
  responsibility_term: "Termo de Responsabilidade assinado",
  closing_minutes: "Ata de Encerramento assinada",
};

export function getInventorySubmissionRequirements({ itemCount, memberCount, documentTypes }: { itemCount: number; memberCount: number; documentTypes: Iterable<string> }) {
  const receivedDocuments = new Set(documentTypes);
  const missing = [
    ...(itemCount > 0 ? [] : ["Ao menos um item patrimonial"]),
    ...(memberCount >= 1 ? [] : ["Ao menos um integrante da subcomissão"]),
    ...REQUIRED_INVENTORY_DOCUMENT_TYPES.filter(type => !receivedDocuments.has(type)).map(type => documentLabels[type]),
  ];
  return { ready: missing.length === 0, missing };
}
