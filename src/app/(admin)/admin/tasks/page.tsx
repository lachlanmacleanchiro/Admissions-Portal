import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { Badge } from "@/components/ui/Badge";
import { WipBanner } from "@/components/ui/WipBanner";
import { AddStaffTaskForm } from "./AddStaffTaskForm";
import Link from "next/link";

function isOverdue(dueDate: Date | null) {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date();
}

function isDueThisWeek(dueDate: Date | null) {
  if (!dueDate) return false;
  const d = new Date(dueDate);
  const now = new Date();
  const weekAway = new Date(now.getTime() + 7 * 86400000);
  return d >= now && d <= weekAway;
}

export default async function AdminTasksPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "STAFF") redirect("/login");
  requirePermission(session, "MANAGE_OWN_TASKS");

  const tasks = await prisma.staffTask.findMany({
    where: { assignedToId: session.user.id, status: { not: "COMPLETE" } },
    include: { application: { select: { id: true, applicantNumber: true, student: { select: { firstName: true, lastName: true } } } } },
    orderBy: { dueDate: "asc" },
  });

  const overdueTasks = tasks.filter((t) => isOverdue(t.dueDate));
  const thisWeekTasks = tasks.filter((t) => !isOverdue(t.dueDate) && isDueThisWeek(t.dueDate));
  const otherTasks = tasks.filter((t) => !isOverdue(t.dueDate) && !isDueThisWeek(t.dueDate));

  return (
    <div className="px-8 py-7 w-full">
      <WipBanner>This page is work in progress. Only some logic has been implemented.</WipBanner>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl text-text">{session.user.firstName}&apos;s Queue</h1>
          <p className="text-sm text-text-muted mt-1">{tasks.length} tasks requiring action, sorted by priority.</p>
        </div>
      </div>

      <AddStaffTaskForm staffId={session.user.id} />

      {overdueTasks.length > 0 && (
        <section className="mt-8">
          <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: "#c0392b" }}>Urgent — Action Required</p>
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {overdueTasks.map((task, i) => (
              <TaskRow key={task.id} task={task} isOverdue isLast={i === overdueTasks.length - 1} />
            ))}
          </div>
        </section>
      )}

      {thisWeekTasks.length > 0 && (
        <section className="mt-8">
          <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: "#114E3B" }}>This Week</p>
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {thisWeekTasks.map((task, i) => (
              <TaskRow key={task.id} task={task} isLast={i === thisWeekTasks.length - 1} />
            ))}
          </div>
        </section>
      )}

      {otherTasks.length > 0 && (
        <section className="mt-8">
          <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: "#999" }}>Upcoming</p>
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {otherTasks.map((task, i) => (
              <TaskRow key={task.id} task={task} isLast={i === otherTasks.length - 1} />
            ))}
          </div>
        </section>
      )}

      {tasks.length === 0 && (
        <div className="mt-8 bg-white rounded-2xl shadow-sm py-16 text-center text-sm" style={{ color: "#aaa" }}>
          No tasks in your queue.
        </div>
      )}
    </div>
  );
}

function TaskRow({ task, isOverdue, isLast }: { task: any; isOverdue?: boolean; isLast?: boolean }) {
  return (
    <div
      className="flex items-center gap-4 px-5 py-4 transition-colors"
      style={{
        borderLeft: `3px solid ${isOverdue ? "#c0392b" : "#114E3B"}`,
        borderBottom: isLast ? "none" : "1px solid rgba(0,0,0,0.05)",
      }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold" style={{ color: "#222" }}>{task.title}</p>
        {task.description && <p className="text-xs mt-0.5 truncate" style={{ color: "#aaa" }}>{task.description}</p>}
        {task.application && (
          <Link href={`/admin/applicants/${task.application.id}`} className="text-xs font-medium mt-0.5 block" style={{ color: "#114E3B" }}>
            {task.application.student.firstName} {task.application.student.lastName} · {task.application.applicantNumber}
          </Link>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {task.dueDate && (
          <Badge variant={isOverdue ? "red" : "muted"}>
            {isOverdue ? "Overdue" : `Due ${new Date(task.dueDate).toLocaleDateString("en-NZ", { day: "numeric", month: "short" })}`}
          </Badge>
        )}
        {!task.application && <Badge variant="muted">Internal</Badge>}
      </div>
    </div>
  );
}
