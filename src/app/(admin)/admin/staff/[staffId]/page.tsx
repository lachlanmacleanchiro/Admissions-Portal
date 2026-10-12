import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { Badge } from "@/components/ui/Badge";
import { PermissionMatrix } from "./PermissionMatrix";
import { PermissionKey } from "@/generated/prisma/client";
import Link from "next/link";

const PERMISSION_GROUPS: { label: string; keys: PermissionKey[] }[] = [
  {
    label: "Applicants",
    keys: ["VIEW_APPLICANTS", "EDIT_APPLICANT_PROFILE", "ADVANCE_APPLICATION_STAGE", "WITHDRAW_APPLICATION"],
  },
  {
    label: "Tasks",
    keys: ["ASSIGN_TASKS", "REVIEW_TASK_SUBMISSIONS", "DELETE_TASKS", "MANAGE_OWN_TASKS", "REMIND_TASK"],
  },
  {
    label: "Documents",
    keys: ["REQUEST_DOCUMENTS", "VIEW_DOCUMENTS", "VERIFY_DOCUMENTS", "DELETE_DOCUMENTS"],
  },
  {
    label: "Messages",
    keys: ["SEND_MESSAGES", "VIEW_ALL_MESSAGES"],
  },
  {
    label: "Workflows",
    keys: ["VIEW_INTERNATIONAL", "EDIT_INTERNATIONAL"],
  },
  {
    label: "Reports",
    keys: ["VIEW_REPORTS"],
  },
  {
    label: "Administration",
    keys: ["MANAGE_STAFF_USERS", "MANAGE_PERMISSIONS"],
  },
];

const PERMISSION_LABELS: Record<string, string> = {
  VIEW_APPLICANTS: "View applicants",
  EDIT_APPLICANT_PROFILE: "Edit applicant profile",
  ADVANCE_APPLICATION_STAGE: "Advance application stage",
  WITHDRAW_APPLICATION: "Withdraw / decline application",
  ASSIGN_TASKS: "Assign tasks to students",
  REVIEW_TASK_SUBMISSIONS: "Review task submissions",
  DELETE_TASKS: "Delete tasks",
  MANAGE_OWN_TASKS: "Manage own task queue",
  REMIND_TASK: "Send task reminders",
  REQUEST_DOCUMENTS: "Request documents",
  VIEW_DOCUMENTS: "View documents",
  VERIFY_DOCUMENTS: "Verify / reject documents",
  DELETE_DOCUMENTS: "Delete documents",
  SEND_MESSAGES: "Send messages",
  VIEW_ALL_MESSAGES: "View all messages",
  VIEW_INTERNATIONAL: "View international compliance",
  EDIT_INTERNATIONAL: "Edit international compliance",
  VIEW_REPORTS: "View reports",
  MANAGE_STAFF_USERS: "Manage staff users",
  MANAGE_PERMISSIONS: "Manage permissions",
};

export default async function StaffPermissionsPage({ params }: { params: Promise<{ staffId: string }> }) {
  const { staffId } = await params;
  const session = await auth();
  if (!session?.user || session.user.role !== "STAFF") redirect("/login");
  requirePermission(session, "MANAGE_PERMISSIONS");

  const staffUser = await prisma.user.findUnique({
    where: { id: staffId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      isGlobalAdmin: true,
      staffPermissions: true,
    },
  });

  if (!staffUser || staffUser.role === "STUDENT") notFound();

  const grantedKeys = new Set(
    staffUser.staffPermissions.filter((p) => p.granted).map((p) => p.permissionKey)
  );

  const initialPermissions = Object.fromEntries(
    Object.values(PERMISSION_LABELS).map((_, i) => {
      const key = Object.keys(PERMISSION_LABELS)[i] as PermissionKey;
      return [key, grantedKeys.has(key)];
    })
  ) as Record<PermissionKey, boolean>;

  return (
    <div className="px-8 py-7 w-full">
      <Link href="/admin/staff" className="text-xs text-text-muted hover:text-green">← Staff Management</Link>
      <div className="flex items-center gap-3 mt-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-green flex items-center justify-center text-white font-bold">
          {staffUser.firstName.charAt(0)}
        </div>
        <div>
          <h1 className="font-serif text-xl text-text">
            {staffUser.firstName} {staffUser.lastName}
          </h1>
          <p className="text-xs text-text-muted">{staffUser.email}</p>
        </div>
        {staffUser.isGlobalAdmin && <Badge variant="gold">Global Admin</Badge>}
      </div>

      {staffUser.isGlobalAdmin ? (
        <div className="bg-gold/10 border border-gold/30 px-5 py-4 text-sm text-text">
          Global Admin — all permissions granted automatically. No individual grants required.
        </div>
      ) : (
        <PermissionMatrix
          staffId={staffId}
          groups={PERMISSION_GROUPS}
          labels={PERMISSION_LABELS}
          initialPermissions={initialPermissions}
        />
      )}
    </div>
  );
}
