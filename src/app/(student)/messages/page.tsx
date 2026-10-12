import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getMessagingMode } from "@/lib/messaging";
import { StudentInbox } from "./StudentInbox";

export default async function MessagesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const application = await prisma.application.findUnique({
    where: { studentId: session.user.id },
    select: { id: true },
  });

  if (!application) return <div className="p-8 text-text-muted">Application not found.</div>;

  // Preload only the style that's shown, for the first paint; the inbox marks
  // conversations read when it opens them.
  const mode = await getMessagingMode();
  const [chatThread, threads] = await Promise.all([
    mode === "CHAT"
      ? prisma.messageThread.findUnique({
          where: { applicationId: application.id },
          include: {
            messages: {
              orderBy: { sentAt: "asc" },
              include: { sender: { select: { firstName: true, lastName: true } } },
            },
          },
        })
      : null,
    mode === "THREADS"
      ? prisma.mailThread.findMany({
          where: { applicationId: application.id },
          orderBy: { updatedAt: "desc" },
          include: {
            messages: { orderBy: { sentAt: "desc" }, take: 1 },
            _count: { select: { messages: { where: { isRead: false, senderRole: "STAFF" } } } },
          },
        })
      : [],
  ]);

  return (
    <div className="px-8 py-8 max-w-5xl">
      <p className="text-xs font-semibold tracking-widest uppercase text-text-muted mb-1">Admissions Office</p>
      <h1 className="font-serif text-3xl text-text mb-2">Messages</h1>
      <p className="text-sm text-text-muted mb-6">
        {mode === "THREADS"
          ? "Message the NZCC admissions team about your application. Start a new conversation for each topic."
          : "Message the NZCC admissions team about your application."}
      </p>

      <StudentInbox
        mode={mode}
        initialChat={(chatThread?.messages ?? []).map((m) => ({
          id: m.id,
          senderRole: m.senderRole,
          body: m.body,
          sentAt: m.sentAt.toISOString(),
          isRead: m.isRead,
          sender: m.sender,
        }))}
        initialThreads={threads.map((t) => ({
          id: t.id,
          subject: t.subject,
          updatedAt: t.updatedAt.toISOString(),
          messages: t.messages.map((m) => ({
            id: m.id,
            senderRole: m.senderRole,
            body: m.body,
            sentAt: m.sentAt.toISOString(),
            isRead: m.isRead,
          })),
          _count: t._count,
        }))}
      />
    </div>
  );
}
