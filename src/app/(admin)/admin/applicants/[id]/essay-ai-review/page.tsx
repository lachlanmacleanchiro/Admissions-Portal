import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { Badge } from "@/components/ui/Badge";
import { generateDemoAnnotations, PLACEHOLDER_ESSAY_TEXT } from "./aiDemoData";

const TONE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  positive: { bg: "rgba(34,197,94,0.12)", border: "rgba(34,197,94,0.35)", text: "#15803d" },
  neutral: { bg: "rgba(199,154,59,0.12)", border: "rgba(199,154,59,0.35)", text: "#8a6416" },
  concern: { bg: "rgba(192,57,43,0.1)", border: "rgba(192,57,43,0.3)", text: "#c0392b" },
};

export default async function EssayAiReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user || session.user.role !== "STAFF") redirect("/login");
  requirePermission(session, "VIEW_APPLICANTS");

  const app = await prisma.application.findUnique({
    where: { id },
    select: { student: { select: { firstName: true, lastName: true } } },
  });

  if (!app) notFound();

  // The essay is submitted as a document against the ESSAY-stage task. We don't parse
  // uploaded files (PDF/Word) for text, so the demo uses placeholder essay text below —
  // this just locates the real submission to show what's being "reviewed".
  const essayDocument = await prisma.document.findFirst({
    where: { applicationId: id, task: { stageKey: "ESSAY" } },
    orderBy: { uploadedAt: "desc" },
  });

  const { sentences, notes, strengths, weaknesses } = generateDemoAnnotations(PLACEHOLDER_ESSAY_TEXT);
  const noteBySentence = new Map(notes.map((n) => [n.sentenceIndex, n]));

  return (
    <div>
      <div className="flex items-center gap-3 mb-1">
        <h2 className="font-serif text-xl text-text">Essay</h2>
        <Badge variant="gold">✨ AI-Assisted Review — Demo</Badge>
      </div>
      <p className="text-sm mb-2" style={{ color: "#888" }}>
        This is a demonstration of AI-assisted essay marking. The essay text, highlights, and notes below are
        placeholder content for illustration only — no real file parsing or analysis has been performed.
      </p>
      {essayDocument ? (
        <p className="text-xs mb-6" style={{ color: "#aaa" }}>
          Reviewing submission: <strong>{essayDocument.filename}</strong> · uploaded {new Date(essayDocument.uploadedAt).toLocaleDateString("en-NZ")}
        </p>
      ) : (
        <p className="text-xs mb-6" style={{ color: "#c0392b" }}>
          No essay document has been submitted for this applicant yet. Showing placeholder content for demonstration.
        </p>
      )}

      {sentences.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-8 text-sm" style={{ color: "#888" }}>
          No essay content available to review.
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-5">
          {/* Essay text with highlights */}
          <div className="col-span-2 bg-white rounded-2xl shadow-sm p-6">
            <p className="text-[11px] font-semibold uppercase tracking-widest mb-4" style={{ color: "#999" }}>Essay</p>
            <div className="text-sm leading-relaxed" style={{ color: "#333" }}>
              {sentences.map((sentence, i) => {
                const note = noteBySentence.get(i);
                if (!note) return <span key={i}>{sentence} </span>;
                const colors = TONE_COLORS[note.tone];
                return (
                  <span
                    key={i}
                    className="rounded px-0.5"
                    style={{ backgroundColor: colors.bg, borderBottom: `2px solid ${colors.border}` }}
                  >
                    {sentence}{" "}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Sidebar: sentiment notes + strengths/weaknesses */}
          <div className="flex flex-col gap-5">
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-3.5" style={{ borderBottom: "1px solid rgba(0,0,0,0.06)", backgroundColor: "#F8F8F6" }}>
                <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#555" }}>Sentiment Notes</p>
              </div>
              <div className="flex flex-col divide-y" style={{ borderColor: "rgba(0,0,0,0.05)" }}>
                {notes.map((note, i) => {
                  const colors = TONE_COLORS[note.tone];
                  return (
                    <div key={i} className="px-5 py-3">
                      <span
                        className="inline-block text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded mb-1.5"
                        style={{ backgroundColor: colors.bg, color: colors.text }}
                      >
                        {note.tone}
                      </span>
                      <p className="text-xs" style={{ color: "#555" }}>{note.note}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-3.5" style={{ borderBottom: "1px solid rgba(0,0,0,0.06)", backgroundColor: "#F8F8F6" }}>
                <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#555" }}>Strengths</p>
              </div>
              <ul className="px-5 py-3 flex flex-col gap-2">
                {strengths.map((s, i) => (
                  <li key={i} className="text-xs flex items-start gap-2" style={{ color: "#333" }}>
                    <span style={{ color: "#22c55e" }}>●</span> {s}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-3.5" style={{ borderBottom: "1px solid rgba(0,0,0,0.06)", backgroundColor: "#F8F8F6" }}>
                <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#555" }}>Weaknesses</p>
              </div>
              <ul className="px-5 py-3 flex flex-col gap-2">
                {weaknesses.map((w, i) => (
                  <li key={i} className="text-xs flex items-start gap-2" style={{ color: "#333" }}>
                    <span style={{ color: "#c0392b" }}>●</span> {w}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
