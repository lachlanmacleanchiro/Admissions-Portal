import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

// Returns the "Admissions team" chat and marks staff messages in it as read,
// unless ?peek=1 (used when refreshing the inbox while another conversation is open).
export async function GET(req: Request) {
  const markRead = new URL(req.url).searchParams.get("peek") !== "1";
  const session = await auth();
  if (!session?.user || session.user.role !== "STUDENT") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const application = await prisma.application.findUnique({
    where: { studentId: session.user.id },
    select: { id: true },
  });
  if (!application) return Response.json({ error: "Not found" }, { status: 404 });

  const thread = await prisma.messageThread.findUnique({
    where: { applicationId: application.id },
    include: {
      messages: {
        orderBy: { sentAt: "asc" },
        include: { sender: { select: { firstName: true, lastName: true } } },
      },
    },
  });

  if (thread && markRead) {
    await prisma.message.updateMany({
      where: { threadId: thread.id, senderRole: "STAFF", isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  return Response.json({ messages: thread?.messages ?? [] });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "STUDENT") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const application = await prisma.application.findUnique({
    where: { studentId: session.user.id },
    select: { id: true },
  });
  if (!application) return Response.json({ error: "Not found" }, { status: 404 });

  const { body } = await req.json();
  if (!body?.trim()) return Response.json({ error: "Message body required." }, { status: 400 });

  const thread = await prisma.messageThread.upsert({
    where: { applicationId: application.id },
    create: { applicationId: application.id },
    update: { updatedAt: new Date() },
  });

  const message = await prisma.message.create({
    data: {
      threadId: thread.id,
      senderRole: "STUDENT",
      senderId: session.user.id,
      body,
    },
  });

  await logAudit({
    applicationId: application.id,
    objectType: "Message",
    objectId: message.id,
    action: "CREATE",
    actionDetail: "Student sent a message",
    userId: session.user.id,
  });

  return Response.json(message, { status: 201 });
}
