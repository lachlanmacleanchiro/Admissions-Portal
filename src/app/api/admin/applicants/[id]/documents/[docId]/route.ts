import type { Session } from "next-auth";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissionGuard } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { notifyStudentOfDocumentRejection } from "@/lib/notifications";
import { createTimelineEvent } from "@/lib/timeline";
import { getStorageProvider } from "@/lib/storage";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const { id, docId } = await params;
  const session = await auth();
  const { action, verificationNote } = await req.json();

  if (!["verify", "reject", "publish", "unpublish"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  if (action === "publish" || action === "unpublish") {
    return setPublished(session, id, docId, action === "publish");
  }

  const guard = permissionGuard(session, "VERIFY_DOCUMENTS");
  if (guard) return guard;

  const doc = await prisma.document.findUnique({ where: { id: docId, applicationId: id } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Staff-uploaded files aren't student submissions, so there's nothing to verify.
  if (doc.uploadedByStaffId) return NextResponse.json({ error: "Staff uploads can't be verified." }, { status: 400 });

  const newStatus = action === "verify" ? "VERIFIED" : "REJECTED";

  await prisma.$transaction([
    prisma.document.update({
      where: { id: docId },
      data: {
        status: newStatus,
        verificationNote,
        verifiedById: action === "verify" ? session!.user.id : null,
      },
    }),
    ...(doc.taskId
      ? [
          prisma.task.update({
            where: { id: doc.taskId },
            data: {
              status: action === "verify" ? "APPROVED" : "REJECTED",
              reviewNote: verificationNote,
              reviewedAt: new Date(),
              reviewedById: session!.user.id,
            },
          }),
        ]
      : []),
  ]);

  await logAudit({
    applicationId: id,
    objectType: "Document",
    objectId: docId,
    action: "UPDATE",
    actionDetail: `Document "${doc.filename}" ${action === "verify" ? "verified" : "rejected"}${verificationNote ? ` — ${verificationNote}` : ""}`,
    userId: session!.user.id,
  });

  await createTimelineEvent({
    applicationId: id,
    eventType: "DOCUMENT_VERIFIED",
    title: `Document ${action === "verify" ? "verified" : "rejected"}: ${doc.filename}`,
    description: verificationNote || undefined,
    isVisibleToStudent: true,
    relatedDocumentId: docId,
    createdById: session!.user.id,
  });

  if (action === "reject") {
    await notifyStudentOfDocumentRejection(id, doc.filename, verificationNote ?? null);
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const { id, docId } = await params;
  const session = await auth();
  const guard = permissionGuard(session, "DELETE_DOCUMENTS");
  if (guard) return guard;

  const doc = await prisma.document.findUnique({ where: { id: docId, applicationId: id } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.document.delete({ where: { id: docId } });

  const storage = getStorageProvider();
  await storage.delete(doc.storageKey);

  await logAudit({
    applicationId: id,
    objectType: "Document",
    objectId: docId,
    action: "DELETE",
    actionDetail: `Document "${doc.filename}" deleted`,
    userId: session!.user.id,
  });

  return NextResponse.json({ success: true });
}

/** Publishes a staff-uploaded file to the student portal, or pulls it back to draft. */
async function setPublished(session: Session | null, id: string, docId: string, publish: boolean) {
  const guard = permissionGuard(session, "PUBLISH_DOCUMENTS");
  if (guard) return guard;

  const doc = await prisma.document.findUnique({ where: { id: docId, applicationId: id } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!doc.uploadedByStaffId) {
    return NextResponse.json({ error: "Only staff uploads can be published or unpublished." }, { status: 400 });
  }
  if (doc.publishedToStudent === publish) return NextResponse.json({ success: true });

  await prisma.document.update({
    where: { id: docId },
    data: { publishedToStudent: publish, publishedAt: publish ? new Date() : null },
  });

  await logAudit({
    applicationId: id,
    objectType: "Document",
    objectId: docId,
    action: "UPDATE",
    actionDetail: `Document "${doc.filename}" ${publish ? "published to" : "removed from"} the student portal`,
    userId: session!.user.id,
  });

  if (publish) {
    await createTimelineEvent({
      applicationId: id,
      eventType: "DOCUMENT_SENT",
      title: `Document shared: ${doc.filename}`,
      isVisibleToStudent: true,
      relatedDocumentId: docId,
      createdById: session!.user.id,
    });
  }

  return NextResponse.json({ success: true });
}
