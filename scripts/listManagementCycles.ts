import { getManagementCycles } from "../server/db";

const year = Number(process.argv[2] ?? new Date().getFullYear());
const rows = await getManagementCycles(year);
console.log(JSON.stringify(rows.map(row => ({ cycleId: row.cycle.id, school: row.school.name, status: row.cycle.status })), null, 2));
process.exit(0);
