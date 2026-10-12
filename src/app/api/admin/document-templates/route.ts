import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { STAGE_ORDER } from "@/lib/stages";
import type { ApplicationStageKey } from "@/generated/prisma/client";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.isGlobalAdmin) return new NextResponse(null, { status: 403 });

  const { stageKey, name, subject, bodyMarkdown } = await req.json();

  if (!STAGE_ORDER.includes(stageKey)) {
    return NextResponse.json({ error: "Choose a stage for this template." }, { status: 400 });
  }
  if (!name?.trim() || !subject?.trim() || !bodyMarkdown?.trim()) {
    return NextResponse.json({ error: "Name, email subject, and body are required." }, { status: 400 });
  }

  const maxSortOrder = await prisma.documentTemplate.aggregate({
    where: { stageKey },
    _max: { sortOrder: true },
  });

  const template = await prisma.documentTemplate.create({
    data: {
      stageKey: stageKey as ApplicationStageKey,
      name: name.trim(),
      subject: subject.trim(),
      bodyMarkdown,
      sortOrder: (maxSortOrder._max.sortOrder ?? -1) + 1,
      createdById: session.user.id,
      updatedById: session.user.id,
    },
  });

  await logAudit({
    objectType: "DocumentTemplate",
    objectId: template.id,
    action: "CREATE",
    actionDetail: `Created document template "${template.name}"`,
    userId: session.user.id,
  });

  return NextResponse.json(template, { status: 201 });
}
