import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissionGuard } from "@/lib/permissions";
import { createTimelineEvent } from "@/lib/timeline";
import { notifyStudentOfNewTasks } from "@/lib/notifications";
import { logAudit } from "@/lib/audit";
import { filterActiveStaffIds } from "@/lib/staff";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const guard = permissionGuard(session, "ASSIGN_TASKS");
  if (guard) return guard;

  const { title, description, dueDate, isRequired, requiresDocument, documentInstructions, requiredDocumentCategory, assignedToId } = await req.json();

  if (!title?.trim()) return NextResponse.json({ error: "Title required" }, { status: 400 });

  const assignee = typeof assignedToId === "string" && assignedToId ? assignedToId : null;
  if (assignee && !(await filterActiveStaffIds([assignee])).has(assignee)) {
    return NextResponse.json({ error: "Tasks can only be assigned to active staff members." }, { status: 400 });
  }

  const task = await prisma.task.create({
    data: {
      applicationId: id,
      title,
      description,
      dueDate: dueDate ? new Date(dueDate) : null,
      isRequired: !!isRequired,
      requiresDocument: !!requiresDocument,
      documentInstructions,
      requiredDocumentCategory: requiresDocument ? (requiredDocumentCategory ?? "ANY") : "ANY",
      assignedById: session!.user.id,
      assignedToId: assignee,
    },
  });

  await createTimelineEvent({
    applicationId: id,
    eventType: "TASK_ASSIGNED",
    title: `Task Assigned: ${title}`,
    description: "A new task has been assigned to you.",
    isVisibleToStudent: true,
    relatedTaskId: task.id,
    createdById: session!.user.id,
  });

  await notifyStudentOfNewTasks(id, [task]);

  await logAudit({
    applicationId: id,
    objectType: "Task",
    objectId: task.id,
    action: "CREATE",
    actionDetail: `Task "${title}" created and assigned`,
    userId: session!.user.id,
  });

  return NextResponse.json(task, { status: 201 });
}
