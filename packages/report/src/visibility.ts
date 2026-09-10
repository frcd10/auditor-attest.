/**
 * Disclosure rules (non-negotiable 4), enforced here and only here:
 *  - private                      → never listed, reachable only with the access token.
 *  - public + verified maintainer → everything visible immediately.
 *  - public + unverified          → Critical/High redacted until maintainer ack or 90 days.
 * Counts are always visible. On-chain never carries finding text.
 */

export type RequestedVisibility = "public" | "private";
export type EffectiveVisibility = "public" | "private" | "public_redacted";

export const REDACTION_DAYS = 90;

export interface VisibilityInput {
  visibility: RequestedVisibility;
  submitterVerified: boolean;
  redactUntil?: Date | null;
  maintainerAckAt?: Date | null;
}

export function redactUntilFor(createdAt: Date): Date {
  return new Date(createdAt.getTime() + REDACTION_DAYS * 24 * 60 * 60 * 1000);
}

export function effectiveVisibility(r: VisibilityInput, now: Date = new Date()): EffectiveVisibility {
  if (r.visibility === "private") return "private";
  if (r.submitterVerified) return "public";
  if (r.maintainerAckAt && r.maintainerAckAt.getTime() <= now.getTime()) return "public";
  if (r.redactUntil && r.redactUntil.getTime() <= now.getTime()) return "public";
  return "public_redacted";
}

/** Whether the redaction placeholder should be applied when rendering. */
export function shouldRedact(v: EffectiveVisibility): boolean {
  return v === "public_redacted";
}
