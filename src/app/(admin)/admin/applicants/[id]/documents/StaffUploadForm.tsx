"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { UploadProgress } from "@/components/ui/UploadProgress";
import { uploadWithProgress } from "@/lib/uploadWithProgress";
import { CATEGORY_ACCEPT } from "@/lib/documentValidation";

/** Staff upload a file to an applicant. Publishing to the student portal is a separate permission. */
export function StaffUploadForm({ applicationId, canPublish }: { applicationId: string; canPublish: boolean }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  const [publish, setPublish] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const isLoading = progress !== null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) { setError("Please choose a file."); return; }

    setProgress(0);
    setError("");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("description", description);
    formData.append("publish", String(canPublish && publish));

    const res = await uploadWithProgress<{ error?: string }>(
      `/api/admin/applicants/${applicationId}/documents`,
      formData,
      setProgress
    );
    setProgress(null);

    if (!res.ok) {
      setError(res.data?.error ?? "The upload didn't work. Check your connection and try again.");
      return;
    }

    setFile(null);
    setDescription("");
    setPublish(false);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm p-5 mb-5 flex flex-col gap-3">
      <div>
        <h2 className="text-sm font-semibold" style={{ color: "#222" }}>Upload a document</h2>
        <p className="text-xs mt-0.5" style={{ color: "#888" }}>
          {canPublish
            ? "Uploads are staff-only until you publish them to the student portal."
            : "Uploads are staff-only. A colleague with publish permission can share them with the student."}
        </p>
      </div>

      {isLoading ? (
        <UploadProgress progress={progress} fileName={file?.name} processingLabel="Saving…" />
      ) : (
        <input
          type="file"
          accept={`${CATEGORY_ACCEPT.ANY},.heic,.heif`}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          aria-label="Choose a file to upload"
          className="text-sm"
        />
      )}

      <input
        type="text"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Short description for the student (optional)"
        maxLength={200}
        disabled={isLoading}
        aria-label="Description"
        className="text-sm px-3 py-2 rounded-lg border border-black/10"
      />

      <div className="flex items-center justify-between gap-3 flex-wrap">
        {canPublish ? (
          <label className="flex items-center gap-2 text-sm" style={{ color: "#444" }}>
            <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} disabled={isLoading} />
            Publish to the student portal now
          </label>
        ) : (
          <span />
        )}
        <Button type="submit" isLoading={isLoading} disabled={!file}>Upload</Button>
      </div>

      {error && <p role="alert" className="text-sm text-red-flag">{error}</p>}
    </form>
  );
}
