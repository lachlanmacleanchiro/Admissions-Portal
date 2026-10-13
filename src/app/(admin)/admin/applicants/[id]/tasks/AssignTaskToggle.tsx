"use client";

import { useState } from "react";
import { AssignTaskForm } from "./AssignTaskForm";
import type { StaffOption } from "@/lib/staff";

export function AssignTaskToggle({ applicationId, staffId, staffOptions }: { applicationId: string; staffId: string; staffOptions: StaffOption[] }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#999" }}>Tasks</p>
        <button
          onClick={() => setIsOpen((v) => !v)}
          aria-label={isOpen ? "Close new task form" : "Add task"}
          className="flex items-center gap-1.5 pl-3 pr-3.5 h-8 rounded-full text-white text-xs font-semibold transition-colors"
          style={{ backgroundColor: "#114E3B" }}
        >
          <svg className="w-3.5 h-3.5 flex-shrink-0 transition-transform" style={{ transform: isOpen ? "rotate(45deg)" : "none" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          {isOpen ? "Cancel" : "Add Task"}
        </button>
      </div>

      {isOpen && (
        <div className="mb-2">
          <AssignTaskForm applicationId={applicationId} staffId={staffId} staffOptions={staffOptions} onDone={() => setIsOpen(false)} />
        </div>
      )}
    </div>
  );
}
