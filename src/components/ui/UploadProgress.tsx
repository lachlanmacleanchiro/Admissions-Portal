"use client";

/**
 * Upload status: a spinner plus a progress bar with the percentage while the
 * file is sending, then an indeterminate "Processing…" once it's all sent and
 * the server is saving it.
 */
export function UploadProgress({
  progress,
  fileName,
  processingLabel = "Processing…",
  compact = false,
}: {
  /** 0–1 while sending; 1 once all bytes are sent. */
  progress: number;
  fileName?: string;
  processingLabel?: string;
  compact?: boolean;
}) {
  const percent = Math.min(100, Math.round(progress * 100));
  const isProcessing = percent >= 100;
  const label = isProcessing
    ? processingLabel
    : `Uploading${fileName ? ` ${fileName}` : ""}… ${percent}%`;

  return (
    <div role="status" aria-live="polite" className={`flex flex-col ${compact ? "gap-1" : "gap-1.5"} w-full`}>
      <div className="flex items-center gap-2 min-w-0">
        <svg className="motion-safe:animate-spin h-4 w-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ color: "#114E3B" }}>
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.2" />
          <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
        <span className={`${compact ? "text-[11px]" : "text-xs"} truncate`} style={{ color: "#333" }}>{label}</span>
      </div>
      <div
        className="w-full rounded-full overflow-hidden"
        style={{ height: compact ? 4 : 6, backgroundColor: "rgba(17,78,59,0.12)" }}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={isProcessing ? undefined : percent}
        aria-label={isProcessing ? processingLabel : "Upload progress"}
      >
        {isProcessing ? (
          <div className="h-full w-1/3 rounded-full motion-safe:animate-[upload-indeterminate_1.1s_ease-in-out_infinite]" style={{ backgroundColor: "#114E3B" }} />
        ) : (
          <div className="h-full rounded-full transition-[width] duration-200" style={{ width: `${percent}%`, backgroundColor: "#114E3B" }} />
        )}
      </div>
    </div>
  );
}
