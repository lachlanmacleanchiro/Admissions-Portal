import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission, hasPermission } from "@/lib/permissions";
import { Badge } from "@/components/ui/Badge";
import { DocumentVerifyButtons } from "./DocumentVerifyButtons";
import { DocumentDeleteButton } from "./DocumentDeleteButton";
import { DocumentPublishButton } from "./DocumentPublishButton";
import { UploadDocumentButton } from "./UploadDocumentButton";

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  CITIZENSHIP_PROOF: "Citizenship / residency proof",
  IELTS_CERTIFICATE: "IELTS certificate",
  CHIROPRACTOR_RECOMMENDATION: "Recommendation letter",
  TASK_SUBMISSION: "Task upload",
  OFFER_CONDITION_EVIDENCE: "Offer condition evidence",
  GENERAL: "Other document",
};

const GRID = "grid items-center gap-4 grid-cols-[minmax(0,2.5fr)_minmax(0,1.4fr)_72px_104px_150px_auto]";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" });
}

/** Small coloured tile showing the file type, like a file manager icon. */
function FileIcon({ filename, mimeType }: { filename: string; mimeType: string }) {
  const ext = filename.includes(".") ? filename.split(".").pop()!.toUpperCase().slice(0, 4) : "FILE";
  const isImage = mimeType.startsWith("image/");
  const isPdf = mimeType === "application/pdf";
  const color = isPdf ? "#c0392b" : isImage ? "#2f7d5b" : "#2d5fa8";
  return (
    <div
      className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-[10px] font-bold"
      style={{ backgroundColor: `${color}14`, color }}
      aria-hidden="true"
    >
      {ext}
    </div>
  );
}

export default async function ApplicantDocumentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user || session.user.role !== "STAFF") redirect("/login");
  requirePermission(session, "VIEW_DOCUMENTS");

  const app = await prisma.application.findUnique({
    where: { id },
    select: {
      id: true,
      student: { select: { firstName: true, lastName: true } },
      documents: {
        orderBy: { uploadedAt: "desc" },
        include: {
          task: { select: { title: true, description: true, documentInstructions: true, studentNote: true } },
          uploadedByStaff: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });

  if (!app) notFound();

  const canVerify = hasPermission(session, "VERIFY_DOCUMENTS");
  const canDelete = hasPermission(session, "DELETE_DOCUMENTS");
  const canUpload = hasPermission(session, "UPLOAD_DOCUMENTS");
  const canPublish = hasPermission(session, "PUBLISH_DOCUMENTS");

  // Task uploads waiting on a staff decision go to the top; everything else is in the file list.
  const forReview = app.documents.filter((d) => d.taskId && !d.uploadedByStaffId && d.status === "PENDING_REVIEW");
  const forReviewIds = new Set(forReview.map((d) => d.id));
  const files = app.documents.filter((d) => !forReviewIds.has(d.id));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold" style={{ color: "#222" }}>Documents</h2>
        {canUpload && <UploadDocumentButton applicationId={id} canPublish={canPublish} />}
      </div>

      {/* For review */}
      {forReview.length > 0 && (
        <section aria-labelledby="for-review-heading">
          <div className="flex items-center gap-2 mb-3">
            <h3 id="for-review-heading" className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#8a6416" }}>
              For review
            </h3>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(199,154,59,0.15)", color: "#8a6416" }}>
              {forReview.length}
            </span>
          </div>
          <div className="flex flex-col gap-3">
            {forReview.map((doc) => (
              <div
                key={doc.id}
                className="bg-white rounded-2xl shadow-sm px-5 py-4 flex items-start gap-4"
                style={{ borderLeft: "3px solid #C79A3B" }}
              >
                <FileIcon filename={doc.filename} mimeType={doc.mimeType} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: "#222" }}>{doc.task?.title}</p>
                  {doc.task?.description && (
                    <p className="text-xs mt-0.5 whitespace-pre-line" style={{ color: "#666" }}>{doc.task.description}</p>
                  )}
                  {doc.task?.documentInstructions && (
                    <p className="text-xs mt-1 italic" style={{ color: "#888" }}>Instructions: {doc.task.documentInstructions}</p>
                  )}
                  {doc.task?.studentNote && (
                    <p className="text-xs mt-1.5 px-2.5 py-1.5 rounded-md" style={{ backgroundColor: "#F8F8F6", color: "#555" }}>
                      Student note: {doc.task.studentNote}
                    </p>
                  )}
                  <p className="text-xs mt-2" style={{ color: "#444" }}>
                    <span className="font-medium">{doc.filename}</span>
                    <span style={{ color: "#aaa" }}> · {formatSize(doc.sizeBytes)} · Uploaded {formatDate(doc.uploadedAt)}</span>
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <a href={`/api/files/${doc.storageKey}`} target="_blank" rel="noreferrer" className="text-xs font-semibold" style={{ color: "#114E3B" }}>
                    View
                  </a>
                  {canVerify && <DocumentVerifyButtons documentId={doc.id} applicationId={id} />}
                  {canDelete && <DocumentDeleteButton documentId={doc.id} applicationId={id} filename={doc.filename} />}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* File manager */}
      <section aria-labelledby="files-heading">
        <h3 id="files-heading" className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: "#999" }}>
          All files
          <span className="ml-2 font-normal normal-case tracking-normal" style={{ color: "#bbb" }}>{files.length}</span>
        </h3>
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden overflow-x-auto">
          {files.length === 0 ? (
            <div className="px-5 py-16 text-center text-sm" style={{ color: "#aaa" }}>
              {forReview.length > 0 ? "No other files." : "No documents yet."}
            </div>
          ) : (
            <div className="min-w-[860px]">
              <div
                className={`${GRID} px-5 py-2.5 text-[10px] font-semibold uppercase tracking-widest`}
                style={{ backgroundColor: "#F8F8F6", borderBottom: "1px solid rgba(0,0,0,0.06)", color: "#888" }}
              >
                <span>Name</span>
                <span>Source</span>
                <span>Size</span>
                <span>Date</span>
                <span>Status</span>
                <span className="text-right">Actions</span>
              </div>
              {files.map((doc, i) => {
                const isStaffUpload = !!doc.uploadedByStaffId;
                const isVerified = doc.status === "VERIFIED";
                const isRejected = doc.status === "REJECTED";
                const source = isStaffUpload
                  ? `Staff${doc.uploadedByStaff ? ` · ${doc.uploadedByStaff.firstName} ${doc.uploadedByStaff.lastName}` : ""}`
                  : doc.task
                    ? `Task: ${doc.task.title}`
                    : `Student · ${DOCUMENT_TYPE_LABELS[doc.documentType] ?? "Other document"}`;
                return (
                  <div
                    key={doc.id}
                    className={`${GRID} px-5 py-3`}
                    style={{ borderBottom: i < files.length - 1 ? "1px solid rgba(0,0,0,0.05)" : "none" }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <FileIcon filename={doc.filename} mimeType={doc.mimeType} />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: "#222" }} title={doc.filename}>{doc.filename}</p>
                        {(doc.description || doc.verificationNote) && (
                          <p className="text-xs truncate" style={{ color: "#999" }}>{doc.description ?? doc.verificationNote}</p>
                        )}
                      </div>
                    </div>
                    <span className="text-xs truncate" style={{ color: "#666" }} title={source}>{source}</span>
                    <span className="text-xs" style={{ color: "#888" }}>{formatSize(doc.sizeBytes)}</span>
                    <span className="text-xs" style={{ color: "#888" }}>{formatDate(doc.uploadedAt)}</span>
                    <span>
                      {isStaffUpload ? (
                        <Badge variant={doc.publishedToStudent ? "green" : "muted"}>
                          {doc.publishedToStudent ? "Visible to student" : "Draft · staff only"}
                        </Badge>
                      ) : (
                        <Badge variant={isVerified ? "green" : isRejected ? "red" : "gold"}>
                          {doc.status.replace("_", " ")}
                        </Badge>
                      )}
                    </span>
                    <div className="flex items-center justify-end gap-3">
                      <a href={`/api/files/${doc.storageKey}`} target="_blank" rel="noreferrer" className="text-xs font-semibold" style={{ color: "#114E3B" }}>
                        View
                      </a>
                      {isStaffUpload && canPublish && (
                        <DocumentPublishButton documentId={doc.id} applicationId={id} published={doc.publishedToStudent} />
                      )}
                      {canVerify && !isStaffUpload && doc.status === "PENDING_REVIEW" && (
                        <DocumentVerifyButtons documentId={doc.id} applicationId={id} />
                      )}
                      {canDelete && <DocumentDeleteButton documentId={doc.id} applicationId={id} filename={doc.filename} />}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
