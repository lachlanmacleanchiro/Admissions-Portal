"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { UploadProgress } from "@/components/ui/UploadProgress";
import { uploadWithProgress } from "@/lib/uploadWithProgress";
import { CATEGORY_ACCEPT } from "@/lib/documentValidation";

/** "+ Upload" button that opens a modal for staff to add a file. Publishing is a separate permission. */
export function UploadDocumentButton({ applicationId, canPublish }: { applicationId: string; canPublish: boolean }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  const [publish, setPublish] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const isLoading = progress !== null;

  function close() {
    if (isLoading) return;
    setIsOpen(false);
    setFile(null);
    setDescription("");
    setPublish(false);
    setError("");
  }

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

    close();
    router.refresh();
  }

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>+ Upload</Button>

      <Modal isOpen={isOpen} onClose={close} title="Upload a document" size="md">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const dropped = e.dataTransfer.files[0];
              if (dropped) setFile(dropped);
            }}
            className="p-6 text-center rounded-xl transition-colors"
            style={{
              border: `2px dashed ${isDragging ? "#114E3B" : "rgba(0,0,0,0.12)"}`,
              backgroundColor: isDragging ? "rgba(17,78,59,0.04)" : "#F8F8F6",
            }}
          >
            <input
              ref={inputRef}
              type="file"
              id="staff-doc-upload"
              className="hidden"
              disabled={isLoading}
              accept={`${CATEGORY_ACCEPT.ANY},.heic,.heif`}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {isLoading ? (
              <UploadProgress progress={progress} fileName={file?.name} processingLabel="Saving…" />
            ) : (
              <label htmlFor="staff-doc-upload" className="cursor-pointer flex flex-col items-center gap-1.5">
                <svg className="w-7 h-7 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                <span className="text-sm font-medium text-text">{file ? file.name : "Choose a file or drag it here"}</span>
                <span className="text-xs text-text-light">PDF, Word or image · Max 10MB</span>
              </label>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="staff-doc-description" className="text-xs font-semibold" style={{ color: "#555" }}>
              Description <span className="font-normal" style={{ color: "#aaa" }}>(optional, shown to the student if published)</span>
            </label>
            <input
              id="staff-doc-description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={200}
              disabled={isLoading}
              className="text-sm px-3 py-2 rounded-lg border border-black/10"
            />
          </div>

          {canPublish ? (
            <label className="flex items-start gap-2 text-sm" style={{ color: "#444" }}>
              <input type="checkbox" className="mt-1" checked={publish} onChange={(e) => setPublish(e.target.checked)} disabled={isLoading} />
              <span>
                Publish to student portal
                <span className="block text-xs" style={{ color: "#888" }}>
                  Unticked files stay staff-only. You can publish them later.
                </span>
              </span>
            </label>
          ) : (
            <p className="text-xs" style={{ color: "#888" }}>
              This file will be staff-only. A colleague with publish permission can share it with the student.
            </p>
          )}

          {error && <p role="alert" className="text-sm text-red-flag">{error}</p>}

          <div className="flex gap-3 justify-end">
            <Button type="button" variant="ghost" onClick={close} disabled={isLoading}>Cancel</Button>
            <Button type="submit" isLoading={isLoading} disabled={!file}>Upload</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
