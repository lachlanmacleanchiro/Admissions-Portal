"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { MarkdownEditor } from "@/components/shared/MarkdownEditor";
import {
  AUTO_VARIABLES,
  SUGGESTED_FILL_IN_VARIABLES,
  extractVariables,
  fillTemplate,
  humaniseVariableName,
} from "@/lib/documentTemplates";

interface StageTemplate {
  id: string;
  name: string;
  subject: string;
  bodyMarkdown: string;
}

interface PastSend {
  id: string;
  templateId: string | null;
  subject: string;
  sentAt: string;
  sentByName: string;
}

interface StageDocumentsPanelProps {
  applicationId: string;
  stageLabel: string;
  studentEmail: string;
  templates: StageTemplate[];
  sends: PastSend[];
  autoValues: Record<string, string>;
  canSend: boolean;
}

const VARIABLE_GROUPS = [
  { title: "Filled automatically", variables: AUTO_VARIABLES },
  { title: "Fill in below", variables: SUGGESTED_FILL_IN_VARIABLES },
];

const AUTO_LABELS = Object.fromEntries(AUTO_VARIABLES.map((v) => [v.key, v.label]));

function formatSentAt(iso: string) {
  return new Date(iso).toLocaleString("en-NZ", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

export function StageDocumentsPanel({
  applicationId,
  stageLabel,
  studentEmail,
  templates,
  sends,
  autoValues,
  canSend,
}: StageDocumentsPanelProps) {
  const router = useRouter();
  const [active, setActive] = useState<StageTemplate | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const [justSent, setJustSent] = useState<string | null>(null);

  function openReview(t: StageTemplate) {
    setActive(t);
    setSubject(t.subject);
    setBody(t.bodyMarkdown);
    setFieldValues({});
    setError("");
  }

  const values = { ...autoValues, ...fieldValues };
  // Fields staff must complete: custom variables, plus auto ones with no data (e.g. no interview date yet).
  const fields = extractVariables(subject, body).filter((key) => !autoValues[key]);
  const missing = fields.filter((key) => !values[key]?.trim());
  const finalSubject = fillTemplate(subject, values);
  const finalBody = fillTemplate(body, values);

  async function send() {
    if (!active || missing.length > 0) return;
    setIsSending(true);
    setError("");
    const res = await fetch(`/api/admin/applicants/${applicationId}/document-sends`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId: active.id, subject: finalSubject, bodyMarkdown: finalBody }),
    });
    setIsSending(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "The email couldn't be sent. Please try again.");
      return;
    }
    setJustSent(active.name);
    setActive(null);
    router.refresh();
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden col-span-2" style={{ borderLeft: "3px solid #C79A3B" }}>
      <div className="px-5 py-3.5" style={{ borderBottom: "1px solid rgba(0,0,0,0.06)", backgroundColor: "#F8F8F6" }}>
        <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#555" }}>
          Documents for {stageLabel}
        </p>
        <p className="text-xs mt-0.5" style={{ color: "#888" }}>
          Nothing is sent automatically. Review each document, then send it to {studentEmail}.
        </p>
      </div>

      {justSent && (
        <p className="px-5 py-2.5 text-sm" style={{ color: "#114E3B", backgroundColor: "rgba(17,78,59,0.06)" }} role="status">
          “{justSent}” was sent.
        </p>
      )}

      {templates.map((t, i) => {
        const lastSend = sends.find((s) => s.templateId === t.id);
        return (
          <div
            key={t.id}
            className="flex items-center gap-4 px-5 py-3.5"
            style={{ borderBottom: i < templates.length - 1 ? "1px solid rgba(0,0,0,0.05)" : "none" }}
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold" style={{ color: "#222" }}>{t.name}</p>
              <p className="text-xs mt-0.5" style={{ color: lastSend ? "#114E3B" : "#C79A3B" }}>
                {lastSend ? `Sent ${formatSentAt(lastSend.sentAt)} by ${lastSend.sentByName}` : "Not sent yet"}
              </p>
            </div>
            {canSend && (
              <Button size="sm" variant={lastSend ? "secondary" : "primary"} onClick={() => openReview(t)}>
                {lastSend ? "Review & send again" : "Review & send"}
              </Button>
            )}
          </div>
        );
      })}

      <Modal isOpen={!!active} onClose={() => setActive(null)} title={active ? `Review: ${active.name}` : ""} size="xl">
        {active && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-text-muted">
              To <strong className="text-text">{studentEmail}</strong>. Check the details, make any changes for this applicant, then send.
              Changes here don&apos;t affect the template.
            </p>

            {fields.length > 0 && (
              <div className="rounded-lg px-4 py-3" style={{ backgroundColor: "#FFF8ED", border: "1px solid rgba(199,154,59,0.3)" }}>
                <p className="text-sm font-semibold mb-2.5" style={{ color: "#8a6416" }}>Fill in before sending</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {fields.map((key) => (
                    <Input
                      key={key}
                      id={`doc-field-${key}`}
                      label={AUTO_LABELS[key] ?? humaniseVariableName(key)}
                      value={fieldValues[key] ?? ""}
                      onChange={(e) => setFieldValues((prev) => ({ ...prev, [key]: e.target.value }))}
                      placeholder={`{{${key}}}`}
                    />
                  ))}
                </div>
              </div>
            )}

            <Input id="doc-send-subject" label="Email subject" value={subject} onChange={(e) => setSubject(e.target.value)} />

            <MarkdownEditor
              value={body}
              onChange={setBody}
              variableGroups={VARIABLE_GROUPS}
              previewValues={values}
              previewLabel="What the applicant will receive"
              minHeight={320}
            />

            {error && (
              <p className="text-sm px-3 py-2 rounded-lg" style={{ color: "#c0392b", backgroundColor: "rgba(192,57,43,0.06)" }} role="alert">{error}</p>
            )}

            <div className="flex items-center gap-3 justify-end">
              {missing.length > 0 && (
                <p className="text-xs mr-auto" style={{ color: "#8a6416" }}>
                  {missing.length} field{missing.length === 1 ? "" : "s"} still to fill in
                </p>
              )}
              <Button variant="ghost" onClick={() => setActive(null)}>Cancel</Button>
              <Button onClick={send} isLoading={isSending} disabled={missing.length > 0}>
                Send to applicant
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
