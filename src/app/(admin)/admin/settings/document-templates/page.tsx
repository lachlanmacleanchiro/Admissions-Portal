import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { DocumentTemplateManager } from "../DocumentTemplateManager";
import { SettingsNav } from "../SettingsNav";

export default async function DocumentTemplatesSettingsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "STAFF" || !session.user.isGlobalAdmin) redirect("/admin");

  const documentTemplates = await prisma.documentTemplate.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { updatedBy: { select: { firstName: true, lastName: true } } },
  });

  return (
    <div className="px-8 py-7 max-w-4xl">
      <h1 className="font-serif text-2xl text-text mb-4">Settings</h1>
      <SettingsNav />

      <section>
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
    </div>
  );
}
