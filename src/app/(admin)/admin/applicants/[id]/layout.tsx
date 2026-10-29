import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission, hasPermission } from "@/lib/permissions";
import { Badge } from "@/components/ui/Badge";
import { STAGE_STATUS_LABELS } from "@/lib/stages";
import { ApplicantTabs } from "@/components/admin/ApplicantTabs";
import { StageAdvancer } from "./StageAdvancer";
import { SendReminderButton } from "./SendReminderButton";
import { FlagEditor } from "./FlagEditor";
import { YearLevelEditor } from "./YearLevelEditor";
import { getMessagingMode } from "@/lib/messaging";
import { WidgetEditProvider } from "@/components/admin/WidgetEditContext";
import { MoveWidgetsButton } from "@/components/admin/MoveWidgetsButton";
import Link from "next/link";
import type { ApplicationStageKey } from "@/generated/prisma/client";

const STAGE_VARIANTS: Record<ApplicationStageKey, "muted" | "blue" | "gold" | "red" | "green" | "olive" | "purple"> = {
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

// Shared header + tab bar for every applicant tab, so it stays put when switching tabs.
export default async function ApplicantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user || session.user.role !== "STAFF") redirect("/login");
  requirePermission(session, "VIEW_APPLICANTS");

  const app = await prisma.application.findUnique({
    where: { id },
    select: {
      id: true,
      category: true,
      yearLevel: true,
      currentStage: true,
      flagNote: true,
      flagColor: true,
      student: { select: { firstName: true, lastName: true } },
      intakeYear: { select: { label: true } },
    },
  });
  if (!app) notFound();

  const canAdvance = hasPermission(session, "ADVANCE_APPLICATION_STAGE");
  const canEditProfile = hasPermission(session, "EDIT_APPLICANT_PROFILE");
  const canRemindTasks = hasPermission(session, "REMIND_TASK");
  const canViewDocs = hasPermission(session, "VIEW_DOCUMENTS");
  const canMessage = hasPermission(session, "SEND_MESSAGES");

  // Unread messages from the student in the messaging style currently shown.
  const unreadMessages = canMessage
    ? (await getMessagingMode()) === "CHAT"
      ? await prisma.message.count({ where: { thread: { applicationId: id }, senderRole: "STUDENT", isRead: false } })
      : await prisma.mailMessage.count({ where: { thread: { applicationId: id }, senderRole: "STUDENT", isRead: false } })
    : 0;

  return (
    <WidgetEditProvider>
    <div className="px-8 py-7 w-full">
      <Link href="/admin/applicants" className="text-xs font-medium transition-colors hover:underline" style={{ color: "#114E3B" }}>
        ← All Applicants
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="font-serif text-3xl text-text">
              {app.student.firstName} {app.student.lastName}
            </h1>
            <Badge variant={STAGE_VARIANTS[app.currentStage]}>{STAGE_STATUS_LABELS[app.currentStage]}</Badge>
            <FlagEditor applicationId={id} flagNote={app.flagNote} flagColor={app.flagColor} canEdit={canEditProfile} />
          </div>
          <div className="flex items-center gap-2 text-xs" style={{ color: "#666" }}>
            <span>{app.category === "DOMESTIC" ? "Domestic" : "International"}</span>
            <span>·</span>
            <YearLevelEditor applicationId={id} yearLevel={app.yearLevel} canEdit={canEditProfile} />
            <span>·</span>
            <span>{app.intakeYear.label}</span>
          </div>
        </div>
        {canAdvance && (
          <div className="flex items-start gap-3">
            <StageAdvancer applicationId={app.id} currentStage={app.currentStage} />
          </div>
        )}
      </div>

      <ApplicantTabs
        applicationId={id}
        showDocuments={canViewDocs}
        showCommunications={canMessage}
        unreadMessages={unreadMessages}
        actions={
          <>
            <MoveWidgetsButton applicationId={app.id} />
            {canRemindTasks && <SendReminderButton applicationId={app.id} />}
          </>
        }
      />

      {children}
    </div>
    </WidgetEditProvider>
  );
}
