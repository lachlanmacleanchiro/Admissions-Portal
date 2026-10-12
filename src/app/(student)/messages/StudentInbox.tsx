"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

type SenderRole = "STAFF" | "STUDENT";

export interface InboxMessage {
  id: string;
  senderRole: SenderRole;
  body: string;
  sentAt: string;
  isRead: boolean;
  sender?: { firstName: string; lastName: string } | null;
}

export interface InboxThreadSummary {
  id: string;
  subject: string;
  updatedAt: string;
  messages: InboxMessage[]; // latest message only
  _count: { messages: number }; // unread staff messages
}

const CHAT_KEY = "chat";
const POLL_MS = 30_000;

function formatListDate(date: string) {
  const d = new Date(date);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) {
    return d.toLocaleTimeString("en-NZ", { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString("en-NZ", { day: "numeric", month: "short" });
}

function formatDayLabel(date: string) {
  const d = new Date(date);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "Today";
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" });
}

function formatTime(date: string) {
  return new Date(date).toLocaleTimeString("en-NZ", { hour: "numeric", minute: "2-digit" });
}

export function StudentInbox({
  initialChat,
  initialThreads,
  mode,
}: {
  initialChat: InboxMessage[];
  initialThreads: InboxThreadSummary[];
  /** Messaging style chosen in Settings → Communication. */
  mode: "CHAT" | "THREADS";
}) {
  const router = useRouter();
  const [chat, setChat] = useState(initialChat);
  const [threads, setThreads] = useState(initialThreads);
  const [activeKey, setActiveKey] = useState<string | null>(() => {
    if (mode === "CHAT") return CHAT_KEY;
    // Open the first conversation with unread messages, otherwise the most recent one.
    return (initialThreads.find((t) => t._count.messages > 0) ?? initialThreads[0])?.id ?? null;
  });
  const [threadMessages, setThreadMessages] = useState<InboxMessage[] | null>(null);
  const [draft, setDraft] = useState("");
  const [sendError, setSendError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [newBody, setNewBody] = useState("");
  const [composeError, setComposeError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const isChat = activeKey === CHAT_KEY;
  const activeThread = threads.find((t) => t.id === activeKey);

  const loadChat = useCallback(async (markRead: boolean) => {
    const res = await fetch(`/api/student/messages${markRead ? "" : "?peek=1"}`);
    if (res.ok) setChat((await res.json()).messages);
  }, []);

  const loadThreads = useCallback(async () => {
    const res = await fetch("/api/student/mail-threads");
    if (res.ok) setThreads(await res.json());
  }, []);

  const loadThread = useCallback(async (id: string) => {
    const res = await fetch(`/api/student/mail-threads/${id}`);
    if (res.ok) setThreadMessages((await res.json()).messages);
  }, []);

  // Opening a conversation marks it read; refresh the sidebar badge afterwards.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (activeKey === null) return;
      if (activeKey === CHAT_KEY) {
        await loadChat(true);
      } else {
        setThreadMessages(null);
        await loadThread(activeKey);
        await loadThreads();
      }
      if (!cancelled) router.refresh();
    })();
    return () => { cancelled = true; };
  }, [activeKey, loadChat, loadThread, loadThreads, router]);

  // Check for new messages every 30 seconds while the tab is visible.
  useEffect(() => {
    const timer = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      if (mode === "CHAT") await loadChat(true);
      else await Promise.all([loadThreads(), activeKey ? loadThread(activeKey) : null]);
      router.refresh();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [activeKey, mode, loadChat, loadThread, loadThreads, router]);

  const messages = isChat ? chat : threadMessages ?? [];

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length, activeKey]);

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    if (!draft.trim() || isSending || !activeKey) return;
    setIsSending(true);
    setSendError("");
    const res = await fetch(isChat ? "/api/student/messages" : `/api/student/mail-threads/${activeKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: draft }),
    }).catch(() => null);
    setIsSending(false);
    if (!res || !res.ok) {
      // Keep the draft so nothing the student wrote is lost.
      setSendError("Your message wasn't sent. Check your connection and try again.");
      return;
    }
    setDraft("");
    if (isChat) await loadChat(true);
    else await Promise.all([loadThread(activeKey), loadThreads()]);
  }

  async function startConversation(e: React.FormEvent) {
    e.preventDefault();
    setComposeError("");
    if (!newSubject.trim() || !newBody.trim()) {
      setComposeError("Add a subject and a message.");
      return;
    }
    setIsSending(true);
    const res = await fetch("/api/student/mail-threads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject: newSubject, body: newBody }),
    }).catch(() => null);
    setIsSending(false);
    if (!res || !res.ok) {
      setComposeError("Your message wasn't sent. Check your connection and try again.");
      return;
    }
    const created = await res.json();
    setIsComposeOpen(false);
    setNewSubject("");
    setNewBody("");
    await loadThreads();
    setActiveKey(created.id);
  }

  const lastOwnIndex = messages.map((m) => m.senderRole).lastIndexOf("STUDENT");

  // Group the open conversation's messages by day.
  const groups: { label: string; items: { msg: InboxMessage; index: number }[] }[] = [];
  messages.forEach((msg, index) => {
    const label = formatDayLabel(msg.sentAt);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push({ msg, index });
    else groups.push({ label, items: [{ msg, index }] });
  });

  return (
    <div
      className="bg-white rounded-2xl shadow-sm overflow-hidden flex"
      style={{ height: "min(680px, calc(100vh - 200px))", minHeight: 440 }}
    >
      {/* Conversation list (Threads mode only) */}
      {mode === "THREADS" && (
      <div className="w-72 flex-shrink-0 flex flex-col" style={{ borderRight: "1px solid rgba(0,0,0,0.06)" }}>
        <div className="px-4 py-3 flex items-center justify-between flex-shrink-0" style={{ borderBottom: "1px solid rgba(0,0,0,0.06)", backgroundColor: "#F8F8F6" }}>
          <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#555" }}>Conversations</p>
          <button onClick={() => setIsComposeOpen(true)} className="text-xs font-semibold" style={{ color: "#114E3B" }}>
            + New message
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {threads.length === 0 && (
            <p className="px-4 py-4 text-xs" style={{ color: "#999" }}>No conversations yet.</p>
          )}
          {threads.map((t) => (
            <ConversationItem
              key={t.id}
              title={t.subject}
              preview={t.messages[0]?.body ?? ""}
              date={t.updatedAt}
              unread={t._count.messages}
              isActive={t.id === activeKey}
              onClick={() => setActiveKey(t.id)}
            />
          ))}
        </div>
      </div>
      )}

      {/* Open conversation */}
      {activeKey === null ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center" style={{ backgroundColor: "#EFEFEC" }}>
          <p className="text-sm font-semibold" style={{ color: "#333" }}>No conversations yet</p>
          <p className="text-xs max-w-xs" style={{ color: "#888" }}>Ask the admissions team anything about your application.</p>
          <Button onClick={() => setIsComposeOpen(true)}>Start a conversation</Button>
        </div>
      ) : (
      <div className="flex-1 flex flex-col min-w-0">
        <div className="px-5 py-3 flex-shrink-0" style={{ borderBottom: "1px solid rgba(0,0,0,0.06)", backgroundColor: "#F8F8F6" }}>
          <p className="text-sm font-semibold truncate" style={{ color: "#222" }}>
            {isChat ? "Admissions team" : activeThread?.subject ?? "Conversation"}
          </p>
          <p className="text-[11px]" style={{ color: "#999" }}>
            {isChat ? "The NZCC admissions team usually replies within 2 working days." : "Conversation with the NZCC admissions team"}
          </p>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-1" style={{ backgroundColor: "#EFEFEC" }}>
          {!isChat && threadMessages === null ? (
            <p className="m-auto text-xs" style={{ color: "#999" }}>Loading…</p>
          ) : messages.length === 0 ? (
            <p className="m-auto text-xs text-center max-w-xs" style={{ color: "#888" }}>
              No messages yet. Ask the admissions team anything about your application.
            </p>
          ) : (
            groups.map((group) => (
              <div key={group.label} className="flex flex-col gap-1">
                <div className="flex justify-center my-2.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wide px-3 py-1 rounded-full" style={{ backgroundColor: "rgba(0,0,0,0.06)", color: "#888" }}>
                    {group.label}
                  </span>
                </div>
                {group.items.map(({ msg, index }) => {
                  const isMine = msg.senderRole === "STUDENT";
                  const prev = messages[index - 1];
                  const startsRun = !prev || prev.senderRole !== msg.senderRole;
                  return (
                    <div key={msg.id} className={`flex flex-col ${isMine ? "items-end" : "items-start"}`} style={{ marginTop: startsRun ? 8 : 0 }}>
                      {!isMine && startsRun && msg.sender && (
                        <span className="text-[10px] font-semibold mb-0.5 px-1" style={{ color: "#888" }}>
                          {msg.sender.firstName} · NZCC Admissions
                        </span>
                      )}
                      <div
                        className="max-w-[75%] text-sm leading-snug"
                        style={{
                          backgroundColor: isMine ? "#114E3B" : "#fff",
                          color: isMine ? "#fff" : "#222",
                          borderRadius: 18,
                          borderBottomRightRadius: isMine ? 4 : 18,
                          borderBottomLeftRadius: isMine ? 18 : 4,
                          boxShadow: isMine ? "none" : "0 1px 1px rgba(0,0,0,0.05)",
                          padding: "9px 14px",
                        }}
                      >
                        <div style={{ wordBreak: "break-word", whiteSpace: "pre-wrap" }}>{msg.body}</div>
                        <div style={{ fontSize: 10, marginTop: 3, color: isMine ? "rgba(255,255,255,0.65)" : "#aaa", textAlign: "right" }}>
                          {formatTime(msg.sentAt)}
                        </div>
                      </div>
                      {index === lastOwnIndex && (
                        <span className="text-[10px] mt-0.5 px-1" style={{ color: msg.isRead ? "#114E3B" : "#999" }}>
                          {msg.isRead ? "Seen by the admissions team" : "Sent"}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <form onSubmit={send} className="flex-shrink-0" style={{ borderTop: "1px solid rgba(0,0,0,0.06)", padding: "12px 16px" }}>
          {sendError && (
            <p role="alert" className="text-xs mb-2 px-3 py-2 rounded-lg" style={{ color: "#c0392b", backgroundColor: "rgba(192,57,43,0.06)" }}>
              {sendError}
            </p>
          )}
          <div className="flex items-end gap-2">
            <textarea
              id="inbox-reply"
              value={draft}
              onChange={(e) => { setDraft(e.target.value); setSendError(""); }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={1}
              aria-label="Write a message"
              placeholder="Write a message… (Shift+Enter for a new line)"
              className="flex-1 text-sm focus:outline-none text-text placeholder:text-text-light resize-none"
              style={{ backgroundColor: "#F2F2F0", border: "1.5px solid rgba(0,0,0,0.08)", borderRadius: 20, padding: "9px 16px", lineHeight: "20px", maxHeight: 120 }}
            />
            <Button type="submit" disabled={!draft.trim()} isLoading={isSending}>Send</Button>
          </div>
        </form>
      </div>
      )}

      <Modal isOpen={isComposeOpen} onClose={() => setIsComposeOpen(false)} title="New message">
        <form onSubmit={startConversation} className="flex flex-col gap-4">
          <p className="text-sm text-text-muted">
            Start a separate conversation for a specific topic, such as your documents or your offer.
          </p>
          <div>
            <label htmlFor="new-conversation-subject" className="block text-sm font-semibold text-text mb-1.5">Subject</label>
            <input
              id="new-conversation-subject"
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              className="w-full px-3 py-2.5 text-sm rounded-lg focus:outline-none"
              style={{ backgroundColor: "#F8F8F6", border: "1.5px solid rgba(0,0,0,0.1)" }}
              placeholder="e.g. Question about my IELTS certificate"
            />
          </div>
          <div>
            <label htmlFor="new-conversation-body" className="block text-sm font-semibold text-text mb-1.5">Message</label>
            <textarea
              id="new-conversation-body"
              value={newBody}
              onChange={(e) => setNewBody(e.target.value)}
              rows={5}
              className="w-full px-3 py-2.5 text-sm rounded-lg resize-none focus:outline-none"
              style={{ backgroundColor: "#F8F8F6", border: "1.5px solid rgba(0,0,0,0.1)" }}
            />
          </div>
          {composeError && <p role="alert" className="text-sm text-red-flag">{composeError}</p>}
          <div className="flex gap-3 justify-end">
            <Button variant="ghost" type="button" onClick={() => setIsComposeOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={isSending}>Send message</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function ConversationItem({
  title,
  subtitle,
  preview,
  date,
  unread,
  isActive,
  onClick,
}: {
  title: string;
  subtitle?: string;
  preview: string;
  date?: string;
  unread: number;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-current={isActive ? "true" : undefined}
      className="w-full text-left px-4 py-3 transition-colors hover:bg-black/[0.02]"
      style={{ backgroundColor: isActive ? "#F0F6F4" : undefined, borderBottom: "1px solid rgba(0,0,0,0.04)" }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm truncate" style={{ color: "#222", fontWeight: unread > 0 ? 700 : 600 }}>{title}</span>
        {date && <span className="text-[10px] flex-shrink-0" style={{ color: "#aaa" }}>{formatListDate(date)}</span>}
      </div>
      {subtitle && <p className="text-[10px] uppercase tracking-wide" style={{ color: "#aaa" }}>{subtitle}</p>}
      <div className="flex items-center justify-between gap-2 mt-0.5">
        <p className="text-xs truncate" style={{ color: unread > 0 ? "#333" : "#999" }}>{preview}</p>
        {unread > 0 && (
          <span
            className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex-shrink-0"
            style={{ backgroundColor: "#C79A3B", color: "#fff" }}
            aria-label={`${unread} unread`}
          >
            {unread}
          </span>
        )}
      </div>
    </button>
  );
}
