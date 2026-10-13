import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TaskTemplateManager } from "../TaskTemplateManager";
import { SettingsNav } from "../SettingsNav";
import { getAssignableStaff } from "@/lib/staff";

export default async function TaskTemplatesSettingsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "STAFF" || !session.user.isGlobalAdmin) redirect("/admin");

  const [taskTemplates, staffOptions] = await Promise.all([
    prisma.taskTemplate.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    getAssignableStaff(),
  ]);

  return (
    <div className="px-8 py-7 w-full">
      <h1 className="font-serif text-2xl text-text mb-4">Settings</h1>
      <SettingsNav />

      <section>
        <h2 className="font-serif text-lg text-text mb-1">Stage Task Templates</h2>
        <p className="text-sm text-text-muted mb-4">
          Configure the tasks automatically created when an application enters each stage.
        </p>
        <TaskTemplateManager templates={taskTemplates} staffOptions={staffOptions} />
      </section>
    </div>
  );
}
