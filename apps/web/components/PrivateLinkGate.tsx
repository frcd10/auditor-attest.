"use client";

import { useEffect, useState } from "react";

/**
 * Blocks the page of a finished private audit until the user confirms they copied the
 * report link. Shown once per browser (localStorage); there is no server-side recovery.
 */
export function PrivateLinkGate({ jobId, link }: { jobId: string; link: string }) {
  const key = `auditor.ack.${jobId}`;
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      setOpen(localStorage.getItem(key) !== "1");
    } catch {
      setOpen(true);
    }
  }, [key]);

  if (!open) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      /* clipboard blocked: the field below is selectable */
    }
  };
  const close = () => {
    try {
      localStorage.setItem(key, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="pl-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="card w-full max-w-xl p-6">
        <h2 id="pl-title" className="text-lg font-semibold">Save your private report link</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          This report is private. The link below contains the only key to it. It is not listed anywhere, there is no account, and we cannot send it to you later. If you lose it, the report is gone.
        </p>
        <div className="mt-4 flex gap-2">
          <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} className="input input-sq mono flex-1 py-1.5 text-xs" />
          <button type="button" onClick={copy} className="btn btn-outline btn-sm">{copied ? "Copied" : "Copy"}</button>
        </div>
        <label className="mt-5 flex items-start gap-3 text-sm">
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-1" />
          <span>I copied the link and I understand the report cannot be accessed or recovered without it.</span>
        </label>
        <div className="mt-5 flex justify-end">
          <button type="button" disabled={!checked} onClick={close} className="btn btn-accent">Continue</button>
        </div>
      </div>
    </div>
  );
}
