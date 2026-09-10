import { createCipheriv, randomBytes } from "node:crypto";

/** Same format as apps/worker/src/byok.ts: base64( iv[12] | tag[16] | ciphertext ), AES-256-GCM. */
export function encryptSecret(plain: string, kek: Buffer): string {
  if (kek.length !== 32) throw new Error("KEK must be 32 bytes");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", kek, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString("base64");
}
