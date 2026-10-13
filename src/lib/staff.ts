import { prisma } from "@/lib/prisma";

export interface StaffOption {
  id: string;
  firstName: string;
  lastName: string;
}

/** Active staff members tasks can be assigned to, alphabetical. */
export async function getAssignableStaff(): Promise<StaffOption[]> {
  return prisma.user.findMany({
    where: { role: "STAFF", isActive: true },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    select: { id: true, firstName: true, lastName: true },
  });
}

/** Returns the ids from `ids` that belong to active staff members. */
export async function filterActiveStaffIds(ids: string[]): Promise<Set<string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return new Set();
  const rows = await prisma.user.findMany({
    where: { id: { in: unique }, role: "STAFF", isActive: true },
    select: { id: true },
  });
  return new Set(rows.map((r) => r.id));
}
