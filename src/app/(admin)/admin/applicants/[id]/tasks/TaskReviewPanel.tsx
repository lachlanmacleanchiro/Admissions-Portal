"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

interface TaskReviewPanelProps {
  taskId: string;
  applicationId: string;
  studentNote: string | null;
  submittedAt: string | Date | null;
  acknowledgedAt: string | Date | null;
}

function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" });
}

/** Review controls for a submitted student task, laid out as a section of the task row. */
export function TaskReviewPanel({ taskId, applicationId, studentNote, submittedAt, acknowledgedAt }: TaskReviewPanelProps) {
  const router = useRouter();
  const [reviewNote, setReviewNote] = useState("");
  const [pending, setPending] = useState<"approve" | "reject" | "acknowledge" | null>(null);
  const [error, setError] = useState("");

  async function handleAction(action: "approve" | "reject" | "acknowledge") {
    if (action === "reject" && !reviewNote.trim()) {
      setError("Add a note telling the student what to change before requesting changes.");
      return;
    }
    setPending(action);
    setError("");
    const res = await fetch(`/api/admin/applicants/${applicationId}/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reviewNote }),
    }).catch(() => null);
    setPending(null);
    if (!res || !res.ok) {
      setError("That didn't save. Please try again.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-4 pt-4 flex flex-col gap-3" style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm font-semibold" style={{ color: "#222" }}>
          Review submission
          {submittedAt && (
            <span className="ml-2 text-xs font-normal" style={{ color: "#999" }}>Submitted {formatDate(submittedAt)}</span>
          )}
        </p>
        {acknowledgedAt ? (
          <span className="text-xs" style={{ color: "#999" }}>Seen {formatDate(acknowledgedAt)}</span>
        ) : (
          <button
            type="button"
            onClick={() => handleAction("acknowledge")}
            disabled={pending !== null}
            className="text-xs font-semibold hover:underline disabled:opacity-50"
            style={{ color: "#114E3B" }}
          >
            Mark as seen
          </button>
        )}
      </div>

      {studentNote && (
        <div>
          <p className="text-xs font-medium mb-0.5" style={{ color: "#888" }}>Note from the student</p>
          <p className="text-sm whitespace-pre-wrap" style={{ color: "#333" }}>{studentNote}</p>
        </div>
      )}

      <div>
        <label htmlFor={`review-note-${taskId}`} className="block text-xs font-medium mb-1" style={{ color: "#888" }}>
          Note to the student <span style={{ color: "#aaa" }}>(required when requesting changes)</span>
        </label>
        <textarea
          id={`review-note-${taskId}`}
          value={reviewNote}
          onChange={(e) => { setReviewNote(e.target.value); setError(""); }}
          rows={2}
          className="w-full px-3 py-2 text-sm focus:outline-none text-text placeholder:text-text-light resize-y rounded-lg"
          style={{ backgroundColor: "#fff", border: "1px solid rgba(0,0,0,0.15)" }}
          placeholder="e.g. Please upload a certified copy"
        />
      </div>

      {error && <p role="alert" className="text-xs" style={{ color: "#c0392b" }}>{error}</p>}

      <div className="flex gap-2">
        <Button size="sm" onClick={() => handleAction("approve")} isLoading={pending === "approve"} disabled={pending !== null}>
          Approve
        </Button>
        <Button size="sm" variant="secondary" onClick={() => handleAction("reject")} isLoading={pending === "reject"} disabled={pending !== null}>
          Request changes
        </Button>
      </div>
    </div>
  );
}
