"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

interface EmailSendSettingsFormProps {
  fromAddress: string;
  fromName: string;
  /** Last 4 characters of the key saved in Settings, if any. */
  savedKeyLast4: string | null;
  savedKeyUnreadable: boolean;
  /** Where the key currently in use comes from. */
  apiKeySource: "settings" | "environment" | null;
  envFromAddress: string | null;
}

type Status = { kind: "success" | "error"; text: string } | null;

export function EmailSendSettingsForm({
  fromAddress: initialAddress,
  fromName: initialName,
  savedKeyLast4,
  savedKeyUnreadable,
  apiKeySource,
  envFromAddress,
}: EmailSendSettingsFormProps) {
  const router = useRouter();
  const [fromAddress, setFromAddress] = useState(initialAddress);
  const [fromName, setFromName] = useState(initialName);
  const [apiKey, setApiKey] = useState("");
  const [isReplacingKey, setIsReplacingKey] = useState(!savedKeyLast4);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  async function save(extra: { clearApiKey?: boolean } = {}) {
    setIsSaving(true);
    setStatus(null);
    const res = await fetch("/api/admin/settings/email", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromAddress, fromName, apiKey: isReplacingKey ? apiKey : "", ...extra }),
    });
    setIsSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setStatus({ kind: "error", text: data.error ?? "Couldn't save the email settings." });
      return;
    }
    setApiKey("");
    setIsReplacingKey(false);
    setStatus({ kind: "success", text: extra.clearApiKey ? "Saved API key removed." : "Email settings saved." });
    router.refresh();
  }

  async function sendTest() {
    setIsTesting(true);
    setStatus(null);
    const res = await fetch("/api/admin/settings/email/test", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setIsTesting(false);
    setStatus(
      res.ok
        ? { kind: "success", text: `Test email sent to ${data.sentTo}. Check your inbox.` }
        : { kind: "error", text: data.error ?? "The test email couldn't be sent." }
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 flex flex-col gap-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Input
            id="email-from-address"
            label="Send from address"
            type="email"
            value={fromAddress}
            onChange={(e) => setFromAddress(e.target.value)}
            placeholder={envFromAddress ?? "admissions@yourdomain.com"}
            autoComplete="off"
          />
          <p className="text-xs" style={{ color: "#888" }}>Must be on a domain you've verified in Resend.</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Input
            id="email-from-name"
            label="Send from name"
            value={fromName}
            onChange={(e) => setFromName(e.target.value)}
            placeholder="New Zealand College of Chiropractic"
            autoComplete="off"
          />
          <p className="text-xs" style={{ color: "#888" }}>What applicants see as the sender.</p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-semibold text-text">Resend API key</p>
        {savedKeyUnreadable && (
          <p className="text-xs px-3 py-2 rounded-lg" style={{ color: "#c0392b", backgroundColor: "rgba(192,57,43,0.06)" }}>
            The saved key can&apos;t be read (the server&apos;s AUTH_SECRET has changed). Enter the key again.
          </p>
        )}
        {isReplacingKey ? (
          <>
            <input
              id="email-api-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="re_…"
              autoComplete="new-password"
              aria-label="Resend API key"
              className="w-full px-4 py-2.5 rounded-lg text-sm text-text font-mono focus:outline-none"
              style={{ backgroundColor: "#F8F8F6", border: "1.5px solid rgba(0,0,0,0.1)" }}
            />
            <p className="text-xs" style={{ color: "#888" }}>
              Create one at resend.com → API Keys, with “Sending access”. It&apos;s stored encrypted and can&apos;t be viewed again after saving.
              {savedKeyLast4 && (
                <>
                  {" "}
                  <button type="button" className="font-semibold underline" onClick={() => { setIsReplacingKey(false); setApiKey(""); }}>
                    Keep the current key
                  </button>
                </>
              )}
            </p>
          </>
        ) : (
          <div className="flex items-center gap-3 flex-wrap">
            <span className="px-3 py-2 rounded-lg text-sm font-mono" style={{ backgroundColor: "#F8F8F6", color: "#555" }}>
              re_••••••••{savedKeyLast4}
            </span>
            <button type="button" onClick={() => setIsReplacingKey(true)} className="text-xs font-semibold" style={{ color: "#114E3B" }}>
              Replace key
            </button>
            <button type="button" onClick={() => save({ clearApiKey: true })} className="text-xs font-semibold" style={{ color: "#c0392b" }}>
              Remove key
            </button>
          </div>
        )}
        <p className="text-xs" style={{ color: "#888" }}>
          {apiKeySource === "settings"
            ? "Emails are being sent with the key saved here."
            : apiKeySource === "environment"
            ? "No key saved here yet — emails currently use the server's RESEND_API_KEY."
            : "No API key is configured, so the portal can't send emails yet."}
        </p>
      </div>

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

      <div className="flex items-center gap-3 justify-end">
        <Button variant="secondary" onClick={sendTest} isLoading={isTesting} disabled={isSaving}>
          Send test email
        </Button>
        <Button onClick={() => save()} isLoading={isSaving} disabled={isTesting}>
          Save
        </Button>
      </div>
    </div>
  );
}
