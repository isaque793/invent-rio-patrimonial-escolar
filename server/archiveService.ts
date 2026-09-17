import { eq } from "drizzle-orm";
import {
  committeeMembers,
  inventoryCycles,
  inventoryDocuments,
  inventoryIssues,
  inventoryItems,
  inventoryNotes,
  schools,
  validationHistory,
} from "../drizzle/schema";
import { requireDb } from "./db";
import { storageCopy, storagePutExact, storageVerify } from "./storage";

const ARCHIVE_PACKAGE_VERSION = 1;
const ARCHIVE_ROOT = "arquivo-inventario";

interface ArchiveManifest {
  version: number;
  schoolId: number;
  cycleId: number;
  year: number;
  archivedAt: string;
  items: number;
  documents: number;
  archiveStatus: "completed";
}

function archiveFolder(year: number, schoolId: number, cycleId: number) {
  return `${ARCHIVE_ROOT}/${year}/escola-${schoolId}/ciclo-${cycleId}`;
}

/**
 * Arquiva um ciclo já validado: gera o pacote (dados + documentos + manifesto)
 * na área institucional de armazenamento e registra o resultado no banco.
 *
 * Ordem seguida (ver "arquivar não é apagar"):
 *   exportar -> armazenar -> verificar -> registrar
 * Nenhum conteúdo operacional é removido por esta função. Em caso de falha em
 * qualquer etapa, o ciclo permanece com archiveStatus="ERROR" e pode ser
 * reprocessado (idempotente: reexecutar apenas regrava o pacote e o manifesto).
 */
export async function archiveCycle(cycleId: number): Promise<
  | { ok: true; location: string }
  | { ok: false; error: string }
> {
  const db = await requireDb();

  const cycleRows = await db.select().from(inventoryCycles).where(eq(inventoryCycles.id, cycleId)).limit(1);
  const cycle = cycleRows[0];
  if (!cycle) return { ok: false, error: "Ciclo não encontrado." };

  if (cycle.status !== "validated") {
    return { ok: false, error: "Somente ciclos validados podem ser arquivados." };
  }
  // Idempotência: evita duas execuções simultâneas do mesmo ciclo e evita
  // reprocessar um ciclo já concluído com sucesso.
  if (cycle.archiveStatus === "ARCHIVED") {
    return { ok: true, location: cycle.archiveLocation ?? archiveFolder(cycle.year, cycle.schoolId, cycle.id) };
  }
  if (cycle.archiveStatus === "PENDING") {
    return { ok: false, error: "Arquivamento já em andamento para este ciclo." };
  }

  await db.update(inventoryCycles).set({ archiveStatus: "PENDING", archiveError: null }).where(eq(inventoryCycles.id, cycleId));

  try {
    const folder = archiveFolder(cycle.year, cycle.schoolId, cycle.id);

    const [school, items, issues, notes, committee, history, documents] = await Promise.all([
      db.select().from(schools).where(eq(schools.id, cycle.schoolId)).limit(1),
      db.select().from(inventoryItems).where(eq(inventoryItems.cycleId, cycleId)),
      db.select().from(inventoryIssues).where(eq(inventoryIssues.cycleId, cycleId)),
      db.select().from(inventoryNotes).where(eq(inventoryNotes.cycleId, cycleId)),
      db.select().from(committeeMembers).where(eq(committeeMembers.cycleId, cycleId)),
      db.select().from(validationHistory).where(eq(validationHistory.cycleId, cycleId)),
      db.select().from(inventoryDocuments).where(eq(inventoryDocuments.cycleId, cycleId)),
    ]);

    // 1) Exportar: grava os JSONs de dados do ciclo no pacote.
    await Promise.all([
      storagePutExact(`${folder}/dados/ciclo.json`, JSON.stringify({ ...cycle, school: school[0] ?? null }, null, 2)),
      storagePutExact(`${folder}/dados/itens.json`, JSON.stringify(items, null, 2)),
      storagePutExact(`${folder}/dados/ocorrencias.json`, JSON.stringify(issues, null, 2)),
      storagePutExact(`${folder}/dados/observacoes.json`, JSON.stringify(notes, null, 2)),
      storagePutExact(`${folder}/dados/comissao.json`, JSON.stringify(committee, null, 2)),
      storagePutExact(`${folder}/dados/validacoes.json`, JSON.stringify(history, null, 2)),
    ]);

    // 2) Armazenar: copia cada documento assinado para dentro do pacote.
    // Usamos CopyObject (lado do servidor do R2) em vez de baixar e reenviar,
    // então não há custo relevante de banda nem duplicação de tráfego.
    const copiedKeys: string[] = [];
    for (const doc of documents) {
      const destKey = `${folder}/documentos/${doc.documentType}-${doc.id}-${doc.fileName}`;
      await storageCopy(doc.storageKey, destKey);
      copiedKeys.push(destKey);
    }

    // 3) Verificar: confirma que cada documento copiado realmente existe no destino
    // antes de considerar o pacote completo. Se qualquer um falhar, o ciclo
    // permanece com archiveStatus="ERROR" e nada é removido do lado operacional.
    for (const key of copiedKeys) {
      const check = await storageVerify(key);
      if (!check.exists) {
        throw new Error(`Falha ao verificar documento arquivado: ${key}`);
      }
    }

    const manifest: ArchiveManifest = {
      version: ARCHIVE_PACKAGE_VERSION,
      schoolId: cycle.schoolId,
      cycleId: cycle.id,
      year: cycle.year,
      archivedAt: new Date().toISOString(),
      items: items.length,
      documents: documents.length,
      archiveStatus: "completed",
    };
    await storagePutExact(`${folder}/manifest.json`, JSON.stringify(manifest, null, 2));
    const manifestCheck = await storageVerify(`${folder}/manifest.json`);
    if (!manifestCheck.exists) throw new Error("Falha ao verificar manifest.json do pacote.");

    // 4) Registrar: só depois de tudo verificado o ciclo é marcado como arquivado.
    await db
      .update(inventoryCycles)
      .set({
        archiveStatus: "ARCHIVED",
        archivedAt: new Date(),
        archiveLocation: folder,
        archiveVersion: ARCHIVE_PACKAGE_VERSION,
        archiveError: null,
      })
      .where(eq(inventoryCycles.id, cycleId));

    return { ok: true, location: folder };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido ao arquivar.";
    await db
      .update(inventoryCycles)
      .set({ archiveStatus: "ERROR", archiveError: message })
      .where(eq(inventoryCycles.id, cycleId));
    console.error(`[Archive] Falha ao arquivar ciclo ${cycleId}:`, error);
    return { ok: false, error: message };
  }
}
