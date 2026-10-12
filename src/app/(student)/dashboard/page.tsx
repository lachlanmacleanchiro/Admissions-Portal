import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { countUnreadForStudent } from "@/lib/studentInbox";
import { ProgressTracker } from "@/components/student/ProgressTracker";
import { Badge } from "@/components/ui/Badge";
import Link from "next/link";
import { STAGE_STATUS_LABELS, STAGE_DISPLAY_STEPS, stageDisplayIndex } from "@/lib/stages";

type AttentionTone = "urgent" | "soon" | "info";

const ATTENTION_COLORS: Record<AttentionTone, string> = {
  urgent: "#c0392b",
  soon: "#C79A3B",
  info: "#114E3B",
};

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  CITIZENSHIP_PROOF: "Citizenship / residency proof",
  IELTS_CERTIFICATE: "IELTS certificate",
  CHIROPRACTOR_RECOMMENDATION: "Chiropractor recommendation letter",
};

interface AttentionItem {
  key: string;
  tone: AttentionTone;
  title: string;
  detail?: string;
  href: string;
  action: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function formatShortDate(date: Date) {
  return date.toLocaleDateString("en-NZ", { weekday: "short", day: "numeric", month: "short" });
}

/** Everything the student should act on, most urgent first. */
function buildAttentionItems({
  tasks,
  documents,
  unreadCount,
  pendingOffer,
}: {
  tasks: { id: string; title: string; status: string; dueDate: Date | null }[];
  documents: { documentType: string; status: string }[];
  unreadCount: number;
  pendingOffer: { acceptanceDeadline: Date | null } | null;
}): AttentionItem[] {
  const now = Date.now();
  const urgent: AttentionItem[] = [];
  const soon: AttentionItem[] = [];
  const info: AttentionItem[] = [];

  for (const task of tasks) {
    const due = task.dueDate ? new Date(task.dueDate) : null;
    if (task.status === "REJECTED") {
      urgent.push({ key: `task-${task.id}`, tone: "urgent", title: `Changes needed: ${task.title}`, detail: "The admissions team has asked you to update this.", href: `/tasks/${task.id}`, action: "Fix it" });
    } else if (due && due.getTime() < now) {
      urgent.push({ key: `task-${task.id}`, tone: "urgent", title: `Overdue: ${task.title}`, detail: `Was due ${formatShortDate(due)}`, href: `/tasks/${task.id}`, action: "Complete" });
    } else if (due && due.getTime() - now <= 7 * DAY_MS) {
      soon.push({ key: `task-${task.id}`, tone: "soon", title: task.title, detail: `Due ${formatShortDate(due)}`, href: `/tasks/${task.id}`, action: "Complete" });
    }
  }

  // Application documents whose latest upload was rejected (documents are newest first).
  const seenTypes = new Set<string>();
  for (const doc of documents) {
    if (seenTypes.has(doc.documentType)) continue;
    seenTypes.add(doc.documentType);
    if (doc.status === "REJECTED" && DOCUMENT_TYPE_LABELS[doc.documentType]) {
      urgent.push({ key: `doc-${doc.documentType}`, tone: "urgent", title: `Replace your ${DOCUMENT_TYPE_LABELS[doc.documentType].toLowerCase()}`, detail: "Your upload wasn't accepted.", href: "/documents", action: "Replace" });
    }
  }

  if (pendingOffer) {
    const deadline = pendingOffer.acceptanceDeadline ? new Date(pendingOffer.acceptanceDeadline) : null;
    const target = deadline && deadline.getTime() - now <= 7 * DAY_MS ? soon : info;
    target.push({
      key: "offer",
      tone: target === soon ? "soon" : "info",
      title: "You have an offer of place",
      detail: deadline ? `Respond by ${formatShortDate(deadline)}` : "Review your offer and respond.",
      href: "/offer",
      action: "View offer",
    });
  }

  if (unreadCount > 0) {
    info.push({ key: "messages", tone: "info", title: `${unreadCount} unread message${unreadCount === 1 ? "" : "s"} from the admissions team`, href: "/messages", action: "Read" });
  }

  return [...urgent, ...soon, ...info];
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const application = await prisma.application.findUnique({
    where: { studentId: session.user.id },
    include: {
      intakeYear: true,
      tasks: {
        where: { status: { in: ["PENDING", "IN_PROGRESS", "REJECTED"] }, audience: "STUDENT" },
        orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      },
      documents: {
        where: { taskId: null, offerConditionId: null },
        orderBy: { uploadedAt: "desc" },
        select: { documentType: true, status: true },
      },
      offers: {
        where: { responseStatus: "PENDING" },
        orderBy: { issuedAt: "desc" },
        take: 1,
        select: { acceptanceDeadline: true },
      },
    },
  });

  if (!application) {
    return <div className="p-8 text-text-muted">Application not found.</div>;
  }

  const unreadCount = await countUnreadForStudent(application.id);
  const stageIndex = stageDisplayIndex(application.currentStage);
  const attentionItems = buildAttentionItems({
    tasks: application.tasks,
    documents: application.documents,
    unreadCount,
    pendingOffer: application.depositStatus === "NOT_PAID" ? application.offers[0] ?? null : null,
  });

  return (
    <div className="px-8 py-8 max-w-4xl">
      {/* Header */}
      <p className="text-xs font-semibold tracking-widest uppercase text-text-muted mb-1">
        {getGreeting()}
      </p>
      <h1 className="font-serif text-4xl text-text mb-2">
        Kia ora, {session.user.firstName}
      </h1>

      {/* Needs your attention */}
      {attentionItems.length > 0 ? (
        <section className="mt-5 bg-white rounded-2xl shadow-sm overflow-hidden" aria-labelledby="attention-heading">
          <div className="px-5 py-3.5 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(0,0,0,0.06)", backgroundColor: "#F8F8F6" }}>
            <h2 id="attention-heading" className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#555" }}>
              Needs your attention
            </h2>
            <span className="text-xs" style={{ color: "#999" }}>
              {attentionItems.length} item{attentionItems.length === 1 ? "" : "s"}
            </span>
          </div>
          <ul>
            {attentionItems.map((item, i) => (
              <li key={item.key} style={{ borderBottom: i < attentionItems.length - 1 ? "1px solid rgba(0,0,0,0.05)" : "none" }}>
                <Link href={item.href} className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-black/[0.02]">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: ATTENTION_COLORS[item.tone] }} aria-hidden="true" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold" style={{ color: "#222" }}>{item.title}</span>
                    {item.detail && <span className="block text-xs mt-0.5" style={{ color: "#888" }}>{item.detail}</span>}
                  </span>
                  <span className="text-xs font-semibold flex-shrink-0" style={{ color: "#114E3B" }}>{item.action} →</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="mt-3 text-sm flex items-center gap-2" style={{ color: "#114E3B" }}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          You&apos;re all caught up. We&apos;ll let you know when there&apos;s something to do.
        </p>
      )}

      {/* Progress tracker */}
      <div className="mt-6 bg-white rounded-2xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-serif text-lg text-text">Your Application Progress</h2>
          <Badge variant="muted">
            Stage {stageIndex + 1} of {STAGE_DISPLAY_STEPS.length} · {STAGE_STATUS_LABELS[application.currentStage]}
          </Badge>
        </div>
        <ProgressTracker currentStage={application.currentStage} />
      </div>

      {/* Tasks */}
      {application.tasks.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-semibold tracking-widest uppercase text-text-muted">Your open tasks</p>
            <Link href="/tasks" className="text-xs font-semibold" style={{ color: "#114E3B" }}>View all tasks →</Link>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {application.tasks.slice(0, 6).map((task) => {
              const isOverdue = task.dueDate && new Date(task.dueDate) < new Date();
              const isRejected = task.status === "REJECTED";
              return (
                <Link key={task.id} href={`/tasks/${task.id}`}>
                  <div
                    className="h-full bg-white rounded-xl shadow-sm p-5 transition-colors"
                    style={{ borderLeft: `3px solid ${isOverdue || isRejected ? "#c0392b" : task.dueDate ? "#C79A3B" : "#114E3B"}` }}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#F2F2F0" }}>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: "#aaa" }}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      {isOverdue || isRejected ? (
                        <Badge variant="red">{isRejected ? "Action required" : "Overdue"}</Badge>
                      ) : task.dueDate ? (
                        <Badge variant="gold">Due {new Date(task.dueDate).toLocaleDateString("en-NZ", { day: "numeric", month: "short" })}</Badge>
                      ) : task.isRequired ? (
                        <Badge variant="red">Required</Badge>
                      ) : null}
                    </div>
                    <h3 className="font-semibold text-sm mb-1" style={{ color: "#222" }}>{task.title}</h3>
                    <p className="text-xs line-clamp-2" style={{ color: "#aaa" }}>{task.description}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Application summary */}
      <div className="mt-8">
        <p className="text-xs font-semibold tracking-widest uppercase text-text-muted mb-3">Application Summary</p>
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {[
            ["Applicant type", `${application.category === "DOMESTIC" ? "Domestic" : "International"} · Year ${application.yearLevel === "YEAR_1" ? "1" : "2"}`],
            ["Current stage", STAGE_STATUS_LABELS[application.currentStage]],
            ["Application submitted", application.submittedAt ? new Date(application.submittedAt).toLocaleDateString("en-NZ", { day: "numeric", month: "long", year: "numeric" }) : "—"],
            ["Intake year", application.intakeYear.label],
          ].map(([label, value], i, arr) => (
            <div
              key={label}
              className="flex justify-between px-5 py-3.5 text-sm"
              style={{ borderBottom: i < arr.length - 1 ? "1px solid rgba(0,0,0,0.05)" : "none" }}
            >
              <dt style={{ color: "#aaa" }}>{label}</dt>
              <dd className="font-medium" style={{ color: "#222" }}>{value}</dd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
