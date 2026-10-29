import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissionGuard } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const guard = permissionGuard(session, "ADVANCE_APPLICATION_STAGE");
  if (guard) return guard;

  const { score, notes } = await req.json();

  if (score !== undefined && score !== null && (score < 0 || score > 100)) {
    return NextResponse.json({ error: "Score must be between 0 and 100." }, { status: 400 });
  }

  const application = await prisma.application.findUnique({ where: { id }, select: { id: true } });
  if (!application) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const review = await prisma.essayReview.upsert({
    where: { applicationId: id },
    update: { score, notes, reviewedById: session!.user.id },
    create: { applicationId: id, score, notes, reviewedById: session!.user.id },
  });

  await logAudit({
    applicationId: id,
    objectType: "EssayReview",
    objectId: review.id,
    action: "UPDATE",
    actionDetail: `Essay review updated${score != null ? ` — score ${score}%` : ""}`,
    userId: session!.user.id,
  });

  return NextResponse.json({ review });
}
