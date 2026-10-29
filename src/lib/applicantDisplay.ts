/**
 * Formatters for the applicant Overview cards. Date-only values (e.g. DOB)
 * are stored as UTC midnight, so they're formatted in UTC to keep the day.
 */
export function formatDateOnly(d: Date | null | undefined): string {
  return d ? d.toLocaleDateString("en-NZ", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" }) : "—";
}

/** Value for an `<input type="date">`. */
export function toDateInputValue(d: Date | null | undefined): string {
  return d ? d.toISOString().slice(0, 10) : "";
}

export function formatSuburbCity(suburb: string | null, city: string | null): string {
  const parts = [suburb, city].map((p) => p?.trim()).filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "—";
}

const CHIRO_STATUS_LABELS = { OBSERVING: "Observing", UNDER_CARE: "Under care" } as const;

export function formatChiroExperience(entries: { chiropractorName: string; status: "OBSERVING" | "UNDER_CARE" }[]): string[] {
  return entries.map((e) => `${e.chiropractorName} (${CHIRO_STATUS_LABELS[e.status]})`);
}

export function formatEducationYears(started: number, completed: number | null): string {
  return `${started}–${completed ?? "present"}`;
}
