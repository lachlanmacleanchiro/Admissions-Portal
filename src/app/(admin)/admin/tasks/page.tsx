import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/permissions";
import { getMyTasks, type MyTaskItem } from "@/lib/myTasks";
import { getAssignableStaff } from "@/lib/staff";
import { Badge } from "@/components/ui/Badge";
import { AddStaffTaskForm } from "./AddStaffTaskForm";
import { CompleteTaskCheckbox } from "./CompleteTaskCheckbox";
import Link from "next/link";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export default async function AdminTasksPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "STAFF") redirect("/login");
  requirePermission(session, "MANAGE_OWN_TASKS");

  const [items, staffOptions] = await Promise.all([getMyTasks(session.user.id), getAssignableStaff()]);

  const now = Date.now();
  const mine = items.filter((t) => t.needsMyAction);
  const overdue = mine.filter((t) => t.dueDate && t.dueDate.getTime() < now);
  const thisWeek = mine.filter((t) => t.dueDate && t.dueDate.getTime() >= now && t.dueDate.getTime() - now <= WEEK_MS);
  const later = mine.filter((t) => !t.dueDate || t.dueDate.getTime() - now > WEEK_MS);
  const waiting = items.filter((t) => !t.needsMyAction);

  return (
    <div className="px-8 py-7 w-full">
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="font-serif text-2xl text-text">My Tasks</h1>
          <p className="text-sm text-text-muted mt-1">
            {mine.length === 0
              ? "Nothing needs your action right now."
              : `${mine.length} task${mine.length === 1 ? "" : "s"} need${mine.length === 1 ? "s" : ""} your action. Includes applicant tasks assigned to you and your own to-dos.`}
          </p>
        </div>
      </div>

      <AddStaffTaskForm staffId={session.user.id} staffOptions={staffOptions} />

      <TaskSection title="Overdue" color="#c0392b" items={overdue} tone="overdue" />
      <TaskSection title="Due this week" color="#114E3B" items={thisWeek} />
      <TaskSection title="Later" color="#999" items={later} />
      <TaskSection
        title="Waiting on the applicant"
        color="#999"
        items={waiting}
        hint="Student tasks assigned to you. They'll move up when the applicant submits them for your review."
      />

      {items.length === 0 && (
        <div className="mt-8 bg-white rounded-2xl shadow-sm py-16 text-center text-sm" style={{ color: "#aaa" }}>
          No tasks assigned to you. Tasks assigned to you on an applicant, or added here, will show up in this list.
        </div>
      )}
    </div>
  );
}

function TaskSection({
  title,
  color,
  items,
  tone,
  hint,
}: {
  title: string;
  color: string;
  items: MyTaskItem[];
  tone?: "overdue";
  hint?: string;
}) {
  if (items.length === 0) return null;
  return (
    <section className="mt-8">
      <p className="text-[11px] font-semibold uppercase tracking-widest mb-1" style={{ color }}>
        {title} · {items.length}
      </p>
      {hint && <p className="text-xs mb-3" style={{ color: "#999" }}>{hint}</p>}
      <div className={`bg-white rounded-2xl shadow-sm overflow-hidden ${hint ? "" : "mt-2"}`}>
        {items.map((task, i) => (
          <TaskRow key={task.key} task={task} isOverdue={tone === "overdue"} isLast={i === items.length - 1} />
        ))}
      </div>
    </section>
  );
}

function TaskRow({ task, isOverdue, isLast }: { task: MyTaskItem; isOverdue: boolean; isLast: boolean }) {
  const reviewHref = task.applicant ? `/admin/applicants/${task.applicant.id}/tasks` : null;
  const canTick = task.kind === "todo" || task.audience === "STAFF";
  const needsReview = task.kind === "applicant" && task.audience === "STUDENT" && task.status === "SUBMITTED";

  return (
    <div
      className="flex items-center gap-4 px-5 py-4"
      style={{
        borderLeft: `3px solid ${isOverdue ? "#c0392b" : task.needsMyAction ? "#114E3B" : "rgba(0,0,0,0.1)"}`,
        borderBottom: isLast ? "none" : "1px solid rgba(0,0,0,0.05)",
      }}
    >
      <span className="w-5 flex justify-center flex-shrink-0">
        {canTick && (
          <CompleteTaskCheckbox kind={task.kind} taskId={task.id} applicationId={task.applicant?.id} title={task.title} />
        )}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold" style={{ color: "#222" }}>{task.title}</p>
          <Badge variant={task.kind === "todo" ? "muted" : "blue"}>
            {task.kind === "todo" ? "To-do" : task.audience === "STUDENT" ? "Student task" : "Applicant task"}
          </Badge>
        </div>
        {task.description && <p className="text-xs mt-0.5 truncate" style={{ color: "#999" }}>{task.description}</p>}
        <p className="text-xs mt-0.5" style={{ color: "#888" }}>
          {task.applicant && reviewHref && (
            <Link href={reviewHref} className="font-medium hover:underline" style={{ color: "#114E3B" }}>
              {task.applicant.name} · {task.applicant.applicantNumber}
            </Link>
          )}
          {task.applicant && task.assignedByName && " · "}
          {task.assignedByName && `Assigned by ${task.assignedByName}`}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {task.dueDate && (
          <Badge variant={isOverdue ? "red" : "muted"}>
            {isOverdue ? "Overdue" : "Due"} {task.dueDate.toLocaleDateString("en-NZ", { day: "numeric", month: "short" })}
          </Badge>
        )}
        {needsReview && reviewHref && (
          <Link
            href={reviewHref}
            className="text-xs font-semibold px-3 py-1.5 rounded-full"
            style={{ backgroundColor: "rgba(17,78,59,0.08)", color: "#114E3B" }}
          >
            Review
          </Link>
        )}
      </div>
    </div>
  );
}
