import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissionGuard } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { NextRequest, NextResponse } from "next/server";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const guard = permissionGuard(session, "VIEW_APPLICANTS");
  if (guard) return guard;

  const courses = await prisma.prerequisiteCourse.findMany({
    where: { applicationId: id },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ courses });
}

interface CourseInput {
  nzccCourseCode: string;
  equivalentCourseCode?: string | null;
  grade?: string | null;
  institution?: string | null;
  year?: number | null;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const guard = permissionGuard(session, "EDIT_APPLICANT_PROFILE");
  if (guard) return guard;

  const { prerequisitesMet, prerequisiteNotes, courses, gpaScore: rawGpaScore } = await req.json();

  const gpaScore = rawGpaScore === undefined ? undefined
    : rawGpaScore === null || rawGpaScore === "" ? null
    : parseFloat(rawGpaScore);
  if (typeof gpaScore === "number" && Number.isNaN(gpaScore)) {
    return NextResponse.json({ error: "Overall Grade Average must be a number." }, { status: 400 });
  }

  const application = await prisma.application.findUnique({ where: { id }, select: { id: true } });
  if (!application) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const courseRows: CourseInput[] = Array.isArray(courses)
    ? courses.filter((c: CourseInput) => c.nzccCourseCode?.trim())
    : [];

  await prisma.$transaction([
    prisma.application.update({
      where: { id },
      data: {
        prerequisitesMet: prerequisitesMet !== undefined ? !!prerequisitesMet : undefined,
        prerequisiteNotes: prerequisiteNotes !== undefined ? prerequisiteNotes : undefined,
        gpaScore,
      },
    }),
    ...(Array.isArray(courses)
      ? [
          prisma.prerequisiteCourse.deleteMany({ where: { applicationId: id } }),
          ...(courseRows.length > 0
            ? [
                prisma.prerequisiteCourse.createMany({
                  data: courseRows.map((c) => ({
                    applicationId: id,
                    nzccCourseCode: c.nzccCourseCode,
                    equivalentCourseCode: c.equivalentCourseCode || null,
                    grade: c.grade || null,
                    institution: c.institution || null,
                    year: c.year ?? null,
                  })),
                }),
              ]
            : []),
        ]
      : []),
  ]);

  await logAudit({
    applicationId: id,
    objectType: "Application",
    objectId: id,
    action: "UPDATE",
    actionDetail: "Prerequisites updated",
    userId: session!.user.id,
  });

  return NextResponse.json({ success: true });
}
