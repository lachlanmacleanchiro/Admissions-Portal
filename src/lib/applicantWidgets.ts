/**
 * The widgets on an applicant's Overview tab, in their default order and
 * width. Each staff member can rearrange them (Move Widgets); their layout
 * is saved on their user record and applies to every applicant they view.
 */
export type WidgetWidth = "full" | "half";

export interface WidgetLayoutItem {
  id: string;
  width: WidgetWidth;
}

export const APPLICANT_WIDGETS: { id: string; title: string; defaultWidth: WidgetWidth }[] = [
  { id: "progress", title: "Stage progress", defaultWidth: "full" },
  { id: "stage-documents", title: "Stage documents", defaultWidth: "full" },
  { id: "details", title: "Application details", defaultWidth: "half" },
  { id: "notes", title: "Internal notes", defaultWidth: "half" },
  { id: "academic", title: "Academic background", defaultWidth: "half" },
  { id: "disclosures", title: "Disclosures", defaultWidth: "half" },
  { id: "prerequisites", title: "Prerequisite courses", defaultWidth: "full" },
  { id: "statement", title: "Personal statement", defaultWidth: "half" },
  { id: "tasks", title: "Tasks", defaultWidth: "half" },
  { id: "offer", title: "Offer", defaultWidth: "half" },
  { id: "interview", title: "Interview review", defaultWidth: "half" },
  { id: "essay", title: "Essay review", defaultWidth: "half" },
  { id: "account", title: "Account", defaultWidth: "full" },
];

const WIDGET_IDS = new Set(APPLICANT_WIDGETS.map((w) => w.id));

export const DEFAULT_LAYOUT: WidgetLayoutItem[] = APPLICANT_WIDGETS.map((w) => ({ id: w.id, width: w.defaultWidth }));

/**
 * Turns a stored layout (possibly from an older version, with unknown or
 * missing widgets) into a complete, valid layout: known widgets in the saved
 * order, then any new widgets in default order at their default width.
 */
export function normaliseLayout(stored: unknown): WidgetLayoutItem[] {
  const result: WidgetLayoutItem[] = [];
  const seen = new Set<string>();
  if (Array.isArray(stored)) {
    for (const item of stored) {
      if (!item || typeof item !== "object") continue;
      const { id, width } = item as { id?: unknown; width?: unknown };
      if (typeof id !== "string" || !WIDGET_IDS.has(id) || seen.has(id)) continue;
      seen.add(id);
      result.push({ id, width: width === "half" ? "half" : "full" });
    }
  }
  for (const item of DEFAULT_LAYOUT) {
    if (!seen.has(item.id)) result.push(item);
  }
  return result;
}
