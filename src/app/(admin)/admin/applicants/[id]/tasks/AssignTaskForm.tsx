"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import type { StaffOption } from "@/lib/staff";

/** STAFF = internal task (staff only); STUDENT = task shown in the student's portal. */
export type TaskKind = "STAFF" | "STUDENT";

const EMPTY = {
  title: "", description: "", dueDate: "", isRequired: true, requiresDocument: false,
  documentInstructions: "", requiredDocumentCategory: "ANY", assignedToId: "",
};

export function AssignTaskForm({
  kind,
  applicationId,
  staffId,
  staffOptions,
  onBack,
  onDone,
}: {
  kind: TaskKind;
  applicationId: string;
  staffId: string;
  staffOptions: StaffOption[];
  onBack?: () => void;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState({ ...EMPTY, assignedToId: kind === "STAFF" ? staffId : "" });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const isStudent = kind === "STUDENT";

  function set(field: string, value: string | boolean) {
    setForm((p) => ({ ...p, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    const res = await fetch(`/api/admin/applicants/${applicationId}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        audience: kind,
        // Internal tasks have no student-facing upload or "required" flag.
        ...(isStudent ? {} : { requiresDocument: false, isRequired: true }),
      }),
    }).catch(() => null);
    setIsLoading(false);
    if (!res || !res.ok) {
      const data = await res?.json().catch(() => ({}));
      setError(data?.error ?? "Couldn't create the task. Please try again.");
      return;
    }
    setForm({ ...EMPTY, assignedToId: kind === "STAFF" ? staffId : "" });
    router.refresh();
    onDone?.();
  }

  const fieldStyle = {
    backgroundColor: "#F8F8F6",
    border: "1.5px solid rgba(0,0,0,0.1)",
    borderRadius: "8px",
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold" style={{ color: "#222" }}>{isStudent ? "New student task" : "New internal task"}</p>
          <p className="text-xs mt-0.5" style={{ color: "#888" }}>
            {isStudent
              ? "The student will see this in their My Tasks and can submit it."
              : "Only staff can see this. The student is never shown it."}
          </p>
        </div>
        {onBack && (
          <button type="button" onClick={onBack} className="text-xs font-semibold flex-shrink-0" style={{ color: "#114E3B" }}>
            ← Change type
          </button>
        )}
      </div>

      <Input
        id="new-task-title"
        label="Task title"
        value={form.title}
        onChange={(e) => set("title", e.target.value)}
        placeholder={isStudent ? "e.g. Upload your latest transcript" : "e.g. Call chiropractor referee"}
        required
      />
      <div>
        <label htmlFor="new-task-description" className="block text-sm font-semibold text-text mb-1.5">
          {isStudent ? "Instructions for the student" : "Description"}
        </label>
        <textarea
          id="new-task-description"
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          rows={3}
          className="w-full px-3 py-2.5 text-sm focus:outline-none text-text placeholder:text-text-light resize-none"
          style={fieldStyle}
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="new-task-assignee" className="text-sm font-semibold text-text">
          {isStudent ? "Staff follow-up" : "Assign to"}
        </label>
        <select
          id="new-task-assignee"
          value={form.assignedToId}
          onChange={(e) => set("assignedToId", e.target.value)}
          className="w-full px-3 py-2.5 text-sm focus:outline-none text-text rounded-lg"
          style={fieldStyle}
        >
          <option value="">{isStudent ? "No one" : "Unassigned"}</option>
          {staffOptions.map((s) => (
            <option key={s.id} value={s.id}>{s.id === staffId ? `Me (${s.firstName} ${s.lastName})` : `${s.firstName} ${s.lastName}`}</option>
          ))}
        </select>
        <p className="text-xs" style={{ color: "#888" }}>
          {isStudent
            ? "Keeps an eye on it and reviews it. It shows under Following in their My Tasks, then Needs your review once submitted."
            : "The staff member who does this. It appears in their My Tasks."}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input id="new-task-due" label="Due date (optional)" type="date" value={form.dueDate} onChange={(e) => set("dueDate", e.target.value)} />
        {isStudent && (
          <div className="flex flex-col gap-3 pt-6">
            <label className="flex items-center gap-2 text-sm text-text cursor-pointer">
              <input type="checkbox" checked={form.isRequired} onChange={(e) => set("isRequired", e.target.checked)} className="accent-green" />
              Required
            </label>
            <label className="flex items-center gap-2 text-sm text-text cursor-pointer">
              <input type="checkbox" checked={form.requiresDocument} onChange={(e) => set("requiresDocument", e.target.checked)} className="accent-green" />
              Requires document upload
            </label>
          </div>
        )}
      </div>
      {isStudent && form.requiresDocument && (
        <div className="flex flex-col gap-4">
          <div>
            <label htmlFor="new-task-doc-instructions" className="block text-sm font-semibold text-text mb-1.5">Document instructions</label>
            <textarea
              id="new-task-doc-instructions"
              value={form.documentInstructions}
              onChange={(e) => set("documentInstructions", e.target.value)}
              rows={2}
              className="w-full px-3 py-2.5 text-sm focus:outline-none text-text placeholder:text-text-light resize-none"
              style={fieldStyle}
              placeholder="Tell the student what to upload…"
            />
          </div>
          <div>
            <label htmlFor="new-task-doc-category" className="block text-sm font-semibold text-text mb-1.5">Accepted file type</label>
            <select
              id="new-task-doc-category"
              value={form.requiredDocumentCategory}
              onChange={(e) => set("requiredDocumentCategory", e.target.value)}
              className="w-full px-3 py-2.5 text-sm focus:outline-none text-text rounded-lg"
              style={fieldStyle}
            >
              <option value="ANY">Any file type</option>
              <option value="DOCUMENT">Document (PDF/Word) — e.g. transcripts</option>
              <option value="IMAGE">Image only — e.g. passport or ID</option>
            </select>
          </div>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-red-flag">{error}</p>}
      <Button type="submit" isLoading={isLoading} size="sm">
        {isStudent ? "Create student task" : "Create internal task"}
      </Button>
    </form>
  );
}
