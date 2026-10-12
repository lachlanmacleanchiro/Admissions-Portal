"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

type Mode = "CHAT" | "THREADS";

const OPTIONS: { value: Mode; title: string; description: string }[] = [
  {
    value: "CHAT",
    title: "Chat",
    description: "One ongoing conversation per applicant, like a text message thread. Best for quick back-and-forth.",
  },
  {
    value: "THREADS",
    title: "Threads",
    description: "Separate conversations, each with a subject line, like email. Best for keeping topics apart.",
  },
];

const MODE_NAMES: Record<Mode, string> = { CHAT: "Chat", THREADS: "Threads" };

export function MessagingModeSelector({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [saved, setSaved] = useState<Mode>(mode);
  const [selected, setSelected] = useState<Mode>(mode);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const hasChanges = selected !== saved;

  function choose(next: Mode) {
    setSelected(next);
    setStatus(null);
  }

  async function save() {
    if (!hasChanges || isSaving) return;
    setIsSaving(true);
    setStatus(null);
    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messagingMode: selected }),
    }).catch(() => null);
    setIsSaving(false);
    if (!res || !res.ok) {
      setStatus({ kind: "error", text: "Couldn't save the messaging style. Please try again." });
      return;
    }
    setSaved(selected);
    setStatus({ kind: "success", text: `Saved. Students and staff now see ${MODE_NAMES[selected]}.` });
    router.refresh();
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm p-5 flex flex-col gap-4">
      <div role="radiogroup" aria-label="Messaging style" className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {OPTIONS.map((option) => {
          const isSelected = selected === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => choose(option.value)}
              disabled={isSaving}
              className="text-left rounded-xl p-4 flex flex-col gap-3 transition-colors disabled:cursor-wait"
              style={{
                border: `1.5px solid ${isSelected ? "#114E3B" : "rgba(0,0,0,0.1)"}`,
                backgroundColor: isSelected ? "rgba(17,78,59,0.04)" : "#fff",
              }}
            >
              <span className="flex items-center gap-2.5">
                <span
                  className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ border: `1.5px solid ${isSelected ? "#114E3B" : "rgba(0,0,0,0.25)"}` }}
                  aria-hidden="true"
                >
                  {isSelected && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: "#114E3B" }} />}
                </span>
                <span className="text-sm font-semibold" style={{ color: "#222" }}>{option.title}</span>
                {saved === option.value && (
                  <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ backgroundColor: "rgba(17,78,59,0.08)", color: "#114E3B" }}>
                    Current
                  </span>
                )}
              </span>
              <span className="block text-xs" style={{ color: "#777", paddingLeft: 26 }}>{option.description}</span>
              {option.value === "CHAT" ? <ChatPreview /> : <ThreadsPreview />}
            </button>
          );
        })}
      </div>

      <p className="text-xs" style={{ color: "#888" }}>
        Switching only changes which messaging box is shown. Messages sent in the other style are kept and reappear if you switch back.
      </p>

      {status && (
        <p
          role={status.kind === "error" ? "alert" : "status"}
          className="text-sm px-3 py-2 rounded-lg"
          style={
            status.kind === "error"
              ? { color: "#c0392b", backgroundColor: "rgba(192,57,43,0.06)" }
              : { color: "#114E3B", backgroundColor: "rgba(17,78,59,0.06)" }
          }
        >
          {status.text}
        </p>
      )}

      <div className="flex items-center justify-end gap-3 flex-wrap">
        {hasChanges && (
          <p className="text-xs mr-auto" style={{ color: "#8a6416" }}>
            Unsaved change: switch from {MODE_NAMES[saved]} to {MODE_NAMES[selected]}.
          </p>
        )}
        {hasChanges && (
          <Button variant="ghost" onClick={() => choose(saved)} disabled={isSaving}>Cancel</Button>
        )}
        <Button onClick={save} isLoading={isSaving} disabled={!hasChanges}>Save</Button>
      </div>
    </div>
  );
}

/** Illustration of the chat style: one conversation of message bubbles. */
function ChatPreview() {
  const bubbles: { fromStaff: boolean; text: string }[] = [
    { fromStaff: true, text: "Hi Emma, your interview is booked for Tuesday." },
    { fromStaff: false, text: "Great, thank you!" },
    { fromStaff: true, text: "See you then." },
  ];
  return (
    <span className="rounded-lg p-3 flex flex-col gap-1.5" style={{ backgroundColor: "#EFEFEC" }} aria-hidden="true">
      <span className="block text-[9px] font-semibold uppercase tracking-widest mb-0.5" style={{ color: "#999" }}>Preview</span>
      {bubbles.map((b, i) => (
        <span key={i} className={`flex ${b.fromStaff ? "justify-start" : "justify-end"}`}>
          <span
            className="text-[11px] leading-snug px-2.5 py-1.5 max-w-[80%]"
            style={{
              backgroundColor: b.fromStaff ? "#fff" : "#114E3B",
              color: b.fromStaff ? "#333" : "#fff",
              borderRadius: 12,
              borderBottomLeftRadius: b.fromStaff ? 3 : 12,
              borderBottomRightRadius: b.fromStaff ? 12 : 3,
            }}
          >
            {b.text}
          </span>
        </span>
      ))}
    </span>
  );
}

/** Illustration of the threads style: a list of subject-line conversations. */
function ThreadsPreview() {
  const threads = [
    { subject: "Interview booking", preview: "Your interview is booked for…", unread: true },
    { subject: "IELTS certificate", preview: "Thanks, we've received it.", unread: false },
    { subject: "Offer question", preview: "Can I defer my start date?", unread: false },
  ];
  return (
    <span className="block rounded-lg overflow-hidden" style={{ border: "1px solid rgba(0,0,0,0.08)" }} aria-hidden="true">
      <span className="block text-[9px] font-semibold uppercase tracking-widest px-3 pt-2 pb-1" style={{ color: "#999", backgroundColor: "#F8F8F6" }}>Preview</span>
      {threads.map((t, i) => (
        <span
          key={t.subject}
          className="flex items-center justify-between gap-2 px-3 py-1.5"
          style={{ backgroundColor: i === 0 ? "#F0F6F4" : "#fff", borderTop: "1px solid rgba(0,0,0,0.05)" }}
        >
          <span className="min-w-0">
            <span className="block text-[11px] truncate" style={{ color: "#222", fontWeight: t.unread ? 700 : 600 }}>{t.subject}</span>
            <span className="block text-[10px] truncate" style={{ color: "#999" }}>{t.preview}</span>
          </span>
          {t.unread && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: "#C79A3B" }} />}
        </span>
      ))}
    </span>
  );
}
