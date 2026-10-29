"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";

interface EssayReviewData {
  score: number | null;
  notes: string | null;
}

export function EssayReviewPanel({ applicationId, review, canEdit }: { applicationId: string; review: EssayReviewData | null; canEdit: boolean }) {
  const router = useRouter();
  const [score, setScore] = useState(review?.score?.toString() ?? "");
  const [notes, setNotes] = useState(review?.notes ?? "");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSave() {
    setIsLoading(true);
    await fetch(`/api/admin/applicants/${applicationId}/essay-review`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ score: score === "" ? null : parseInt(score, 10), notes: notes || null }),
    });
    setIsLoading(false);
    router.refresh();
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: "1px solid rgba(0,0,0,0.06)", backgroundColor: "#F8F8F6" }}>
        <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#555" }}>Essay Review</p>
        <Link
          href={`/admin/applicants/${applicationId}/essay-ai-review`}
          className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide rounded-md transition-opacity hover:opacity-90"
          style={{ backgroundColor: "#C79A3B", color: "#fff" }}
        >
          ✨ AI-Assisted Marking (Demo)
        </Link>
      </div>
      <div className="px-5 py-4 flex flex-col gap-3">
        <div>
          <label className="text-xs font-semibold text-text mb-1 block">Score (%)</label>
          <input
            type="number" min={0} max={100} value={score} onChange={(e) => setScore(e.target.value)} disabled={!canEdit}
            className="w-full px-3 py-2 text-sm rounded-lg" style={{ backgroundColor: "#F8F8F6", border: "1.5px solid rgba(0,0,0,0.1)" }}
          />
        </div>
        <Textarea label="Notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={!canEdit} />
        {canEdit && (
          <div className="flex justify-end">
            <Button size="sm" onClick={handleSave} isLoading={isLoading}>Save</Button>
          </div>
        )}
      </div>
    </div>
  );
}
