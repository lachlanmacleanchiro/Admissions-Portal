import "server-only";
import { prisma } from "@/lib/prisma";
import { STAGE_STATUS_LABELS } from "@/lib/stages";

const NZ_TIME_ZONE = "Pacific/Auckland";

/** Values for the auto-filled template variables (see AUTO_VARIABLES) for one applicant. */
export async function buildAutoVariableValues(
  applicationId: string,
  staff: { firstName: string; lastName: string }
): Promise<Record<string, string> | null> {
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    select: {
      applicantNumber: true,
      currentStage: true,
      preferredFirstName: true,
      student: { select: { firstName: true, lastName: true, email: true } },
      intakeYear: { select: { label: true } },
      interviewReview: { select: { interviewDate: true } },
    },
  });
  if (!app) return null;

  const interviewDate = app.interviewReview?.interviewDate ?? null;

  return {
    preferredName: app.preferredFirstName?.trim() || app.student.firstName,
    firstName: app.student.firstName,
    lastName: app.student.lastName,
    fullName: `${app.student.firstName} ${app.student.lastName}`,
    email: app.student.email,
    applicantNumber: app.applicantNumber,
    intakeYear: app.intakeYear.label,
    currentStage: STAGE_STATUS_LABELS[app.currentStage],
    // Left empty when no interview is scheduled, so staff are asked to fill them in.
    interviewDate: interviewDate
      ? interviewDate.toLocaleDateString("en-NZ", {
          weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: NZ_TIME_ZONE,
        })
      : "",
    interviewTime: interviewDate
      ? interviewDate.toLocaleTimeString("en-NZ", { hour: "numeric", minute: "2-digit", timeZone: NZ_TIME_ZONE })
      : "",
    staffName: `${staff.firstName} ${staff.lastName}`,
    staffFirstName: staff.firstName,
    today: new Date().toLocaleDateString("en-NZ", {
      day: "numeric", month: "long", year: "numeric", timeZone: NZ_TIME_ZONE,
    }),
  };
}
