import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/Badge";
import { DocumentUploadForm } from "./DocumentUploadForm";
import { ChecklistUploadButton } from "./ChecklistUploadButton";

type ItemState = "missing" | "uploaded" | "review" | "verified" | "rejected";

interface ChecklistItem {
  key: string;
  label: string;
  hint: string;
  required: boolean;
  state: ItemState;
  note?: string | null;
  upload?: { documentType: string; accept: string; mimeTypes: string[]; typeHint: string };
  link?: { href: string; label: string };
}

const PDF = { accept: ".pdf", mimeTypes: ["application/pdf"], typeHint: "PDF" };
const PDF_OR_WORD = {
  accept: ".pdf,.doc,.docx",
  mimeTypes: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  typeHint: "PDF or Word",
};

const STATE_DISPLAY: Record<ItemState, { label: string; variant: "muted" | "gold" | "green" | "red" | "blue" }> = {
  missing: { label: "Not uploaded", variant: "muted" },
  uploaded: { label: "Uploaded — not submitted", variant: "blue" },
  review: { label: "Under review", variant: "gold" },
  verified: { label: "Accepted", variant: "green" },
  rejected: { label: "Needs replacing", variant: "red" },
};

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  CITIZENSHIP_PROOF: "Citizenship / residency proof",
  IELTS_CERTIFICATE: "IELTS certificate",
  CHIROPRACTOR_RECOMMENDATION: "Recommendation letter",
  TASK_SUBMISSION: "Task upload",
  OFFER_CONDITION_EVIDENCE: "Offer condition evidence",
  GENERAL: "Other document",
};

function documentState(status: string | undefined): ItemState {
  if (!status) return "missing";
  if (status === "VERIFIED") return "verified";
  if (status === "REJECTED") return "rejected";
  return "review";
}

export default async function DocumentsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const application = await prisma.application.findUnique({
    where: { studentId: session.user.id },
    include: {
      documents: { orderBy: { uploadedAt: "desc" }, include: { task: { select: { title: true } } } },
      tasks: {
        where: { audience: "STUDENT", requiresDocument: true },
        orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
        include: { documents: { orderBy: { uploadedAt: "desc" }, take: 1 } },
      },
    },
  });

  if (!application) return <div className="p-8 text-text-muted">Application not found.</div>;

  // Latest application-level upload of each type (documents are newest first).
  const latestByType = new Map<string, (typeof application.documents)[number]>();
  for (const doc of application.documents) {
    if (!doc.taskId && !doc.offerConditionId && !latestByType.has(doc.documentType)) latestByType.set(doc.documentType, doc);
  }

  function applicationItem(
    documentType: string,
    label: string,
    hint: string,
    required: boolean,
    format: typeof PDF
  ): ChecklistItem {
    const latest = latestByType.get(documentType);
    const state = documentState(latest?.status);
    return {
      key: documentType,
      label,
      hint,
      required,
      state,
      note: state === "rejected" ? latest?.verificationNote : null,
      upload:
        state === "missing" || state === "rejected"
          ? { documentType, accept: format.accept, mimeTypes: format.mimeTypes, typeHint: format.typeHint }
          : undefined,
    };
  }

  const items: ChecklistItem[] = [
    applicationItem(
      "CITIZENSHIP_PROOF",
      "Citizenship / residency proof",
      "A clear scan (not a photo) of your passport, birth certificate, whakapapa or refugee documentation. PDF only.",
      true,
      PDF
    ),
    ...(application.englishProficiencyStatus === "IELTS_CERTIFIED"
      ? [applicationItem("IELTS_CERTIFICATE", "IELTS certificate", "Issued within the last 2 years. PDF only.", true, PDF)]
      : []),
    applicationItem(
      "CHIROPRACTOR_RECOMMENDATION",
      "Chiropractor recommendation letter",
      "Optional. PDF or Word document.",
      false,
      PDF_OR_WORD
    ),
    ...application.tasks.map((task): ChecklistItem => {
      const latest = task.documents[0];
      const state: ItemState =
        task.status === "APPROVED" ? "verified"
        : task.status === "REJECTED" ? "rejected"
        : task.status === "SUBMITTED" ? "review"
        : latest ? "uploaded"
        : "missing";
      return {
        key: task.id,
        label: task.title,
        hint: task.documentInstructions || "Upload this from the task page.",
        required: task.isRequired,
        state,
        note: state === "rejected" ? task.reviewNote ?? latest?.verificationNote : null,
        link:
          state === "verified" || state === "review"
            ? undefined
            : { href: `/tasks/${task.id}`, label: state === "rejected" ? "Replace" : state === "uploaded" ? "Submit task" : "Upload" },
      };
    }),
  ];

  const required = items.filter((i) => i.required);
  const received = required.filter((i) => i.state === "review" || i.state === "verified");
  const outstanding = required.length - received.length;

  return (
    <div className="px-8 py-8 max-w-4xl">
      <p className="text-xs font-semibold tracking-widest uppercase text-text-muted mb-1">Secure Storage</p>
      <h1 className="font-serif text-3xl text-text mb-2">My Documents</h1>
      <p className="text-sm text-text-muted mb-8">
        Everything we need from you, and everything you&apos;ve sent us. Only you and the admissions team can see these files.
      </p>

      {/* Checklist */}
      <section className="bg-white rounded-2xl shadow-sm overflow-hidden mb-8" aria-labelledby="checklist-heading">
        <div className="px-5 py-3.5 flex items-center justify-between gap-4 flex-wrap" style={{ borderBottom: "1px solid rgba(0,0,0,0.06)", backgroundColor: "#F8F8F6" }}>
          <h2 id="checklist-heading" className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#555" }}>
            Required documents
          </h2>
          <p className="text-xs font-semibold" style={{ color: outstanding === 0 ? "#114E3B" : "#8a6416" }}>
            {received.length} of {required.length} received{outstanding === 0 ? " — all done" : ""}
          </p>
        </div>
        <ul>
          {items.map((item, i) => {
            const display = STATE_DISPLAY[item.state];
            return (
              <li
                key={item.key}
                className="flex items-start gap-4 px-5 py-4"
                style={{ borderBottom: i < items.length - 1 ? "1px solid rgba(0,0,0,0.05)" : "none" }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold" style={{ color: "#222" }}>{item.label}</p>
                    {!item.required && <span className="text-[10px] uppercase tracking-wide" style={{ color: "#aaa" }}>Optional</span>}
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: "#888" }}>{item.hint}</p>
                  {item.note && (
                    <p className="text-xs mt-1.5 px-2.5 py-1.5 rounded-md" style={{ color: "#c0392b", backgroundColor: "rgba(192,57,43,0.06)" }}>
                      Admissions feedback: {item.note}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <Badge variant={display.variant}>{display.label}</Badge>
                  {item.upload && (
                    <ChecklistUploadButton
                      documentType={item.upload.documentType}
                      accept={item.upload.accept}
                      allowedMimeTypes={item.upload.mimeTypes}
                      typeHint={item.upload.typeHint}
                      label={item.state === "rejected" ? "Replace" : "Upload"}
                    />
                  )}
                  {item.link && (
                    <Link
                      href={item.link.href}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-opacity hover:opacity-90"
                      style={{ backgroundColor: "#114E3B", color: "#fff" }}
                    >
                      {item.link.label}
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Other uploads */}
      <section className="mb-8" aria-labelledby="other-heading">
        <h2 id="other-heading" className="text-[11px] font-semibold uppercase tracking-widest mb-1" style={{ color: "#999" }}>
          Send another document
        </h2>
        <p className="text-xs mb-3" style={{ color: "#888" }}>For anything not on the list above, such as a document the admissions team asked for by message.</p>
        <DocumentUploadForm />
      </section>

      {/* History */}
      {application.documents.length > 0 && (
        <section aria-labelledby="history-heading">
          <div className="flex items-center justify-between mb-3">
            <h2 id="history-heading" className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#999" }}>All uploads</h2>
            <p className="text-xs" style={{ color: "#aaa" }}>{application.documents.length} on file</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {application.documents.map((doc, i) => {
              const state = documentState(doc.status);
              const display = STATE_DISPLAY[state];
              const kind = doc.task?.title ?? DOCUMENT_TYPE_LABELS[doc.documentType] ?? "Other document";
              return (
                <div
                  key={doc.id}
                  className="flex items-center gap-4 px-5 py-3.5"
                  style={{ borderBottom: i < application.documents.length - 1 ? "1px solid rgba(0,0,0,0.05)" : "none" }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: "#222" }}>{doc.filename}</p>
                    <p className="text-xs mt-0.5" style={{ color: "#aaa" }}>
                      {kind} · Uploaded {new Date(doc.uploadedAt).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                  <Badge variant={display.variant}>{display.label}</Badge>
                  <a href={`/api/files/${doc.storageKey}`} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold" style={{ color: "#114E3B" }}>
                    View
                  </a>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
