"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

interface CourseRow {
  nzccCourseCode: string;
  equivalentCourseCode: string;
  grade: string;
  institution: string;
  year: string;
}

interface PrerequisiteCourseData {
  nzccCourseCode: string;
  equivalentCourseCode: string | null;
  grade: string | null;
  institution: string | null;
  year: number | null;
}

const EMPTY_ROW: CourseRow = { nzccCourseCode: "", equivalentCourseCode: "", grade: "", institution: "", year: "" };

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
  const [rows, setRows] = useState<CourseRow[]>(
    courses.length > 0
      ? courses.map((c) => ({
          nzccCourseCode: c.nzccCourseCode,
          equivalentCourseCode: c.equivalentCourseCode ?? "",
          grade: c.grade ?? "",
          institution: c.institution ?? "",
          year: c.year?.toString() ?? "",
        }))
      : [EMPTY_ROW]
  );
  const [isLoading, setIsLoading] = useState(false);

  function updateRow(i: number, field: keyof CourseRow, value: string) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, { ...EMPTY_ROW }]);
  }

  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSave() {
    setIsLoading(true);
    await fetch(`/api/admin/applicants/${applicationId}/prerequisites`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prerequisitesMet,
        courses: rows
          .filter((r) => r.nzccCourseCode.trim())
          .map((r) => ({
            nzccCourseCode: r.nzccCourseCode,
            equivalentCourseCode: r.equivalentCourseCode || null,
            grade: r.grade || null,
            institution: r.institution || null,
            year: r.year ? parseInt(r.year, 10) : null,
          })),
      }),
    });
    setIsLoading(false);
    router.refresh();
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <div className="px-5 py-3.5" style={{ borderBottom: "1px solid rgba(0,0,0,0.06)", backgroundColor: "#F8F8F6" }}>
        <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#555" }}>Prerequisite Courses</p>
      </div>
      <div className="px-5 py-4 flex flex-col gap-3">
        {gpaScore != null && (
          <p className="text-xs" style={{ color: "#888" }}>Overall GPA: <span className="font-semibold" style={{ color: "#222" }}>{gpaScore.toFixed(2)}</span></p>
        )}
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
              {rows.map((row, i) => (
                <tr key={i}>
                  {(["nzccCourseCode", "equivalentCourseCode", "grade", "institution"] as const).map((field) => (
                    <td key={field} className="pr-2 pb-1.5">
                      <input
                        value={row[field]}
                        onChange={(e) => updateRow(i, field, e.target.value)}
                        disabled={!canEdit}
                        className="w-full px-2 py-1.5 text-xs rounded-md"
                        style={{ backgroundColor: "#F8F8F6", border: "1px solid rgba(0,0,0,0.1)" }}
                      />
                    </td>
                  ))}
                  <td className="pr-2 pb-1.5">
                    <input
                      value={row.year}
                      onChange={(e) => updateRow(i, "year", e.target.value)}
                      disabled={!canEdit}
                      type="number"
                      className="w-16 px-2 py-1.5 text-xs rounded-md"
                      style={{ backgroundColor: "#F8F8F6", border: "1px solid rgba(0,0,0,0.1)" }}
                    />
                  </td>
                  {canEdit && (
                    <td className="pb-1.5">
                      <button onClick={() => removeRow(i)} className="text-xs" style={{ color: "#c0392b" }}>✕</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {canEdit && (
          <div className="flex items-center justify-between">
            <button onClick={addRow} className="text-xs font-semibold" style={{ color: "#114E3B" }}>+ Add course</button>
            <Button size="sm" onClick={handleSave} isLoading={isLoading}>Save</Button>
          </div>
        )}
      </div>
    </div>
  );
}
