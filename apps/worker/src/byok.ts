import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * BYOK keys travel from the web tier to the worker through the jobs table. They are
 * encrypted with BYOK_KEK (AES-256-GCM) and the ciphertext is wiped the moment the
 * worker claims the job. Format: base64( iv[12] | tag[16] | ciphertext ).
 */
export function encryptSecret(plain: string, kek: Buffer): string {
  if (kek.length !== 32) throw new Error("KEK must be 32 bytes");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", kek, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString("base64");
}

export function decryptSecret(blob: string, kek: Buffer): string {
  if (kek.length !== 32) throw new Error("KEK must be 32 bytes");
  const buf = Buffer.from(blob, "base64");
  if (buf.length < 28) throw new Error("ciphertext too short");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ct = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", kek, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}
