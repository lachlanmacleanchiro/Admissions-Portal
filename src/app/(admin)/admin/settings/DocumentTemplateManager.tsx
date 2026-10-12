"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { MarkdownEditor } from "@/components/shared/MarkdownEditor";
import { STAGE_LABELS, STAGE_ORDER } from "@/lib/stages";
import {
  AUTO_VARIABLES,
  SUGGESTED_FILL_IN_VARIABLES,
  SAMPLE_VALUES,
  extractFillInVariables,
} from "@/lib/documentTemplates";
import type { ApplicationStageKey } from "@/generated/prisma/client";

interface DocumentTemplate {
  id: string;
  stageKey: ApplicationStageKey;
  name: string;
  subject: string;
  bodyMarkdown: string;
  isActive: boolean;
  sortOrder: number;
  updatedAt: string;
  updatedByName: string | null;
}

interface FormState {
  stageKey: ApplicationStageKey;
  name: string;
  subject: string;
  bodyMarkdown: string;
}

const EMPTY_FORM: FormState = { stageKey: "INTERVIEW", name: "", subject: "", bodyMarkdown: "" };

const VARIABLE_GROUPS = [
  { title: "Filled automatically", variables: AUTO_VARIABLES },
  { title: "Filled in by staff when sending", variables: SUGGESTED_FILL_IN_VARIABLES },
];

export function DocumentTemplateManager({ templates }: { templates: DocumentTemplate[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<{ id: string | null; form: FormState } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [pendingDelete, setPendingDelete] = useState<DocumentTemplate | null>(null);

  const stagesWithTemplates = STAGE_ORDER.filter((stage) => templates.some((t) => t.stageKey === stage));

  function openNew() {
    setError("");
    setEditing({ id: null, form: EMPTY_FORM });
  }

  function openEdit(t: DocumentTemplate) {
    setError("");
    setEditing({ id: t.id, form: { stageKey: t.stageKey, name: t.name, subject: t.subject, bodyMarkdown: t.bodyMarkdown } });
  }

  function setField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setEditing((prev) => (prev ? { ...prev, form: { ...prev.form, [field]: value } } : prev));
  }

  async function save() {
    if (!editing) return;
    setIsSaving(true);
    setError("");
    const res = await fetch(editing.id ? `/api/admin/document-templates/${editing.id}` : "/api/admin/document-templates", {
      method: editing.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing.form),
    });
    setIsSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Couldn't save the template. Please try again.");
      return;
    }
    setEditing(null);
    router.refresh();
  }

  async function toggleActive(t: DocumentTemplate) {
    await fetch(`/api/admin/document-templates/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !t.isActive }),
    });
    router.refresh();
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    await fetch(`/api/admin/document-templates/${pendingDelete.id}`, { method: "DELETE" });
    setPendingDelete(null);
    router.refresh();
  }

  const form = editing?.form;
  const fillIns = form ? extractFillInVariables(form.subject, form.bodyMarkdown) : [];
  const canSave = !!form && !!form.name.trim() && !!form.subject.trim() && !!form.bodyMarkdown.trim();

  return (
    <div className="flex flex-col gap-3">
      {templates.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm px-5 py-8 text-center">
          <p className="text-sm text-text">No document templates yet.</p>
          <p className="text-xs mt-1" style={{ color: "#888" }}>
            Create one, such as an interview invitation, and staff can review and send it to applicants at that stage.
          </p>
        </div>
      ) : (
        stagesWithTemplates.map((stage) => (
          <div key={stage} className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-3" style={{ backgroundColor: "#F8F8F6", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
              <span className="text-sm font-semibold" style={{ color: "#222" }}>{STAGE_LABELS[stage]}</span>
            </div>
            {templates
              .filter((t) => t.stageKey === stage)
              .map((t, i, list) => (
                <div
                  key={t.id}
                  className="flex items-start gap-4 px-5 py-3.5"
                  style={{ borderBottom: i < list.length - 1 ? "1px solid rgba(0,0,0,0.05)" : "none" }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold" style={{ color: t.isActive ? "#222" : "#999" }}>{t.name}</p>
                      {!t.isActive && <Badge variant="muted">Inactive</Badge>}
                    </div>
                    <p className="text-xs mt-0.5 truncate" style={{ color: "#888" }}>Subject: {t.subject}</p>
                    <p className="text-[11px] mt-0.5" style={{ color: "#aaa" }}>
                      Updated {new Date(t.updatedAt).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" })}
                      {t.updatedByName ? ` by ${t.updatedByName}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 pt-0.5">
                    <button onClick={() => openEdit(t)} className="text-xs font-semibold" style={{ color: "#114E3B" }}>Edit</button>
                    <button onClick={() => toggleActive(t)} className="text-xs font-semibold" style={{ color: "#666" }}>
                      {t.isActive ? "Deactivate" : "Activate"}
                    </button>
                    <button onClick={() => setPendingDelete(t)} className="text-xs font-semibold" style={{ color: "#c0392b" }}>Delete</button>
                  </div>
                </div>
              ))}
          </div>
        ))
      )}

      <div>
        <Button size="sm" onClick={openNew}>+ New document template</Button>
      </div>

      <Modal
        isOpen={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? "Edit document template" : "New document template"}
        size="xl"
      >
        {form && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Template name"
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                placeholder="e.g. Online interview invitation"
              />
              <div className="flex flex-col gap-1.5">
                <label htmlFor="doc-template-stage" className="text-sm font-semibold text-text">Stage</label>
                <select
                  id="doc-template-stage"
                  value={form.stageKey}
                  onChange={(e) => setField("stageKey", e.target.value as ApplicationStageKey)}
                  className="w-full px-4 py-2.5 rounded-lg text-sm text-text focus:outline-none"
                  style={{ backgroundColor: "#F8F8F6", border: "1.5px solid rgba(0,0,0,0.1)" }}
                >
                  {STAGE_ORDER.map((s) => (
                    <option key={s} value={s}>{STAGE_LABELS[s]}</option>
                  ))}
                </select>
                <p className="text-xs" style={{ color: "#888" }}>
                  Staff see a “Review &amp; send” button for this template while an applicant is at this stage. It is never sent automatically.
                </p>
              </div>
            </div>

            <Input
              label="Email subject"
              value={form.subject}
              onChange={(e) => setField("subject", e.target.value)}
              placeholder="e.g. Your NZCC admissions interview"
            />

            <div>
              <p className="text-sm font-semibold text-text mb-1.5">Document</p>
              <MarkdownEditor
                value={form.bodyMarkdown}
                onChange={(v) => setField("bodyMarkdown", v)}
                variableGroups={VARIABLE_GROUPS}
                previewValues={SAMPLE_VALUES}
                previewLabel="Preview with sample data"
              />
            </div>

            {fillIns.length > 0 && (
              <p className="text-xs" style={{ color: "#8a6416" }}>
                Staff will be asked to fill in: {fillIns.map((v) => `{{${v}}}`).join(", ")}
              </p>
            )}

            {error && (
              <p className="text-sm px-3 py-2 rounded-lg" style={{ color: "#c0392b", backgroundColor: "rgba(192,57,43,0.06)" }}>{error}</p>
            )}

            <div className="flex gap-3 justify-end">
              <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={save} isLoading={isSaving} disabled={!canSave}>
                {editing?.id ? "Save changes" : "Create template"}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={!!pendingDelete} onClose={() => setPendingDelete(null)} title="Delete template?" size="sm">
        <p className="text-sm text-text-muted mb-5">
          “{pendingDelete?.name}” will be removed. Emails already sent from it stay in each applicant&apos;s record.
        </p>
        <div className="flex gap-3 justify-end">
          <Button variant="ghost" onClick={() => setPendingDelete(null)}>Cancel</Button>
          <Button variant="danger" onClick={confirmDelete}>Delete</Button>
        </div>
      </Modal>
    </div>
  );
}
