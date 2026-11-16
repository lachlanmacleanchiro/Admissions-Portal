import type { ResidencyStatus } from "@/generated/prisma/client";

export const RESIDENCY_STATUS_LABELS: Record<ResidencyStatus, string> = {
  PERMANENT_RESIDENT: "NZ permanent resident",
  RESIDENT_VISA: "NZ resident visa holder",
  AUSTRALIAN_CITIZEN_OR_RESIDENT: "Australian citizen or permanent resident",
  REFUGEE_OR_PROTECTED_PERSON: "Refugee or protected person",
  OTHER: "Other",
};

export const RESIDENCY_STATUS_KEYS = Object.keys(RESIDENCY_STATUS_LABELS) as ResidencyStatus[];

export function isResidencyStatus(value: unknown): value is ResidencyStatus {
  return typeof value === "string" && (RESIDENCY_STATUS_KEYS as string[]).includes(value);
}

/** Label shown on an applicant's profile, or null when the question doesn't apply / wasn't answered. */
export function describeResidency(app: {
  category: string;
  isNzCitizen: boolean | null;
  residencyStatus: ResidencyStatus | null;
  residencyStatusDetails: string | null;
}): string | null {
  if (app.category !== "DOMESTIC" || app.isNzCitizen !== false || !app.residencyStatus) return null;
  const label = RESIDENCY_STATUS_LABELS[app.residencyStatus];
  return app.residencyStatus === "OTHER" && app.residencyStatusDetails ? `${label}: ${app.residencyStatusDetails}` : label;
}
