"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import type { StaffOption } from "@/lib/staff";

export function AddStaffTaskForm({ staffId, staffOptions }: { staffId: string; staffOptions: StaffOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [assignedToId, setAssignedToId] = useState(staffId);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setIsLoading(true);
    setError("");
    const res = await fetch("/api/admin/staff/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description, dueDate, assignedToId }),
    }).catch(() => null);
    setIsLoading(false);
    if (!res || !res.ok) {
      const data = await res?.json().catch(() => ({}));
      setError(data?.error ?? "Couldn't save the task. Please try again.");
      return;
    }
    setTitle("");
    setDescription("");
    setDueDate("");
    setAssignedToId(staffId);
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        + Add Task
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm p-5 flex flex-col gap-4">
      <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#999" }}>New Task</p>
      <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
      <div>
        <label htmlFor="staff-task-description" className="block text-sm font-semibold text-text mb-1.5">Description</label>
        <textarea
          id="staff-task-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full px-3 py-2.5 text-sm focus:outline-none text-text placeholder:text-text-light resize-none rounded-lg"
          style={{ backgroundColor: "#F8F8F6", border: "1.5px solid rgba(0,0,0,0.1)" }}
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="staff-task-assignee" className="text-sm font-semibold text-text">Assign to</label>
          <select
            id="staff-task-assignee"
            value={assignedToId}
            onChange={(e) => setAssignedToId(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg text-sm text-text focus:outline-none"
            style={{ backgroundColor: "#F8F8F6", border: "1.5px solid rgba(0,0,0,0.1)" }}
          >
            {staffOptions.map((s) => (
              <option key={s.id} value={s.id}>{s.id === staffId ? `Me (${s.firstName} ${s.lastName})` : `${s.firstName} ${s.lastName}`}</option>
            ))}
          </select>
        </div>
        <Input label="Due date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      </div>
      {error && <p role="alert" className="text-sm text-red-flag">{error}</p>}
      <div className="flex gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
        <Button type="submit" size="sm" isLoading={isLoading}>Save Task</Button>
      </div>
    </form>
  );
}
