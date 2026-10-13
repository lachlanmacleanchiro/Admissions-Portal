import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission, hasPermission } from "@/lib/permissions";
import { getAssignableStaff } from "@/lib/staff";
import { AssignTaskToggle } from "./AssignTaskToggle";
import { TaskReviewPanel } from "./TaskReviewPanel";
import { TaskActions } from "./TaskActions";
import { TaskOptionsMenu } from "./TaskOptionsMenu";
import { SubTabs } from "@/components/ui/SubTabs";
import type { TaskAudience, TaskStatus } from "@/generated/prisma/client";

type Tone = "neutral" | "info" | "warning" | "success" | "danger";

const TONE_STYLES: Record<Tone, { dot: string; text: string; bg: string }> = {
  neutral: { dot: "#9CA3AF", text: "#4B5563", bg: "#F3F4F6" },
  info: { dot: "#2563EB", text: "#1D4ED8", bg: "#EFF6FF" },
  warning: { dot: "#C79A3B", text: "#8a6416", bg: "#FBF5E8" },
  success: { dot: "#16A34A", text: "#15803D", bg: "#F0FDF4" },
  danger: { dot: "#DC2626", text: "#B91C1C", bg: "#FEF2F2" },
};

/** Status wording shared with My Tasks and the student portal. */
function statusDisplay(status: TaskStatus, audience: TaskAudience): { label: string; tone: Tone } {
  switch (status) {
    case "APPROVED": return { label: audience === "STAFF" ? "Complete" : "Approved", tone: "success" };
    case "REJECTED": return { label: "Changes requested", tone: "danger" };
    case "SUBMITTED": return { label: "Submitted, awaiting review", tone: "warning" };
    case "IN_PROGRESS": return { label: "In progress", tone: "info" };
    default: return { label: "Not started", tone: "neutral" };
  }
}

function StatusPill({ status, audience }: { status: TaskStatus; audience: TaskAudience }) {
  const { label, tone } = statusDisplay(status, audience);
  const s = TONE_STYLES[tone];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap" style={{ color: s.text, backgroundColor: s.bg }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.dot }} aria-hidden="true" />
      {label}
    </span>
  );
}

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" });
}

export default async function ApplicantTasksPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { id } = await params;
  const { view } = await searchParams;
  const showArchived = view === "archived";
  const session = await auth();
  if (!session?.user || session.user.role !== "STAFF") redirect("/login");
  requirePermission(session, "VIEW_APPLICANTS");

  const [app, staffOptions] = await Promise.all([
    prisma.application.findUnique({
      where: { id },
      include: {
        student: { select: { firstName: true, lastName: true } },
        tasks: {
          orderBy: { createdAt: "desc" },
          include: {
            assignedBy: { select: { firstName: true, lastName: true } },
            assignedTo: { select: { id: true, firstName: true, lastName: true } },
            reviewedBy: { select: { firstName: true, lastName: true } },
            documents: { select: { id: true, filename: true, storageKey: true, status: true, uploadedAt: true }, orderBy: { uploadedAt: "desc" } },
          },
        },
      },
    }),
    getAssignableStaff(),
  ]);

  if (!app) notFound();

  const canAssign = hasPermission(session, "ASSIGN_TASKS");
  const canReview = hasPermission(session, "REVIEW_TASK_SUBMISSIONS");
  const canDelete = hasPermission(session, "DELETE_TASKS");
  const now = Date.now();

  // Active = still needs action (incl. submitted, awaiting review); Archived = approved / completed.
  const activeTasks = app.tasks.filter((t) => t.status !== "APPROVED");
  const archivedTasks = app.tasks.filter((t) => t.status === "APPROVED");
  const tasks = showArchived ? archivedTasks : activeTasks;
  const base = `/admin/applicants/${id}/tasks`;

  return (
    <div>
      {canAssign && (
        <AssignTaskToggle applicationId={id} staffId={session.user.id} staffOptions={staffOptions} />
      )}

      <SubTabs
        label="Task status"
        tabs={[
          { href: base, label: "Active", count: activeTasks.length, active: !showArchived },
          { href: `${base}?view=archived`, label: "Archived", count: archivedTasks.length, active: showArchived },
        ]}
      />

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {tasks.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm" style={{ color: "#999" }}>
            {showArchived
              ? "No completed tasks yet. Tasks move here once they're approved or marked complete."
              : app.tasks.length === 0
              ? "No tasks yet."
              : "Nothing needs action. Completed tasks are under Archived."}
          </div>
        ) : (
          <ul>
            {tasks.map((task, i) => {
              const isStudentTask = task.audience === "STUDENT";
              const isOpen = task.status !== "APPROVED";
              const isOverdue = isOpen && task.dueDate && new Date(task.dueDate).getTime() < now;
              const showReview = task.status === "SUBMITTED" && canReview;
              const isDecided = task.status === "APPROVED" || task.status === "REJECTED";

              return (
                <li
                  key={task.id}
                  className="px-6 py-5"
                  style={{ borderBottom: i < tasks.length - 1 ? "1px solid rgba(0,0,0,0.06)" : "none" }}
                >
                  <div className="flex items-start justify-between gap-6 flex-wrap">
                    {/* Title, type, status, details */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold" style={{ color: "#222" }}>{task.title}</h3>
                        <span
                          className="text-[11px] font-medium px-1.5 py-0.5 rounded"
                          style={{ color: "#555", border: "1px solid rgba(0,0,0,0.12)" }}
                        >
                          {isStudentTask ? "Student" : "Internal"}
                        </span>
                        <StatusPill status={task.status} audience={task.audience} />
                      </div>
                      {task.description && (
                        <p className="text-sm mt-1.5 max-w-3xl" style={{ color: "#555" }}>{task.description}</p>
                      )}
                      <p className="text-xs mt-1.5" style={{ color: "#888" }}>
                        {task.dueDate && (
                          <span style={isOverdue ? { color: "#B91C1C", fontWeight: 600 } : undefined}>
                            {isOverdue ? "Overdue · was due" : "Due"} {formatDate(task.dueDate)}
                          </span>
                        )}
                        {task.dueDate && " · "}
                        Created by {task.assignedBy.firstName} {task.assignedBy.lastName}
                      </p>
                    </div>

                    {/* Assignee and menu */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {canAssign ? (
                        <TaskActions
                          applicationId={id}
                          taskId={task.id}
                          status={task.status}
                          assignedToId={task.assignedTo?.id ?? null}
                          staffOptions={staffOptions}
                          audience={task.audience}
                        />
                      ) : (
                        <span className="text-xs" style={{ color: "#888" }}>
                          {isStudentTask ? "Follow-up" : "Assigned to"}:{" "}
                          {task.assignedTo ? `${task.assignedTo.firstName} ${task.assignedTo.lastName}` : isStudentTask ? "No one" : "Unassigned"}
                        </span>
                      )}
                      {canDelete && <TaskOptionsMenu applicationId={id} taskId={task.id} />}
                    </div>
                  </div>

                  {/* Files */}
                  {task.documents.length > 0 && (
                    <ul className="mt-3 flex flex-col gap-1.5">
                      {task.documents.map((doc) => (
                        <li key={doc.id} className="flex items-center gap-2 text-sm flex-wrap">
                          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} style={{ color: "#888" }} aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <a
                            href={`/api/files/${doc.storageKey}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium hover:underline truncate max-w-md"
                            style={{ color: "#114E3B" }}
                          >
                            {doc.filename}
                          </a>
                          <span className="text-xs" style={{ color: "#999" }}>
                            {formatDate(doc.uploadedAt)} ·{" "}
                            {doc.status === "VERIFIED" ? "Verified" : doc.status === "REJECTED" ? "Not accepted" : "Pending review"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* Review, or the outcome once reviewed */}
                  {showReview && (
                    <TaskReviewPanel
                      taskId={task.id}
                      applicationId={id}
                      studentNote={task.studentNote}
                      submittedAt={task.completedAt}
                      acknowledgedAt={task.acknowledgedAt}
                    />
                  )}

                  {isDecided && (task.reviewedAt || task.reviewNote) && (
                    <p className="mt-3 text-xs" style={{ color: "#777" }}>
                      <span className="font-medium" style={{ color: task.status === "APPROVED" ? "#15803D" : "#B91C1C" }}>
                        {task.status === "APPROVED" ? (isStudentTask ? "Approved" : "Completed") : "Changes requested"}
                      </span>
                      {task.reviewedAt && (
                        <>
                          {" by "}
                          {task.reviewedBy ? `${task.reviewedBy.firstName} ${task.reviewedBy.lastName}` : "staff"}
                          {" · "}
                          {formatDate(task.reviewedAt)}
                        </>
                      )}
                      {task.reviewNote && <> — {task.reviewNote}</>}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
