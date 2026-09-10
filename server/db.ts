import { and, asc, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  committeeMembers,
  inventoryCycles,
  inventoryDocuments,
  inventoryIssues,
  inventoryItems,
  inventoryNotes,
  schoolMemberships,
  schools,
  users,
  validationHistory,
  type InsertUser,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import { hasSchoolAccess } from "./inventoryUtils";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Falha ao conectar:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("O identificador do utilizador é obrigatório.");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId, lastSignedIn: user.lastSignedIn ?? new Date() };
  const updateSet: Record<string, unknown> = { lastSignedIn: values.lastSignedIn };
  for (const field of ["name", "email", "loginMethod"] as const) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  } else if (user.role !== undefined) {
    values.role = user.role;
  }
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("A base de dados não está disponível neste momento.");
  return db;
}

export async function getVisibleSchools(user: typeof users.$inferSelect) {
  const db = await requireDb();
  if (user.role === "admin") return db.select().from(schools).orderBy(asc(schools.name));
  const rows = await db
    .select({ school: schools })
    .from(schoolMemberships)
    .innerJoin(schools, eq(schoolMemberships.schoolId, schools.id))
    .where(eq(schoolMemberships.userId, user.id))
    .orderBy(asc(schools.name));
  return rows.map(row => row.school);
}

export async function userCanAccessSchool(user: typeof users.$inferSelect, schoolId: number) {
  if (hasSchoolAccess(user.role, false)) return true;
  const db = await requireDb();
  const membership = await db
    .select({ id: schoolMemberships.id })
    .from(schoolMemberships)
    .where(and(eq(schoolMemberships.schoolId, schoolId), eq(schoolMemberships.userId, user.id)))
    .limit(1);
  return hasSchoolAccess(user.role, Boolean(membership[0]));
}

export async function getCycleById(cycleId: number) {
  const db = await requireDb();
  const rows = await db.select().from(inventoryCycles).where(eq(inventoryCycles.id, cycleId)).limit(1);
  return rows[0];
}

export async function getSchoolOverview(schoolId: number, year: number) {
  const db = await requireDb();
  const school = (await db.select().from(schools).where(eq(schools.id, schoolId)).limit(1))[0];
  if (!school) return null;
  const cycle = (
    await db
      .select()
      .from(inventoryCycles)
      .where(and(eq(inventoryCycles.schoolId, schoolId), eq(inventoryCycles.year, year)))
      .limit(1)
  )[0];
  if (!cycle) return { school, cycle: null, members: [], items: [], issues: [], documents: [], notes: null, history: [] };
  const [members, items, issues, documents, notes, history] = await Promise.all([
    db.select().from(committeeMembers).where(eq(committeeMembers.cycleId, cycle.id)).orderBy(asc(committeeMembers.id)),
    db.select().from(inventoryItems).where(eq(inventoryItems.cycleId, cycle.id)).orderBy(asc(inventoryItems.id)),
    db.select().from(inventoryIssues).where(eq(inventoryIssues.cycleId, cycle.id)).orderBy(asc(inventoryIssues.id)),
    db.select().from(inventoryDocuments).where(eq(inventoryDocuments.cycleId, cycle.id)).orderBy(asc(inventoryDocuments.uploadedAt)),
    db.select().from(inventoryNotes).where(eq(inventoryNotes.cycleId, cycle.id)).limit(1),
    db.select().from(validationHistory).where(eq(validationHistory.cycleId, cycle.id)).orderBy(asc(validationHistory.createdAt)),
  ]);
  return { school, cycle, members, items, issues, documents, notes: notes[0] ?? null, history };
}

export async function getManagementCycles(year: number) {
  const db = await requireDb();
  return db
    .select({ cycle: inventoryCycles, school: schools })
    .from(inventoryCycles)
    .innerJoin(schools, eq(inventoryCycles.schoolId, schools.id))
    .where(eq(inventoryCycles.year, year))
    .orderBy(asc(schools.name));
}

export async function getManagementItems(year: number) {
  const db = await requireDb();
  return db
    .select({ item: inventoryItems, school: schools, cycle: inventoryCycles })
    .from(inventoryItems)
    .innerJoin(inventoryCycles, eq(inventoryItems.cycleId, inventoryCycles.id))
    .innerJoin(schools, eq(inventoryCycles.schoolId, schools.id))
    .where(eq(inventoryCycles.year, year));
}

export async function getManagementIssues(year: number) {
  const db = await requireDb();
  return db
    .select({ issue: inventoryIssues, school: schools, cycle: inventoryCycles })
    .from(inventoryIssues)
    .innerJoin(inventoryCycles, eq(inventoryIssues.cycleId, inventoryCycles.id))
    .innerJoin(schools, eq(inventoryCycles.schoolId, schools.id))
    .where(eq(inventoryCycles.year, year));
}

export async function getManagementControlExportData(year: number) {
  const db = await requireDb();
  const [schoolRows, cycleRows] = await Promise.all([
    db.select().from(schools).orderBy(asc(schools.name)),
    db.select().from(inventoryCycles).where(eq(inventoryCycles.year, year)),
  ]);
  const cycleIds = cycleRows.map(cycle => cycle.id);
  const empty = Promise.resolve([]);
  const [itemRows, memberRows, issueRows, documentRows, noteRows] = await Promise.all([
    cycleIds.length ? db.select().from(inventoryItems).where(inArray(inventoryItems.cycleId, cycleIds)).orderBy(asc(inventoryItems.propertyNumber)) : empty,
    cycleIds.length ? db.select().from(committeeMembers).where(inArray(committeeMembers.cycleId, cycleIds)).orderBy(asc(committeeMembers.id)) : empty,
    cycleIds.length ? db.select().from(inventoryIssues).where(inArray(inventoryIssues.cycleId, cycleIds)).orderBy(asc(inventoryIssues.id)) : empty,
    cycleIds.length ? db.select().from(inventoryDocuments).where(inArray(inventoryDocuments.cycleId, cycleIds)).orderBy(asc(inventoryDocuments.uploadedAt)) : empty,
    cycleIds.length ? db.select().from(inventoryNotes).where(inArray(inventoryNotes.cycleId, cycleIds)) : empty,
  ]);
  const cycleBySchool = new Map(cycleRows.map(cycle => [cycle.schoolId, cycle]));
  const byCycle = <T extends { cycleId: number }>(rows: T[]) => rows.reduce<Map<number, T[]>>((groups, row) => {
    groups.set(row.cycleId, [...(groups.get(row.cycleId) ?? []), row]);
    return groups;
  }, new Map());
  const itemsByCycle = byCycle(itemRows);
  const membersByCycle = byCycle(memberRows);
  const issuesByCycle = byCycle(issueRows);
  const documentsByCycle = byCycle(documentRows);
  const notesByCycle = new Map(noteRows.map(note => [note.cycleId, note]));

  return schoolRows.map(school => {
    const cycle = cycleBySchool.get(school.id) ?? null;
    return {
      school,
      cycle,
      items: cycle ? itemsByCycle.get(cycle.id) ?? [] : [],
      members: cycle ? membersByCycle.get(cycle.id) ?? [] : [],
      issues: cycle ? issuesByCycle.get(cycle.id) ?? [] : [],
      documents: cycle ? documentsByCycle.get(cycle.id) ?? [] : [],
      notes: cycle ? notesByCycle.get(cycle.id) ?? null : null,
    };
  });
}

export async function listAssignableUsers() {
  const db = await requireDb();
  return db.select({ id: users.id, name: users.name, email: users.email, role: users.role }).from(users).orderBy(asc(users.name));
}

export async function findSchoolMember(schoolId: number, userId: number) {
  const db = await requireDb();
  const result = await db
    .select()
    .from(schoolMemberships)
    .where(and(eq(schoolMemberships.schoolId, schoolId), eq(schoolMemberships.userId, userId)))
    .limit(1);
  return result[0];
}

export async function getSchoolMembers(schoolId: number) {
  const db = await requireDb();
  return db
    .select({ membership: schoolMemberships, user: users })
    .from(schoolMemberships)
    .innerJoin(users, eq(schoolMemberships.userId, users.id))
    .where(eq(schoolMemberships.schoolId, schoolId));
}

export async function getCyclesForSchoolIds(schoolIds: number[], year: number) {
  if (schoolIds.length === 0) return [];
  const db = await requireDb();
  return db.select().from(inventoryCycles).where(and(inArray(inventoryCycles.schoolId, schoolIds), eq(inventoryCycles.year, year)));
}
