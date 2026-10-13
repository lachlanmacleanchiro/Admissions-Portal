"use client";

import { useState } from "react";
import { AssignTaskForm, type TaskKind } from "./AssignTaskForm";
import type { StaffOption } from "@/lib/staff";

const KINDS: { value: TaskKind; title: string; description: string }[] = [
  {
    value: "STAFF",
    title: "Internal task",
    description: "Work for staff to do. The student never sees it. Assign it to a staff member.",
  },
  {
    value: "STUDENT",
    title: "Student task",
    description: "Something the student needs to do. Shows in their My Tasks. A staff member can follow it up.",
  },
];

export function AssignTaskToggle({ applicationId, staffId, staffOptions }: { applicationId: string; staffId: string; staffOptions: StaffOption[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [kind, setKind] = useState<TaskKind | null>(null);

  function close() {
    setIsOpen(false);
    setKind(null);
  }

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#999" }}>Tasks</p>
        <button
          onClick={() => (isOpen ? close() : setIsOpen(true))}
          aria-label={isOpen ? "Close new task form" : "New task"}
          aria-expanded={isOpen}
          className="flex items-center gap-1.5 pl-3 pr-3.5 h-8 rounded-full text-white text-xs font-semibold transition-colors"
          style={{ backgroundColor: "#114E3B" }}
        >
          <svg className="w-3.5 h-3.5 flex-shrink-0 transition-transform" style={{ transform: isOpen ? "rotate(45deg)" : "none" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          {isOpen ? "Cancel" : "New Task"}
        </button>
      </div>

      {isOpen && !kind && (
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <p className="text-sm font-semibold text-text mb-3">What kind of task?</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {KINDS.map((k) => (
              <button
                key={k.value}
                type="button"
                onClick={() => setKind(k.value)}
                className="text-left rounded-xl px-4 py-3.5 transition-colors hover:bg-black/[0.02]"
                style={{ border: "1.5px solid rgba(0,0,0,0.1)" }}
              >
                <span className="flex items-center gap-2">
                  <span className="text-sm font-semibold" style={{ color: "#222" }}>{k.title}</span>
                  <span
                    className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded"
                    style={k.value === "STAFF" ? { backgroundColor: "#EFF6FF", color: "#1D4ED8" } : { backgroundColor: "rgba(17,78,59,0.08)", color: "#114E3B" }}
                  >
                    {k.value === "STAFF" ? "Staff only" : "Visible to student"}
                  </span>
                </span>
                <span className="block text-xs mt-1" style={{ color: "#777" }}>{k.description}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {isOpen && kind && (
        <div className="mb-2">
          <AssignTaskForm
            key={kind}
            kind={kind}
            applicationId={applicationId}
            staffId={staffId}
            staffOptions={staffOptions}
            onBack={() => setKind(null)}
            onDone={close}
          />
        </div>
      )}
    </div>
  );
}
