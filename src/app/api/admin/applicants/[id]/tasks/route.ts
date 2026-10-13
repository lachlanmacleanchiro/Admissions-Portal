import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissionGuard } from "@/lib/permissions";
import { createTimelineEvent } from "@/lib/timeline";
import { notifyStudentOfNewTasks } from "@/lib/notifications";
import { logAudit } from "@/lib/audit";
import { filterActiveStaffIds } from "@/lib/staff";
import { NextRequest, NextResponse } from "next/server";

// Body.audience: "STAFF" = internal task (never shown to the student),
// "STUDENT" = shown in the student's My Tasks. assignedToId is the staff member
// doing (internal) or following up (student) the task.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const guard = permissionGuard(session, "ASSIGN_TASKS");
  if (guard) return guard;

  const { title, description, dueDate, isRequired, requiresDocument, documentInstructions, requiredDocumentCategory, assignedToId, audience } = await req.json();

  if (!title?.trim()) return NextResponse.json({ error: "Title required" }, { status: 400 });
  if (audience !== "STAFF" && audience !== "STUDENT") {
    return NextResponse.json({ error: "Choose whether this is an internal task or a student task." }, { status: 400 });
  }
  const isStudentTask = audience === "STUDENT";

  const assignee = typeof assignedToId === "string" && assignedToId ? assignedToId : null;
  if (assignee && !(await filterActiveStaffIds([assignee])).has(assignee)) {
    return NextResponse.json({ error: "Tasks can only be assigned to active staff members." }, { status: 400 });
  }

  const withDocument = isStudentTask && !!requiresDocument;
  const task = await prisma.task.create({
    data: {
      applicationId: id,
      title: title.trim(),
      description,
      audience,
      dueDate: dueDate ? new Date(dueDate) : null,
      isRequired: isStudentTask ? !!isRequired : true,
      requiresDocument: withDocument,
      documentInstructions: withDocument ? documentInstructions : null,
      requiredDocumentCategory: withDocument ? (requiredDocumentCategory ?? "ANY") : "ANY",
      assignedById: session!.user.id,
      assignedToId: assignee,
    },
  });

  await createTimelineEvent({
    applicationId: id,
    eventType: "TASK_ASSIGNED",
    title: `${isStudentTask ? "Task Assigned" : "Internal task created"}: ${task.title}`,
    description: isStudentTask ? "A new task has been assigned to you." : undefined,
    // Internal tasks must never appear in the student's timeline.
    isVisibleToStudent: isStudentTask,
    relatedTaskId: task.id,
    createdById: session!.user.id,
  });

  // Only emails the student for student tasks.
  await notifyStudentOfNewTasks(id, [task]);

  await logAudit({
    applicationId: id,
    objectType: "Task",
    objectId: task.id,
    action: "CREATE",
    actionDetail: `${isStudentTask ? "Student" : "Internal"} task "${task.title}" created`,
    userId: session!.user.id,
  });

  return NextResponse.json(task, { status: 201 });
}
