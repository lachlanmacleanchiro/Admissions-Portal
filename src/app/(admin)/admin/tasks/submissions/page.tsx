import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { Badge } from "@/components/ui/Badge";
import Link from "next/link";
import { AcknowledgeButton } from "./AcknowledgeButton";

export default async function TaskSubmissionsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "STAFF") redirect("/login");
  requirePermission(session, "REVIEW_TASK_SUBMISSIONS");

  const tasks = await prisma.task.findMany({
    where: { status: "SUBMITTED" },
    orderBy: [{ acknowledgedAt: "asc" }, { completedAt: "asc" }],
    include: {
      application: { select: { id: true, applicantNumber: true, student: { select: { firstName: true, lastName: true } } } },
      documents: { select: { id: true, filename: true, storageKey: true } },
    },
  });

  const unseen = tasks.filter((t) => !t.acknowledgedAt);
  const seen = tasks.filter((t) => t.acknowledgedAt);

  return (
    <div className="px-8 py-7 w-full">
      <div className="mb-6">
        <h1 className="font-serif text-2xl text-text">Task Submissions</h1>
        <p className="text-sm text-text-muted mt-1">{tasks.length} submitted tasks awaiting review, {unseen.length} unseen.</p>
      </div>

      {unseen.length > 0 && (
        <section className="mb-8">
          <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: "#C79A3B" }}>New — Not yet seen</p>
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {unseen.map((task, i) => (
              <SubmissionRow key={task.id} task={task} isLast={i === unseen.length - 1} />
            ))}
          </div>
        </section>
      )}

      {seen.length > 0 && (
        <section>
          <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: "#999" }}>Seen — Awaiting decision</p>
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {seen.map((task, i) => (
              <SubmissionRow key={task.id} task={task} isLast={i === seen.length - 1} />
            ))}
          </div>
        </section>
      )}

      {tasks.length === 0 && (
        <div className="bg-white rounded-2xl shadow-sm py-16 text-center text-sm" style={{ color: "#aaa" }}>
          No submitted tasks awaiting review.
        </div>
      )}
    </div>
  );
}

function SubmissionRow({ task, isLast }: { task: any; isLast: boolean }) {
  return (
    <div
      className="flex items-center gap-4 px-5 py-4"
      style={{
        borderLeft: `3px solid ${task.acknowledgedAt ? "rgba(0,0,0,0.1)" : "#C79A3B"}`,
        borderBottom: isLast ? "none" : "1px solid rgba(0,0,0,0.05)",
      }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold" style={{ color: "#222" }}>{task.title}</p>
          {!task.acknowledgedAt && <Badge variant="gold">New</Badge>}
        </div>
        <Link href={`/admin/applicants/${task.application.id}/tasks`} className="text-xs font-medium mt-0.5 block" style={{ color: "#114E3B" }}>
          {task.application.student.firstName} {task.application.student.lastName}
        </Link>
        <p className="text-xs mt-0.5" style={{ color: "#bbb" }}>
          Submitted {new Date(task.completedAt).toLocaleDateString("en-NZ", { day: "numeric", month: "short" })}
          {task.documents.length > 0 && ` · ${task.documents.length} document${task.documents.length > 1 ? "s" : ""}`}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {!task.acknowledgedAt && (
          <AcknowledgeButton applicationId={task.application.id} taskId={task.id} />
        )}
        <Link
          href={`/admin/applicants/${task.application.id}/tasks`}
          className="text-xs font-semibold px-3 py-1.5 rounded-full"
          style={{ backgroundColor: "rgba(17,78,59,0.08)", color: "#114E3B" }}
        >
          Review
        </Link>
      </div>
    </div>
  );
}
