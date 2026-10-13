"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { uploadWithProgress } from "@/lib/uploadWithProgress";
import { UploadProgress } from "@/components/ui/UploadProgress";

interface ChecklistUploadButtonProps {
  documentType: string;
  accept: string;
  label: string;
  /** The file type the server will accept, used to catch mistakes before uploading. */
  allowedMimeTypes: string[];
  typeHint: string;
}

const MAX_SIZE = 10 * 1024 * 1024;

export function ChecklistUploadButton({ documentType, accept, label, allowedMimeTypes, typeHint }: ChecklistUploadButtonProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [fileName, setFileName] = useState("");
  // Keeps "Saving…" up until the refreshed page (with the new status) has loaded.
  const [isRefreshing, startRefresh] = useTransition();
  const isUploading = progress !== null || isRefreshing;
  const [error, setError] = useState("");

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError("");
    if (!allowedMimeTypes.includes(file.type)) {
      setError(`Please choose a ${typeHint} file.`);
      return;
    }
    if (file.size > MAX_SIZE) {
      setError("That file is larger than 10MB.");
      return;
    }
    setFileName(file.name);
    setProgress(0);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("documentType", documentType);
    const res = await uploadWithProgress<{ error?: string }>("/api/student/documents", formData, setProgress);
    if (inputRef.current) inputRef.current.value = "";
    if (!res.ok) {
      setProgress(null);
      setError(res.data?.error ?? "The upload didn't work. Check your connection and try again.");
      return;
    }
    setProgress(null);
    startRefresh(() => router.refresh());
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <input
        ref={inputRef}
        id={`upload-${documentType}`}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      {isUploading ? (
        <div className="w-48">
          <UploadProgress progress={progress ?? 1} fileName={fileName} processingLabel="Saving…" compact />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-opacity hover:opacity-90"
          style={{ backgroundColor: "#114E3B", color: "#fff" }}
        >
          {label}
        </button>
      )}
      {error && <p role="alert" className="text-xs text-right" style={{ color: "#c0392b" }}>{error}</p>}
    </div>
  );
}
