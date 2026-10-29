"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type YearLevel = "YEAR_1" | "YEAR_2";

const LABELS: Record<YearLevel, string> = { YEAR_1: "Year 1", YEAR_2: "Year 2" };

// Applicants no longer choose their year level, so staff set it here (in the header meta line).
export function YearLevelEditor({
  applicationId,
  yearLevel,
  canEdit,
}: {
  applicationId: string;
  yearLevel: YearLevel;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState<YearLevel>(yearLevel);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  if (!canEdit) return <span>{LABELS[yearLevel]}</span>;

  async function handleChange(next: YearLevel) {
    const previous = value;
    setValue(next);
    setIsSaving(true);
    setError("");
    const res = await fetch(`/api/admin/applicants/${applicationId}/profile`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ yearLevel: next }),
    });
    setIsSaving(false);
    if (!res.ok) {
      setValue(previous);
      setError("Couldn't save year level");
      return;
    }
    router.refresh();
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <select
        aria-label="Year level"
        value={value}
        disabled={isSaving}
        onChange={(e) => handleChange(e.target.value as YearLevel)}
        className="bg-transparent text-xs rounded px-0.5 cursor-pointer border border-transparent hover:border-black/15 focus:border-black/25 focus:outline-none disabled:opacity-50"
        style={{ color: "inherit" }}
      >
        {(Object.keys(LABELS) as YearLevel[]).map((key) => (
          <option key={key} value={key}>{LABELS[key]}</option>
        ))}
      </select>
      {error && <span style={{ color: "#c0392b" }}>{error}</span>}
    </span>
  );
}
