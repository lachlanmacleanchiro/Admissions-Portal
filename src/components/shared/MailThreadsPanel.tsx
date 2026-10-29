"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

type SenderRole = "STAFF" | "STUDENT";

interface ThreadMessage {
  id: string;
  senderRole: SenderRole;
  body: string;
  sentAt: string;
  sender?: { firstName: string; lastName: string };
}

interface ThreadSummary {
  id: string;
  subject: string;
  updatedAt: string;
  messages: ThreadMessage[];
  _count: { messages: number };
}

interface ThreadDetail extends ThreadSummary {
  messages: ThreadMessage[];
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-NZ", { day: "numeric", month: "short" });
}

function formatDateTime(date: string) {
  return new Date(date).toLocaleString("en-NZ", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

export function MailThreadsPanel({
  baseUrl,
  viewerRole,
  composerLabel,
}: {
  /** e.g. "/api/student/mail-threads" or "/api/admin/applicants/abc123/mail-threads" */
  baseUrl: string;
  viewerRole: SenderRole;
  composerLabel: string;
}) {
  const router = useRouter();
  const [threads, setThreads] = useState<ThreadSummary[] | null>(null);
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeThread, setActiveThread] = useState<ThreadDetail | null>(null);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [newBody, setNewBody] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [error, setError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function loadThreads(searchTerm: string) {
    const url = searchTerm ? `${baseUrl}?search=${encodeURIComponent(searchTerm)}` : baseUrl;
    const res = await fetch(url);
    if (res.ok) setThreads(await res.json());
  }

  useEffect(() => {
    loadThreads("");
  }, [baseUrl]);

  useEffect(() => {
    const timeout = setTimeout(() => loadThreads(search), 300);
    return () => clearTimeout(timeout);
  }, [search]);

  async function openThread(id: string) {
    setActiveId(id);
    const res = await fetch(`${baseUrl}/${id}`);
    if (res.ok) {
      setActiveThread(await res.json());
      // Opening a thread marks it read; refresh so the applicant tab's unread badge updates.
      if (viewerRole === "STAFF") router.refresh();
    }
  }

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [activeThread?.messages.length]);

  async function handleCreateThread(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!newSubject.trim() || !newBody.trim()) {
      setError("Subject and message are both required.");
      return;
    }
    setIsSending(true);
    const res = await fetch(baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject: newSubject, body: newBody }),
    });
    setIsSending(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to send. Please try again.");
      return;
    }
    setIsComposeOpen(false);
    setNewSubject("");
    setNewBody("");
    await loadThreads(search);
    const created = await res.json().catch(() => null);
    if (created?.id) openThread(created.id);
  }

  async function handleReply(e: React.FormEvent) {
    e.preventDefault();
    if (!replyBody.trim() || !activeId) return;
    setIsSending(true);
    const res = await fetch(`${baseUrl}/${activeId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: replyBody }),
    });
    setIsSending(false);
    if (res.ok) {
      setReplyBody("");
      openThread(activeId);
      loadThreads(search);
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden flex" style={{ height: 560 }}>
      {/* Thread list */}
      <div className="w-72 flex-shrink-0 flex flex-col" style={{ borderRight: "1px solid rgba(0,0,0,0.06)" }}>
        <div className="px-4 py-3.5 flex-shrink-0" style={{ borderBottom: "1px solid rgba(0,0,0,0.06)", backgroundColor: "#F8F8F6" }}>
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#555" }}>Threads</p>
            <button onClick={() => setIsComposeOpen(true)} className="text-xs font-semibold" style={{ color: "#114E3B" }}>+ New</button>
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search threads…"
            className="w-full px-3 py-1.5 text-xs rounded-lg"
            style={{ backgroundColor: "#fff", border: "1.5px solid rgba(0,0,0,0.1)" }}
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {threads === null ? (
            <p className="px-4 py-4 text-xs" style={{ color: "#999" }}>Loading…</p>
          ) : threads.length === 0 ? (
            <p className="px-4 py-4 text-xs" style={{ color: "#999" }}>No threads yet.</p>
          ) : (
            threads.map((t) => {
              const last = t.messages[0];
              const isActive = t.id === activeId;
              const unread = t._count.messages > 0;
              return (
                <button
                  key={t.id}
                  onClick={() => openThread(t.id)}
                  className="w-full text-left px-4 py-3 transition-colors"
                  style={{
                    backgroundColor: isActive ? "#F0F6F4" : "transparent",
                    borderBottom: "1px solid rgba(0,0,0,0.04)",
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm truncate" style={{ color: "#222", fontWeight: unread ? 700 : 600 }}>{t.subject}</span>
                    {unread && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: "#C79A3B" }} />}
                  </div>
                  {last && (
                    <p className="text-xs truncate mt-0.5" style={{ color: "#999" }}>{last.body}</p>
                  )}
                  <p className="text-[10px] mt-1" style={{ color: "#bbb" }}>{formatDate(t.updatedAt)}</p>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Active thread */}
      <div className="flex-1 flex flex-col">
        {!activeThread ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm" style={{ color: "#999" }}>Select a thread, or start a new one.</p>
          </div>
        ) : (
          <>
            <div className="px-5 py-3.5 flex-shrink-0" style={{ borderBottom: "1px solid rgba(0,0,0,0.06)", backgroundColor: "#F8F8F6" }}>
              <p className="text-sm font-semibold" style={{ color: "#222" }}>{activeThread.subject}</p>
            </div>
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3" style={{ backgroundColor: "#EFEFEC" }}>
              {activeThread.messages.map((msg) => {
                const isMine = msg.senderRole === viewerRole;
                return (
                  <div key={msg.id} className={["flex", isMine ? "justify-end" : "justify-start"].join(" ")}>
                    <div
                      className="max-w-[75%] text-sm leading-snug"
                      style={{
                        backgroundColor: isMine ? "#114E3B" : "#fff",
                        color: isMine ? "#fff" : "#222",
                        borderRadius: 14,
                        boxShadow: isMine ? "none" : "0 1px 1px rgba(0,0,0,0.05)",
                        padding: "10px 14px",
                      }}
                    >
                      {msg.sender && (
                        <div className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: isMine ? "rgba(255,255,255,0.7)" : "#999" }}>
                          {msg.sender.firstName} {msg.sender.lastName}
                        </div>
                      )}
                      <div style={{ wordBreak: "break-word" }}>{msg.body}</div>
                      <div style={{ fontSize: 10, marginTop: 4, color: isMine ? "rgba(255,255,255,0.65)" : "#aaa", textAlign: "right" }}>
                        {formatDateTime(msg.sentAt)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <form onSubmit={handleReply} className="flex-shrink-0" style={{ borderTop: "1px solid rgba(0,0,0,0.06)", padding: "12px 16px" }}>
              <div className="flex items-center gap-2">
                <textarea
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleReply(e);
                    }
                  }}
                  rows={1}
                  placeholder={composerLabel}
                  className="flex-1 text-sm focus:outline-none text-text placeholder:text-text-light resize-none"
                  style={{ backgroundColor: "#F2F2F0", border: "1.5px solid rgba(0,0,0,0.08)", borderRadius: 20, padding: "9px 16px", lineHeight: "20px", maxHeight: 100 }}
                />
                <Button type="submit" disabled={!replyBody.trim() || isSending} isLoading={isSending}>Send</Button>
              </div>
            </form>
          </>
        )}
      </div>

      <Modal isOpen={isComposeOpen} onClose={() => setIsComposeOpen(false)} title="New Thread">
        <form onSubmit={handleCreateThread} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-text mb-1.5">Subject</label>
            <input
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              className="w-full px-3 py-2.5 text-sm rounded-lg"
              style={{ backgroundColor: "#F8F8F6", border: "1.5px solid rgba(0,0,0,0.1)" }}
              placeholder="What's this about?"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1.5">Message</label>
            <textarea
              value={newBody}
              onChange={(e) => setNewBody(e.target.value)}
              rows={5}
              className="w-full px-3 py-2.5 text-sm rounded-lg resize-none"
              style={{ backgroundColor: "#F8F8F6", border: "1.5px solid rgba(0,0,0,0.1)" }}
            />
          </div>
          {error && <p className="text-sm text-red-flag">{error}</p>}
          <div className="flex gap-3 justify-end">
            <Button variant="ghost" type="button" onClick={() => setIsComposeOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={isSending}>Start Thread</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
