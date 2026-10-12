import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding database...");

  // ── Intake Year ──────────────────────────────────────────────────────
  const intakeYear = await prisma.intakeYear.upsert({
    where: { year: 2026 },
    update: { isActive: true },
    create: { year: 2026, label: "2026 INTAKE", isActive: true },
  });
  console.log(`✓ Intake year: ${intakeYear.label}`);

  // ── Global Admin ─────────────────────────────────────────────────────
  const adminHash = await bcrypt.hash("Admin1234!", 12);
  const globalAdmin = await prisma.user.upsert({
    where: { email: "admin@nzcc.ac.nz" },
    update: {},
    create: {
      email: "admin@nzcc.ac.nz",
      passwordHash: adminHash,
      firstName: "Sarah",
      lastName: "Williamson",
      role: "STAFF",
      isGlobalAdmin: true,
      emailVerified: new Date(),
    },
  });
  console.log(`✓ Global admin: ${globalAdmin.email}`);

  // ── Partial-Permission Staff ──────────────────────────────────────────
  const staffHash = await bcrypt.hash("Staff1234!", 12);
  const admissionsOfficer = await prisma.user.upsert({
    where: { email: "officer@nzcc.ac.nz" },
    update: {},
    create: {
      email: "officer@nzcc.ac.nz",
      passwordHash: staffHash,
      firstName: "James",
      lastName: "Chen",
      role: "STAFF",
      isGlobalAdmin: false,
      emailVerified: new Date(),
    },
  });

  // Grant limited permissions
  const officerPerms = [
    "VIEW_APPLICANTS",
    "ASSIGN_TASKS",
    "REVIEW_TASK_SUBMISSIONS",
    "VIEW_DOCUMENTS",
    "VERIFY_DOCUMENTS",
    "SEND_MESSAGES",
    "VIEW_ALL_MESSAGES",
    "MANAGE_OWN_TASKS",
  ];
  for (const key of officerPerms) {
    await prisma.staffPermission.upsert({
      where: { staffUserId_permissionKey: { staffUserId: admissionsOfficer.id, permissionKey: key as any } },
      update: { granted: true },
      create: { staffUserId: admissionsOfficer.id, permissionKey: key as any, granted: true },
    });
  }
  console.log(`✓ Admissions officer: ${admissionsOfficer.email} (${officerPerms.length} permissions)`);

  const complianceOfficer = await prisma.user.upsert({
    where: { email: "compliance@nzcc.ac.nz" },
    update: {},
    create: {
      email: "compliance@nzcc.ac.nz",
      passwordHash: staffHash,
      firstName: "Michelle",
      lastName: "Taufa",
      role: "STAFF",
      isGlobalAdmin: false,
      emailVerified: new Date(),
    },
  });
  for (const key of ["VIEW_APPLICANTS", "VIEW_INTERNATIONAL", "EDIT_INTERNATIONAL", "VIEW_REPORTS", "MANAGE_OWN_TASKS"]) {
    await prisma.staffPermission.upsert({
      where: { staffUserId_permissionKey: { staffUserId: complianceOfficer.id, permissionKey: key as any } },
      update: { granted: true },
      create: { staffUserId: complianceOfficer.id, permissionKey: key as any, granted: true },
    });
  }
  console.log(`✓ Compliance officer: ${complianceOfficer.email}`);

  // ── Students ──────────────────────────────────────────────────────────
  const studentHash = await bcrypt.hash("Student1234!", 12);

  const studentsData = [
    {
      email: "emma.johnson@example.com",
      firstName: "Emma",
      lastName: "Johnson",
      stage: "OFFER_UNCONDITIONAL",
      category: "DOMESTIC",
      yearLevel: "YEAR_1",
      applicantNumber: "#0041",
      flagNote: "READY",
    },
    {
      email: "liam.patel@example.com",
      firstName: "Liam",
      lastName: "Patel",
      stage: "INTERVIEW",
      category: "INTERNATIONAL",
      yearLevel: "YEAR_1",
      applicantNumber: "#0042",
      flagNote: "FOLLOW UP",
    },
    {
      email: "priya.wong@example.com",
      firstName: "Priya",
      lastName: "Wong",
      stage: "ACADEMIC_CHECK",
      category: "INTERNATIONAL",
      yearLevel: "YEAR_2",
      applicantNumber: "#0043",
      flagNote: "NEEDS TRANSLATION",
    },
    {
      email: "james.martin@example.com",
      firstName: "James",
      lastName: "Martin",
      stage: "INTAKE_REVIEW",
      category: "DOMESTIC",
      yearLevel: "YEAR_1",
      applicantNumber: "#0044",
      flagNote: null,
    },
    {
      email: "sophie.tait@example.com",
      firstName: "Sophie",
      lastName: "Tait",
      stage: "NEW_SUBMITTED",
      category: "DOMESTIC",
      yearLevel: "YEAR_1",
      applicantNumber: "#0045",
      flagNote: null,
    },
    {
      email: "carlos.mendez@example.com",
      firstName: "Carlos",
      lastName: "Mendez",
      stage: "COMMITTEE",
      category: "INTERNATIONAL",
      yearLevel: "YEAR_1",
      applicantNumber: "#0046",
      flagNote: "ESSAY OUTSTANDING",
    },
    {
      email: "aisha.nkosi@example.com",
      firstName: "Aisha",
      lastName: "Nkosi",
      stage: "ENROLLED",
      category: "DOMESTIC",
      yearLevel: "YEAR_1",
      applicantNumber: "#0047",
      flagNote: "IN WISENET",
    },
  ];

  for (const [index, s] of studentsData.entries()) {
    const user = await prisma.user.upsert({
      where: { email: s.email },
      update: {},
      create: {
        email: s.email,
        passwordHash: studentHash,
        firstName: s.firstName,
        lastName: s.lastName,
        role: "STUDENT",
        emailVerified: new Date(),
      },
    });

    const existing = await prisma.application.findUnique({ where: { studentId: user.id } });
    if (existing) {
      console.log(`  ↳ Application already exists for ${s.firstName}`);
      continue;
    }

    const app = await prisma.application.create({
      data: {
        studentId: user.id,
        intakeYearId: intakeYear.id,
        category: s.category as any,
        yearLevel: s.yearLevel as any,
        currentStage: s.stage as any,
        applicantNumber: s.applicantNumber,
        flagNote: s.flagNote,
        sortOrder: index,
        dateOfBirth: new Date("1999-06-15"),
        phone: "+64 21 555 0001",
        address: "123 Example St, Auckland",
        city: "Auckland",
        country: "New Zealand",
        guardianName: "Parent Name",
        guardianPhone: "+64 21 555 0002",
        guardianRelation: "Parent",
        submittedAt: new Date(),
      },
    });

    // Add a task
    await prisma.task.create({
      data: {
        applicationId: app.id,
        title: "Upload Academic Transcripts",
        description: "Please upload certified copies of all academic transcripts.",
        isRequired: true,
        requiresDocument: true,
        documentInstructions: "Upload as PDF. Maximum 10MB per file.",
        assignedById: admissionsOfficer.id,
        status: s.stage === "ENROLLED" || s.stage === "OFFER_UNCONDITIONAL" ? "APPROVED" : "PENDING",
        dueDate: new Date(Date.now() + 14 * 86400000),
      },
    });

    // Timeline event — use STAGE_CHANGE with the application's starting stage
    await prisma.timelineEvent.create({
      data: {
        applicationId: app.id,
        eventType: "STAGE_CHANGE",
        title: "Application Submitted",
        description: "Your application has been received and is under review.",
        isVisibleToStudent: true,
        relatedStageKey: s.stage as any,
      },
    });

    // International compliance
    if (s.category === "INTERNATIONAL") {
      await prisma.internationalCompliance.create({
        data: {
          applicationId: app.id,
          visaStatus: s.stage === "OFFER_UNCONDITIONAL" || s.stage === "ENROLLED" ? "APPLIED" : "NOT_YET",
          healthInsuranceStatus: s.stage === "ENROLLED" ? "CONFIRMED" : "NOT_YET",
          ieltsStatus: s.stage === "COMMITTEE" || s.stage === "OFFER_UNCONDITIONAL" ? "CONFIRMED" : "IN_PROGRESS",
          offerOfPlaceIssued: s.stage === "OFFER_UNCONDITIONAL" || s.stage === "ENROLLED",
        },
      });
    }

    // Message thread — Message has threadId, not applicationId
    await prisma.messageThread.create({
      data: {
        applicationId: app.id,
        messages: {
          create: {
            senderId: admissionsOfficer.id,
            senderRole: "STAFF",
            body: `Hi ${s.firstName}, welcome to the NZCC admissions process. Please check your tasks and upload any required documents. Don't hesitate to reach out if you have questions.`,
          },
        },
      },
    });

    console.log(`  ✓ Student ${s.firstName} ${s.lastName} (${s.stage})`);
  }

  // ── Document Templates ───────────────────────────────────────────────
  const existingInterviewTemplate = await prisma.documentTemplate.findFirst({
    where: { name: "Online interview invitation" },
  });
  if (!existingInterviewTemplate) {
    await prisma.documentTemplate.create({
      data: {
        stageKey: "INTERVIEW",
        name: "Online interview invitation",
        subject: "Your NZCC admissions interview",
        createdById: globalAdmin.id,
        updatedById: globalAdmin.id,
        bodyMarkdown: `# Online interview

Kia ora {{preferredName}}!

I would like to invite you for an online admissions interview on the following time and date:

**{{interviewDate}} at {{interviewTime}} via Zoom**

Please click on the link below a few minutes before the scheduled start time so you can check your audio and video setup. Zoom is a straightforward, easy-to-use video platform, and you do not need an account to join the interview. Should you have any technical issues or problems, please let us know with plenty of notice.

{{zoomLink}}

This is a professional interview and is heavily weighted in admissions decision making. Please dress accordingly, set yourself up in a well-lit area at a desk, and be prepared to start on time, ensuring your audio and video settings are in working order.

Details about the admissions essay and admissions timeline will be provided at the end of the interview, and there will also be time for any questions you may have.

Before the interview, we do recommend watching some short videos that explore chiropractic philosophy, just to freshen your understanding before the interview. Just click on the link below and scroll down to *Explore our Philosophy*.

https://chiropractic.ac.nz/study-with-us/discover-chiropractic/

I look forward to seeing you soon.

{{staffName}}
NZCC Admissions`,
      },
    });
  }
  console.log("✓ Document templates");

  console.log("\n✅ Seed complete!");
  console.log("\nLogin credentials:");
  console.log("  Global Admin: admin@nzcc.ac.nz / Admin1234!");
  console.log("  Admissions Officer: officer@nzcc.ac.nz / Staff1234!");
  console.log("  Compliance Officer: compliance@nzcc.ac.nz / Staff1234!");
  console.log("  Students: e.g. emma.johnson@example.com / Student1234!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
