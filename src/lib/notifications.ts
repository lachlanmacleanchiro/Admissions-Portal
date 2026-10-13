import { prisma } from "@/lib/prisma";
import { sendTemplatedEmail, buildAppUrl } from "@/lib/email";
import { STAGE_STATUS_LABELS } from "@/lib/stages";
import type { ApplicationStageKey, OfferType } from "@/generated/prisma/client";

async function isEmailNotificationsEnabled(): Promise<boolean> {
  const row = await prisma.appSettings.findUnique({ where: { id: "singleton" } });
  return row?.emailNotificationsEnabled ?? false;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderTaskListHtml(tasks: { title: string }[]): string {
  return tasks.map((t) => `<li>${escapeHtml(t.title)}</li>`).join("");
}

export async function notifyStudentOfNewTasks(
  applicationId: string,
  tasks: { id: string; title: string; audience?: string }[]
): Promise<void> {
  const studentTasks = tasks.filter((t) => t.audience === undefined || t.audience === "STUDENT");
  if (studentTasks.length === 0) return;
  try {
    if (!(await isEmailNotificationsEnabled())) return;

    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      select: { student: { select: { email: true, firstName: true } } },
    });
    if (!application) return;

    await sendTemplatedEmail("TASKS_ASSIGNED", application.student.email, {
      firstName: application.student.firstName,
      taskList: renderTaskListHtml(studentTasks),
      portalUrl: buildAppUrl("/tasks"),
    });
  } catch (err) {
    console.error("notifyStudentOfNewTasks failed", err);
  }
}

export async function notifyStudentOfStageChange(
  applicationId: string,
  newStage: ApplicationStageKey
): Promise<void> {
  try {
    if (!(await isEmailNotificationsEnabled())) return;

    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      select: { student: { select: { email: true, firstName: true } } },
    });
    if (!application) return;

    await sendTemplatedEmail("STAGE_CHANGE_NOTIFICATION", application.student.email, {
      firstName: application.student.firstName,
      stageName: STAGE_STATUS_LABELS[newStage],
      portalUrl: buildAppUrl("/dashboard"),
    });
  } catch (err) {
    console.error("notifyStudentOfStageChange failed", err);
  }
}

export async function notifyStudentTaskReminder(
  applicationId: string
): Promise<{ sent: boolean; taskCount: number }> {
  const tasks = await prisma.task.findMany({
    // Student tasks only — internal (staff) tasks must never appear in a student email.
    where: { applicationId, audience: "STUDENT", isRequired: true, status: { not: "APPROVED" } },
    select: { id: true, title: true },
  });
  if (tasks.length === 0) return { sent: false, taskCount: 0 };

  try {
    if (!(await isEmailNotificationsEnabled())) {
      return { sent: false, taskCount: tasks.length };
    }

    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      select: { student: { select: { email: true, firstName: true } } },
    });
    if (!application) return { sent: false, taskCount: tasks.length };

    await sendTemplatedEmail("TASK_REMINDER", application.student.email, {
      firstName: application.student.firstName,
      taskList: renderTaskListHtml(tasks),
      portalUrl: buildAppUrl("/tasks"),
    });

    return { sent: true, taskCount: tasks.length };
  } catch (err) {
    console.error("notifyStudentTaskReminder failed", err);
    return { sent: false, taskCount: tasks.length };
  }
}

/**
 * Finds distinct application IDs that have at least one outstanding, required,
 * student-facing task due exactly `days` from now (by calendar date). Used to
 * drive an automatic "due soon" reminder, separate from the manual reminder
 * button (which sends immediately, listing all outstanding tasks).
 */
export async function findApplicationIdsWithTasksDueInDays(days: number): Promise<string[]> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + days);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const tasks = await prisma.task.findMany({
    where: {
      audience: "STUDENT",
      isRequired: true,
      status: { notIn: ["APPROVED"] },
      dueDate: { gte: start, lt: end },
    },
    select: { applicationId: true },
    distinct: ["applicationId"],
  });

  return tasks.map((t) => t.applicationId);
}

function formatOfferType(type: OfferType): string {
  return type === "CONDITIONAL" ? "conditional" : "unconditional";
}

export async function notifyStudentOfApplicationDeclined(
  applicationId: string,
  note: string | null
): Promise<void> {
  try {
    if (!(await isEmailNotificationsEnabled())) return;

    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      select: { student: { select: { email: true, firstName: true } } },
    });
    if (!application) return;

    await sendTemplatedEmail("APPLICATION_DECLINED", application.student.email, {
      firstName: application.student.firstName,
      note: note ?? "",
    });
  } catch (err) {
    console.error("notifyStudentOfApplicationDeclined failed", err);
  }
}

export async function notifyStudentOfOffer(
  applicationId: string,
  offerType: OfferType,
  acceptanceDeadline: Date | null
): Promise<void> {
  try {
    if (!(await isEmailNotificationsEnabled())) return;

    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      select: { student: { select: { email: true, firstName: true } } },
    });
    if (!application) return;

    await sendTemplatedEmail("OFFER_ISSUED", application.student.email, {
      firstName: application.student.firstName,
      offerType: formatOfferType(offerType),
      deadlineText: acceptanceDeadline
        ? `Please respond by ${acceptanceDeadline.toLocaleDateString("en-NZ")}.`
        : "",
      portalUrl: buildAppUrl("/offer"),
    });
  } catch (err) {
    console.error("notifyStudentOfOffer failed", err);
  }
}

export async function notifyAdminsOfOfferResponse(
  applicationId: string,
  offerType: OfferType,
  accepted: boolean
): Promise<void> {
  try {
    if (!(await isEmailNotificationsEnabled())) return;

    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      select: { student: { select: { firstName: true, lastName: true } } },
    });
    if (!application) return;

    const recipients = await prisma.user.findMany({
      where: {
        role: "STAFF",
        isActive: true,
        OR: [
          { isGlobalAdmin: true },
          { staffPermissions: { some: { permissionKey: "ADVANCE_APPLICATION_STAGE", granted: true } } },
        ],
      },
      select: { email: true },
    });
    if (recipients.length === 0) return;

    const studentName = `${application.student.firstName} ${application.student.lastName}`;
    const applicantUrl = buildAppUrl(`/admin/applicants/${applicationId}`);

    await Promise.allSettled(
      recipients.map((r) =>
        sendTemplatedEmail("OFFER_RESPONSE_ADMIN", r.email, {
          studentName,
          responseVerb: accepted ? "accepted" : "declined",
          offerType: formatOfferType(offerType),
          applicantUrl,
        })
      )
    );
  } catch (err) {
    console.error("notifyAdminsOfOfferResponse failed", err);
  }
}

export async function notifyAdminsOfDocumentUpload(
  applicationId: string,
  filename: string
): Promise<void> {
  try {
    if (!(await isEmailNotificationsEnabled())) return;

    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      select: { student: { select: { firstName: true, lastName: true } } },
    });
    if (!application) return;

    const recipients = await prisma.user.findMany({
      where: {
        role: "STAFF",
        isActive: true,
        OR: [
          { isGlobalAdmin: true },
          { staffPermissions: { some: { permissionKey: "VERIFY_DOCUMENTS", granted: true } } },
        ],
      },
      select: { email: true },
    });
    if (recipients.length === 0) return;

    const studentName = `${application.student.firstName} ${application.student.lastName}`;
    const applicantUrl = buildAppUrl(`/admin/applicants/${applicationId}/documents`);

    await Promise.allSettled(
      recipients.map((r) =>
        sendTemplatedEmail("DOCUMENT_UPLOADED_ADMIN", r.email, {
          studentName,
          filename,
          applicantUrl,
        })
      )
    );
  } catch (err) {
    console.error("notifyAdminsOfDocumentUpload failed", err);
  }
}

export async function notifyStudentOfDocumentRejection(
  applicationId: string,
  filename: string,
  note: string | null
): Promise<void> {
  try {
    if (!(await isEmailNotificationsEnabled())) return;

    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      select: { student: { select: { email: true, firstName: true } } },
    });
    if (!application) return;

    await sendTemplatedEmail("DOCUMENT_REJECTED", application.student.email, {
      firstName: application.student.firstName,
      filename,
      note: note ?? "",
      portalUrl: buildAppUrl("/documents"),
    });
  } catch (err) {
    console.error("notifyStudentOfDocumentRejection failed", err);
  }
}

export async function notifyAdminsOfAllTasksComplete(applicationId: string): Promise<void> {
  try {
    if (!(await isEmailNotificationsEnabled())) return;

    const [application, completedTasks] = await Promise.all([
      prisma.application.findUnique({
        where: { id: applicationId },
        select: { student: { select: { firstName: true, lastName: true } } },
      }),
      prisma.task.findMany({
        where: { applicationId, isRequired: true, status: "APPROVED" },
        select: { title: true },
      }),
    ]);
    if (!application) return;

    const recipients = await prisma.user.findMany({
      where: {
        role: "STAFF",
        isActive: true,
        OR: [
          { isGlobalAdmin: true },
          {
            staffPermissions: {
              some: { permissionKey: "REVIEW_TASK_SUBMISSIONS", granted: true },
            },
          },
        ],
      },
      select: { email: true },
    });
    if (recipients.length === 0) return;

    const studentName = `${application.student.firstName} ${application.student.lastName}`;
    const taskList = renderTaskListHtml(completedTasks);
    const applicantUrl = buildAppUrl(`/admin/applicants/${applicationId}`);

    await Promise.allSettled(
      recipients.map((r) =>
        sendTemplatedEmail("TASKS_ALL_COMPLETE_ADMIN", r.email, {
          studentName,
          taskList,
          applicantUrl,
        })
      )
    );
  } catch (err) {
    console.error("notifyAdminsOfAllTasksComplete failed", err);
  }
}

export async function notifyAdminsOfAccountDeletionRequest(
  applicationId: string,
  studentName: string,
  studentEmail: string
): Promise<void> {
  try {
    if (!(await isEmailNotificationsEnabled())) return;

    const recipients = await prisma.user.findMany({
      where: {
        role: "STAFF",
        isActive: true,
        OR: [
          { isGlobalAdmin: true },
          { staffPermissions: { some: { permissionKey: "WITHDRAW_APPLICATION", granted: true } } },
        ],
      },
      select: { email: true },
    });
    if (recipients.length === 0) return;

    const applicantUrl = buildAppUrl(`/admin/applicants/${applicationId}`);

    await Promise.allSettled(
      recipients.map((r) =>
        sendTemplatedEmail("ACCOUNT_DELETION_REQUESTED", r.email, {
          studentName,
          studentEmail,
          applicantUrl,
        })
      )
    );
  } catch (err) {
    console.error("notifyAdminsOfAccountDeletionRequest failed", err);
  }
}

export async function notifyAdminsOfBankTransferSubmitted(applicationId: string): Promise<void> {
  try {
    if (!(await isEmailNotificationsEnabled())) return;

    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      select: { student: { select: { firstName: true, lastName: true } } },
    });
    if (!application) return;

    const recipients = await prisma.user.findMany({
      where: {
        role: "STAFF",
        isActive: true,
        OR: [
          { isGlobalAdmin: true },
          { staffPermissions: { some: { permissionKey: "ADVANCE_APPLICATION_STAGE", granted: true } } },
        ],
      },
      select: { email: true },
    });
    if (recipients.length === 0) return;

    const studentName = `${application.student.firstName} ${application.student.lastName}`;
    const applicantUrl = buildAppUrl(`/admin/applicants/${applicationId}`);

    await Promise.allSettled(
      recipients.map((r) =>
        sendTemplatedEmail("BANK_TRANSFER_SUBMITTED_ADMIN", r.email, { studentName, applicantUrl })
      )
    );
  } catch (err) {
    console.error("notifyAdminsOfBankTransferSubmitted failed", err);
  }
}

export async function notifyStudentOfBankTransferApproved(applicationId: string): Promise<void> {
  try {
    if (!(await isEmailNotificationsEnabled())) return;

    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      select: { student: { select: { email: true, firstName: true } } },
    });
    if (!application) return;

    await sendTemplatedEmail("BANK_TRANSFER_APPROVED", application.student.email, {
      firstName: application.student.firstName,
      portalUrl: buildAppUrl("/offer"),
    });
  } catch (err) {
    console.error("notifyStudentOfBankTransferApproved failed", err);
  }
}
