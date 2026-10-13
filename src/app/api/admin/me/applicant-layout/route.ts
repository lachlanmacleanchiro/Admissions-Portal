import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normaliseLayout, APPLICANT_WIDGETS } from "@/lib/applicantWidgets";
import { Prisma } from "@/generated/prisma/client";
import { NextRequest, NextResponse } from "next/server";

// Saves the signed-in staff member's applicant Overview layout.
// Body: { layout: [{ id, width: "full" | "half" }] } or { reset: true }.
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "STAFF") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));

  if (body.reset === true) {
    await prisma.user.update({ where: { id: session.user.id }, data: { applicantLayout: Prisma.DbNull } });
    return NextResponse.json({ layout: normaliseLayout(null) });
  }

  if (!Array.isArray(body.layout) || body.layout.length > APPLICANT_WIDGETS.length * 2) {
    return NextResponse.json({ error: "layout must be a list of widgets" }, { status: 400 });
  }

  const layout = normaliseLayout(body.layout);
  await prisma.user.update({ where: { id: session.user.id }, data: { applicantLayout: layout as unknown as Prisma.InputJsonValue } });

  return NextResponse.json({ layout });
}
