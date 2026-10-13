import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissionGuard } from "@/lib/permissions";
import { filterActiveStaffIds } from "@/lib/staff";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const session = await auth();
  const guard = permissionGuard(session, "MANAGE_OWN_TASKS");
  if (guard) return guard;

  const { title, description, dueDate, assignedToId } = await req.json();

  if (!title?.trim()) return NextResponse.json({ error: "Title required" }, { status: 400 });

  const assignee = typeof assignedToId === "string" && assignedToId ? assignedToId : session!.user.id;
  if (!(await filterActiveStaffIds([assignee])).has(assignee)) {
    return NextResponse.json({ error: "Tasks can only be assigned to active staff members." }, { status: 400 });
  }

  const task = await prisma.staffTask.create({
    data: {
      assignedToId: assignee,
      createdById: session!.user.id,
      title: title.trim(),
      description,
      dueDate: dueDate ? new Date(dueDate) : null,
    },
  });

  return NextResponse.json(task, { status: 201 });
}
