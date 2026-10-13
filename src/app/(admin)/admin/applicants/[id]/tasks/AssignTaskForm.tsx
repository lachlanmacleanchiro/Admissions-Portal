"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import type { StaffOption } from "@/lib/staff";

export function AssignTaskForm({ applicationId, staffId, staffOptions, onDone }: { applicationId: string; staffId: string; staffOptions: StaffOption[]; onDone?: () => void }) {
  const router = useRouter();
  const [form, setForm] = useState({
    title: "", description: "", dueDate: "", isRequired: true, requiresDocument: false, documentInstructions: "", requiredDocumentCategory: "ANY", assignedToId: "",
  });
  const [isLoading, setIsLoading] = useState(false);

  function set(field: string, value: string | boolean) {
    setForm((p) => ({ ...p, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    await fetch(`/api/admin/applicants/${applicationId}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, assignedById: staffId }),
    });
    setIsLoading(false);
    setForm({ title: "", description: "", dueDate: "", isRequired: true, requiresDocument: false, documentInstructions: "", requiredDocumentCategory: "ANY", assignedToId: "" });
    router.refresh();
    onDone?.();
  }

  const textareaStyle = {
    backgroundColor: "#F8F8F6",
    border: "1.5px solid rgba(0,0,0,0.1)",
    borderRadius: "8px",
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm p-5 flex flex-col gap-4">
      <Input label="Task title" value={form.title} onChange={(e) => set("title", e.target.value)} required />
      <div>
        <label className="block text-sm font-semibold text-text mb-1.5">Description</label>
        <textarea
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          rows={3}
          className="w-full px-3 py-2.5 text-sm focus:outline-none text-text placeholder:text-text-light resize-none"
          style={textareaStyle}
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="new-task-assignee" className="text-sm font-semibold text-text">Assign to</label>
        <select
          id="new-task-assignee"
          value={form.assignedToId}
          onChange={(e) => set("assignedToId", e.target.value)}
          className="w-full px-3 py-2.5 text-sm focus:outline-none text-text rounded-lg"
          style={textareaStyle}
        >
          <option value="">Unassigned</option>
          {staffOptions.map((s) => (
            <option key={s.id} value={s.id}>{s.id === staffId ? `Me (${s.firstName} ${s.lastName})` : `${s.firstName} ${s.lastName}`}</option>
          ))}
        </select>
        <p className="text-xs" style={{ color: "#888" }}>The staff member responsible. It appears in their My Tasks.</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input label="Due date (optional)" type="date" value={form.dueDate} onChange={(e) => set("dueDate", e.target.value)} />
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
      </div>
      {form.requiresDocument && (
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-semibold text-text mb-1.5">Document instructions</label>
            <textarea
              value={form.documentInstructions}
              onChange={(e) => set("documentInstructions", e.target.value)}
              rows={2}
              className="w-full px-3 py-2.5 text-sm focus:outline-none text-text placeholder:text-text-light resize-none"
              style={textareaStyle}
              placeholder="Tell the student what to upload…"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-text mb-1.5">Accepted file type</label>
            <select
              value={form.requiredDocumentCategory}
              onChange={(e) => set("requiredDocumentCategory", e.target.value)}
              className="w-full px-3 py-2.5 text-sm focus:outline-none text-text rounded-lg"
              style={textareaStyle}
            >
              <option value="ANY">Any file type</option>
              <option value="DOCUMENT">Document (PDF/Word) — e.g. transcripts</option>
              <option value="IMAGE">Image only — e.g. passport or ID</option>
            </select>
          </div>
        </div>
      )}
      <Button type="submit" isLoading={isLoading} size="sm">Assign Task</Button>
    </form>
  );
}
