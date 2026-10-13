import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// Body: { action: "complete" | "reopen" }. Allowed for the assignee or whoever created the to-do.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  const session = await auth();
  if (!session?.user || session.user.role !== "STAFF") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const task = await prisma.staffTask.findUnique({ where: { id: taskId } });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (task.assignedToId !== session.user.id && task.createdById !== session.user.id) {
    return NextResponse.json({ error: "Only the assignee or creator can update this task." }, { status: 403 });
  }

  const { action } = await req.json();
  if (action !== "complete" && action !== "reopen") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const updated = await prisma.staffTask.update({
    where: { id: taskId },
    data: action === "complete"
      ? { status: "COMPLETE", completedAt: new Date() }
      : { status: "PENDING", completedAt: null },
  });

  return NextResponse.json(updated);
}
