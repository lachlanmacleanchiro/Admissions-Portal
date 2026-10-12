import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissionGuard } from "@/lib/permissions";
import { createTimelineEvent } from "@/lib/timeline";
import { logAudit } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import { renderMarkdown } from "@/lib/markdown";
import { findUnresolvedVariables } from "@/lib/documentTemplates";
import { NextRequest, NextResponse } from "next/server";

// Sends a staff-reviewed document to the applicant. Nothing in the stage flow
// calls this — documents only go out when a staff member presses Send.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const guard = permissionGuard(session, "SEND_MESSAGES");
  if (guard) return guard;

  const { templateId, subject, bodyMarkdown } = await req.json();
  if (!subject?.trim() || !bodyMarkdown?.trim()) {
    return NextResponse.json({ error: "Subject and body are required." }, { status: 400 });
  }

  const unresolved = findUnresolvedVariables(subject, bodyMarkdown);
  if (unresolved.length > 0) {
    return NextResponse.json(
      { error: `Fill in every field before sending: ${unresolved.map((v) => `{{${v}}}`).join(", ")}` },
      { status: 400 }
    );
  }

  const application = await prisma.application.findUnique({
    where: { id },
    select: { id: true, currentStage: true, student: { select: { email: true } } },
  });
  if (!application) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const template = templateId
    ? await prisma.documentTemplate.findUnique({ where: { id: templateId }, select: { id: true, name: true } })
    : null;
  if (templateId && !template) {
    return NextResponse.json({ error: "This template no longer exists." }, { status: 404 });
  }

  try {
    await sendEmail({
      to: application.student.email,
      subject: subject.trim(),
      bodyHtml: renderMarkdown(bodyMarkdown),
      footerNote: "Sent by the NZCC Admissions team. If you have any questions, please reply via the Messages page of the Applicant Portal.",
    });
  } catch (err) {
    console.error("Document send failed", err);
    return NextResponse.json(
      { error: "The email couldn't be sent. Nothing was recorded — please try again or check the email settings." },
      { status: 502 }
    );
  }

  const send = await prisma.documentSend.create({
    data: {
      applicationId: id,
      templateId: template?.id ?? null,
      stageKey: application.currentStage,
      subject: subject.trim(),
      bodyMarkdown,
      sentToEmail: application.student.email,
      sentById: session!.user.id,
    },
  });

  await createTimelineEvent({
    applicationId: id,
    eventType: "DOCUMENT_SENT",
    title: `Email sent: ${subject.trim()}`,
    description: `Sent to ${application.student.email}.`,
    isVisibleToStudent: true,
    createdById: session!.user.id,
  });

  await logAudit({
    applicationId: id,
    objectType: "DocumentSend",
    objectId: send.id,
    action: "CREATE",
    actionDetail: `Sent document "${template?.name ?? subject.trim()}" to ${application.student.email}`,
    userId: session!.user.id,
  });

  return NextResponse.json({ success: true, send }, { status: 201 });
}
