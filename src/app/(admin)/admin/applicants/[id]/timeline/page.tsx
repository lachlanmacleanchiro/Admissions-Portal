import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import Link from "next/link";
import type { TimelineEventType } from "@/generated/prisma/client";

const EVENT_ICONS: Record<string, string> = {
  STAGE_CHANGE: "→",
  TASK_ASSIGNED: "✦",
  TASK_COMPLETED: "✓",
  DOCUMENT_UPLOADED: "↑",
  DOCUMENT_VERIFIED: "✓",
  MESSAGE_SENT: "✉",
  NOTE_ADDED: "✎",
  APPLICATION_CREATED: "★",
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  STAGE_CHANGE: "Stage change",
  TASK_ASSIGNED: "Task assigned",
  TASK_COMPLETED: "Task completed",
  DOCUMENT_UPLOADED: "Document uploaded",
  DOCUMENT_VERIFIED: "Document verified",
  MESSAGE_SENT: "Message sent",
  NOTE_ADDED: "Note added",
  APPLICATION_CREATED: "Application created",
};

export default async function ApplicantTimelinePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ search?: string; type?: string; sort?: string; visibility?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user || session.user.role !== "STAFF") redirect("/login");
  requirePermission(session, "VIEW_APPLICANTS");

  const app = await prisma.application.findUnique({
    where: { id },
    select: {
      id: true,
      student: { select: { firstName: true, lastName: true } },
      timelineEvents: {
        orderBy: { occurredAt: sp.sort === "asc" ? "asc" : "desc" },
        where: {
          ...(sp.search
            ? {
                OR: [
                  { title: { contains: sp.search, mode: "insensitive" } },
                  { description: { contains: sp.search, mode: "insensitive" } },
                ],
              }
            : {}),
          ...(sp.type ? { eventType: sp.type as TimelineEventType } : {}),
          ...(sp.visibility === "student" ? { isVisibleToStudent: true } : {}),
          ...(sp.visibility === "internal" ? { isVisibleToStudent: false } : {}),
        },
        include: {
          createdBy: { select: { firstName: true, lastName: true, role: true } },
        },
      },
    },
  });

  if (!app) notFound();

  const selectStyle = {
    backgroundColor: "#fff",
    border: "1.5px solid rgba(0,0,0,0.1)",
    borderRadius: 8,
    padding: "7px 12px",
    fontSize: 13,
    color: "#333",
    outline: "none",
  };

  const baseUrl = `/admin/applicants/${id}/timeline`;

  function buildUrl(overrides: Record<string, string>) {
    const p = new URLSearchParams();
    const merged = { search: sp.search ?? "", type: sp.type ?? "", sort: sp.sort ?? "", visibility: sp.visibility ?? "", ...overrides };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const qs = p.toString();
    return qs ? `${baseUrl}?${qs}` : baseUrl;
  }

  return (
    <div>
      {/* Controls */}
      <form method="get" action={baseUrl} className="flex gap-2 mb-6 flex-wrap items-center">
        <input
          name="search"
          defaultValue={sp.search}
          placeholder="Search events…"
          className="flex-1 min-w-40 px-3 py-2 text-sm rounded-lg focus:outline-none"
          style={{ backgroundColor: "#fff", border: "1.5px solid rgba(0,0,0,0.1)" }}
        />
        <select name="type" defaultValue={sp.type ?? ""} style={selectStyle}>
          <option value="">All types</option>
          {Object.entries(EVENT_TYPE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <select name="visibility" defaultValue={sp.visibility ?? ""} style={selectStyle}>
          <option value="">All visibility</option>
          <option value="student">Visible to student</option>
          <option value="internal">Internal only</option>
        </select>
        <select name="sort" defaultValue={sp.sort ?? "desc"} style={{ ...selectStyle, color: "#114E3B", fontWeight: 600 }}>
          <option value="desc">Newest first</option>
          <option value="asc">Oldest first</option>
        </select>
        <button
          type="submit"
          className="px-4 py-2 rounded-lg text-sm font-semibold"
          style={{ backgroundColor: "#114E3B", color: "#fff" }}
        >
          Filter
        </button>
        {(sp.search || sp.type || sp.visibility || sp.sort) && (
          <Link href={baseUrl} className="text-xs font-medium" style={{ color: "#aaa" }}>
            Clear
          </Link>
        )}
      </form>

      <p className="text-xs mb-5" style={{ color: "#aaa" }}>
        {app.timelineEvents.length} event{app.timelineEvents.length !== 1 ? "s" : ""}
        {sp.search || sp.type || sp.visibility ? " matching filters" : ""}
      </p>

      {app.timelineEvents.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm py-16 text-center text-sm" style={{ color: "#aaa" }}>
          No events found.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {app.timelineEvents.map((event, i) => (
            <div key={event.id} className="flex gap-4 items-start">
              <div className="flex flex-col items-center flex-shrink-0" style={{ width: 28 }}>
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                  style={{ backgroundColor: "#114E3B" }}
                >
                  {EVENT_ICONS[event.eventType] ?? "·"}
                </div>
                {i < app.timelineEvents.length - 1 && (
                  <div className="flex-1 mt-1" style={{ width: 2, minHeight: 24, backgroundColor: "rgba(0,0,0,0.08)" }} />
                )}
              </div>
              <div className="flex-1 bg-white rounded-xl shadow-sm px-4 py-3" style={{ marginTop: 2 }}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-semibold" style={{ color: "#222" }}>{event.title}</p>
                  <span
                    className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full flex-shrink-0 ml-3"
                    style={{
                      backgroundColor: event.isVisibleToStudent ? "rgba(17,78,59,0.08)" : "rgba(0,0,0,0.05)",
                      color: event.isVisibleToStudent ? "#114E3B" : "#aaa",
                    }}
                  >
                    {event.isVisibleToStudent ? "Visible" : "Internal"}
                  </span>
                </div>
                {event.description && <p className="text-xs mb-1" style={{ color: "#666" }}>{event.description}</p>}
                <p className="text-xs" style={{ color: "#bbb" }}>
                  {new Date(event.occurredAt).toLocaleDateString("en-NZ", { day: "numeric", month: "long", year: "numeric" })}
                  {" at "}
                  {new Date(event.occurredAt).toLocaleTimeString("en-NZ", { hour: "2-digit", minute: "2-digit" })}
                  {event.createdBy && (
                    <>
                      {" · "}
                      <span style={{ color: event.createdBy.role === "STUDENT" ? "#888" : "#114E3B" }}>
                        {event.createdBy.firstName} {event.createdBy.lastName}
                      </span>
                    </>
                  )}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
