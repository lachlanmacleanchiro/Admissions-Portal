"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { uploadWithProgress } from "@/lib/uploadWithProgress";
import { UploadProgress } from "@/components/ui/UploadProgress";

interface EvidenceDocument {
  id: string;
  filename: string;
  storageKey: string;
}

interface Condition {
  id: string;
  conditionText: string;
  status: "PENDING" | "SATISFIED" | "WAIVED";
  satisfiedAt: string | null;
  evidenceDocuments: EvidenceDocument[];
}

export function OfferConditionCard({ condition, canUpload }: { condition: Condition; canUpload: boolean }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const isLoading = progress !== null;
  const [error, setError] = useState("");

  async function handleUpload() {
    if (!file) return;
    setProgress(0);
    setError("");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("documentType", "OFFER_CONDITION_EVIDENCE");
    formData.append("offerConditionId", condition.id);

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
    <div className="px-4 py-3 rounded-lg" style={{ backgroundColor: "#F8F8F6", border: "1px solid rgba(0,0,0,0.06)" }}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <p className="text-sm" style={{ color: "#333" }}>{condition.conditionText}</p>
        <Badge variant={condition.status === "SATISFIED" ? "green" : condition.status === "WAIVED" ? "muted" : "gold"} className="flex-shrink-0">
          {condition.status}
        </Badge>
      </div>

      {condition.evidenceDocuments.length > 0 && (
        <div className="flex flex-col gap-1 mb-2">
          {condition.evidenceDocuments.map((d) => (
            <a key={d.id} href={`/api/files/${d.storageKey}`} className="text-xs font-medium" style={{ color: "#114E3B" }}>
              {d.filename}
            </a>
          ))}
        </div>
      )}

      {isLoading && (
        <div className="mt-2 max-w-sm">
          <UploadProgress progress={progress} fileName={file?.name} processingLabel="Saving…" compact />
        </div>
      )}

      {canUpload && condition.status === "PENDING" && !isLoading && (
        <div className="flex items-center gap-2 mt-2">
          <input
            type="file"
            id={`evidence-${condition.id}`}
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
          />
          <label htmlFor={`evidence-${condition.id}`} className="text-xs font-semibold cursor-pointer" style={{ color: "#114E3B" }}>
            {file ? file.name : "Choose file…"}
          </label>
          {file && (
            <button
              onClick={handleUpload}
              disabled={isLoading}
              className="text-xs font-semibold px-2 py-1 rounded"
              style={{ backgroundColor: "#114E3B", color: "#fff" }}
            >
              {isLoading ? "Uploading…" : "Upload evidence"}
            </button>
          )}
        </div>
      )}

      {error && <p className="text-xs mt-1 text-red-flag">{error}</p>}
    </div>
  );
}
