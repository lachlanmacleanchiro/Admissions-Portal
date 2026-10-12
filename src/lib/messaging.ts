import { prisma } from "@/lib/prisma";
import type { MessagingMode } from "@/generated/prisma/client";

/**
 * Which messaging style the portal shows (Settings → Communication).
 * Only controls which widget is displayed — both styles' routes and messages are kept.
 */
export async function getMessagingMode(): Promise<MessagingMode> {
  const settings = await prisma.appSettings.findUnique({
    where: { id: "singleton" },
    select: { messagingMode: true },
  });
  return settings?.messagingMode ?? "CHAT";
}
