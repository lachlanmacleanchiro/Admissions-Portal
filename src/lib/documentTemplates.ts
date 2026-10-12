/**
 * Variable handling for document templates. Shared by the settings editor,
 * the staff review-and-send modal, and the send API.
 *
 * Templates use {{variableName}} placeholders. Variables listed in
 * AUTO_VARIABLES are filled from the applicant's record; any other name is a
 * "fill-in" field the staff member completes before sending (e.g.
 * {{zoomLink}}). A document can't be sent while any placeholder is unresolved.
 */

export interface TemplateVariable {
  key: string;
  label: string;
  sample: string;
}

export const AUTO_VARIABLES: TemplateVariable[] = [
  { key: "preferredName", label: "Preferred first name (falls back to first name)", sample: "Emma" },
  { key: "firstName", label: "First name", sample: "Emma" },
  { key: "lastName", label: "Last name", sample: "Johnson" },
  { key: "fullName", label: "Full name", sample: "Emma Johnson" },
  { key: "email", label: "Applicant email", sample: "emma.johnson@example.com" },
  { key: "applicantNumber", label: "Applicant number", sample: "#0001" },
  { key: "intakeYear", label: "Intake year", sample: "2026 INTAKE" },
  { key: "currentStage", label: "Current stage", sample: "Interview" },
  { key: "interviewDate", label: "Interview date (from the interview review)", sample: "Tuesday 14 October 2026" },
  { key: "interviewTime", label: "Interview time (from the interview review)", sample: "10:30 am" },
  { key: "staffName", label: "Your full name", sample: "Sarah Williamson" },
  { key: "staffFirstName", label: "Your first name", sample: "Sarah" },
  { key: "today", label: "Today's date", sample: "12 October 2026" },
];

export const SUGGESTED_FILL_IN_VARIABLES: TemplateVariable[] = [
  { key: "zoomLink", label: "Zoom link", sample: "https://zoom.us/j/123456789" },
  { key: "location", label: "Location", sample: "NZCC Campus, Mount Wellington" },
  { key: "deadline", label: "Deadline", sample: "Friday 24 October 2026" },
];

const AUTO_KEYS = new Set(AUTO_VARIABLES.map((v) => v.key));
const VARIABLE_PATTERN = /\{\{\s*(\w+)\s*\}\}/g;

/** Every distinct variable name used in the given texts, in order of first use. */
export function extractVariables(...texts: string[]): string[] {
  const seen = new Set<string>();
  for (const text of texts) {
    for (const match of text.matchAll(VARIABLE_PATTERN)) seen.add(match[1]);
  }
  return [...seen];
}

/** Variables that aren't auto-filled — staff must supply these at send time. */
export function extractFillInVariables(...texts: string[]): string[] {
  return extractVariables(...texts).filter((key) => !AUTO_KEYS.has(key));
}

/** Replaces {{key}} placeholders that have a non-empty value; leaves the rest intact. */
export function fillTemplate(text: string, values: Record<string, string | undefined>): string {
  return text.replace(VARIABLE_PATTERN, (match, key: string) => {
    const value = values[key];
    return value != null && value.trim() !== "" ? value : match;
  });
}

/** Placeholder names still present in the text (i.e. not yet filled in). */
export function findUnresolvedVariables(...texts: string[]): string[] {
  return extractVariables(...texts);
}

/** Turns "zoomLink" into "Zoom link" for fill-in field labels. */
export function humaniseVariableName(key: string): string {
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/_/g, " ").toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export const SAMPLE_VALUES: Record<string, string> = Object.fromEntries(
  [...AUTO_VARIABLES, ...SUGGESTED_FILL_IN_VARIABLES].map((v) => [v.key, v.sample])
);
