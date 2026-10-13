"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { STAGE_LABELS, STAGE_STATUS_LABELS, STAGE_ORDER } from "@/lib/stages";
import type { ApplicationStageKey, TaskStatus, TaskAudience } from "@/generated/prisma/client";

interface StageAdvancerProps {
  applicationId: string;
  currentStage: ApplicationStageKey;
}

interface NewTask {
  templateId: string;
  title: string;
  audience: TaskAudience;
  defaultAssigneeId: string | null;
}

interface StaffOption {
  id: string;
  firstName: string;
  lastName: string;
}

interface PreviewTask {
  id: string;
  title: string;
  status: TaskStatus;
  audience: TaskAudience;
  stageKey?: ApplicationStageKey | null;
}

export function StageAdvancer({ applicationId, currentStage }: StageAdvancerProps) {
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [targetStage, setTargetStage] = useState<ApplicationStageKey | null>(null);
  const [notes, setNotes] = useState("");
  // Off by default: staff tick it when they want the student emailed about this change.
  const [notifyStudent, setNotifyStudent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [staleTasks, setStaleTasks] = useState<PreviewTask[]>([]);
  const [existingStageTasks, setExistingStageTasks] = useState<PreviewTask[]>([]);
  // Stale tasks the staff member has checked to mark complete now.
  const [completeIds, setCompleteIds] = useState<Set<string>>(new Set());
  // Existing-stage tasks the staff member has UNCHECKED "keep" for — these get reset.
  const [keepIds, setKeepIds] = useState<Set<string>>(new Set());
  // Tasks the target stage will create, and who each is assigned to (templateId → staff id, "" = unassigned).
  const [newTasks, setNewTasks] = useState<NewTask[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [canAssign, setCanAssign] = useState(false);
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMenuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMenuOpen]);

  async function openStageModal(stage: ApplicationStageKey) {
    setTargetStage(stage);
    setIsMenuOpen(false);
    setNotes("");
    setNotifyStudent(false);
    setCompleteIds(new Set());
    setIsPreviewLoading(true);
    const res = await fetch(`/api/admin/applicants/${applicationId}/stage-preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toStage: stage }),
    });
    const data = await res.json();
    setStaleTasks(data.staleTasks ?? []);
    setExistingStageTasks(data.existingStageTasks ?? []);
    // Default: keep every already-completed task from a prior visit to this stage.
    setKeepIds(new Set((data.existingStageTasks ?? []).map((t: PreviewTask) => t.id)));
    const upcoming: NewTask[] = data.newTasks ?? [];
    setNewTasks(upcoming);
    setAssignments(Object.fromEntries(upcoming.map((t) => [t.templateId, t.defaultAssigneeId ?? ""])));
    setCanAssign(!!data.canAssign);
    setStaffOptions(data.staffOptions ?? []);
    setIsPreviewLoading(false);
  }

  function toggleComplete(id: string) {
    setCompleteIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleKeep(id: string) {
    setKeepIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleAdvance() {
    if (!targetStage) return;
    setIsLoading(true);
    const resetTaskIds = existingStageTasks.filter((t) => !keepIds.has(t.id)).map((t) => t.id);
    const res = await fetch(`/api/admin/applicants/${applicationId}/stage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        toStage: targetStage,
        notes,
        notifyStudent,
        completeTaskIds: Array.from(completeIds),
        resetTaskIds,
        ...(canAssign ? { assignments } : {}),
      }),
    });
    setIsLoading(false);
    if (res.ok) {
      setTargetStage(null);
      setNotes("");
      router.refresh();
    }
  }

  return (
    <>
      <div ref={menuRef} className="relative flex-shrink-0">
        <p className="text-[11px] font-semibold uppercase tracking-widest mb-1.5 text-right" style={{ color: "#888" }}>Status</p>
        <button
          onClick={() => setIsMenuOpen((v) => !v)}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg transition-opacity hover:opacity-90"
          style={{ backgroundColor: "#114E3B", color: "#ffffff", boxShadow: "0 2px 8px rgba(17,78,59,0.35)" }}
        >
          {STAGE_STATUS_LABELS[currentStage]}
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d={isMenuOpen ? "M19 15l-7-7-7 7" : "M19 9l-7 7-7-7"} />
          </svg>
        </button>

        {isMenuOpen && (
          <div
            className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg overflow-hidden z-10"
            style={{ border: "1px solid rgba(0,0,0,0.08)" }}
          >
            {STAGE_ORDER.map((stage) => {
              const isCurrent = stage === currentStage;
              return (
                <button
                  key={stage}
                  disabled={isCurrent}
                  onClick={() => openStageModal(stage)}
                  className="w-full text-left px-4 py-2.5 text-sm flex items-center justify-between transition-colors disabled:cursor-not-allowed hover:bg-black/[0.03]"
                  style={{ color: isCurrent ? "#aaa" : "#222" }}
                >
                  {STAGE_LABELS[stage]}
                  {isCurrent && <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "#C79A3B" }}>Current</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <Modal isOpen={!!targetStage} onClose={() => setTargetStage(null)} title="Change Application Stage" size="lg">
        {targetStage && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-text-muted">
              Move this application from{" "}
              <strong className="text-text">{STAGE_LABELS[currentStage]}</strong> to{" "}
              <strong className="text-text">{STAGE_LABELS[targetStage]}</strong>.
            </p>

            {isPreviewLoading && <p className="text-sm text-text-muted">Checking existing tasks…</p>}

            {!isPreviewLoading && staleTasks.length > 0 && (
              <div className="rounded-lg px-4 py-3" style={{ backgroundColor: "#FFF8ED", border: "1px solid rgba(199,154,59,0.3)" }}>
                <p className="text-sm font-semibold mb-1" style={{ color: "#8a6416" }}>
                  {staleTasks.length} open task{staleTasks.length === 1 ? "" : "s"} from earlier stages
                </p>
                <p className="text-xs mb-2.5" style={{ color: "#8a6416" }}>
                  Choose which ones to mark complete now. Anything left unchecked stays open.
                </p>
                <div className="flex flex-col gap-1.5">
                  {staleTasks.map((t) => (
                    <label key={t.id} className="flex items-center gap-2 text-sm" style={{ color: "#333" }}>
                      <input type="checkbox" checked={completeIds.has(t.id)} onChange={() => toggleComplete(t.id)} />
                      {t.title}
                      {t.stageKey && (
                        <span className="text-[10px] uppercase tracking-wide" style={{ color: "#aaa" }}>
                          ({STAGE_LABELS[t.stageKey]})
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {!isPreviewLoading && existingStageTasks.length > 0 && (
              <div className="rounded-lg px-4 py-3" style={{ backgroundColor: "#F0F6F4", border: "1px solid rgba(17,78,59,0.15)" }}>
                <p className="text-sm font-semibold mb-1" style={{ color: "#114E3B" }}>
                  This application has been in {STAGE_LABELS[targetStage]} before
                </p>
                <p className="text-xs mb-2.5" style={{ color: "#3a6b5c" }}>
                  Choose which tasks to keep as-is. Unchecked tasks will be reset and need to be redone.
                </p>
                <div className="flex flex-col gap-1.5">
                  {existingStageTasks.map((t) => (
                    <label key={t.id} className="flex items-center gap-2 text-sm" style={{ color: "#333" }}>
                      <input type="checkbox" checked={keepIds.has(t.id)} onChange={() => toggleKeep(t.id)} />
                      {t.title}
                      <span className="text-[10px] uppercase tracking-wide" style={{ color: "#aaa" }}>({t.status.toLowerCase()})</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {!isPreviewLoading && newTasks.length > 0 && (
              <div className="rounded-lg px-4 py-3" style={{ backgroundColor: "#F8F8F6", border: "1px solid rgba(0,0,0,0.08)" }}>
                <p className="text-sm font-semibold mb-1" style={{ color: "#222" }}>
                  {newTasks.length} new task{newTasks.length === 1 ? "" : "s"} for {STAGE_LABELS[targetStage]}
                </p>
                <p className="text-xs mb-2.5" style={{ color: "#777" }}>
                  {canAssign
                    ? "Choose who's responsible for each. They'll see it in My Tasks."
                    : "These will be created when you confirm."}
                </p>
                <div className="flex flex-col gap-2">
                  {newTasks.map((t) => (
                    <div key={t.templateId} className="flex items-center justify-between gap-3 flex-wrap">
                      <span className="text-sm min-w-0" style={{ color: "#333" }}>
                        {t.title}
                        <span className="ml-2 text-[10px] uppercase tracking-wide" style={{ color: "#aaa" }}>
                          {t.audience === "STAFF" ? "Internal task" : "Student task · staff follow-up"}
                        </span>
                      </span>
                      {canAssign && (
                        <select
                          aria-label={`Assign "${t.title}" to`}
                          value={assignments[t.templateId] ?? ""}
                          onChange={(e) => setAssignments((prev) => ({ ...prev, [t.templateId]: e.target.value }))}
                          className="text-xs px-2 py-1.5 rounded-md"
                          style={{ backgroundColor: "#fff", border: "1px solid rgba(0,0,0,0.12)", color: "#333", minWidth: 170 }}
                        >
                          <option value="">Unassigned</option>
                          {staffOptions.map((s) => (
                            <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-text mb-1.5">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full px-3 py-2.5 text-sm focus:outline-none text-text placeholder:text-text-light resize-none rounded-lg"
                style={{ backgroundColor: "#F8F8F6", border: "1.5px solid rgba(0,0,0,0.1)" }}
                placeholder="Add any notes about this stage change…"
              />
            </div>
            <label className="flex items-center gap-2 text-sm" style={{ color: "#333" }}>
              <input type="checkbox" checked={notifyStudent} onChange={(e) => setNotifyStudent(e.target.checked)} />
              Send student email notification
            </label>
            <div className="flex gap-3 justify-end">
              <Button variant="ghost" onClick={() => setTargetStage(null)}>Cancel</Button>
              <Button onClick={handleAdvance} isLoading={isLoading}>Confirm</Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
