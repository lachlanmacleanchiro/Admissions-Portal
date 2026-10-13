import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { countMyActionableTasks } from "@/lib/myTasks";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user || session.user.role !== "STAFF") {
    redirect("/login");
  }

  const [activeIntake, intakeYears] = await Promise.all([
    prisma.intakeYear.findFirst({ where: { isActive: true } }),
    prisma.intakeYear.findMany({ where: { isVisible: true, isArchived: false }, orderBy: { year: "desc" } }),
  ]);
  const visibleIntakeIds = intakeYears.map((iy) => iy.id);

  const [pendingStaffTaskCount, intlAttentionCount, unseenSubmissionCount] = await Promise.all([
    countMyActionableTasks(session.user.id),
    visibleIntakeIds.length > 0
      ? prisma.internationalCompliance.count({
          where: {
            application: { intakeYearId: { in: visibleIntakeIds } },
            OR: [
              { visaStatus: "NOT_YET" },
              { healthInsuranceStatus: "NOT_YET" },
              { ieltsStatus: "REQUIRED" },
            ],
          },
        })
      : Promise.resolve(0),
    prisma.task.count({
      where: { status: "SUBMITTED", acknowledgedAt: null },
    }),
  ]);

  return (
    <div className="flex h-screen overflow-hidden">
      <AdminSidebar
        isGlobalAdmin={session.user.isGlobalAdmin}
        pendingStaffTaskCount={pendingStaffTaskCount}
        intlAttentionCount={intlAttentionCount}
        unseenSubmissionCount={unseenSubmissionCount}
        userName={`${session.user.firstName} ${session.user.lastName}`}
        isAdmin={!!session.user.isGlobalAdmin}
        activeIntakeLabel={activeIntake?.label}
        intakeYears={intakeYears.map((iy) => ({ id: iy.id, label: iy.label, isActive: iy.isActive }))}
      />
      <main className="flex-1 overflow-y-auto bg-surface">
        {children}
      </main>

      {/* Floating bug report — sibling of sidebar+main, inside non-transformed container */}
      <a
        href="https://nzchiro.sharepoint.com/sites/AdmissionsAppDev/Lists/Suggestions%20and%20Bugs/newform.aspx"
        target="_blank"
        rel="noopener noreferrer"
        title="Report a bug or suggest a feature"
        style={{
          position: "fixed",
          bottom: "24px",
          right: "24px",
          width: "48px",
          height: "48px",
          borderRadius: "50%",
          backgroundColor: "#114E3B",
          boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
        }}
      >
        <img src="/bug.png" alt="Report a bug" style={{ width: "20px", height: "20px", filter: "brightness(0) invert(1)" }} />
      </a>
    </div>
  );
}
