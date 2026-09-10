import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { appRouter } from "../server/routers.ts";
import { getDb } from "../server/db.ts";
import { committeeMembers, inventoryCycles, inventoryDocuments, inventoryIssues, inventoryItems, inventoryNotes, schools, users, validationHistory } from "../drizzle/schema.ts";

const TEMPORARY_CODE = "TEMP-VALIDACAO-2026";
const year = new Date().getFullYear();
const temporaryMembers = [
  { name: "Membro Técnico 1", jobTitle: "Servidor", masp: "1000001", isPresident: true },
  { name: "Membro Técnico 2", jobTitle: "Servidor", masp: "1000002", isPresident: false },
  { name: "Membro Técnico 3", jobTitle: "Servidor", masp: "1000003", isPresident: false },
];

async function expectFailure(operation, messageFragment) {
  try {
    await operation();
    throw new Error(`Expected failure containing: ${messageFragment}`);
  } catch (error) {
    if (!String(error.message).includes(messageFragment)) throw error;
  }
}

async function cleanup(db, schoolId) {
  if (!schoolId) return;
  const cycles = await db.select({ id: inventoryCycles.id }).from(inventoryCycles).where(eq(inventoryCycles.schoolId, schoolId));
  for (const cycle of cycles) {
    await db.delete(validationHistory).where(eq(validationHistory.cycleId, cycle.id));
    await db.delete(inventoryDocuments).where(eq(inventoryDocuments.cycleId, cycle.id));
    await db.delete(inventoryIssues).where(eq(inventoryIssues.cycleId, cycle.id));
    await db.delete(inventoryItems).where(eq(inventoryItems.cycleId, cycle.id));
    await db.delete(inventoryNotes).where(eq(inventoryNotes.cycleId, cycle.id));
    await db.delete(committeeMembers).where(eq(committeeMembers.cycleId, cycle.id));
  }
  await db.delete(inventoryCycles).where(eq(inventoryCycles.schoolId, schoolId));
  await db.delete(schools).where(eq(schools.id, schoolId));
}

const db = await getDb();
if (!db) throw new Error("Database unavailable");
const [user] = await db.select().from(users).where(eq(users.id, 1)).limit(1);
if (!user) throw new Error("Administrative test user not found");
const caller = appRouter.createCaller({ user, req: { protocol: "https", headers: {} }, res: {} });
let schoolId;

try {
  const school = await caller.school.create({ name: "VALIDAÇÃO TÉCNICA TEMPORÁRIA — REMOVER", schoolCode: TEMPORARY_CODE, city: "AMBIENTE CONTROLADO", regionalOffice: null, email: null, phone: null, responsibleName: "Responsável temporário", responsibleMasp: "0000000", responsibleRole: "Validação técnica", directorName: "Direção temporária", directorMasp: "0000001" });
  schoolId = school.id;
  const cycle = await caller.inventory.createCycle({ schoolId, year });

  await expectFailure(() => caller.inventory.submit({ cycleId: cycle.id }), "Inclua ao menos um item");
  await caller.inventory.addItem({ cycleId: cycle.id, propertyNumber: "TEMP-0001", quantity: 2, description: "Bem temporário para validação técnica", technicalDetails: "Registo autorizado para teste e remoção", expenseCode: "52.14", conservationCode: "2 - Bom", conservationState: "Bom", unitValue: 250, currentSituation: "Em uso" });
  await caller.inventory.addIssue({ cycleId: cycle.id, issueType: "other", propertyNumber: "TEMP-0001", quantity: 1, description: "Ocorrência temporária de validação", conservationState: "Bom", location: "Ambiente controlado", totalValue: 250, originBody: null, currentSituation: "Em tratamento", pendingDescription: "Teste controlado do relatório consolidado de pendências.", measuresTaken: "Validação concluída e registo temporário removido.", resolutionStatus: "resolved" });
  await caller.inventory.upsertNotes({ cycleId: cycle.id, problemsFound: "Teste técnico autorizado.", quantityDivergences: null, valueDivergences: null });
  await caller.inventory.setCommittee({ cycleId: cycle.id, members: temporaryMembers });
  await expectFailure(() => caller.inventory.submit({ cycleId: cycle.id }), "Envie os três documentos");

  const tooLargeContent = Buffer.alloc(10 * 1024 * 1024 + 1).toString("base64");
  await expectFailure(() => caller.inventory.uploadDocument({ cycleId: cycle.id, documentType: "opening_minutes", fileName: "maior-que-o-limite.pdf", mimeType: "application/pdf", contentBase64: tooLargeContent }), "Envie ficheiros de até 10 MB");
  await expectFailure(() => caller.inventory.uploadDocument({ cycleId: cycle.id, documentType: "opening_minutes", fileName: "tipo-invalido.bin", mimeType: "application/octet-stream", contentBase64: "dGVzdGU=" }), "Invalid option");
  await expectFailure(() => caller.inventory.uploadDocument({ cycleId: cycle.id, documentType: "other", fileName: "categoria-invalida.pdf", mimeType: "application/pdf", contentBase64: "dGVzdGU=" }), "Invalid option");

  const documentSources = [["opening_minutes", "/home/ubuntu/upload/AtadeAbertura-InventárioAnual.pdf"], ["responsibility_term", "/home/ubuntu/upload/TermodeResponsabilidade-InventárioAnual.pdf"], ["closing_minutes", "/home/ubuntu/upload/AtadeEncerramento-InventárioAnual.pdf"]];
  for (const [documentType, path] of documentSources) {
    await caller.inventory.uploadDocument({ cycleId: cycle.id, documentType, fileName: `temporario-${documentType}.pdf`, mimeType: "application/pdf", contentBase64: readFileSync(path).toString("base64") });
  }
  await db.delete(committeeMembers).where(eq(committeeMembers.cycleId, cycle.id));
  await expectFailure(() => caller.inventory.submit({ cycleId: cycle.id }), "Registe os três membros da subcomissão");
  await caller.inventory.setCommittee({ cycleId: cycle.id, members: temporaryMembers });
  await caller.inventory.submit({ cycleId: cycle.id });
  await caller.management.changeStatus({ cycleId: cycle.id, status: "under_review", note: "Validação técnica em análise." });
  await caller.management.changeStatus({ cycleId: cycle.id, status: "validated", note: "Validação técnica concluída." });
  const overview = await caller.inventory.overview({ schoolId, year });
  if (overview?.cycle?.status !== "validated" || overview.documents.length !== 3 || overview.items.length !== 1 || overview.issues.length !== 1) throw new Error("Temporary validation did not reach expected final state");
  console.log(JSON.stringify({ success: true, finalStatus: overview.cycle.status, documents: overview.documents.length, items: overview.items.length, issues: overview.issues.length, checks: ["missing_item", "missing_documents", "oversized_file", "invalid_mime", "invalid_document_type", "missing_committee", "validated"] }));
} finally {
  await cleanup(db, schoolId);
  console.log(JSON.stringify({ cleanup: "completed", schoolId }));
}
