"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import {
  STANDARD_PREREQUISITE_CODES, splitPrerequisiteRows, hasPrerequisiteDetails, type PrerequisiteRow,
} from "@/lib/prerequisites";

interface PrerequisiteCourseData {
  nzccCourseCode: string;
  equivalentCourseCode: string | null;
  grade: string | null;
  institution: string | null;
  year: number | null;
}

const DETAIL_FIELDS = ["equivalentCourseCode", "grade", "institution"] as const;
const INPUT_STYLE = { backgroundColor: "#F8F8F6", border: "1px solid rgba(0,0,0,0.1)" };

export function PrerequisitesPanel({
  applicationId,
  courses,
  gpaScore,
  prerequisitesMet,
  canEdit,
}: {
  applicationId: string;
  courses: PrerequisiteCourseData[];
  gpaScore: number | null;
  prerequisitesMet: boolean;
  canEdit: boolean;
}) {
  const router = useRouter();
  const savedRows = splitPrerequisiteRows(courses.map((c) => ({
    nzccCourseCode: c.nzccCourseCode,
    equivalentCourseCode: c.equivalentCourseCode ?? "",
    grade: c.grade ?? "",
    institution: c.institution ?? "",
    year: c.year?.toString() ?? "",
  })));
  const [standard, setStandard] = useState<PrerequisiteRow[]>(savedRows.standard);
  const [legacy, setLegacy] = useState<PrerequisiteRow[]>(savedRows.legacy);
  const [gpa, setGpa] = useState(gpaScore?.toString() ?? "");
  const [met, setMet] = useState(prerequisitesMet);
  // GPA and "met" can also be saved from the Edit form; pick up the new saved
  // values so this panel never sends back stale ones.
  const [syncedFrom, setSyncedFrom] = useState({ gpaScore, prerequisitesMet });
  if (syncedFrom.gpaScore !== gpaScore || syncedFrom.prerequisitesMet !== prerequisitesMet) {
    setSyncedFrom({ gpaScore, prerequisitesMet });
    setGpa(gpaScore?.toString() ?? "");
    setMet(prerequisitesMet);
  }
  const [expanded, setExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Summary reflects what's saved, not unsaved edits.
  const enteredCount = savedRows.standard.filter(hasPrerequisiteDetails).length;

  function update(list: "standard" | "legacy", i: number, field: keyof PrerequisiteRow, value: string) {
    const setter = list === "standard" ? setStandard : setLegacy;
    setter((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  }

  async function handleSave() {
    setIsLoading(true);
    setError("");
    const toSave = [...standard.filter(hasPrerequisiteDetails), ...legacy.filter((r) => r.nzccCourseCode.trim())];
    const res = await fetch(`/api/admin/applicants/${applicationId}/prerequisites`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prerequisitesMet: met,
        gpaScore: gpa,
        courses: toSave.map((r) => ({
          nzccCourseCode: r.nzccCourseCode,
          equivalentCourseCode: r.equivalentCourseCode || null,
          grade: r.grade || null,
          institution: r.institution || null,
          year: r.year ? parseInt(r.year, 10) : null,
        })),
      }),
    });
    setIsLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to save. Please try again.");
      return;
    }
    router.refresh();
  }

  function renderRow(list: "standard" | "legacy", row: PrerequisiteRow, i: number) {
    return (
      <tr key={`${list}-${i}`}>
        <td className="pr-2 pb-1.5">
          {list === "standard" ? (
            <span className="font-semibold" style={{ color: "#222" }}>{row.nzccCourseCode}</span>
          ) : (
            <input
              value={row.nzccCourseCode}
              onChange={(e) => update(list, i, "nzccCourseCode", e.target.value)}
              disabled={!canEdit}
              className="w-full px-2 py-1.5 text-xs rounded-md"
              style={INPUT_STYLE}
            />
          )}
        </td>
        {DETAIL_FIELDS.map((field) => (
          <td key={field} className="pr-2 pb-1.5">
            <input
              value={row[field]}
              onChange={(e) => update(list, i, field, e.target.value)}
              disabled={!canEdit}
              className="w-full px-2 py-1.5 text-xs rounded-md"
              style={INPUT_STYLE}
            />
          </td>
        ))}
        <td className="pr-2 pb-1.5">
          <input
            value={row.year}
            onChange={(e) => update(list, i, "year", e.target.value)}
            disabled={!canEdit}
            type="number"
            className="w-16 px-2 py-1.5 text-xs rounded-md"
            style={INPUT_STYLE}
          />
        </td>
        {canEdit && (
          <td className="pb-1.5">
            {list === "legacy" && (
              <button onClick={() => setLegacy((prev) => prev.filter((_, idx) => idx !== i))} className="text-xs" style={{ color: "#c0392b" }} aria-label="Remove course">✕</button>
            )}
          </td>
        )}
      </tr>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="w-full flex items-center justify-between gap-4 px-5 py-3.5 text-left"
        style={{ borderBottom: expanded ? "1px solid rgba(0,0,0,0.06)" : "none", backgroundColor: "#F8F8F6" }}
      >
        <span>
          <span className="block text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#555" }}>Prerequisite Courses</span>
          <span className="block text-xs mt-1" style={{ color: "#888" }}>
            {`${enteredCount} of ${STANDARD_PREREQUISITE_CODES.length} courses entered · Overall grade average: ${gpaScore ?? "—"} · Prerequisites met: ${prerequisitesMet ? "Yes" : "No"}`}
          </span>
        </span>
        <svg
          className="w-4 h-4 flex-shrink-0 transition-transform"
          style={{ color: "#888", transform: expanded ? "rotate(180deg)" : undefined }}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {expanded && (
        <div className="px-5 py-4 flex flex-col gap-3">
          <div className="flex items-end gap-6">
            <div>
              <label className="text-xs font-semibold text-text mb-1 block">Overall Grade Average</label>
              <input
                type="number" step="0.01" value={gpa} onChange={(e) => setGpa(e.target.value)} disabled={!canEdit}
                className="w-32 px-3 py-2 text-sm rounded-lg" style={{ backgroundColor: "#F8F8F6", border: "1.5px solid rgba(0,0,0,0.1)" }}
              />
            </div>
            <label className="flex items-center gap-2 text-sm pb-2" style={{ color: "#333" }}>
              <input type="checkbox" checked={met} onChange={(e) => setMet(e.target.checked)} disabled={!canEdit} />
              Prerequisites met
            </label>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ color: "#999" }}>
                  <th className="text-left font-semibold pb-1.5 pr-2">NZCC Course</th>
                  <th className="text-left font-semibold pb-1.5 pr-2">Equivalent Course</th>
                  <th className="text-left font-semibold pb-1.5 pr-2">Grade</th>
                  <th className="text-left font-semibold pb-1.5 pr-2">Institution</th>
                  <th className="text-left font-semibold pb-1.5 pr-2">Year</th>
                  {canEdit && <th className="pb-1.5"></th>}
                </tr>
              </thead>
              <tbody>
                {standard.map((row, i) => renderRow("standard", row, i))}
                {legacy.map((row, i) => renderRow("legacy", row, i))}
              </tbody>
            </table>
          </div>
          {error && <p className="text-xs" style={{ color: "#c0392b" }}>{error}</p>}
          {canEdit && (
            <div className="flex justify-end">
              <Button size="sm" onClick={handleSave} isLoading={isLoading}>Save</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
