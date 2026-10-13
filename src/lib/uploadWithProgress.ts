/**
 * Sends a FormData upload and reports progress (0–1) as the file is sent.
 * Uses XMLHttpRequest because fetch() can't report upload progress.
 * Never throws: network failures resolve with ok = false and status = 0.
 */
export function uploadWithProgress<T = Record<string, unknown>>(
  url: string,
  body: FormData,
  onProgress: (fraction: number) => void,
  method: "POST" | "PATCH" = "POST"
): Promise<{ ok: boolean; status: number; data: T | null }> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) onProgress(e.loaded / e.total);
    };
    // Bytes are all sent; the server is now saving the file.
    xhr.upload.onload = () => onProgress(1);

    xhr.onload = () => {
      let data: T | null = null;
      try {
        data = JSON.parse(xhr.responseText) as T;
      } catch {
        // Non-JSON response; leave data null.
      }
      resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, data });
    };
    xhr.onerror = () => resolve({ ok: false, status: 0, data: null });
    xhr.onabort = () => resolve({ ok: false, status: 0, data: null });

    xhr.send(body);
  });
}
