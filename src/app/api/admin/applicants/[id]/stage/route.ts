import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissionGuard, hasPermission } from "@/lib/permissions";
import { createTimelineEvent, STAGE_ORDER } from "@/lib/timeline";
import { generateTasksForStage } from "@/lib/taskTemplates";
import { notifyStudentOfNewTasks, notifyStudentOfStageChange } from "@/lib/notifications";
import { logAudit } from "@/lib/audit";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const guard = permissionGuard(session, "ADVANCE_APPLICATION_STAGE");
  if (guard) return guard;

  const body = await req.json();
  const nextStage = body.toStage ?? body.stage;
  const notes: string = body.notes ?? "";
  // IDs of open tasks (from other stages) the staff member chose to mark complete now.
  const completeTaskIds: string[] = Array.isArray(body.completeTaskIds) ? body.completeTaskIds : [];
  // IDs of already-existing tasks for the target stage the staff member chose to reset (re-do), rather than keep.
  const resetTaskIds: string[] = Array.isArray(body.resetTaskIds) ? body.resetTaskIds : [];
  const notifyStudent: boolean = body.notifyStudent ?? true;
  // templateId → staff user id ("" = unassigned) for the tasks this stage creates.
  // Only honoured for staff who can assign tasks; otherwise template defaults apply.
  const assignments: Record<string, string> =
    hasPermission(session, "ASSIGN_TASKS") && body.assignments && typeof body.assignments === "object"
      ? Object.fromEntries(
          Object.entries(body.assignments as Record<string, unknown>).filter(
            (entry): entry is [string, string] => typeof entry[1] === "string"
          )
        )
      : {};

  const app = await prisma.application.findUnique({ where: { id }, select: { currentStage: true } });
  if (!app) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!STAGE_ORDER.includes(nextStage)) {
    return NextResponse.json({ error: "Invalid stage" }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.application.update({ where: { id }, data: { currentStage: nextStage } }),
    prisma.applicationStageHistory.create({
      data: {
        applicationId: id,
        fromStage: app.currentStage,
        toStage: nextStage,
        advancedById: session!.user.id,
        notes,
      },
    }),
    ...(completeTaskIds.length > 0
      ? [
          prisma.task.updateMany({
            where: { id: { in: completeTaskIds }, applicationId: id },
            data: { status: "APPROVED", completedAt: new Date() },
          }),
        ]
      : []),
    ...(resetTaskIds.length > 0
      ? [
          prisma.task.updateMany({
            where: { id: { in: resetTaskIds }, applicationId: id },
            data: { status: "PENDING", completedAt: null, reviewedAt: null, reviewNote: null },
          }),
        ]
      : []),
  ]);

  const newTasks = await generateTasksForStage(id, nextStage, session!.user.id, assignments);

  await createTimelineEvent({
    applicationId: id,
    eventType: "STAGE_CHANGE",
    title: `Stage Advanced`,
    description: [
      `Moved from ${app.currentStage.replace(/_/g, " ")} to ${nextStage.replace(/_/g, " ")}`,
      notes ? `Note: ${notes}` : "",
    ].filter(Boolean).join(" · "),
    isVisibleToStudent: true,
    createdById: session!.user.id,
  });

  if (notifyStudent) {
    await notifyStudentOfNewTasks(id, newTasks);
    await notifyStudentOfStageChange(id, nextStage);
  }

  await logAudit({
    applicationId: id,
    objectType: "Application",
    objectId: id,
    action: "UPDATE",
    actionDetail: `Stage changed from ${app.currentStage} to ${nextStage}${notes ? ` — ${notes}` : ""}`,
    userId: session!.user.id,
  });

  return NextResponse.json({ success: true, stage: nextStage });
}
