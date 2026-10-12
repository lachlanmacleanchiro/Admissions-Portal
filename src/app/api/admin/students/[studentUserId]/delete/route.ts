import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissionGuard } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { getStorageProvider } from "@/lib/storage";
import { NextRequest, NextResponse } from "next/server";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ studentUserId: string }> }) {
  const { studentUserId } = await params;
  const session = await auth();
  const guard = permissionGuard(session, "WITHDRAW_APPLICATION");
  if (guard) return guard;

  const student = await prisma.user.findUnique({
    where: { id: studentUserId },
    select: { id: true, role: true, firstName: true, lastName: true, email: true, deletionRequestedAt: true },
  });
  if (!student || student.role !== "STUDENT") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const application = await prisma.application.findUnique({
    where: { studentId: studentUserId },
    select: { id: true },
  });

  const documentKeys: string[] = [];

  if (application) {
    const documents = await prisma.document.findMany({
      where: { applicationId: application.id },
      select: { storageKey: true },
    });
    documentKeys.push(...documents.map((d) => d.storageKey));

    await prisma.$transaction([
      prisma.message.deleteMany({ where: { thread: { applicationId: application.id } } }),
      prisma.mailMessage.deleteMany({ where: { thread: { applicationId: application.id } } }),
      prisma.mailThread.deleteMany({ where: { applicationId: application.id } }),
      prisma.documentSend.deleteMany({ where: { applicationId: application.id } }),
      prisma.prerequisiteCourse.deleteMany({ where: { applicationId: application.id } }),
      prisma.document.deleteMany({ where: { applicationId: application.id } }),
      prisma.offerCondition.deleteMany({ where: { offer: { applicationId: application.id } } }),
      prisma.offer.deleteMany({ where: { applicationId: application.id } }),
      prisma.task.deleteMany({ where: { applicationId: application.id } }),
      prisma.staffTask.updateMany({ where: { applicationId: application.id }, data: { applicationId: null } }),
      prisma.note.deleteMany({ where: { applicationId: application.id } }),
      prisma.timelineEvent.deleteMany({ where: { applicationId: application.id } }),
      prisma.applicationStageHistory.deleteMany({ where: { applicationId: application.id } }),
      prisma.auditLog.updateMany({ where: { applicationId: application.id }, data: { applicationId: null } }),
      prisma.educationHistoryEntry.deleteMany({ where: { applicationId: application.id } }),
      prisma.chiropracticExperienceEntry.deleteMany({ where: { applicationId: application.id } }),
      prisma.interviewReview.deleteMany({ where: { applicationId: application.id } }),
      prisma.essayReview.deleteMany({ where: { applicationId: application.id } }),
      prisma.committeeDecision.deleteMany({ where: { applicationId: application.id } }),
      prisma.internationalCompliance.deleteMany({ where: { applicationId: application.id } }),
      prisma.messageThread.deleteMany({ where: { applicationId: application.id } }),
      prisma.application.delete({ where: { id: application.id } }),
    ]);
  }

  await prisma.auditLog.updateMany({ where: { userId: studentUserId }, data: { userId: null } });
  await prisma.user.delete({ where: { id: studentUserId } });

  // Logged only after the deletion succeeds, unattached to the (now-gone) application.
  const context = student.deletionRequestedAt
    ? "following their deletion request"
    : "initiated by staff (no student request)";
  await logAudit({
    objectType: "User",
    objectId: studentUserId,
    action: "DELETE",
    actionDetail: `Deleted account for ${student.firstName} ${student.lastName} (${student.email}) ${context}`,
    userId: session!.user.id,
  });

  const storage = getStorageProvider();
  await Promise.allSettled(documentKeys.map((key) => storage.delete(key)));

  return NextResponse.json({ success: true });
}
