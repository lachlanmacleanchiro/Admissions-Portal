import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { issueVerificationToken } from "@/lib/verification";
import { sendTemplatedEmail, buildAppUrl } from "@/lib/email";
import { getStorageProvider } from "@/lib/storage";
import { logApplicationError } from "@/lib/errorLog";

const PDF_ONLY_MIME_TYPES = ["application/pdf"];
const DOC_UPLOAD_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

interface EducationHistoryInput {
  level: "SECONDARY" | "TERTIARY";
  institutionName: string;
  country: string;
  yearStarted: number;
  qualification?: string;
  yearCompleted?: number;
}

interface ChiropracticExperienceInput {
  chiropractorName: string;
  status: "OBSERVING" | "UNDER_CARE";
}

const MAX_FILE_SIZE = 10 * 1024 * 1024;

async function generateNextApplicantNumber(): Promise<string> {
  const applications = await prisma.application.findMany({
    select: { applicantNumber: true },
  });
  const maxNumber = applications.reduce((max, a) => {
    const numeric = parseInt(a.applicantNumber.replace(/\D/g, ""), 10);
    return Number.isFinite(numeric) && numeric > max ? numeric : max;
  }, 0);
  return `#${String(maxNumber + 1).padStart(4, "0")}`;
}

async function uploadIfPresent(file: File | null, allowedTypes: string[]) {
  if (!file) return null;
  if (file.size > MAX_FILE_SIZE) throw new Error("FILE_TOO_LARGE");
  if (!allowedTypes.includes(file.type)) throw new Error("FILE_TYPE_NOT_ALLOWED");
  const buffer = Buffer.from(await file.arrayBuffer());
  const storage = getStorageProvider();
  const { key, storedFilename } = await storage.upload(buffer, file.name, file.type);
  return { key, storedFilename, filename: file.name, mimeType: file.type, sizeBytes: file.size };
}

export async function POST(req: NextRequest) {
  const reqClone = req.clone();
  try {
    return await handleApply(req);
  } catch (err) {
    let email: string | undefined;
    try {
      const formData = await reqClone.formData();
      const payload = JSON.parse(formData.get("payload") as string);
      email = payload?.email;
    } catch {
      // ignore — best-effort only, don't let this mask the original error
    }
    await logApplicationError("apply", err, email);
    return Response.json({ error: "Something went wrong submitting your application. Please try again." }, { status: 500 });
  }
}

async function handleApply(req: NextRequest) {
  const formData = await req.formData();
  const payload = JSON.parse(formData.get("payload") as string);

  const {
    category, intakeYearId,
    firstName, lastName, middleName, preferredFirstName, email, password,
    dateOfBirth, gender, preferredPronouns, maoriPacificaStatus, citizenshipCountry,
    hasDisabilitySupportNeed, disabilitySupportCategory,
    hasCriminalConviction, criminalConvictionDetails,
    hasPendingLegalProceedings, pendingLegalProceedingsDetails,
    phone, address, suburb, city, postcode, country,
    useAlternativeAddress, alternativeAddress, alternativeSuburb, alternativeCity, alternativePostcode, alternativeCountry,
    hasCompletedTertiaryStudy, nationalStudentNumber,
    educationHistory, chiropracticExperience,
    englishProficiencyStatus, ieltsTestDate, englishProficiencyDetails,
    hasPriorAcademicIssues, priorAcademicIssuesDetails,
    hasPriorComplaints, priorComplaintsDetails,
    hasDishonestyAllegations, dishonestyAllegationsDetails,
    personalStatement, referralSource,
    declarationSignatureName,
    guardianName, guardianEmail, guardianPhone, guardianRelation,
  } = payload;

  if (!category || !intakeYearId || !firstName || !lastName || !email || !password) {
    return Response.json({ error: "Missing required fields." }, { status: 400 });
  }
  if (!suburb?.trim()) {
    return Response.json({ error: "Suburb is required." }, { status: 400 });
  }
  if (!postcode?.trim()) {
    return Response.json({ error: "Postcode is required." }, { status: 400 });
  }
  if (!declarationSignatureName?.trim()) {
    return Response.json({ error: "Declaration signature is required." }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return Response.json({ error: "An account with this email already exists." }, { status: 409 });
  }

  const intakeYear = await prisma.intakeYear.findFirst({
    where: { id: intakeYearId, isOpenForApplications: true, isArchived: false },
  });
  if (!intakeYear) {
    return Response.json({ error: "The selected intake year is no longer open for applications. Please refresh and choose another." }, { status: 400 });
  }

  let citizenshipProof, ieltsCertificate, recommendationLetter;
  try {
    citizenshipProof = await uploadIfPresent(formData.get("citizenshipProof") as File | null, PDF_ONLY_MIME_TYPES);
    ieltsCertificate = await uploadIfPresent(formData.get("ieltsCertificate") as File | null, PDF_ONLY_MIME_TYPES);
    recommendationLetter = await uploadIfPresent(formData.get("recommendationLetter") as File | null, DOC_UPLOAD_MIME_TYPES);
  } catch (err) {
    if (err instanceof Error && err.message === "FILE_TYPE_NOT_ALLOWED") {
      return Response.json({ error: "Uploaded files must be a PDF (or Word document for the recommendation letter)." }, { status: 400 });
    }
    return Response.json({ error: "One or more files exceed the 10MB limit." }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const applicantNumber = await generateNextApplicantNumber();

  const educationEntries: EducationHistoryInput[] = Array.isArray(educationHistory) ? educationHistory : [];
  const experienceEntries: ChiropracticExperienceInput[] = (Array.isArray(chiropracticExperience) ? chiropracticExperience : [])
    .filter((e) => e.chiropractorName?.trim());

  const userId = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { firstName, lastName, email, passwordHash, role: "STUDENT" },
    });

    const application = await tx.application.create({
      data: {
        studentId: user.id,
        intakeYearId: intakeYear.id,
        applicantNumber,
        category,
        // Applicants don't choose a year level; staff correct it on the applicant file.
        yearLevel: "YEAR_1",
        currentStage: "NEW_SUBMITTED",
        status: "IN_PROGRESS",
        middleName, preferredFirstName,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        gender, preferredPronouns, maoriPacificaStatus, citizenshipCountry,
        hasDisabilitySupportNeed: !!hasDisabilitySupportNeed, disabilitySupportCategory,
        hasCriminalConviction: !!hasCriminalConviction,
        criminalConvictionDetails: hasCriminalConviction ? criminalConvictionDetails : null,
        hasPendingLegalProceedings: !!hasPendingLegalProceedings,
        pendingLegalProceedingsDetails: hasPendingLegalProceedings ? pendingLegalProceedingsDetails : null,
        phone, address, suburb, city, postcode, country,
        useAlternativeAddress: !!useAlternativeAddress,
        alternativeAddress, alternativeSuburb, alternativeCity, alternativePostcode, alternativeCountry,
        hasCompletedTertiaryStudy: !!hasCompletedTertiaryStudy, nationalStudentNumber,
        englishProficiencyStatus,
        ieltsTestDate: ieltsTestDate ? new Date(ieltsTestDate) : null,
        englishProficiencyDetails,
        hasPriorAcademicIssues: !!hasPriorAcademicIssues,
        priorAcademicIssuesDetails: hasPriorAcademicIssues ? priorAcademicIssuesDetails : null,
        hasPriorComplaints: !!hasPriorComplaints,
        priorComplaintsDetails: hasPriorComplaints ? priorComplaintsDetails : null,
        hasDishonestyAllegations: !!hasDishonestyAllegations,
        dishonestyAllegationsDetails: hasDishonestyAllegations ? dishonestyAllegationsDetails : null,
        personalStatement, referralSource,
        declarationAcceptedAt: new Date(),
        declarationSignatureName,
        guardianName, guardianEmail, guardianPhone, guardianRelation,
        submittedAt: new Date(),
        educationHistory: {
          create: educationEntries.map((e) => ({
            level: e.level,
            institutionName: e.institutionName,
            country: e.country,
            yearStarted: e.yearStarted,
            qualification: e.qualification,
            yearCompleted: e.yearCompleted,
          })),
        },
        chiropracticExperience: {
          create: experienceEntries.map((e) => ({
            chiropractorName: e.chiropractorName,
            status: e.status,
          })),
        },
      },
    });

    const documentsToCreate = [
      citizenshipProof && { ...citizenshipProof, documentType: "CITIZENSHIP_PROOF" },
      ieltsCertificate && { ...ieltsCertificate, documentType: "IELTS_CERTIFICATE" },
      recommendationLetter && { ...recommendationLetter, documentType: "CHIROPRACTOR_RECOMMENDATION" },
    ].filter(Boolean) as (NonNullable<typeof citizenshipProof> & { documentType: string })[];

    for (const doc of documentsToCreate) {
      await tx.document.create({
        data: {
          applicationId: application.id,
          filename: doc.filename,
          storedFilename: doc.storedFilename,
          mimeType: doc.mimeType,
          sizeBytes: doc.sizeBytes,
          storageKey: doc.key,
          documentType: doc.documentType,
        },
      });
    }

    await tx.timelineEvent.create({
      data: {
        applicationId: application.id,
        eventType: "STAGE_CHANGE",
        title: "Application submitted",
        description: `Your online application was received. An acknowledgement was sent to ${email}.`,
        isVisibleToStudent: true,
        relatedStageKey: "NEW_SUBMITTED",
      },
    });

    return user.id;
  });

  const token = await issueVerificationToken(userId, "EMAIL_VERIFICATION");
  const verifyUrl = buildAppUrl(`/verify-email?token=${token}`);

  try {
    await sendTemplatedEmail("ACCOUNT_VERIFICATION", email, { firstName, verifyUrl });
  } catch (err) {
    console.error("Failed to send verification email:", err);
  }

  return Response.json({ success: true }, { status: 201 });
}
