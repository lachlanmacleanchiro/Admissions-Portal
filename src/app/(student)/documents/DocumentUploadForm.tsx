"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { CATEGORY_ACCEPT } from "@/lib/documentValidation";
import { uploadWithProgress } from "@/lib/uploadWithProgress";
import { UploadProgress } from "@/components/ui/UploadProgress";

/** Upload for anything not on the checklist. Files for a task are uploaded from that task's page. */
export function DocumentUploadForm() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const isLoading = progress !== null;
  const [error, setError] = useState("");

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) { setError("Please choose a file."); return; }

    setProgress(0);
    setError("");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("documentType", "GENERAL");

    const res = await uploadWithProgress<{ error?: string }>("/api/student/documents", formData, setProgress);
    setProgress(null);

    if (!res.ok) {
      setError(res.data?.error ?? "The upload didn't work. Check your connection and try again.");
      return;
    }

    setFile(null);
    router.refresh();
  }

  return (
    <form onSubmit={handleUpload} className="flex flex-col gap-3">
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const dropped = e.dataTransfer.files[0];
          if (dropped) setFile(dropped);
        }}
        className="p-6 text-center transition-colors rounded-xl"
        style={{
          border: `2px dashed ${isDragging ? "#114E3B" : "rgba(0,0,0,0.12)"}`,
          backgroundColor: isDragging ? "rgba(17,78,59,0.04)" : "#F8F8F6",
        }}
      >
        <input type="file" id="doc-upload" className="hidden" disabled={isLoading} onChange={(e) => setFile(e.target.files?.[0] ?? null)} accept={CATEGORY_ACCEPT.DOCUMENT} />
        {isLoading ? (
          <UploadProgress progress={progress} fileName={file?.name} processingLabel="Saving…" />
        ) : (
        <label htmlFor="doc-upload" className="cursor-pointer flex flex-col items-center gap-1.5">
          <svg className="w-7 h-7 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          <span className="text-sm font-medium text-text">{file ? file.name : "Choose a file or drag it here"}</span>
          <span className="text-xs text-text-light">PDF or Word document · Max 10MB</span>
        </label>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        {error ? <p role="alert" className="text-sm text-red-flag">{error}</p> : <span />}
        <Button type="submit" isLoading={isLoading} disabled={!file}>Upload</Button>
      </div>
    </form>
  );
}
