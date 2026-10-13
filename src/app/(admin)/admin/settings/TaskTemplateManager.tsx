"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { STAGE_LABELS, STAGE_ORDER } from "@/lib/stages";
import type { ApplicationStageKey } from "@/generated/prisma/client";
import type { StaffOption } from "@/lib/staff";

type Audience = "STAFF" | "STUDENT";
type DocumentCategory = "ANY" | "DOCUMENT" | "IMAGE";

interface TaskTemplate {
  id: string;
  stageKey: ApplicationStageKey;
  title: string;
  description: string;
  audience: Audience;
  sortOrder: number;
  dueDays: number | null;
  requiresDocument: boolean;
  documentInstructions: string | null;
  requiredDocumentCategory: DocumentCategory;
  defaultAssigneeId: string | null;
}

interface TaskTemplateFormState {
  title: string;
  description: string;
  audience: Audience;
  dueDays: string;
  requiresDocument: boolean;
  documentInstructions: string;
  requiredDocumentCategory: DocumentCategory;
  defaultAssigneeId: string;
}

const EMPTY_FORM: TaskTemplateFormState = {
  title: "",
  description: "",
  audience: "STAFF",
  dueDays: "",
  requiresDocument: false,
  documentInstructions: "",
  requiredDocumentCategory: "ANY",
  defaultAssigneeId: "",
};

export function TaskTemplateManager({ templates, staffOptions }: { templates: TaskTemplate[]; staffOptions: StaffOption[] }) {
  const staffNames = new Map(staffOptions.map((s) => [s.id, `${s.firstName} ${s.lastName}`]));
  const router = useRouter();
  const [openStage, setOpenStage] = useState<ApplicationStageKey | null>(null);
  const [newForm, setNewForm] = useState<TaskTemplateFormState>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<TaskTemplateFormState>(EMPTY_FORM);

  const byStage = new Map<ApplicationStageKey, TaskTemplate[]>();
  for (const stage of STAGE_ORDER) byStage.set(stage, []);
  for (const t of templates) byStage.get(t.stageKey)?.push(t);
  for (const list of byStage.values()) list.sort((a, b) => a.sortOrder - b.sortOrder);

  async function handleCreate(stageKey: ApplicationStageKey) {
    if (!newForm.title.trim() || !newForm.description.trim()) return;
    setIsSaving(true);
    await fetch("/api/admin/task-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stageKey, ...newForm }),
    });
    setIsSaving(false);
    setNewForm(EMPTY_FORM);
    router.refresh();
  }

  function startEdit(t: TaskTemplate) {
    setEditingId(t.id);
    setEditForm({
      title: t.title,
      description: t.description,
      audience: t.audience,
      dueDays: t.dueDays != null ? String(t.dueDays) : "",
      requiresDocument: t.requiresDocument,
      documentInstructions: t.documentInstructions ?? "",
      requiredDocumentCategory: t.requiredDocumentCategory,
      defaultAssigneeId: t.defaultAssigneeId ?? "",
    });
  }

  async function saveEdit(id: string) {
    setIsSaving(true);
    await fetch(`/api/admin/task-templates/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    setIsSaving(false);
    setEditingId(null);
    router.refresh();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/admin/task-templates/${id}`, { method: "DELETE" });
    router.refresh();
  }

  async function move(stageKey: ApplicationStageKey, index: number, direction: -1 | 1) {
    const list = byStage.get(stageKey) ?? [];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= list.length) return;
    const reordered = [...list];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
    await fetch("/api/admin/task-templates/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds: reordered.map((t) => t.id) }),
    });
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      {STAGE_ORDER.map((stage) => {
        const list = byStage.get(stage) ?? [];
        const isOpen = openStage === stage;
        return (
          <div key={stage} className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <button
              onClick={() => setOpenStage(isOpen ? null : stage)}
              className="w-full flex items-center justify-between px-5 py-3.5"
              style={{ backgroundColor: "#F8F8F6" }}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-sm font-semibold" style={{ color: "#222" }}>{STAGE_LABELS[stage]}</span>
                <span className="text-xs" style={{ color: "#999" }}>{list.length} task{list.length === 1 ? "" : "s"}</span>
              </div>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: "#999" }}>
                <path strokeLinecap="round" strokeLinejoin="round" d={isOpen ? "M19 15l-7-7-7 7" : "M19 9l-7 7-7-7"} />
              </svg>
            </button>

            {isOpen && (
              <div className="px-5 py-4 flex flex-col gap-3">
                {list.length === 0 && (
                  <p className="text-sm" style={{ color: "#aaa" }}>No tasks configured for this stage yet.</p>
                )}
                {list.map((t, i) => (
                  <div key={t.id} className="rounded-lg px-4 py-3" style={{ border: "1px solid rgba(0,0,0,0.08)" }}>
                    {editingId === t.id ? (
                      <TaskTemplateForm
                        form={editForm}
                        onChange={setEditForm}
                        onCancel={() => setEditingId(null)}
                        onSave={() => saveEdit(t.id)}
                        isSaving={isSaving}
                        saveLabel="Save"
                        staffOptions={staffOptions}
                      />
                    ) : (
                      <div className="flex items-start gap-3">
                        <div className="flex flex-col gap-1 pt-0.5">
                          <button onClick={() => move(stage, i, -1)} disabled={i === 0} className="disabled:opacity-25" style={{ color: "#999" }}>
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>
                          </button>
                          <button onClick={() => move(stage, i, 1)} disabled={i === list.length - 1} className="disabled:opacity-25" style={{ color: "#999" }}>
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                          </button>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <p className="text-sm font-semibold" style={{ color: "#222" }}>{t.title}</p>
                            <Badge variant={t.audience === "STAFF" ? "blue" : "green"}>{t.audience === "STAFF" ? "Internal" : "Student"}</Badge>
                            {t.dueDays != null && (
                              <span className="text-[10px] uppercase tracking-wide" style={{ color: "#aaa" }}>Due {t.dueDays}d</span>
                            )}
                            {t.defaultAssigneeId && staffNames.has(t.defaultAssigneeId) && (
                              <span className="text-[10px] uppercase tracking-wide" style={{ color: "#114E3B" }}>
                                {t.audience === "STUDENT" ? "Followed up by" : "Assigned to"} {staffNames.get(t.defaultAssigneeId)}
                              </span>
                            )}
                            {t.requiresDocument && (
                              <span className="text-[10px] uppercase tracking-wide" style={{ color: "#aaa" }}>
                                Requires {t.requiredDocumentCategory === "DOCUMENT" ? "document" : t.requiredDocumentCategory === "IMAGE" ? "image" : "file"}
                              </span>
                            )}
                          </div>
                          <p className="text-xs" style={{ color: "#888" }}>{t.description}</p>
                        </div>
                        <div className="flex gap-3 flex-shrink-0">
                          <button onClick={() => startEdit(t)} className="text-xs font-semibold" style={{ color: "#114E3B" }}>Edit</button>
                          <button onClick={() => handleDelete(t.id)} className="text-xs font-semibold" style={{ color: "#c0392b" }}>Delete</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                <div className="rounded-lg px-4 py-3" style={{ backgroundColor: "#F8F8F6" }}>
                  <p className="text-[11px] font-semibold uppercase tracking-widest mb-2.5" style={{ color: "#999" }}>Add task</p>
                  <TaskTemplateForm
                    form={newForm}
                    onChange={setNewForm}
                    onSave={() => handleCreate(stage)}
                    isSaving={isSaving}
                    saveLabel="Add task"
                    staffOptions={staffOptions}
                    saveDisabled={!newForm.title.trim() || !newForm.description.trim()}
                    fieldBg="#fff"
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TaskTemplateForm({
  form,
  onChange,
  onSave,
  onCancel,
  isSaving,
  saveLabel,
  saveDisabled,
  fieldBg = "#F8F8F6",
  staffOptions,
}: {
  form: TaskTemplateFormState;
  onChange: (form: TaskTemplateFormState) => void;
  onSave: () => void;
  onCancel?: () => void;
  isSaving: boolean;
  saveLabel: string;
  saveDisabled?: boolean;
  fieldBg?: string;
  staffOptions: StaffOption[];
}) {
  function set<K extends keyof TaskTemplateFormState>(field: K, value: TaskTemplateFormState[K]) {
    onChange({ ...form, [field]: value });
  }

  return (
    <div className="flex flex-col gap-2.5">
      <Input label="Title" value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Review academic transcripts" />
      <div>
        <label className="block text-sm font-semibold text-text mb-1.5">Description</label>
        <textarea
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          rows={2}
          className="w-full px-3 py-2.5 text-sm focus:outline-none text-text placeholder:text-text-light resize-none rounded-lg"
          style={{ backgroundColor: fieldBg, border: "1.5px solid rgba(0,0,0,0.1)" }}
          placeholder="What needs to happen"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Due (days after entering stage, optional)"
          type="number"
          min={0}
          value={form.dueDays}
          onChange={(e) => set("dueDays", e.target.value)}
          placeholder="e.g. 7"
        />
        <div className="flex flex-col justify-end pb-2.5">
          <label className="flex items-center gap-2 text-sm text-text cursor-pointer">
            <input
              type="checkbox"
              checked={form.requiresDocument}
              onChange={(e) => set("requiresDocument", e.target.checked)}
              className="accent-green"
            />
            Requires document upload
          </label>
        </div>
      </div>

      {form.requiresDocument && (
        <>
          <div>
            <label className="block text-sm font-semibold text-text mb-1.5">Accepted file type</label>
            <select
              value={form.requiredDocumentCategory}
              onChange={(e) => set("requiredDocumentCategory", e.target.value as DocumentCategory)}
              className="w-full px-3 py-2.5 text-sm focus:outline-none text-text rounded-lg"
              style={{ backgroundColor: fieldBg, border: "1.5px solid rgba(0,0,0,0.1)" }}
            >
              <option value="ANY">Any file type</option>
              <option value="DOCUMENT">Document only (PDF or Word)</option>
              <option value="IMAGE">Image only (JPG, PNG, etc.)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-text mb-1.5">Document instructions</label>
            <textarea
              value={form.documentInstructions}
              onChange={(e) => set("documentInstructions", e.target.value)}
              rows={2}
              className="w-full px-3 py-2.5 text-sm focus:outline-none text-text placeholder:text-text-light resize-none rounded-lg"
              style={{ backgroundColor: fieldBg, border: "1.5px solid rgba(0,0,0,0.1)" }}
              placeholder="Tell the student what to upload…"
            />
          </div>
        </>
      )}

      <AudienceToggle value={form.audience} onChange={(a) => set("audience", a)} />

      <div>
        <label className="block text-sm font-semibold text-text mb-1.5">{form.audience === "STUDENT" ? "Default staff follow-up" : "Default assignee"}</label>
        <select
          value={form.defaultAssigneeId}
          onChange={(e) => set("defaultAssigneeId", e.target.value)}
          className="w-full px-3 py-2.5 text-sm focus:outline-none text-text rounded-lg"
          style={{ backgroundColor: fieldBg, border: "1.5px solid rgba(0,0,0,0.1)" }}
        >
          <option value="">{form.audience === "STUDENT" ? "No one" : "Unassigned"}</option>
          {staffOptions.map((s) => (
            <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>
          ))}
        </select>
        <p className="text-xs mt-1" style={{ color: "#888" }}>
          {form.audience === "STUDENT"
            ? "The staff member who follows this task up and reviews it once the student submits it."
            : "The staff member this task goes to when it's created."}{" "}
          Can be changed when moving an applicant to this stage.
        </p>
      </div>

      <div className="flex gap-2 justify-end">
        {onCancel && <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>}
        <Button size="sm" isLoading={isSaving} onClick={onSave} disabled={saveDisabled}>{saveLabel}</Button>
      </div>
    </div>
  );
}

function AudienceToggle({ value, onChange }: { value: Audience; onChange: (v: Audience) => void }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-text mb-1.5">Task type</label>
      <div className="flex gap-2">
        {(["STAFF", "STUDENT"] as Audience[]).map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => onChange(a)}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors"
            style={
              value === a
                ? { backgroundColor: "#114E3B", color: "#fff" }
                : { backgroundColor: "#fff", color: "#888", border: "1px solid rgba(0,0,0,0.1)" }
            }
          >
            {a === "STAFF" ? "Internal task" : "Student task"}
          </button>
        ))}
      </div>
      <p className="text-xs mt-1" style={{ color: "#888" }}>
        {value === "STAFF"
          ? "Done by staff. The student never sees it."
          : "Shown in the student's My Tasks for them to complete."}
      </p>
    </div>
  );
}
