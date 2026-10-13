import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissionGuard } from "@/lib/permissions";
import { createTimelineEvent } from "@/lib/timeline";
import { notifyAdminsOfAllTasksComplete, notifyStudentOfDocumentRejection } from "@/lib/notifications";
import { logAudit } from "@/lib/audit";
import { filterActiveStaffIds } from "@/lib/staff";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; taskId: string }> }) {
  const { id, taskId } = await params;
  const session = await auth();
  const body = await req.json();
  const { action } = body;

  const task = await prisma.task.findUnique({ where: { id: taskId, applicationId: id } });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (action === "approve" || action === "reject") {
    const guard = permissionGuard(session, "REVIEW_TASK_SUBMISSIONS");
    if (guard) return guard;

    const reviewNote = body.reviewNote;
    const newStatus = action === "approve" ? "APPROVED" : "REJECTED";
    const linkedDocuments = await prisma.document.findMany({ where: { taskId } });

    await prisma.$transaction([
      prisma.task.update({
        where: { id: taskId },
        data: {
          status: newStatus,
          reviewNote,
          reviewedAt: new Date(),
          reviewedById: session!.user.id,
          acknowledgedAt: task.acknowledgedAt ?? new Date(),
          acknowledgedById: task.acknowledgedById ?? session!.user.id,
        },
      }),
      ...(linkedDocuments.length > 0
        ? [
            prisma.document.updateMany({
              where: { taskId },
              data: {
                status: action === "approve" ? "VERIFIED" : "REJECTED",
                verificationNote: reviewNote,
                verifiedById: action === "approve" ? session!.user.id : null,
              },
            }),
          ]
        : []),
    ]);

    if (action === "reject") {
      for (const doc of linkedDocuments) {
        await notifyStudentOfDocumentRejection(id, doc.filename, reviewNote ?? null);
      }
    }

    await createTimelineEvent({
      applicationId: id,
      eventType: action === "approve" ? "TASK_COMPLETED" : "NOTE_ADDED",
      title: `Task ${action === "approve" ? "Approved" : "Rejected"}: ${task.title}`,
      description: reviewNote || undefined,
      isVisibleToStudent: task.audience === "STUDENT",
      relatedTaskId: taskId,
      createdById: session!.user.id,
    });

    if (newStatus === "APPROVED") {
      const remaining = await prisma.task.count({
        where: { applicationId: id, isRequired: true, status: { not: "APPROVED" } },
      });
      if (remaining === 0) await notifyAdminsOfAllTasksComplete(id);
    }

    await logAudit({
      applicationId: id,
      objectType: "Task",
      objectId: taskId,
      action: "UPDATE",
      actionDetail: `Task "${task.title}" ${action === "approve" ? "approved" : "rejected"}${reviewNote ? ` — ${reviewNote}` : ""}`,
      userId: session!.user.id,
    });

    return NextResponse.json({ success: true });
  }

  if (action === "acknowledge") {
    const guard = permissionGuard(session, "REVIEW_TASK_SUBMISSIONS");
    if (guard) return guard;

    await prisma.task.update({
      where: { id: taskId },
      data: { acknowledgedAt: new Date(), acknowledgedById: session!.user.id },
    });

    await logAudit({
      applicationId: id,
      objectType: "Task",
      objectId: taskId,
      action: "UPDATE",
      actionDetail: `Task "${task.title}" acknowledged`,
      userId: session!.user.id,
    });

    return NextResponse.json({ success: true });
  }

  if (action === "toggle-complete") {
    // Staff who can manage tasks, or the staff member the task is assigned to.
    const isAssignee = session?.user?.role === "STAFF" && task.assignedToId === session.user.id;
    if (!isAssignee) {
      const guard = permissionGuard(session, "ASSIGN_TASKS");
      if (guard) return guard;
    }

    const isNowComplete = task.status !== "APPROVED";

    await prisma.task.update({
      where: { id: taskId },
      data: isNowComplete
        ? { status: "APPROVED", completedAt: new Date(), reviewedAt: new Date(), reviewedById: session!.user.id }
        : { status: "PENDING", completedAt: null, reviewedAt: null, reviewedById: null },
    });

    if (isNowComplete) {
      await createTimelineEvent({
        applicationId: id,
        eventType: "TASK_COMPLETED",
        title: `Task completed: ${task.title}`,
        isVisibleToStudent: task.audience === "STUDENT",
        relatedTaskId: taskId,
        createdById: session!.user.id,
      });

      const remaining = await prisma.task.count({
        where: { applicationId: id, isRequired: true, status: { not: "APPROVED" } },
      });
      if (remaining === 0) await notifyAdminsOfAllTasksComplete(id);
    }

    await logAudit({
      applicationId: id,
      objectType: "Task",
      objectId: taskId,
      action: "UPDATE",
      actionDetail: `Task "${task.title}" marked ${isNowComplete ? "complete" : "incomplete"}`,
      userId: session!.user.id,
    });

    return NextResponse.json({ success: true });
  }

  if (action === "assign") {
    const guard = permissionGuard(session, "ASSIGN_TASKS");
    if (guard) return guard;

    const assignedToId: string | null = body.assignedToId || null;
    if (assignedToId && !(await filterActiveStaffIds([assignedToId])).has(assignedToId)) {
      return NextResponse.json({ error: "Tasks can only be assigned to active staff members." }, { status: 400 });
    }

    await prisma.task.update({ where: { id: taskId }, data: { assignedToId } });

    await logAudit({
      applicationId: id,
      objectType: "Task",
      objectId: taskId,
      action: "UPDATE",
      actionDetail: `Task "${task.title}" reassigned`,
      userId: session!.user.id,
    });

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; taskId: string }> }) {
  const { id, taskId } = await params;
  const session = await auth();
  const guard = permissionGuard(session, "DELETE_TASKS");
  if (guard) return guard;

  const task = await prisma.task.findUnique({ where: { id: taskId, applicationId: id } });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    await prisma.task.delete({ where: { id: taskId } });
  } catch {
    return NextResponse.json(
      { error: "This task has documents attached and can't be deleted." },
      { status: 409 }
    );
  }

  await logAudit({
    applicationId: id,
    objectType: "Task",
    objectId: taskId,
    action: "DELETE",
    actionDetail: `Task "${task.title}" deleted`,
    userId: session!.user.id,
  });

  return NextResponse.json({ success: true });
}
