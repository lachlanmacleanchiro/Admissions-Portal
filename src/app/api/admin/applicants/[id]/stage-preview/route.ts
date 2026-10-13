import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissionGuard, hasPermission } from "@/lib/permissions";
import { STAGE_ORDER } from "@/lib/stages";
import { getTemplatesToGenerate } from "@/lib/taskTemplates";
import { getAssignableStaff } from "@/lib/staff";
import type { ApplicationStageKey } from "@/generated/prisma/client";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const guard = permissionGuard(session, "ADVANCE_APPLICATION_STAGE");
  if (guard) return guard;

  const { toStage } = await req.json();
  if (!STAGE_ORDER.includes(toStage)) return NextResponse.json({ error: "Invalid stage" }, { status: 400 });
  const stage = toStage as ApplicationStageKey;

  const openStatuses = ["PENDING", "IN_PROGRESS", "SUBMITTED"] as const;
  const canAssign = hasPermission(session, "ASSIGN_TASKS");

  const [staleTasks, existingStageTasks, templates, staffOptions] = await Promise.all([
    // Open tasks tied to a different stage than the one we're moving to.
    prisma.task.findMany({
      where: {
        applicationId: id,
        status: { in: [...openStatuses] },
        stageKey: { not: stage },
      },
      select: { id: true, title: true, status: true, stageKey: true, audience: true },
      orderBy: { createdAt: "asc" },
    }),
    // Tasks already generated for the target stage (from a prior visit to this stage).
    prisma.task.findMany({
      where: { applicationId: id, stageKey: stage },
      select: { id: true, title: true, status: true, audience: true },
      orderBy: { createdAt: "asc" },
    }),
    // Tasks this stage change will create, so staff can assign them up front.
    getTemplatesToGenerate(id, stage),
    canAssign ? getAssignableStaff() : Promise.resolve([]),
  ]);

  return NextResponse.json({
    staleTasks,
    existingStageTasks,
    newTasks: templates.map((t) => ({
      templateId: t.id,
      title: t.title,
      audience: t.audience,
      defaultAssigneeId: t.defaultAssigneeId,
    })),
    canAssign,
    staffOptions,
  });
}
