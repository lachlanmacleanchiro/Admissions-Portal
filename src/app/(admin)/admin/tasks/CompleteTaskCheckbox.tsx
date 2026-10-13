"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Marks a My Tasks item done: a personal to-do, or a staff applicant task. */
export function CompleteTaskCheckbox({
  kind,
  taskId,
  applicationId,
  title,
}: {
  kind: "todo" | "applicant";
  taskId: string;
  applicationId?: string;
  title: string;
}) {
  const router = useRouter();
  const [isDone, setIsDone] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(false);

  async function complete() {
    setIsSaving(true);
    setError(false);
    const res = await fetch(
      kind === "todo" ? `/api/admin/staff/tasks/${taskId}` : `/api/admin/applicants/${applicationId}/tasks/${taskId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: kind === "todo" ? "complete" : "toggle-complete" }),
      }
    ).catch(() => null);
    setIsSaving(false);
    if (!res || !res.ok) {
      setError(true);
      return;
    }
    setIsDone(true);
    router.refresh();
  }

  return (
    <span className="flex flex-col items-center">
      <input
        type="checkbox"
        checked={isDone}
        disabled={isSaving || isDone}
        onChange={complete}
        aria-label={`Mark "${title}" complete`}
        className="w-4 h-4 accent-green cursor-pointer disabled:cursor-wait"
      />
      {error && <span role="alert" className="text-[10px] mt-0.5" style={{ color: "#c0392b" }}>Failed</span>}
    </span>
  );
}
