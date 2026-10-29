import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissionGuard } from "@/lib/permissions";
import { resolveIntakeFilter } from "@/lib/intakeYears";
import { STAGE_STATUS_LABELS } from "@/lib/stages";
import { NextRequest, NextResponse } from "next/server";
import type { ApplicationStageKey, Prisma } from "@/generated/prisma/client";

function csvCell(value: string | number | null | undefined): string {
  const str = value == null ? "" : String(value);
  return `"${str.replace(/"/g, '""')}"`;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  const guard = permissionGuard(session, "VIEW_APPLICANTS");
  if (guard) return guard;

  const searchParams = req.nextUrl.searchParams;
  const stage = searchParams.get("stage") ?? undefined;
  const type = searchParams.get("type") ?? undefined;
  const year = searchParams.get("year") ?? undefined;
  const search = searchParams.get("search") ?? undefined;
  const intake = searchParams.get("intake") ?? undefined;

  const intakeFilter = await resolveIntakeFilter(intake);

  const where: Prisma.ApplicationWhereInput = {
    ...intakeFilter.where,
    ...(stage ? { currentStage: stage as ApplicationStageKey } : {}),
    ...(type === "DOMESTIC" || type === "INTERNATIONAL" ? { category: type } : {}),
    ...(year === "YEAR_1" || year === "YEAR_2" ? { yearLevel: year } : {}),
    ...(search
      ? {
          OR: [
            { student: { firstName: { contains: search, mode: "insensitive" } } },
            { student: { lastName: { contains: search, mode: "insensitive" } } },
            { student: { email: { contains: search, mode: "insensitive" } } },
            { applicantNumber: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const applications = await prisma.application.findMany({
    where,
    orderBy: [{ student: { lastName: "asc" } }, { student: { firstName: "asc" } }],
    include: {
      student: { select: { firstName: true, lastName: true, email: true } },
      interviewReview: true,
      essayReview: true,
      internationalCompliance: true,
    },
  });

  const headers = [
    "Applicant Number",
    "First Name",
    "Last Name",
    "Email",
    "Category",
    "Year Level",
    "Stage",
    "GPA",
    "Prerequisites Met",
    "Interview Score (/30)",
    "Essay Score (%)",
    "Visa Status",
    "Health Insurance",
    "IELTS Status",
  ];

  const rows = applications.map((app) => [
    csvCell(app.applicantNumber),
    csvCell(app.student.firstName),
    csvCell(app.student.lastName),
    csvCell(app.student.email),
    csvCell(app.category),
    csvCell(app.yearLevel === "YEAR_1" ? "Year 1" : "Year 2"),
    csvCell(STAGE_STATUS_LABELS[app.currentStage]),
    csvCell(app.gpaScore?.toFixed(2) ?? ""),
    csvCell(app.prerequisitesMet ? "Yes" : "No"),
    csvCell(app.interviewReview?.score ?? ""),
    csvCell(app.essayReview?.score ?? ""),
    csvCell(app.internationalCompliance?.visaStatus ?? ""),
    csvCell(app.internationalCompliance?.healthInsuranceStatus ?? ""),
    csvCell(app.internationalCompliance?.ieltsStatus ?? ""),
  ]);

  const csv = [headers.map(csvCell).join(","), ...rows.map((r) => r.join(","))].join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="applicants-export.csv"`,
    },
  });
}
