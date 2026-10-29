import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission, hasPermission } from "@/lib/permissions";
import { Badge } from "@/components/ui/Badge";
import { STAGE_STATUS_LABELS, STAGE_DISPLAY_STEPS, STAGE_ORDER, stageDisplayIndex } from "@/lib/stages";
import { EditApplicantForm } from "./EditApplicantForm";
import { TaskCompleteCheckbox } from "./TaskCompleteCheckbox";
import { OfferPanel } from "./OfferPanel";
import { NotesPanel } from "./NotesPanel";
import { InterviewReviewPanel } from "./InterviewReviewPanel";
import { EssayReviewPanel } from "./EssayReviewPanel";
import { PrerequisitesPanel } from "./PrerequisitesPanel";
import { DeleteAccountPanel } from "./DeleteAccountPanel";
import { StageDocumentsPanel } from "./StageDocumentsPanel";
import { buildAutoVariableValues } from "@/lib/documentTemplateValues";
import { WidgetBoard, type BoardWidget } from "@/components/admin/WidgetBoard";
import { normaliseLayout } from "@/lib/applicantWidgets";
import { formatDateOnly, toDateInputValue, formatSuburbCity, formatChiroExperience, formatEducationYears } from "@/lib/applicantDisplay";
import Link from "next/link";

export default async function ApplicantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user || session.user.role !== "STAFF") redirect("/login");
  requirePermission(session, "VIEW_APPLICANTS");

  const app = await prisma.application.findUnique({
    where: { id },
    include: {
      student: true,
      intakeYear: true,
      tasks: {
        where: { status: { not: "APPROVED" } },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { assignedTo: { select: { firstName: true, lastName: true } } },
      },
      timelineEvents: { orderBy: { occurredAt: "desc" }, take: 5 },
      offers: {
        orderBy: { issuedAt: "desc" },
        include: { conditions: true },
      },
      notes: {
        orderBy: { createdAt: "desc" },
        include: { author: { select: { firstName: true, lastName: true } } },
      },
      interviewReview: true,
      essayReview: true,
      chiropracticExperience: { orderBy: { date: "desc" } },
      educationHistory: { orderBy: [{ yearStarted: "desc" }, { createdAt: "asc" }] },
      prerequisiteCourses: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!app) notFound();

  const [stageDocumentTemplates, documentSends, autoValues] = await Promise.all([
    prisma.documentTemplate.findMany({
      where: { stageKey: app.currentStage, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true, subject: true, bodyMarkdown: true },
    }),
    prisma.documentSend.findMany({
      where: { applicationId: id },
      orderBy: { sentAt: "desc" },
      include: { sentBy: { select: { firstName: true, lastName: true } } },
    }),
    buildAutoVariableValues(id, session.user),
  ]);

  const canAdvance = hasPermission(session, "ADVANCE_APPLICATION_STAGE");
  const canAssignTasks = hasPermission(session, "ASSIGN_TASKS");
  const canSendMessages = hasPermission(session, "SEND_MESSAGES");
  const canEditProfile = hasPermission(session, "EDIT_APPLICANT_PROFILE");
  const canWithdraw = hasPermission(session, "WITHDRAW_APPLICATION");


  const currentIndex = stageDisplayIndex(app.currentStage);
  const rawStageIndex = STAGE_ORDER.indexOf(app.currentStage);
  const showInterview = rawStageIndex >= STAGE_ORDER.indexOf("INTERVIEW");
  const showEssay = rawStageIndex >= STAGE_ORDER.indexOf("ESSAY");


  // Each Overview section is a widget the staff member can rearrange (Move Widgets).
  // A widget is null when it doesn't apply to this applicant.
  const widgets: BoardWidget[] = [
    { id: "progress", node: (
      <div className="bg-white rounded-2xl shadow-sm px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          {STAGE_DISPLAY_STEPS.map((step, i) => {
            const isComplete = i < currentIndex;
            const isCurrent = i === currentIndex;
            return (
              <div key={step.key} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-shrink-0">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{
                      backgroundColor: isComplete ? "#114E3B" : isCurrent ? "#C79A3B" : "rgba(0,0,0,0.08)",
                      color: isComplete || isCurrent ? "#fff" : "#aaa",
                    }}
                  >
                    {isComplete ? (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      i + 1
                    )}
                  </div>
                </div>
                {i < STAGE_DISPLAY_STEPS.length - 1 && (
                  <div
                    className="flex-1 h-0.5 mx-1"
                    style={{ backgroundColor: isComplete ? "#114E3B" : "rgba(0,0,0,0.08)" }}
                  />
                )}
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between mt-1">
          {STAGE_DISPLAY_STEPS.map((step, i) => {
            const isCurrent = i === currentIndex;
            return (
              <div key={step.key} className="flex-1 text-center" style={{ minWidth: 0 }}>
                <span
                  className="text-[9px] font-semibold uppercase tracking-wide leading-tight block truncate px-0.5"
                  style={{ color: isCurrent ? "#C79A3B" : i < currentIndex ? "#114E3B" : "#bbb" }}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    ) },
    { id: "stage-documents", node: stageDocumentTemplates.length > 0 ? (
          <StageDocumentsPanel
            applicationId={id}
            stageLabel={STAGE_STATUS_LABELS[app.currentStage]}
            studentEmail={app.student.email}
            templates={stageDocumentTemplates}
            sends={documentSends.map((s) => ({
              id: s.id,
              templateId: s.templateId,
              subject: s.subject,
              sentAt: s.sentAt.toISOString(),
              sentByName: `${s.sentBy.firstName} ${s.sentBy.lastName}`,
            }))}
            autoValues={autoValues ?? {}}
            canSend={canSendMessages}
          />
    ) : null },
    { id: "notes", node: (
          <NotesPanel
            applicationId={id}
            notes={app.notes.map((n) => ({ ...n, createdAt: n.createdAt.toISOString(), updatedAt: n.updatedAt.toISOString() }))}
            canAdd={canEditProfile}
            currentUserId={session!.user.id}
          />
    ) },
    { id: "details", node: (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: "1px solid rgba(0,0,0,0.06)", backgroundColor: "#F8F8F6" }}>
            <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#555" }}>Application Details</p>
            {canEditProfile && (
              <EditApplicantForm
                applicationId={id}
                initial={{
                  firstName: app.student.firstName,
                  lastName: app.student.lastName,
                  email: app.student.email,
                  phone: app.phone ?? "",
                  dateOfBirth: toDateInputValue(app.dateOfBirth),
                  citizenshipCountry: app.citizenshipCountry ?? "",
                  city: app.city ?? "",
                  address: app.address ?? "",
                  suburb: app.suburb ?? "",
                  postcode: app.postcode ?? "",
                  country: app.country ?? "",
                  guardianName: app.guardianName ?? "",
                  guardianRelation: app.guardianRelation ?? "",
                  guardianEmail: app.guardianEmail ?? "",
                  guardianPhone: app.guardianPhone ?? "",
                  gpaScore: app.gpaScore?.toString() ?? "",
                  prerequisitesMet: app.prerequisitesMet,
                  chiropracticExperience: app.chiropracticExperience.map((e) => ({
                    chiropractorName: e.chiropractorName,
                    status: e.status,
                    date: toDateInputValue(e.date),
                  })),
                }}
              />
            )}
          </div>
          <dl className="divide-y" style={{ borderColor: "rgba(0,0,0,0.05)" }}>
            {([
              ["Date Submitted", app.submittedAt?.toLocaleDateString("en-NZ", { timeZone: "Pacific/Auckland" }) ?? "—"],
              ["Mobile", app.phone ?? "—"],
              ["Email", app.student.email],
              ["DOB", formatDateOnly(app.dateOfBirth)],
              ["Country of Citizenship", app.citizenshipCountry ?? "—"],
              ["Address", formatSuburbCity(app.suburb, app.city)],
              ["Chiropractic Experience", app.chiropracticExperience.length > 0
                ? formatChiroExperience(app.chiropracticExperience).map((line) => <span key={line} className="block">{line}</span>)
                : "—"],
            ] as [string, React.ReactNode][]).map(([k, v], i, arr) => (
              <div key={k} className="flex justify-between gap-4 px-5 py-3 text-sm" style={{ borderBottom: i < arr.length - 1 ? "1px solid rgba(0,0,0,0.05)" : "none" }}>
                <dt style={{ color: "#666" }}>{k}</dt>
                <dd className="font-medium text-right" style={{ color: "#222" }}>{v}</dd>
              </div>
            ))}
          </dl>
        </div>
    ) },
    { id: "academic", node: (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-3.5" style={{ borderBottom: "1px solid rgba(0,0,0,0.06)", backgroundColor: "#F8F8F6" }}>
            <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#555" }}>Academic Background</p>
          </div>
          <dl className="divide-y" style={{ borderColor: "rgba(0,0,0,0.05)" }}>
            {[
              ["Completed tertiary study", app.hasCompletedTertiaryStudy ? "Yes" : "No"],
              ["National Student Number", app.nationalStudentNumber || "—"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between px-5 py-3 text-sm" style={{ borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                <dt style={{ color: "#666" }}>{k}</dt>
                <dd className="font-medium" style={{ color: "#222" }}>{v}</dd>
              </div>
            ))}
          </dl>
          <div className="px-5 py-3">
            <p className="text-sm mb-2" style={{ color: "#666" }}>Education history</p>
            {app.educationHistory.length === 0 ? (
              <p className="text-xs" style={{ color: "#888" }}>No education history entered.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {app.educationHistory.map((e) => (
                  <li key={e.id} className="text-sm">
                    <span className="font-medium block" style={{ color: "#222" }}>{e.institutionName}</span>
                    <span className="text-xs" style={{ color: "#888" }}>
                      {[e.level === "SECONDARY" ? "Secondary" : "Tertiary", e.qualification, e.country, formatEducationYears(e.yearStarted, e.yearCompleted)]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
    ) },
    { id: "disclosures", node: (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-3.5" style={{ borderBottom: "1px solid rgba(0,0,0,0.06)", backgroundColor: "#F8F8F6" }}>
            <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#555" }}>Disclosures</p>
          </div>
          <dl className="divide-y" style={{ borderColor: "rgba(0,0,0,0.05)" }}>
            {[
              ["Disability support need", app.hasDisabilitySupportNeed ? (app.disabilitySupportCategory ?? "Yes") : "No"],
              ["Criminal conviction", app.hasCriminalConviction ? (app.criminalConvictionDetails ?? "Yes") : "No"],
              ["Pending legal proceedings", app.hasPendingLegalProceedings ? (app.pendingLegalProceedingsDetails ?? "Yes") : "No"],
              ["Prior academic issues", app.hasPriorAcademicIssues ? (app.priorAcademicIssuesDetails ?? "Yes") : "No"],
              ["Prior complaints", app.hasPriorComplaints ? (app.priorComplaintsDetails ?? "Yes") : "No"],
              ["Dishonesty allegations", app.hasDishonestyAllegations ? (app.dishonestyAllegationsDetails ?? "Yes") : "No"],
            ].map(([k, v], i, arr) => (
              <div key={k} className="flex justify-between gap-4 px-5 py-3 text-sm" style={{ borderBottom: i < arr.length - 1 ? "1px solid rgba(0,0,0,0.05)" : "none" }}>
                <dt style={{ color: "#666" }}>{k}</dt>
                <dd className="font-medium text-right" style={{ color: "#222" }}>{v}</dd>
              </div>
            ))}
          </dl>
        </div>
    ) },
    { id: "prerequisites", node: app.yearLevel === "YEAR_2" ? (
          <PrerequisitesPanel
            applicationId={id}
            courses={app.prerequisiteCourses}
            gpaScore={app.gpaScore}
            prerequisitesMet={app.prerequisitesMet}
            canEdit={canEditProfile}
          />
    ) : null },
    { id: "statement", node: app.personalStatement ? (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-3.5" style={{ borderBottom: "1px solid rgba(0,0,0,0.06)", backgroundColor: "#F8F8F6" }}>
              <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#555" }}>Personal Statement</p>
            </div>
            <p className="px-5 py-4 text-sm whitespace-pre-wrap" style={{ color: "#333" }}>{app.personalStatement}</p>
          </div>
    ) : null },
    { id: "tasks", node: (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: "1px solid rgba(0,0,0,0.06)", backgroundColor: "#F8F8F6" }}>
            <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#555" }}>Tasks</p>
            {canAssignTasks && (
              <Link href={`/admin/applicants/${id}/tasks`} className="text-xs font-semibold" style={{ color: "#114E3B" }}>Manage →</Link>
            )}
          </div>
          {app.tasks.length === 0 ? (
            <p className="px-5 py-4 text-xs" style={{ color: "#888" }}>No tasks assigned.</p>
          ) : (
            app.tasks.map((task, i) => (
              <div key={task.id} className="flex items-center justify-between px-5 py-3 text-xs" style={{ borderBottom: i < app.tasks.length - 1 ? "1px solid rgba(0,0,0,0.05)" : "none" }}>
                <span className="flex items-center gap-2.5 truncate max-w-[60%]">
                  {canAssignTasks && (
                    <TaskCompleteCheckbox
                      applicationId={id}
                      taskId={task.id}
                      isComplete={task.status === "APPROVED"}
                    />
                  )}
                  <span className="truncate" style={{ color: "#333" }}>{task.title}</span>
                  <span className="flex-shrink-0" style={{ color: task.assignedTo ? "#114E3B" : "#bbb" }}>
                    {task.assignedTo
                      ? `· ${task.audience === "STUDENT" ? "Follow-up: " : ""}${task.assignedTo.firstName} ${task.assignedTo.lastName}`
                      : "· Unassigned"}
                  </span>
                </span>
                <Badge variant={task.status === "APPROVED" ? "green" : task.status === "REJECTED" ? "red" : task.status === "SUBMITTED" ? "gold" : "muted"}>
                  {task.status.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}
                </Badge>
              </div>
            ))
          )}
        </div>
    ) },
    { id: "offer", node: (
        <OfferPanel
          applicationId={id}
          offers={app.offers.map((o) => ({
            ...o,
            issuedAt: o.issuedAt.toISOString(),
            acceptanceDeadline: o.acceptanceDeadline ? o.acceptanceDeadline.toISOString() : null,
          }))}
          canManage={canAdvance}
          depositStatus={app.depositStatus}
          depositMethod={app.depositMethod}
        />
    ) },
    { id: "interview", node: showInterview ? (
          <InterviewReviewPanel
            applicationId={id}
            review={
              app.interviewReview
                ? { ...app.interviewReview, interviewDate: app.interviewReview.interviewDate?.toISOString() ?? null }
                : null
            }
            canEdit={canAdvance}
          />
    ) : null },
    { id: "essay", node: showEssay ? (
          <EssayReviewPanel applicationId={id} review={app.essayReview} canEdit={canAdvance} />
    ) : null },
    { id: "account", node: canWithdraw || app.student.deletionRequestedAt ? (
        <DeleteAccountPanel
          studentUserId={app.student.id}
          studentName={`${app.student.firstName} ${app.student.lastName}`}
          deletionRequestedAt={app.student.deletionRequestedAt ? app.student.deletionRequestedAt.toISOString() : null}
          canDelete={canWithdraw}
        />
    ) : null },
  ];

  const staffUser = await prisma.user.findUnique({ where: { id: session.user.id }, select: { applicantLayout: true } });

  return <WidgetBoard widgets={widgets} initialLayout={normaliseLayout(staffUser?.applicantLayout)} />;
}
