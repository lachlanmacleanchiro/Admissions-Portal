"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

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
  const [isUploading, setIsUploading] = useState(false);
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
    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("documentType", documentType);
    const res = await fetch("/api/student/documents", { method: "POST", body: formData }).catch(() => null);
    setIsUploading(false);
    if (inputRef.current) inputRef.current.value = "";
    if (!res || !res.ok) {
      const data = await res?.json().catch(() => ({}));
      setError(data?.error ?? "The upload didn't work. Please try again.");
      return;
    }
    router.refresh();
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
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={isUploading}
        className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-opacity hover:opacity-90 disabled:opacity-60"
        style={{ backgroundColor: "#114E3B", color: "#fff" }}
      >
        {isUploading ? "Uploading…" : label}
      </button>
      {error && <p role="alert" className="text-xs text-right" style={{ color: "#c0392b" }}>{error}</p>}
    </div>
  );
}
