"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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

export function MessagingModeSelector({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Mode>(mode);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  async function choose(next: Mode) {
    if (next === selected || isSaving) return;
    const previous = selected;
    setSelected(next);
    setIsSaving(true);
    setStatus(null);
    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messagingMode: next }),
    }).catch(() => null);
    setIsSaving(false);
    if (!res || !res.ok) {
      setSelected(previous);
      setStatus({ kind: "error", text: "Couldn't change the messaging style. Please try again." });
      return;
    }
    setStatus({ kind: "success", text: `Students and staff now see ${next === "CHAT" ? "Chat" : "Threads"}.` });
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
              className="text-left rounded-xl px-4 py-3.5 transition-colors disabled:cursor-wait"
              style={{
                border: `1.5px solid ${isSelected ? "#114E3B" : "rgba(0,0,0,0.1)"}`,
                backgroundColor: isSelected ? "rgba(17,78,59,0.05)" : "#fff",
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
              </span>
              <span className="block text-xs mt-1.5" style={{ color: "#777", paddingLeft: 26 }}>{option.description}</span>
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
    </div>
  );
}
