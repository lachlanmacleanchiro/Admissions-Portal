import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { filterActiveStaffIds } from "@/lib/staff";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ templateId: string }> }) {
  const { templateId } = await params;
  const session = await auth();
  if (!session?.user?.isGlobalAdmin) return new NextResponse(null, { status: 403 });

  const { title, description, audience, isActive, dueDays, requiresDocument, documentInstructions, requiredDocumentCategory, defaultAssigneeId } = await req.json();

  if (typeof defaultAssigneeId === "string" && defaultAssigneeId && !(await filterActiveStaffIds([defaultAssigneeId])).has(defaultAssigneeId)) {
    return NextResponse.json({ error: "The default assignee must be an active staff member." }, { status: 400 });
  }

  const template = await prisma.taskTemplate.update({
    where: { id: templateId },
    data: {
      ...(title !== undefined ? { title } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(audience !== undefined ? { audience } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
      ...(defaultAssigneeId !== undefined ? { defaultAssigneeId: defaultAssigneeId || null } : {}),
      ...(dueDays !== undefined ? { dueDays: dueDays === "" || dueDays == null ? null : parseInt(dueDays, 10) } : {}),
      ...(requiresDocument !== undefined ? { requiresDocument: !!requiresDocument } : {}),
      ...(documentInstructions !== undefined ? { documentInstructions: requiresDocument ? documentInstructions : null } : {}),
      ...(requiredDocumentCategory !== undefined ? { requiredDocumentCategory: requiresDocument ? requiredDocumentCategory : "ANY" } : {}),
    },
  });

  return NextResponse.json(template);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ templateId: string }> }) {
  const { templateId } = await params;
  const session = await auth();
  if (!session?.user?.isGlobalAdmin) return new NextResponse(null, { status: 403 });

  await prisma.taskTemplate.delete({ where: { id: templateId } });

  return NextResponse.json({ success: true });
}
