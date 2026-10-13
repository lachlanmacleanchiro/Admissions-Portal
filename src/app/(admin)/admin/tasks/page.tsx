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

/** Where a followed student task is up to, from the staff member's point of view. */
const FOLLOWING_STATUS: Record<string, { label: string; variant: "muted" | "blue" | "red" | "gold" }> = {
  PENDING: { label: "Not started", variant: "muted" },
  IN_PROGRESS: { label: "In progress", variant: "blue" },
  REJECTED: { label: "Changes requested", variant: "red" },
};

export default async function AdminTasksPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "STAFF") redirect("/login");
  requirePermission(session, "MANAGE_OWN_TASKS");

  const [items, staffOptions] = await Promise.all([getMyTasks(session.user.id), getAssignableStaff()]);

  const now = Date.now();
  const isOverdue = (t: MyTaskItem) => !!t.dueDate && t.dueDate.getTime() < now;
  const review = items.filter((t) => t.group === "review");
  const work = items.filter((t) => t.group === "work");
  const overdue = work.filter(isOverdue);
  const thisWeek = work.filter((t) => t.dueDate && !isOverdue(t) && t.dueDate.getTime() - now <= WEEK_MS);
  const later = work.filter((t) => !t.dueDate || t.dueDate.getTime() - now > WEEK_MS);
  const following = items.filter((t) => t.group === "following");
  const actionCount = review.length + work.length;

  return (
    <div className="px-8 py-7 w-full">
      <div className="mb-6">
        <h1 className="font-serif text-2xl text-text">My Tasks</h1>
        <p className="text-sm text-text-muted mt-1">
          {actionCount === 0
            ? "Nothing needs your action right now."
            : `${actionCount} task${actionCount === 1 ? "" : "s"} need${actionCount === 1 ? "s" : ""} your action.`}
          {following.length > 0 && ` You're following ${following.length} student task${following.length === 1 ? "" : "s"}.`}
        </p>
      </div>

      <AddStaffTaskForm staffId={session.user.id} staffOptions={staffOptions} />

      <TaskSection
        title="Needs your review"
        color="#8a6416"
        items={review}
        hint="Student tasks you follow that the student has submitted."
      />
      <TaskSection title="Overdue" color="#c0392b" items={overdue} />
      <TaskSection title="Due this week" color="#114E3B" items={thisWeek} />
      <TaskSection title="Later" color="#999" items={later} />
      <TaskSection
        title="Following"
        color="#555"
        items={following}
        hint="Student tasks you're keeping an eye on. They move to Needs your review when the student submits them."
      />

      {items.length === 0 && (
        <div className="mt-8 bg-white rounded-2xl shadow-sm py-16 text-center text-sm" style={{ color: "#aaa" }}>
          No tasks assigned to you. Tasks assigned to you on an applicant, or added here, will show up in this list.
        </div>
      )}
    </div>
  );
}

function TaskSection({ title, color, items, hint }: { title: string; color: string; items: MyTaskItem[]; hint?: string }) {
  if (items.length === 0) return null;
  return (
    <section className="mt-8">
      <p className="text-[11px] font-semibold uppercase tracking-widest mb-1" style={{ color }}>
        {title} · {items.length}
      </p>
      {hint && <p className="text-xs mb-3" style={{ color: "#999" }}>{hint}</p>}
      <div className={`bg-white rounded-2xl shadow-sm overflow-hidden ${hint ? "" : "mt-2"}`}>
        {items.map((task, i) => (
          <TaskRow key={task.key} task={task} isLast={i === items.length - 1} />
        ))}
      </div>
    </section>
  );
}

function TaskRow({ task, isLast }: { task: MyTaskItem; isLast: boolean }) {
  const tasksHref = task.applicant ? `/admin/applicants/${task.applicant.id}/tasks` : null;
  const isOverdue = !!task.dueDate && task.dueDate.getTime() < Date.now();
  const accent =
    task.group === "review" ? "#C79A3B"
    : isOverdue ? "#c0392b"
    : task.group === "work" ? "#114E3B"
    : "rgba(0,0,0,0.12)";
  const followingStatus = task.group === "following" && task.status ? FOLLOWING_STATUS[task.status] : null;

  return (
    <div
      className="flex items-center gap-4 px-5 py-4"
      style={{ borderLeft: `3px solid ${accent}`, borderBottom: isLast ? "none" : "1px solid rgba(0,0,0,0.05)" }}
    >
      <span className="w-5 flex justify-center flex-shrink-0">
        {task.group === "work" && (
          <CompleteTaskCheckbox kind={task.kind} taskId={task.id} applicationId={task.applicant?.id} title={task.title} />
        )}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold" style={{ color: "#222" }}>{task.title}</p>
          <Badge variant={task.kind === "todo" ? "muted" : task.audience === "STUDENT" ? "green" : "blue"}>
            {task.kind === "todo" ? "To-do" : task.audience === "STUDENT" ? "Student task" : "Internal"}
          </Badge>
        </div>
        {task.description && <p className="text-xs mt-0.5 truncate" style={{ color: "#999" }}>{task.description}</p>}
        <p className="text-xs mt-0.5" style={{ color: "#888" }}>
          {task.applicant && tasksHref && (
            <Link href={tasksHref} className="font-medium hover:underline" style={{ color: "#114E3B" }}>
              {task.applicant.name} · {task.applicant.applicantNumber}
            </Link>
          )}
          {task.applicant && task.assignedByName && " · "}
          {task.assignedByName && `Assigned by ${task.assignedByName}`}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
        {task.group === "review" && <Badge variant="gold">Submitted, awaiting review</Badge>}
        {followingStatus && <Badge variant={followingStatus.variant}>{followingStatus.label}</Badge>}
        {task.dueDate && (
          <Badge variant={isOverdue && task.group !== "review" ? "red" : "muted"}>
            {isOverdue ? "Overdue" : "Due"} {task.dueDate.toLocaleDateString("en-NZ", { day: "numeric", month: "short" })}
          </Badge>
        )}
        {task.group === "review" && tasksHref && (
          <Link
            href={tasksHref}
            className="text-xs font-semibold px-3 py-1.5 rounded-full"
            style={{ backgroundColor: "#114E3B", color: "#fff" }}
          >
            Review
          </Link>
        )}
        {task.group === "following" && tasksHref && (
          <Link href={tasksHref} className="text-xs font-semibold" style={{ color: "#114E3B" }}>
            View →
          </Link>
        )}
      </div>
    </div>
  );
}
