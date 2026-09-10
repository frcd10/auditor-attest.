import { createHash } from "node:crypto";

/** sha256 hex of the byte-for-byte report. Never normalise line endings before hashing. */
export function sha256Hex(data: string | Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

export function sha256Bytes(data: string | Uint8Array): Uint8Array {
  return new Uint8Array(createHash("sha256").update(data).digest());
}
