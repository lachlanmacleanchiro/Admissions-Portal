import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission, hasPermission } from "@/lib/permissions";
import { Badge } from "@/components/ui/Badge";
import { AssignTaskToggle } from "./AssignTaskToggle";
import { TaskReviewPanel } from "./TaskReviewPanel";
import { TaskActions } from "./TaskActions";
import { TaskOptionsMenu } from "./TaskOptionsMenu";

export default async function ApplicantTasksPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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
            documents: { select: { id: true, filename: true, storageKey: true, status: true } },
          },
        },
      },
    }),
    prisma.user.findMany({
      where: { role: "STAFF", isActive: true },
      orderBy: { lastName: "asc" },
      select: { id: true, firstName: true, lastName: true },
    }),
  ]);

  if (!app) notFound();

  const canAssign = hasPermission(session, "ASSIGN_TASKS");
  const canReview = hasPermission(session, "REVIEW_TASK_SUBMISSIONS");
  const canDelete = hasPermission(session, "DELETE_TASKS");

  return (
    <div>
      {canAssign && (
        <AssignTaskToggle applicationId={id} staffId={session.user.id} staffOptions={staffOptions} />
      )}

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {app.tasks.length === 0 ? (
          <div className="px-5 py-16 text-center text-sm" style={{ color: "#aaa" }}>No tasks assigned yet.</div>
        ) : (
          app.tasks.map((task, i) => {
            const statusColor =
              task.status === "APPROVED" ? "#22c55e" :
              task.status === "REJECTED" ? "#c0392b" :
              task.status === "SUBMITTED" ? "#C79A3B" :
              task.status === "IN_PROGRESS" ? "#3b82f6" : "rgba(0,0,0,0.15)";

            return (
              <div
                key={task.id}
                className="p-5"
                style={{
                  borderLeft: `3px solid ${statusColor}`,
                  borderBottom: i < app.tasks.length - 1 ? "1px solid rgba(0,0,0,0.05)" : "none",
                }}
              >
                <div className="flex items-start justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold" style={{ color: "#222" }}>{task.title}</p>
                    <Badge variant={task.audience === "STAFF" ? "blue" : "outline"}>
                      {task.audience === "STAFF" ? "Staff" : "Student"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={
                      task.status === "APPROVED" ? "green" :
                      task.status === "REJECTED" ? "red" :
                      task.status === "SUBMITTED" ? "gold" :
                      task.status === "IN_PROGRESS" ? "blue" : "muted"
                    }>
                      {task.status.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}
                    </Badge>
                    {canDelete && <TaskOptionsMenu applicationId={id} taskId={task.id} />}
                  </div>
                </div>
                {task.description && <p className="text-xs mb-1" style={{ color: "#aaa" }}>{task.description}</p>}
                <p className="text-xs mb-3" style={{ color: "#bbb" }}>
                  Assigned by {task.assignedBy.firstName} {task.assignedBy.lastName}
                  {task.assignedTo && ` · Assigned to ${task.assignedTo.firstName} ${task.assignedTo.lastName}`}
                  {task.dueDate && ` · Due ${new Date(task.dueDate).toLocaleDateString("en-NZ")}`}
                </p>

                {task.audience === "STAFF" && canAssign && (
                  <div className="mb-3">
                    <TaskActions
                      applicationId={id}
                      taskId={task.id}
                      status={task.status}
                      assignedToId={task.assignedTo?.id ?? null}
                      staffOptions={staffOptions}
                    />
                  </div>
                )}

                {task.status === "SUBMITTED" && canReview && (
                  <TaskReviewPanel
                    taskId={task.id}
                    applicationId={id}
                    studentNote={task.studentNote}
                    documents={task.documents}
                    acknowledgedAt={task.acknowledgedAt}
                  />
                )}

                {(task.status === "APPROVED" || task.status === "REJECTED") && (
                  <div
                    className="px-3 py-2 text-xs rounded-lg"
                    style={{
                      borderLeft: `3px solid ${task.status === "APPROVED" ? "#22c55e" : "#c0392b"}`,
                      backgroundColor: task.status === "APPROVED" ? "rgba(34,197,94,0.06)" : "rgba(192,57,43,0.06)",
                      color: "#555",
                    }}
                  >
                    <strong className="block mb-0.5" style={{ color: task.status === "APPROVED" ? "#22c55e" : "#c0392b" }}>
                      {task.status === "APPROVED" ? "Approved" : "Rejected"}
                    </strong>
                    {task.reviewNote && <p className="mb-1">{task.reviewNote}</p>}
                    {task.reviewedAt && (
                      <p style={{ color: "#999" }}>
                        {task.reviewedBy ? `${task.reviewedBy.firstName} ${task.reviewedBy.lastName}` : "Staff"}
                        {" · "}
                        {new Date(task.reviewedAt).toLocaleString("en-NZ", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}