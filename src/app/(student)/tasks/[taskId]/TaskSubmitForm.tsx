"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { CATEGORY_ACCEPT } from "@/lib/documentValidation";
import { uploadWithProgress } from "@/lib/uploadWithProgress";
import { UploadProgress } from "@/components/ui/UploadProgress";
import type { RequiredDocumentCategory } from "@/generated/prisma/client";

interface TaskSubmitFormProps {
  taskId: string;
  requiresDocument: boolean;
  documentInstructions: string | null;
  requiredDocumentCategory: RequiredDocumentCategory;
  existingNote: string | null;
}

const CATEGORY_HINT: Record<RequiredDocumentCategory, string> = {
  ANY: "PDF, Word or image · Max 10MB",
  DOCUMENT: "PDF or Word document · Max 10MB",
  IMAGE: "Image (JPG, PNG or WEBP) · Max 10MB",
};

export function TaskSubmitForm({ taskId, requiresDocument, documentInstructions, requiredDocumentCategory, existingNote }: TaskSubmitFormProps) {
  const router = useRouter();
  const [note, setNote] = useState(existingNote ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  // null = not uploading; 0–1 while the file sends.
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (requiresDocument && !file) {
      setError("Please upload the required document before submitting.");
      return;
    }

    setIsLoading(true);
    setError("");

    // Upload document first if required
    if (file) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("taskId", taskId);
      formData.append("documentType", "TASK_SUBMISSION");

      setUploadProgress(0);
      const uploadRes = await uploadWithProgress<{ error?: string }>("/api/student/documents", formData, setUploadProgress);

      if (!uploadRes.ok) {
        setUploadProgress(null);
        setError(uploadRes.data?.error ?? "The upload didn't work. Check your connection and try again.");
        setIsLoading(false);
        return;
      }
    }

    // Submit task
    const res = await fetch(`/api/student/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentNote: note }),
    });

    setIsLoading(false);
    setUploadProgress(null);

    if (!res.ok) {
      setError("Submission failed. Please try again.");
      return;
    }

    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm p-6 flex flex-col gap-4">
      <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#999" }}>Submit this task</p>

      {requiresDocument && (
        <div>
          {documentInstructions && (
            <p className="text-sm text-text-muted mb-3">{documentInstructions}</p>
          )}
          <label className="block">
            <span className="text-sm font-semibold text-text block mb-1.5">
              Upload document <span style={{ color: "#c0392b" }}>*</span>
            </span>
            {uploadProgress !== null ? (
              <div className="p-6 rounded-xl" style={{ border: "2px solid rgba(17,78,59,0.2)", backgroundColor: "#F8F8F6" }}>
                <UploadProgress progress={uploadProgress} fileName={file?.name} processingLabel="Submitting your task…" />
              </div>
            ) : (
            <div
              className="p-6 text-center cursor-pointer rounded-xl transition-colors"
              style={{ border: "2px dashed rgba(0,0,0,0.12)", backgroundColor: "#F8F8F6" }}
            >
              <input
                disabled={isLoading}
                type="file"
                accept={CATEGORY_ACCEPT[requiredDocumentCategory]}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <svg className="w-8 h-8 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ color: "#bbb" }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                {file ? (
                  <p className="text-sm font-medium" style={{ color: "#114E3B" }}>{file.name}</p>
                ) : (
                  <>
                    <p className="text-sm" style={{ color: "#aaa" }}>Click to upload</p>
                    <p className="text-xs mt-1" style={{ color: "#ccc" }}>{CATEGORY_HINT[requiredDocumentCategory]}</p>
                  </>
                )}
              </label>
            </div>
            )}
          </label>
        </div>
      )}

      <div>
        <label className="block mb-1.5 text-sm font-semibold text-text">
          Note <span className="font-normal" style={{ color: "#aaa" }}>(optional)</span>
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          className="w-full px-3 py-2.5 text-sm focus:outline-none text-text placeholder:text-text-light resize-none rounded-lg"
          style={{ backgroundColor: "#F8F8F6", border: "1.5px solid rgba(0,0,0,0.1)" }}
          placeholder="Add any notes for the admissions team…"
        />
      </div>

      {error && (
        <p className="text-sm px-3 py-2 rounded-lg" style={{ color: "#c0392b", backgroundColor: "rgba(192,57,43,0.06)" }}>{error}</p>
      )}

      <Button type="submit" isLoading={isLoading}>Submit task</Button>
    </form>
  );
}
