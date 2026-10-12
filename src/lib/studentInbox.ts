import { prisma } from "@/lib/prisma";
import { getMessagingMode } from "@/lib/messaging";

/**
 * Unread staff messages for an application in the messaging style the portal
 * currently shows (chat or threads), so badges never point at a hidden widget.
 */
export async function countUnreadForStudent(applicationId: string): Promise<number> {
  const mode = await getMessagingMode();
  if (mode === "THREADS") {
    return prisma.mailMessage.count({
      where: { thread: { applicationId }, senderRole: "STAFF", isRead: false },
    });
  }
  return prisma.message.count({
    where: { thread: { applicationId }, senderRole: "STAFF", isRead: false },
  });
}
