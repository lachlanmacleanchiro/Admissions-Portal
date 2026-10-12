import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission, hasPermission } from "@/lib/permissions";
import { Badge } from "@/components/ui/Badge";
import { CommitteeDecisionPanel } from "./CommitteeDecisionPanel";

export default async function ConsiderationSummaryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user || session.user.role !== "STAFF") redirect("/login");
  requirePermission(session, "VIEW_APPLICANTS");

  const app = await prisma.application.findUnique({
    where: { id },
    include: {
      student: true,
      intakeYear: true,
      interviewReview: { include: { reviewedBy: { select: { firstName: true, lastName: true } } } },
      essayReview: { include: { reviewedBy: { select: { firstName: true, lastName: true } } } },
      internationalCompliance: true,
      committeeDecision: { include: { decidedBy: { select: { firstName: true, lastName: true } } } },
      prerequisiteCourses: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!app) notFound();

  const canDecide = hasPermission(session, "ADVANCE_APPLICATION_STAGE");

  const row = (label: string, value: React.ReactNode) => (
    <div className="flex justify-between px-5 py-3 text-sm" style={{ borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
      <dt style={{ color: "#666" }}>{label}</dt>
      <dd className="font-medium text-right" style={{ color: "#222" }}>{value}</dd>
    </div>
  );

  return (
    <div>
      {/* Application Details */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-5">
        <div className="px-5 py-3.5" style={{ borderBottom: "1px solid rgba(0,0,0,0.06)", backgroundColor: "#F8F8F6" }}>
          <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#555" }}>Application Details</p>
        </div>
        <dl>
          {row("Applicant type", `${app.category === "DOMESTIC" ? "Domestic" : "International"} · Year ${app.yearLevel === "YEAR_1" ? "1" : "2"}`)}
          {row("Intake", app.intakeYear.label)}
          {row("Email", app.student.email)}
          {row("Submitted", app.submittedAt ? new Date(app.submittedAt).toLocaleDateString("en-NZ") : "—")}
        </dl>
      </div>

      {/* Prerequisites & GPA */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-5">
        <div className="px-5 py-3.5" style={{ borderBottom: "1px solid rgba(0,0,0,0.06)", backgroundColor: "#F8F8F6" }}>
          <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#555" }}>Prerequisites &amp; GPA</p>
        </div>
        <dl>
          {row("GPA", app.gpaScore != null ? app.gpaScore.toFixed(2) : "—")}
          {row("Prerequisites met", <Badge variant={app.prerequisitesMet ? "green" : "red"}>{app.prerequisitesMet ? "Yes" : "No"}</Badge>)}
          {app.prerequisiteNotes && row("Notes", app.prerequisiteNotes)}
        </dl>
        {app.prerequisiteCourses.length > 0 && (
          <div className="px-5 py-3" style={{ borderTop: "1px solid rgba(0,0,0,0.05)" }}>
            <table className="w-full text-xs">
              <thead>
                <tr style={{ color: "#999" }}>
                  <th className="text-left font-semibold pb-1.5 pr-2">NZCC Course</th>
                  <th className="text-left font-semibold pb-1.5 pr-2">Equivalent</th>
                  <th className="text-left font-semibold pb-1.5 pr-2">Grade</th>
                  <th className="text-left font-semibold pb-1.5 pr-2">Institution</th>
                  <th className="text-left font-semibold pb-1.5">Year</th>
                </tr>
              </thead>
              <tbody>
                {app.prerequisiteCourses.map((c) => (
                  <tr key={c.id}>
                    <td className="pr-2 pb-1" style={{ color: "#222" }}>{c.nzccCourseCode}</td>
                    <td className="pr-2 pb-1" style={{ color: "#222" }}>{c.equivalentCourseCode ?? "—"}</td>
                    <td className="pr-2 pb-1" style={{ color: "#222" }}>{c.grade ?? "—"}</td>
                    <td className="pr-2 pb-1" style={{ color: "#222" }}>{c.institution ?? "—"}</td>
                    <td className="pb-1" style={{ color: "#222" }}>{c.year ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Interview */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-5">
        <div className="px-5 py-3.5" style={{ borderBottom: "1px solid rgba(0,0,0,0.06)", backgroundColor: "#F8F8F6" }}>
          <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#555" }}>Interview</p>
        </div>
        {!app.interviewReview ? (
          <p className="px-5 py-4 text-xs" style={{ color: "#888" }}>No interview review recorded.</p>
        ) : (
          <dl>
            {row("Score", app.interviewReview.score != null ? `${app.interviewReview.score} / 30` : "—")}
            {row("Format", app.interviewReview.format ?? "—")}
            {row("Date", app.interviewReview.interviewDate ? new Date(app.interviewReview.interviewDate).toLocaleDateString("en-NZ") : "—")}
            {app.interviewReview.notes && row("Notes", app.interviewReview.notes)}
            {app.interviewReview.reviewedBy && row("Reviewed by", `${app.interviewReview.reviewedBy.firstName} ${app.interviewReview.reviewedBy.lastName}`)}
          </dl>
        )}
      </div>

      {/* Essay */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-5">
        <div className="px-5 py-3.5" style={{ borderBottom: "1px solid rgba(0,0,0,0.06)", backgroundColor: "#F8F8F6" }}>
          <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#555" }}>Essay</p>
        </div>
        {!app.essayReview ? (
          <p className="px-5 py-4 text-xs" style={{ color: "#888" }}>No essay review recorded.</p>
        ) : (
          <dl>
            {row("Score", app.essayReview.score != null ? `${app.essayReview.score} / 100` : "—")}
            {app.essayReview.notes && row("Notes", app.essayReview.notes)}
            {app.essayReview.reviewedBy && row("Reviewed by", `${app.essayReview.reviewedBy.firstName} ${app.essayReview.reviewedBy.lastName}`)}
          </dl>
        )}
      </div>

      {app.category === "INTERNATIONAL" && app.internationalCompliance && (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-5">
          <div className="px-5 py-3.5" style={{ borderBottom: "1px solid rgba(0,0,0,0.06)", backgroundColor: "#F8F8F6" }}>
            <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#555" }}>International Compliance</p>
          </div>
          <dl>
            {row("Visa status", app.internationalCompliance.visaStatus)}
            {row("Health insurance", app.internationalCompliance.healthInsuranceStatus)}
            {row("IELTS status", app.internationalCompliance.ieltsStatus)}
          </dl>
        </div>
      )}

      <CommitteeDecisionPanel
        applicationId={id}
        currentStage={app.currentStage}
        existingDecision={
          app.committeeDecision
            ? {
                ...app.committeeDecision,
                decidedAt: app.committeeDecision.decidedAt.toISOString(),
                deferUntil: app.committeeDecision.deferUntil ? app.committeeDecision.deferUntil.toISOString() : null,
              }
            : null
        }
        canDecide={canDecide}
      />
    </div>
  );
}
