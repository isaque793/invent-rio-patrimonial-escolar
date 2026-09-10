import { eq, inArray } from "drizzle-orm";
import { appRouter } from "../server/routers.ts";
import { getDb, upsertUser } from "../server/db.ts";
import { users } from "../drizzle/schema.ts";

const temporaryOpenId = `admin-role-validation-${Date.now()}`;

async function expectFailure(operation, fragment) {
  try {
    await operation();
    throw new Error(`Expected an error containing: ${fragment}`);
  } catch (error) {
    if (!String(error.message).includes(fragment)) throw error;
  }
}

const db = await getDb();
if (!db) throw new Error("Database unavailable");
const [administrator] = await db.select().from(users).where(eq(users.role, "admin")).limit(1);
if (!administrator) throw new Error("No administrator available for the controlled validation");
const [schoolUser] = await db.select().from(users).where(eq(users.role, "user")).limit(1);
if (!schoolUser) throw new Error("No standard user available for the controlled validation");
const caller = appRouter.createCaller({ user: administrator, req: { protocol: "https", headers: {} }, res: {} });
const schoolCaller = appRouter.createCaller({ user: schoolUser, req: { protocol: "https", headers: {} }, res: {} });
const temporaryUserIds = [];

try {
  for (const suffix of ["A", "B"]) {
    const inserted = await db.insert(users).values({ openId: `${temporaryOpenId}-${suffix}`, name: `Administrador temporário ${suffix}`, email: `validacao-temporaria-${suffix.toLowerCase()}@exemplo.local`, loginMethod: "technical-test", role: "user", lastSignedIn: new Date() });
    temporaryUserIds.push(Number(inserted[0].insertId));
  }
  await caller.management.setUserRole({ userId: temporaryUserIds[0], role: "admin" });
  await caller.management.setUserRole({ userId: temporaryUserIds[1], role: "admin" });
  for (const temporaryUserId of temporaryUserIds) {
    const [promotedUser] = await db.select().from(users).where(eq(users.id, temporaryUserId)).limit(1);
    if (!promotedUser) throw new Error("Promoted user not found");
    await upsertUser({ openId: promotedUser.openId, lastSignedIn: new Date() });
  }
  const promotedUsers = await db.select().from(users).where(inArray(users.id, temporaryUserIds));
  if (promotedUsers.length !== 2 || promotedUsers.some(user => user.role !== "admin")) throw new Error("Multiple promotions were not persisted");
  for (const promotedUser of promotedUsers) {
    const promotedCaller = appRouter.createCaller({ user: promotedUser, req: { protocol: "https", headers: {} }, res: {} });
    await promotedCaller.management.listUsers();
    await promotedCaller.school.list({ viewerId: promotedUser.id });
  }
  await caller.management.setUserRole({ userId: temporaryUserIds[0], role: "user" });
  const [revoked] = await db.select().from(users).where(eq(users.id, temporaryUserIds[0])).limit(1);
  if (revoked?.role !== "user") throw new Error("Revocation was not persisted");
  await expectFailure(() => caller.management.setUserRole({ userId: administrator.id, role: "user" }), "pelo menos um administrador");
  await expectFailure(() => schoolCaller.management.listUsers(), "permission");
  console.log(JSON.stringify({ success: true, checks: ["multiple_promotions", "full_access_for_each_promoted_user", "revocation", "last_admin_protection", "non_admin_blocked"], temporaryUserIds }));
} finally {
  if (temporaryUserIds.length) await db.delete(users).where(inArray(users.id, temporaryUserIds));
  console.log(JSON.stringify({ cleanup: "completed", temporaryUserIds }));
}
