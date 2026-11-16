"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DocumentPublishButton({
  documentId,
  applicationId,
  published,
}: {
  documentId: string;
  applicationId: string;
  published: boolean;
}) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  async function handleClick() {
    setIsLoading(true);
    await fetch(`/api/admin/applicants/${applicationId}/documents/${documentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: published ? "unpublish" : "publish" }),
    });
    setIsLoading(false);
    router.refresh();
  }

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className="text-xs font-semibold transition-colors disabled:opacity-50"
      style={{ color: published ? "#8a6416" : "#114E3B" }}
    >
      {published ? "Unpublish" : "Publish to student"}
    </button>
  );
}
