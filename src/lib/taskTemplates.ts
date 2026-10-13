import { prisma } from "@/lib/prisma";
import { filterActiveStaffIds } from "@/lib/staff";
import type { ApplicationStageKey } from "@/generated/prisma/client";

/**
 * Active templates for a stage that don't yet have a Task for this
 * application (so re-entering a stage doesn't create duplicates).
 */
export async function getTemplatesToGenerate(applicationId: string, stageKey: ApplicationStageKey) {
  const [templates, existing] = await Promise.all([
    prisma.taskTemplate.findMany({
      where: { stageKey, isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.task.findMany({
      where: { applicationId, stageKey },
      select: { templateId: true },
    }),
  ]);

  const existingTemplateIds = new Set(existing.map((t) => t.templateId).filter(Boolean));
  return templates.filter((t) => !existingTemplateIds.has(t.id));
}

/**
 * Creates Task rows from active TaskTemplates for the given stage.
 *
 * `assignments` maps templateId → staff user id (or "" for unassigned), as
 * chosen when changing stage. Templates not in the map use their default
 * assignee. Only active staff members can be assigned.
 */
export async function generateTasksForStage(
  applicationId: string,
  stageKey: ApplicationStageKey,
  staffId: string,
  assignments: Record<string, string> = {}
) {
  const toCreate = await getTemplatesToGenerate(applicationId, stageKey);
  if (toCreate.length === 0) return [];

  const chosen = (templateId: string, fallback: string | null) =>
    templateId in assignments ? assignments[templateId] || null : fallback;
  const activeStaff = await filterActiveStaffIds(
    toCreate.map((t) => chosen(t.id, t.defaultAssigneeId) ?? "")
  );

  return prisma.$transaction(
    toCreate.map((template) => {
      const assignee = chosen(template.id, template.defaultAssigneeId);
      return prisma.task.create({
        data: {
          applicationId,
          templateId: template.id,
          stageKey,
          title: template.title,
          description: template.description,
          audience: template.audience,
          assignedById: staffId,
          assignedToId: assignee && activeStaff.has(assignee) ? assignee : null,
          dueDate: template.dueDays != null ? addDays(new Date(), template.dueDays) : null,
          requiresDocument: template.requiresDocument,
          documentInstructions: template.documentInstructions,
          requiredDocumentCategory: template.requiredDocumentCategory,
        },
      });
    })
  );
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}
