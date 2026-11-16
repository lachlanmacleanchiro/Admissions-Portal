import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, permissionGuard } from "@/lib/permissions";
import { getStorageProvider } from "@/lib/storage";
import { isMimeTypeAllowed } from "@/lib/documentValidation";
import { logAudit } from "@/lib/audit";
import { createTimelineEvent } from "@/lib/timeline";
import { NextRequest, NextResponse } from "next/server";

const MAX_SIZE = 10 * 1024 * 1024;
// Same set the student side accepts for "any" uploads.
const ALLOWED_MIME_TYPES_NOTE = "PDF, Word or image files only.";

/**
 * Staff upload a file to an applicant, with no task involved. It stays a draft
 * (staff-only) unless the uploader has PUBLISH_DOCUMENTS and asks to publish it.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const guard = permissionGuard(session, "UPLOAD_DOCUMENTS");
  if (guard) return guard;

  const application = await prisma.application.findUnique({ where: { id }, select: { id: true } });
  if (!application) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const description = ((formData.get("description") as string | null) ?? "").trim() || null;
  const wantsPublish = formData.get("publish") === "true";

  if (!file) return NextResponse.json({ error: "No file provided." }, { status: 400 });
  if (file.size > MAX_SIZE) return NextResponse.json({ error: "File exceeds 10MB limit." }, { status: 400 });
  if (!isMimeTypeAllowed(file.type, "DOCUMENT") && !isMimeTypeAllowed(file.type, "IMAGE")) {
    return NextResponse.json({ error: ALLOWED_MIME_TYPES_NOTE }, { status: 400 });
  }
  if (wantsPublish && !hasPermission(session, "PUBLISH_DOCUMENTS")) {
    return NextResponse.json({ error: "You don't have permission to publish documents to students." }, { status: 403 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const { key, storedFilename } = await getStorageProvider().upload(buffer, file.name, file.type);

  const document = await prisma.document.create({
    data: {
      applicationId: id,
      filename: file.name,
      storedFilename,
      mimeType: file.type,
      sizeBytes: file.size,
      storageKey: key,
      documentType: "STAFF_SHARED",
      description,
      // Not a student submission, so there is nothing to review.
      status: "VERIFIED",
      uploadedByStaffId: session!.user.id,
      publishedToStudent: wantsPublish,
      publishedAt: wantsPublish ? new Date() : null,
    },
  });

  await logAudit({
    applicationId: id,
    objectType: "Document",
    objectId: document.id,
    action: "CREATE",
    actionDetail: `Staff uploaded document "${file.name}"${wantsPublish ? " and published it to the student portal" : " (draft)"}`,
    userId: session!.user.id,
  });

  if (wantsPublish) {
    await createTimelineEvent({
      applicationId: id,
      eventType: "DOCUMENT_SENT",
      title: `Document shared: ${file.name}`,
      isVisibleToStudent: true,
      relatedDocumentId: document.id,
      createdById: session!.user.id,
    });
  }

  return NextResponse.json({ id: document.id, published: wantsPublish }, { status: 201 });
}
