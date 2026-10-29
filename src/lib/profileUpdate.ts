/**
 * Validation for staff edits to an applicant's profile. Each parser returns
 * `undefined` when the field wasn't sent, so the route leaves it untouched.
 */
export class ProfileValidationError extends Error {}

export function isYearLevel(v: unknown): v is "YEAR_1" | "YEAR_2" {
  return v === "YEAR_1" || v === "YEAR_2";
}

/** "YYYY-MM-DD" → UTC midnight, so the calendar day never shifts with time zones. */
export function parseDateOnly(v: unknown): Date | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  const match = typeof v === "string" ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(v) : null;
  if (!match) throw new ProfileValidationError("Dates must be in YYYY-MM-DD format.");
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

export interface ChiroExperienceInput {
  chiropractorName: string;
  status: "OBSERVING" | "UNDER_CARE";
  date: Date | null;
}

export function parseChiropracticExperience(v: unknown): ChiroExperienceInput[] | undefined {
  if (v === undefined) return undefined;
  if (!Array.isArray(v)) throw new ProfileValidationError("Chiropractic experience must be a list.");
  return v.map((item) => {
    const { chiropractorName, status, date } = (item ?? {}) as Record<string, unknown>;
    const name = typeof chiropractorName === "string" ? chiropractorName.trim() : "";
    if (!name) throw new ProfileValidationError("Each chiropractic experience entry needs a chiropractor name.");
    if (status !== "OBSERVING" && status !== "UNDER_CARE") {
      throw new ProfileValidationError("Chiropractic experience status must be Observing or Under care.");
    }
    return { chiropractorName: name, status, date: parseDateOnly(date) ?? null };
  });
}
