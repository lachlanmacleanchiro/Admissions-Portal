import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { WipBanner } from "@/components/ui/WipBanner";
import { STAGE_ORDER, STAGE_DISPLAY_STEPS } from "@/lib/stages";
import { resolveIntakeFilter } from "@/lib/intakeYears";
import { IntakeFilterPicker } from "@/components/admin/IntakeFilterPicker";
import { ReportsCharts } from "./ReportsCharts";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ intake?: string }>;
}) {
  const { intake } = await searchParams;
  const session = await auth();
  if (!session?.user || session.user.role !== "STAFF") redirect("/login");
  requirePermission(session, "VIEW_REPORTS");

  const intakeFilter = await resolveIntakeFilter(intake);
  const baseWhere = intakeFilter.where;

  const [allApps, domestic, international, year1, year2] = await Promise.all([
    prisma.application.findMany({
      where: baseWhere,
      select: { currentStage: true, category: true, yearLevel: true },
    }),
    prisma.application.count({ where: { ...baseWhere, category: "DOMESTIC" } }),
    prisma.application.count({ where: { ...baseWhere, category: "INTERNATIONAL" } }),
    prisma.application.count({ where: { ...baseWhere, yearLevel: "YEAR_1" } }),
    prisma.application.count({ where: { ...baseWhere, yearLevel: "YEAR_2" } }),
  ]);

  const byStage = STAGE_DISPLAY_STEPS.map((step) => ({
    stage: step.key,
    label: step.label,
    count: allApps.filter((a) => step.stages.includes(a.currentStage)).length,
  }));

  const categoryData = [
    { label: "Domestic", count: domestic },
    { label: "International", count: international },
    { label: "Year 1 Entry", count: year1 },
    { label: "Year 2 Entry", count: year2 },
  ];

  const funnelData = STAGE_DISPLAY_STEPS.map((step, i) => {
    const firstStageIndex = STAGE_ORDER.indexOf(step.stages[0]);
    const count = allApps.filter((a) => STAGE_ORDER.indexOf(a.currentStage) >= firstStageIndex).length;
    return { label: step.label, count };
  });

  return (
    <div className="px-8 py-7 w-full">
      <WipBanner>
        This page is work in progress. Only some logic has been implemented. Feedback is needed on what sort of reports you&apos;d like to see.
      </WipBanner>
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="font-serif text-2xl text-text">Reports &amp; Insights</h1>
          <p className="text-sm text-text-muted mt-1">Live snapshot of pipeline health and conversion rates · {intakeFilter.label}</p>
        </div>
        <div className="flex items-center gap-2">
          <IntakeFilterPicker intakeYears={intakeFilter.visibleIntakes.map((iy) => ({ id: iy.id, label: iy.label }))} />
          <span className="px-4 py-2 bg-green-dark text-white text-xs font-semibold tracking-wide cursor-pointer hover:bg-green transition-colors">
            EXPORT PDF
          </span>
        </div>
      </div>

      <ReportsCharts byStage={byStage} categoryData={categoryData} funnelData={funnelData} total={allApps.length} />
    </div>
  );
}
