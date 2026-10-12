import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { Badge } from "@/components/ui/Badge";
import { CreateStaffForm } from "./CreateStaffForm";
import Link from "next/link";

export default async function StaffPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "STAFF") redirect("/login");
  requirePermission(session, "MANAGE_STAFF_USERS");

  const staffUsers = await prisma.user.findMany({
    where: { role: "STAFF" },
    orderBy: { lastName: "asc" },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      isGlobalAdmin: true,
      isActive: true,
    },
  });

  return (
    <div className="px-8 py-7 w-full">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-serif text-2xl text-text">Staff Management</h1>
      </div>

      <CreateStaffForm />

      <div className="mt-8 bg-white rounded-2xl shadow-sm overflow-hidden">
        {staffUsers.map((user, i) => (
          <div
            key={user.id}
            className="staff-row flex items-center gap-4 px-5 py-4 transition-colors"
            style={{ borderBottom: i < staffUsers.length - 1 ? "1px solid rgba(0,0,0,0.05)" : "none" }}
          >
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0" style={{ backgroundColor: "#114E3B" }}>
              {user.firstName.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold" style={{ color: "#222" }}>
                {user.firstName} {user.lastName}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "#aaa" }}>{user.email}</p>
            </div>
            <div className="flex items-center gap-3">
              {user.isGlobalAdmin && <Badge variant="gold">Admin</Badge>}
              {!user.isActive && <Badge variant="red">Inactive</Badge>}
              <Link
                href={`/admin/staff/${user.id}`}
                className="text-xs font-semibold transition-colors"
                style={{ color: "#114E3B" }}
              >
                Permissions →
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
