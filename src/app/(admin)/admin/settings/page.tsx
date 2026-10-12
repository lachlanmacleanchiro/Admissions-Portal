import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { IntakeYearForm } from "./IntakeYearForm";
import { TaskTemplateManager } from "./TaskTemplateManager";
import { DocumentTemplateManager } from "./DocumentTemplateManager";
import { EmailNotificationsToggle } from "./EmailNotificationsToggle";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "STAFF" || !session.user.isGlobalAdmin) redirect("/admin");

  const [intakeYears, taskTemplates, documentTemplates, appSettings, applicationErrors] = await Promise.all([
    prisma.intakeYear.findMany({ orderBy: { year: "desc" } }),
    prisma.taskTemplate.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    prisma.documentTemplate.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: { updatedBy: { select: { firstName: true, lastName: true } } },
    }),
    prisma.appSettings.findUnique({ where: { id: "singleton" } }),
    prisma.applicationErrorLog.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
  ]);

  return (
    <div className="px-8 py-7 max-w-4xl">
      <h1 className="font-serif text-2xl text-text mb-6">Settings</h1>

      <section className="mb-10">
        <h2 className="font-serif text-lg text-text mb-4">Intake Years</h2>
        <IntakeYearForm intakeYears={intakeYears} />
      </section>

      <section>
        <h2 className="font-serif text-lg text-text mb-1">Stage Task Templates</h2>
        <p className="text-sm text-text-muted mb-4">
          Configure the tasks automatically created when an application enters each stage.
        </p>
        <TaskTemplateManager templates={taskTemplates} />
      </section>

      <section className="mt-10">
        <h2 className="font-serif text-lg text-text mb-1">Document Templates</h2>
        <p className="text-sm text-text-muted mb-4">
          Letters and emails staff can review and send to applicants at a given stage, such as an interview invitation.
          Use variables like {"{{preferredName}}"} to personalise them.
        </p>
        <DocumentTemplateManager
          templates={documentTemplates.map((t) => ({
            id: t.id,
            stageKey: t.stageKey,
            name: t.name,
            subject: t.subject,
            bodyMarkdown: t.bodyMarkdown,
            isActive: t.isActive,
            sortOrder: t.sortOrder,
            updatedAt: t.updatedAt.toISOString(),
            updatedByName: t.updatedBy ? `${t.updatedBy.firstName} ${t.updatedBy.lastName}` : null,
          }))}
        />
      </section>

      <section className="mt-10">
        <h2 className="font-serif text-lg text-text mb-4">Email Notifications</h2>
        <EmailNotificationsToggle enabled={appSettings?.emailNotificationsEnabled ?? false} />
      </section>

      <section className="mt-10">
        <h2 className="font-serif text-lg text-text mb-1">Application Submission Errors</h2>
        <p className="text-sm text-text-muted mb-4">
          Errors captured when a student's application form fails to submit. Most recent 50 shown.
        </p>
        {applicationErrors.length === 0 ? (
          <p className="text-sm text-text-muted">No errors recorded.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {applicationErrors.map((e) => (
              <details key={e.id} className="bg-white rounded-lg shadow-sm p-4 text-sm">
                <summary className="cursor-pointer font-medium text-text">
                  {new Date(e.createdAt).toLocaleString("en-NZ")} — {e.message}
                  {e.email && <span className="text-text-muted font-normal"> ({e.email})</span>}
                </summary>
                <p className="text-xs text-text-muted mt-2">Source: {e.source}</p>
                {e.stack && (
                  <pre className="text-xs text-text-muted mt-2 whitespace-pre-wrap bg-surface rounded p-3 overflow-x-auto">
                    {e.stack}
                  </pre>
                )}
              </details>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
