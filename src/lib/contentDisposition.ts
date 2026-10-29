/**
 * Content-Disposition for a stored upload. PDFs and images open in the
 * browser; anything else (e.g. Word) downloads. Both carry the original
 * filename: an ASCII-safe `filename` plus the exact name in `filename*`.
 */
export function buildContentDisposition(filename: string, mimeType: string): string {
  const type = mimeType === "application/pdf" || mimeType.startsWith("image/") ? "inline" : "attachment";
  const asciiFallback = filename.replace(/[^\x20-\x7e]|["\\]/g, "_");
  const encoded = encodeURIComponent(filename).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `${type}; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}
