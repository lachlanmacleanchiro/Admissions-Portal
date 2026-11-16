import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission, hasPermission } from "@/lib/permissions";
import { Badge } from "@/components/ui/Badge";
import { DocumentVerifyButtons } from "./DocumentVerifyButtons";
import { DocumentDeleteButton } from "./DocumentDeleteButton";
import { DocumentPublishButton } from "./DocumentPublishButton";
import { StaffUploadForm } from "./StaffUploadForm";

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
      documents: { orderBy: { uploadedAt: "desc" } },
    },
  });

  if (!app) notFound();

  const canVerify = hasPermission(session, "VERIFY_DOCUMENTS");
  const canDelete = hasPermission(session, "DELETE_DOCUMENTS");
  const canUpload = hasPermission(session, "UPLOAD_DOCUMENTS");
  const canPublish = hasPermission(session, "PUBLISH_DOCUMENTS");

  return (
    <div>
      {canUpload && <StaffUploadForm applicationId={id} canPublish={canPublish} />}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {app.documents.length === 0 ? (
          <div className="px-5 py-16 text-center text-sm" style={{ color: "#aaa" }}>No documents uploaded.</div>
        ) : (
          app.documents.map((doc, i) => {
            const isStaffUpload = !!doc.uploadedByStaffId;
            const isVerified = doc.status === "VERIFIED";
            const isRejected = doc.status === "REJECTED";
            const accentColor = isStaffUpload ? "#3b82f6" : isVerified ? "#22c55e" : isRejected ? "#c0392b" : "#C79A3B";

            return (
              <div
                key={doc.id}
                className="flex items-center gap-4 px-5 py-4"
                style={{
                  borderLeft: `3px solid ${accentColor}`,
                  borderBottom: i < app.documents.length - 1 ? "1px solid rgba(0,0,0,0.05)" : "none",
                }}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: "#222" }}>{doc.filename}</p>
                  <p className="text-xs mt-0.5" style={{ color: "#aaa" }}>
                    {isStaffUpload ? "Staff upload" : doc.documentType} · Uploaded {new Date(doc.uploadedAt).toLocaleDateString("en-NZ")}
                  </p>
                  {doc.description && <p className="text-xs mt-0.5" style={{ color: "#666" }}>{doc.description}</p>}
                  {doc.verificationNote && <p className="text-xs mt-0.5 italic" style={{ color: "#aaa" }}>{doc.verificationNote}</p>}
                </div>
                <div className="flex items-center gap-3">
                  {isStaffUpload ? (
                    <Badge variant={doc.publishedToStudent ? "green" : "muted"}>
                      {doc.publishedToStudent ? "Visible to student" : "Draft · staff only"}
                    </Badge>
                  ) : (
                    <Badge variant={isVerified ? "green" : isRejected ? "red" : "muted"}>
                      {doc.status.replace("_", " ")}
                    </Badge>
                  )}
                  <a
                    href={`/api/files/${doc.storageKey}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold transition-colors"
                    style={{ color: "#114E3B" }}
                  >
                    View
                  </a>
                  {isStaffUpload && canPublish && (
                    <DocumentPublishButton documentId={doc.id} applicationId={id} published={doc.publishedToStudent} />
                  )}
                  {canVerify && !isStaffUpload && doc.status === "PENDING_REVIEW" && (
                    <DocumentVerifyButtons documentId={doc.id} applicationId={id} />
                  )}
                  {canDelete && (
                    <DocumentDeleteButton documentId={doc.id} applicationId={id} filename={doc.filename} />
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}