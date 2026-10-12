import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { STAGE_ORDER } from "@/lib/stages";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ templateId: string }> }) {
  const { templateId } = await params;
  const session = await auth();
  if (!session?.user?.isGlobalAdmin) return new NextResponse(null, { status: 403 });

  const existing = await prisma.documentTemplate.findUnique({ where: { id: templateId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { stageKey, name, subject, bodyMarkdown, isActive } = await req.json();

  if (stageKey !== undefined && !STAGE_ORDER.includes(stageKey)) {
    return NextResponse.json({ error: "Invalid stage." }, { status: 400 });
  }
  for (const [label, value] of [["Name", name], ["Email subject", subject], ["Body", bodyMarkdown]] as const) {
    if (value !== undefined && !String(value).trim()) {
      return NextResponse.json({ error: `${label} can't be empty.` }, { status: 400 });
    }
  }

  const template = await prisma.documentTemplate.update({
    where: { id: templateId },
    data: {
      ...(stageKey !== undefined ? { stageKey } : {}),
      ...(name !== undefined ? { name: name.trim() } : {}),
      ...(subject !== undefined ? { subject: subject.trim() } : {}),
      ...(bodyMarkdown !== undefined ? { bodyMarkdown } : {}),
      ...(isActive !== undefined ? { isActive: !!isActive } : {}),
      updatedById: session.user.id,
    },
  });

  await logAudit({
    objectType: "DocumentTemplate",
    objectId: templateId,
    action: "UPDATE",
    actionDetail: `Updated document template "${template.name}"`,
    userId: session.user.id,
  });

  return NextResponse.json(template);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ templateId: string }> }) {
  const { templateId } = await params;
  const session = await auth();
  if (!session?.user?.isGlobalAdmin) return new NextResponse(null, { status: 403 });

  const existing = await prisma.documentTemplate.findUnique({ where: { id: templateId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Past sends keep their own copy of the subject/body; their templateId is set to null.
  await prisma.documentTemplate.delete({ where: { id: templateId } });

  await logAudit({
    objectType: "DocumentTemplate",
    objectId: templateId,
    action: "DELETE",
    actionDetail: `Deleted document template "${existing.name}"`,
    userId: session.user.id,
  });

  return NextResponse.json({ success: true });
}
