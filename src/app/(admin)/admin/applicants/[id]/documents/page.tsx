import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission, hasPermission } from "@/lib/permissions";
import { Badge } from "@/components/ui/Badge";
import { DocumentVerifyButtons } from "./DocumentVerifyButtons";
import { DocumentDeleteButton } from "./DocumentDeleteButton";

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

  return (
    <div>
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {app.documents.length === 0 ? (
          <div className="px-5 py-16 text-center text-sm" style={{ color: "#aaa" }}>No documents uploaded.</div>
        ) : (
          app.documents.map((doc, i) => {
            const isVerified = doc.status === "VERIFIED";
            const isRejected = doc.status === "REJECTED";
            const accentColor = isVerified ? "#22c55e" : isRejected ? "#c0392b" : "#C79A3B";

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
                    {doc.documentType} · Uploaded {new Date(doc.uploadedAt).toLocaleDateString("en-NZ")}
                  </p>
                  {doc.verificationNote && <p className="text-xs mt-0.5 italic" style={{ color: "#aaa" }}>{doc.verificationNote}</p>}
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={isVerified ? "green" : isRejected ? "red" : "muted"}>
                    {doc.status.replace("_", " ")}
                  </Badge>
                  <a
                    href={`/api/files/${doc.storageKey}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold transition-colors"
                    style={{ color: "#114E3B" }}
                  >
                    View
                  </a>
                  {canVerify && doc.status === "PENDING_REVIEW" && (
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