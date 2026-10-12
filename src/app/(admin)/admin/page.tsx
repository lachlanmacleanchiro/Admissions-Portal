import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { NotImplementedButton } from "@/components/ui/NotImplementedButton";
import { STAGE_LABELS } from "@/lib/stages";
import { resolveIntakeFilter } from "@/lib/intakeYears";
import { IntakeFilterPicker } from "@/components/admin/IntakeFilterPicker";
import type { ApplicationStageKey } from "@/generated/prisma/client";

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

const STAGE_BADGE_VARIANT: Record<ApplicationStageKey, "muted" | "gold" | "blue" | "purple" | "red" | "green" | "olive"> = {
  NEW_SUBMITTED: "muted",
  INTAKE_REVIEW: "blue",
  ACADEMIC_CHECK: "gold",
  INTERVIEW: "blue",
  ESSAY: "blue",
  COMMITTEE: "red",
  OFFER_CONDITIONAL: "gold",
  OFFER_UNCONDITIONAL: "gold",
  ACCEPTED: "green",
  ENROLLED: "olive",
};

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ intake?: string }>;
}) {
  const { intake } = await searchParams;
  const session = await auth();
  if (!session?.user || session.user.role !== "STAFF") redirect("/login");

  const intakeFilter = await resolveIntakeFilter(intake);

  const [stageCounts, todayTasks] = await Promise.all([
    prisma.application.groupBy({
      by: ["currentStage"],
      where: intakeFilter.where,
      _count: true,
    }),
    prisma.staffTask.findMany({
      where: { assignedToId: session.user.id, status: "PENDING" },
      include: { application: { select: { applicantNumber: true, student: { select: { firstName: true, lastName: true } } } } },
      orderBy: [{ dueDate: "asc" }],
      take: 5,
    }),
  ]);

  const stageMap = Object.fromEntries(
    (stageCounts as { currentStage: ApplicationStageKey; _count: number }[]).map((s) => [s.currentStage, s._count])
  );

  const totalApplications = Object.values(stageMap).reduce((a, b) => a + b, 0);
  const awaitingReview = stageMap["NEW_SUBMITTED"] ?? 0;
  const atInterview = (stageMap["INTERVIEW"] ?? 0) + (stageMap["ESSAY"] ?? 0);
  const offersSent = (stageMap["OFFER_CONDITIONAL"] ?? 0) + (stageMap["OFFER_UNCONDITIONAL"] ?? 0);
  const enrolled = stageMap["ENROLLED"] ?? 0;

  // Pipeline snapshot: first 3 apps per stage for the preview strip
  const pipelineApps = await prisma.application.findMany({
    where: intakeFilter.where,
    orderBy: { updatedAt: "desc" },
    take: 21,
    include: {
      student: { select: { firstName: true, lastName: true } },
    },
  });

  // Group by stage (max 3 per)
  const pipelineByStage: Record<string, typeof pipelineApps> = {};
  for (const app of pipelineApps) {
    if (!pipelineByStage[app.currentStage]) pipelineByStage[app.currentStage] = [];
    if (pipelineByStage[app.currentStage].length < 3) {
      pipelineByStage[app.currentStage].push(app);
    }
  }

  const STAGES: ApplicationStageKey[] = [
    "NEW_SUBMITTED", "INTAKE_REVIEW", "ACADEMIC_CHECK",
    "INTERVIEW", "ESSAY", "COMMITTEE", "OFFER_CONDITIONAL", "OFFER_UNCONDITIONAL", "ACCEPTED", "ENROLLED",
  ];

  return (
    <div className="px-8 py-7 w-full">
      <p className="text-xs font-semibold tracking-widest uppercase text-text-muted mb-1">
        {intakeFilter.label}
      </p>
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="font-serif text-3xl text-text">Admissions Overview</h1>
          <p className="text-sm text-text-muted mt-1">
            {getGreeting()}, {session.user.firstName}. You have {todayTasks.length} task{todayTasks.length !== 1 ? "s" : ""} requiring action today.
          </p>
        </div>
        <div className="flex gap-2">
          <IntakeFilterPicker intakeYears={intakeFilter.visibleIntakes.map((iy) => ({ id: iy.id, label: iy.label }))} />
          <Link href="/admin/applicants" className="px-4 py-2 rounded-lg bg-white shadow-sm text-sm font-medium text-text-muted hover:text-green transition-colors">
            Export CSV
          </Link>
          <NotImplementedButton className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
            + New Applicant
          </NotImplementedButton>
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-5 gap-4 mb-8">
        <div className="col-span-1 rounded-xl p-5 text-white" style={{ backgroundColor: "#114E3B" }}>
          <p className="text-[10px] font-semibold tracking-widest uppercase opacity-70 mb-2">Total Applications</p>
          <p className="font-serif text-4xl font-bold">{totalApplications}</p>
          <p className="text-xs opacity-60 mt-1">Target: 150</p>
        </div>
        {[
          { label: "Awaiting Review", value: awaitingReview, sub: `New this week: ${awaitingReview}` },
          { label: "At Interview Stage", value: atInterview, sub: `${atInterview} scheduled this month` },
          { label: "Offers Sent", value: offersSent, sub: `${Math.floor(offersSent * 0.6)} accepted` },
          { label: "Enrolled", value: enrolled, sub: "Deposits confirmed" },
        ].map(({ label, value, sub }) => (
          <div key={label} className="bg-white rounded-xl shadow-sm p-5">
            <p className="text-[10px] font-semibold tracking-widest uppercase text-text-muted mb-2">{label}</p>
            <p className="font-serif text-3xl text-gold">{value}</p>
            <p className="text-xs text-text-muted mt-1">{sub}</p>
          </div>
        ))}
      </div>

      {/* Pipeline snapshot */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold tracking-widest uppercase text-text-muted">Pipeline Snapshot</p>
          <Link href="/admin/pipeline" className="text-xs text-green hover:underline">View full pipeline →</Link>
        </div>
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
          {STAGES.map((stage) => {
            const apps = pipelineByStage[stage] ?? [];
            const count = stageMap[stage] ?? 0;
            return (
              <div key={stage} className="bg-white rounded-xl shadow-sm p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-semibold text-text">{STAGE_LABELS[stage]}</p>
                  <span className="text-[10px] text-text-muted bg-surface-dark px-1.5 py-0.5">{count}</span>
                </div>
                <div className="flex flex-col gap-2">
                  {apps.map((app) => (
                    <Link key={app.id} href={`/admin/applicants/${app.id}`} className="block p-2 bg-surface hover:bg-surface-dark transition-colors">
                      <p className="text-xs font-medium text-text truncate">
                        {app.student.firstName} {app.student.lastName}
                      </p>
                      {app.flagNote && (
                        <p className="text-[10px] text-red-flag mt-0.5 truncate">{app.flagNote}</p>
                      )}
                      <span className={["inline-block mt-1 text-[9px] font-semibold uppercase px-1.5 py-0.5", app.category === "DOMESTIC" ? "bg-green/10 text-green" : "bg-blue-100 text-blue-700"].join(" ")}>
                        {app.category}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Today's priority tasks */}
      {todayTasks.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold tracking-widest uppercase text-text-muted">Today&apos;s Priority Tasks</p>
            <Link href="/admin/tasks" className="text-xs text-green hover:underline">View all tasks →</Link>
          </div>
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {todayTasks.map((task, i) => {
              const isOverdue = task.dueDate && new Date(task.dueDate) < new Date();
              return (
                <div
                  key={task.id}
                  className="flex items-center gap-4 px-5 py-4"
                  style={{
                    borderLeft: `3px solid ${isOverdue ? "#c0392b" : "#C79A3B"}`,
                    borderBottom: i < todayTasks.length - 1 ? "1px solid rgba(0,0,0,0.05)" : "none",
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold" style={{ color: "#222" }}>{task.title}</p>
                    <p className="text-xs mt-0.5" style={{ color: "#aaa" }}>
                      {task.application?.student ? `${task.application.student.firstName} ${task.application.student.lastName} · ` : "Internal · "}
                      {task.description}
                    </p>
                  </div>
                  <Badge variant={isOverdue ? "red" : "gold"}>
                    {isOverdue ? "Overdue" : task.dueDate ? `Due ${new Date(task.dueDate).toLocaleDateString("en-NZ", { day: "numeric", month: "short" })}` : "Pending"}
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
