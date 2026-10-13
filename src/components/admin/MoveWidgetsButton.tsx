"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { useWidgetEdit } from "./WidgetEditContext";

/** "Move Widgets" toggle for the applicant Overview tab; becomes "Save" while arranging. */
export function MoveWidgetsButton({ applicationId }: { applicationId: string }) {
  const pathname = usePathname();
  const { isEditing, setIsEditing, saveRef } = useWidgetEdit();
  const [isSaving, setIsSaving] = useState(false);

  // Widgets only exist on the Overview tab.
  if (pathname !== `/admin/applicants/${applicationId}`) return null;

  async function handleClick() {
    if (!isEditing) {
      setIsEditing(true);
      return;
    }
    if (!saveRef.current) return;
    setIsSaving(true);
    const ok = await saveRef.current();
    setIsSaving(false);
    if (ok) setIsEditing(false);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isSaving}
      aria-pressed={isEditing}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-opacity hover:opacity-90 disabled:opacity-60"
      style={
        isEditing
          ? { backgroundColor: "#114E3B", color: "#fff", border: "1px solid #114E3B" }
          : { backgroundColor: "#fff", color: "#114E3B", border: "1px solid #114E3B" }
      }
    >
      {isEditing ? (
        <>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          {isSaving ? "Saving…" : "Save"}
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h7v5H4zM13 6h7v5h-7zM4 13h16v5H4z" />
          </svg>
          Move Widgets
        </>
      )}
    </button>
  );
}
