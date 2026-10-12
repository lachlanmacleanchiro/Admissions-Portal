import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import type { MessagingMode } from "@/generated/prisma/client";
import { NextRequest, NextResponse } from "next/server";

// Body: any of { emailNotificationsEnabled: boolean, messagingMode: "CHAT" | "THREADS" }
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "STAFF" || !session.user.isGlobalAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { emailNotificationsEnabled, messagingMode } = await req.json();

  if (emailNotificationsEnabled !== undefined && typeof emailNotificationsEnabled !== "boolean") {
    return NextResponse.json({ error: "emailNotificationsEnabled must be a boolean" }, { status: 400 });
  }
  if (messagingMode !== undefined && messagingMode !== "CHAT" && messagingMode !== "THREADS") {
    return NextResponse.json({ error: "messagingMode must be CHAT or THREADS" }, { status: 400 });
  }
  if (emailNotificationsEnabled === undefined && messagingMode === undefined) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const data = {
    ...(emailNotificationsEnabled !== undefined && { emailNotificationsEnabled }),
    ...(messagingMode !== undefined && { messagingMode: messagingMode as MessagingMode }),
  };

  await prisma.appSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ...data },
    update: data,
  });

  if (messagingMode !== undefined) {
    await logAudit({
      objectType: "AppSettings",
      objectId: "singleton",
      action: "UPDATE",
      actionDetail: `Messaging style set to ${messagingMode === "CHAT" ? "Chat" : "Threads"}`,
      userId: session.user.id,
    });
  }

  return NextResponse.json({ success: true });
}
