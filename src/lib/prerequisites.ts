/**
 * The prerequisite courses every Year 2 applicant is assessed against. Staff
 * fill in the equivalent course and grade for each from the transcript.
 */
export const STANDARD_PREREQUISITE_CODES = [
  "HUMBIO1",
  "HUMBIO2",
  "LIFESCI1",
  "LIFESCI2",
  "BIOMECP",
  "ELECTIVE 1",
  "ELECTIVE 2",
  "ELECTIVE 3",
] as const;

export interface PrerequisiteRow {
  nzccCourseCode: string;
  equivalentCourseCode: string;
  grade: string;
  institution: string;
  year: string;
}

/** Course codes were free text, so match them ignoring case and spaces. */
export function normaliseCourseCode(code: string): string {
  return code.replace(/\s+/g, "").toUpperCase();
}

export function hasPrerequisiteDetails(row: PrerequisiteRow): boolean {
  return [row.equivalentCourseCode, row.grade, row.institution, row.year].some((v) => v.trim() !== "");
}

/**
 * Lays saved rows out against the standard list: one row per standard code
 * (filled from the first matching saved row), plus "legacy" rows for anything
 * that doesn't match or duplicates a code, so no saved data is dropped.
 */
export function splitPrerequisiteRows(saved: PrerequisiteRow[]): { standard: PrerequisiteRow[]; legacy: PrerequisiteRow[] } {
  const standard: PrerequisiteRow[] = STANDARD_PREREQUISITE_CODES.map((code) => ({
    nzccCourseCode: code,
    equivalentCourseCode: "",
    grade: "",
    institution: "",
    year: "",
  }));
  const filled = new Set<number>();
  const legacy: PrerequisiteRow[] = [];

  for (const row of saved) {
    const index = STANDARD_PREREQUISITE_CODES.findIndex((code) => normaliseCourseCode(code) === normaliseCourseCode(row.nzccCourseCode));
    if (index === -1 || filled.has(index)) {
      legacy.push({ ...row });
      continue;
    }
    filled.add(index);
    standard[index] = { ...row, nzccCourseCode: STANDARD_PREREQUISITE_CODES[index] };
  }

  return { standard, legacy };
}
