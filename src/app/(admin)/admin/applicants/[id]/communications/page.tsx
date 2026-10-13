import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { getMessagingMode } from "@/lib/messaging";
import { MessagesChatWidget } from "../MessagesChatWidget";
import { MailThreadsPanel } from "@/components/shared/MailThreadsPanel";

// Communications tab: the applicant conversation, in the style chosen in
// Settings → Communication (Chat or Threads).
export default async function ApplicantCommunicationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user || session.user.role !== "STAFF") redirect("/login");
  requirePermission(session, "SEND_MESSAGES");

  const [app, messagingMode] = await Promise.all([
    prisma.application.findUnique({
      where: { id },
      select: {
        id: true,
        student: { select: { firstName: true } },
        messageThread: { include: { messages: { orderBy: { sentAt: "asc" } } } },
      },
    }),
    getMessagingMode(),
  ]);
  if (!app) notFound();

  // Staff viewing the conversation counts as reading it (drives the student's "Seen" receipts).
  if (messagingMode === "CHAT" && app.messageThread) {
    await prisma.message.updateMany({
      where: { threadId: app.messageThread.id, senderRole: "STUDENT", isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  return messagingMode === "CHAT" ? (
    <MessagesChatWidget applicationId={id} studentFirstName={app.student.firstName} thread={app.messageThread ?? null} />
  ) : (
    <MailThreadsPanel
      baseUrl={`/api/admin/applicants/${id}/mail-threads`}
      viewerRole="STAFF"
      composerLabel={`Message ${app.student.firstName}…`}
    />
  );
}
