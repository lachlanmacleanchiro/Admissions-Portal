import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissionGuard } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import {
  isYearLevel, parseDateOnly, parseChiropracticExperience, ProfileValidationError, type ChiroExperienceInput,
} from "@/lib/profileUpdate";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const guard = permissionGuard(session, "EDIT_APPLICANT_PROFILE");
  if (guard) return guard;

  const body = await req.json();

  const {
    firstName, lastName, phone, city, address, postcode, country,
    guardianName, guardianEmail, guardianPhone, flagNote, flagColor, gpaScore, prerequisitesMet,
    yearLevel, citizenshipCountry, suburb, guardianRelation,
  } = body;

  if (yearLevel !== undefined && !isYearLevel(yearLevel)) {
    return NextResponse.json({ error: "Invalid year level." }, { status: 400 });
  }
  let dateOfBirth: Date | null | undefined;
  let chiropracticExperience: ChiroExperienceInput[] | undefined;
  try {
    dateOfBirth = parseDateOnly(body.dateOfBirth);
    chiropracticExperience = parseChiropracticExperience(body.chiropracticExperience);
  } catch (err) {
    if (err instanceof ProfileValidationError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }

  const app = await prisma.application.findUnique({
    where: { id },
    select: { id: true, studentId: true },
  });
  if (!app) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.$transaction([
    prisma.user.update({
      where: { id: app.studentId },
      data: {
        ...(firstName !== undefined && { firstName }),
        ...(lastName !== undefined && { lastName }),
      },
    }),
    prisma.application.update({
      where: { id },
      data: {
        ...(phone !== undefined && { phone }),
        ...(city !== undefined && { city }),
        ...(address !== undefined && { address }),
        ...(postcode !== undefined && { postcode }),
        ...(country !== undefined && { country }),
        ...(guardianName !== undefined && { guardianName }),
        ...(guardianEmail !== undefined && { guardianEmail }),
        ...(guardianPhone !== undefined && { guardianPhone }),
        ...(flagNote !== undefined && { flagNote: flagNote || null }),
        ...(flagColor !== undefined && { flagColor: flagColor || null }),
        ...(gpaScore !== undefined && { gpaScore: gpaScore === null || gpaScore === "" ? null : parseFloat(gpaScore) }),
        ...(prerequisitesMet !== undefined && { prerequisitesMet: !!prerequisitesMet }),
        ...(yearLevel !== undefined && { yearLevel }),
        ...(dateOfBirth !== undefined && { dateOfBirth }),
        ...(citizenshipCountry !== undefined && { citizenshipCountry }),
        ...(suburb !== undefined && { suburb }),
        ...(guardianRelation !== undefined && { guardianRelation }),
      },
    }),
    // A sent list replaces the applicant's entries; an absent one leaves them alone.
    ...(chiropracticExperience
      ? [
          prisma.chiropracticExperienceEntry.deleteMany({ where: { applicationId: id } }),
          ...(chiropracticExperience.length > 0
            ? [prisma.chiropracticExperienceEntry.createMany({
                data: chiropracticExperience.map((e) => ({ applicationId: id, ...e })),
              })]
            : []),
        ]
      : []),
  ]);

  const changedFields = Object.keys(body).filter((k) => body[k] !== undefined);
  await logAudit({
    applicationId: id,
    objectType: "Application",
    objectId: id,
    action: "UPDATE",
    actionDetail: `Staff updated profile fields: ${changedFields.join(", ")}`,
    userId: session!.user.id,
  });

  return NextResponse.json({ success: true });
}
