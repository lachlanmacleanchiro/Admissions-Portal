import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStorageProvider } from "@/lib/storage";
import { isMimeTypeAllowed, categoryRejectionMessage } from "@/lib/documentValidation";
import { logAudit } from "@/lib/audit";
import { notifyAdminsOfDocumentUpload } from "@/lib/notifications";
import { createTimelineEvent } from "@/lib/timeline";

const ALLOWED_DOCUMENT_TYPES = [
  "GENERAL",
  "TASK_SUBMISSION",
  "OFFER_CONDITION_EVIDENCE",
  "CITIZENSHIP_PROOF",
  "IELTS_CERTIFICATE",
  "CHIROPRACTOR_RECOMMENDATION",
];
// Must match the application form, which only accepts PDFs for these.
const PDF_ONLY_DOCUMENT_TYPES = ["CITIZENSHIP_PROOF", "IELTS_CERTIFICATE"];

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "STUDENT") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const application = await prisma.application.findUnique({
    where: { studentId: session.user.id },
    select: { id: true },
  });
  if (!application) return Response.json({ error: "Not found" }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const requestedType = formData.get("documentType") as string | null;
  const documentType = requestedType && ALLOWED_DOCUMENT_TYPES.includes(requestedType) ? requestedType : "GENERAL";
  const taskId = formData.get("taskId") as string | null;
  const offerConditionId = formData.get("offerConditionId") as string | null;

  if (!file) return Response.json({ error: "No file provided." }, { status: 400 });

  if (offerConditionId) {
    const condition = await prisma.offerCondition.findFirst({
      where: { id: offerConditionId, offer: { applicationId: application.id } },
    });
    if (!condition) return Response.json({ error: "Condition not found." }, { status: 404 });
  }

  const MAX_SIZE = 10 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    return Response.json({ error: "File exceeds 10MB limit." }, { status: 400 });
  }

  if (taskId) {
    const task = await prisma.task.findFirst({
      where: { id: taskId, applicationId: application.id },
      select: { requiredDocumentCategory: true },
    });
    if (!task) return Response.json({ error: "Task not found." }, { status: 404 });
    if (!isMimeTypeAllowed(file.type, task.requiredDocumentCategory)) {
      return Response.json({ error: categoryRejectionMessage(task.requiredDocumentCategory) }, { status: 400 });
    }
  } else if (PDF_ONLY_DOCUMENT_TYPES.includes(documentType)) {
    if (file.type !== "application/pdf") {
      return Response.json({ error: "This document must be a PDF." }, { status: 400 });
    }
  } else {
    // General (unlinked) uploads are document evidence — images are not accepted here.
    if (!isMimeTypeAllowed(file.type, "DOCUMENT")) {
      return Response.json({ error: categoryRejectionMessage("DOCUMENT") }, { status: 400 });
    }
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const storage = getStorageProvider();
  const { key, storedFilename } = await storage.upload(buffer, file.name, file.type);

  // If task linked, update task to IN_PROGRESS
  if (taskId) {
    await prisma.task.updateMany({
      where: { id: taskId, applicationId: application.id, status: "PENDING" },
      data: { status: "IN_PROGRESS" },
    });
  }

  const document = await prisma.document.create({
    data: {
      applicationId: application.id,
      taskId: taskId || undefined,
      offerConditionId: offerConditionId || undefined,
      filename: file.name,
      storedFilename,
      mimeType: file.type,
      sizeBytes: file.size,
      storageKey: key,
      documentType,
    },
  });

  await logAudit({
    applicationId: application.id,
    objectType: "Document",
    objectId: document.id,
    action: "CREATE",
    actionDetail: `Student uploaded document "${file.name}"`,
    userId: session.user.id,
  });

  await createTimelineEvent({
    applicationId: application.id,
    eventType: "DOCUMENT_UPLOADED",
    title: `Document uploaded: ${file.name}`,
    isVisibleToStudent: true,
    relatedDocumentId: document.id,
    createdById: session.user.id,
  });

  await notifyAdminsOfDocumentUpload(application.id, file.name);

  return Response.json({ id: document.id }, { status: 201 });
}
