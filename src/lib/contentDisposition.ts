import path from "path";

// Types we're willing to serve. The upload's declared MIME type comes from the
// browser, so it's only trusted when it's on this list.
const EXTENSION_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};
const ALLOWED_TYPES = new Set(Object.values(EXTENSION_TYPES));

// Only these open in the browser. Never all of image/*: SVG can carry script.
const INLINE_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

/** Content-Type for a stored upload: the declared type if allowlisted, else by extension, else a download. */
export function safeContentType(declared: string | undefined, filename: string): string {
  if (declared && ALLOWED_TYPES.has(declared)) return declared;
  return EXTENSION_TYPES[path.extname(filename).toLowerCase()] ?? "application/octet-stream";
}

/**
 * Content-Disposition for a stored upload. PDFs and common images open in the
 * browser; anything else (e.g. Word) downloads. Both carry the original
 * filename: an ASCII-safe `filename` plus the exact name in `filename*`.
 */
export function buildContentDisposition(filename: string, mimeType: string): string {
  const type = INLINE_TYPES.has(mimeType) ? "inline" : "attachment";
  const asciiFallback = filename.replace(/[^\x20-\x7e]|["\\]/g, "_");
  const encoded = encodeURIComponent(filename).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `${type}; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}
