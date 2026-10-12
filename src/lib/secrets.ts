import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

// Encrypts secrets stored in the database (e.g. the Resend API key) with
// AES-256-GCM, keyed from AUTH_SECRET. If AUTH_SECRET changes, previously
// stored secrets can no longer be decrypted and must be re-entered.

function getKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return createHash("sha256").update(`settings-secret:${secret}`).digest();
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64"), tag.toString("base64"), encrypted.toString("base64")].join(":");
}

/** Returns null if the value can't be decrypted (e.g. AUTH_SECRET was rotated). */
export function decryptSecret(stored: string): string | null {
  try {
    const [version, iv, tag, data] = stored.split(":");
    if (version !== "v1") return null;
    const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(iv, "base64"));
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
