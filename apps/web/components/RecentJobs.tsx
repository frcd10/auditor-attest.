"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const KEY = "auditor.jobs";
export interface RememberedJob {
  id: string;
  owner: string;
  repo: string;
  at: number;
}

export function rememberJob(job: RememberedJob) {
  try {
    const list = (JSON.parse(localStorage.getItem(KEY) ?? "[]") as RememberedJob[]).filter((j) => j.id !== job.id);
    list.unshift(job);
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 20)));
  } catch {
    /* storage unavailable */
  }
}

/** Call from the job page so the browser remembers where the user's audits live. */
export function RememberJob(job: RememberedJob) {
  useEffect(() => rememberJob(job), [job]);
  return null;
}

/** "Your audits" list (this browser only; no accounts). */
export function RecentJobs() {
  const [jobs, setJobs] = useState<RememberedJob[]>([]);
  useEffect(() => {
    try {
      setJobs(JSON.parse(localStorage.getItem(KEY) ?? "[]") as RememberedJob[]);
    } catch {
      setJobs([]);
    }
  }, []);
  if (jobs.length === 0) return null;
  return (
    <section className="container-x">
      <div className="card p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Your audits</h2>
          <span className="text-xs text-[var(--dim)]">remembered in this browser</span>
        </div>
        <ul className="mt-3 divide-y divide-[var(--border)]">
          {jobs.map((j) => (
            <li key={j.id} className="flex items-center justify-between py-2 text-sm">
              <Link href={`/q/${j.id}`} className="font-medium hover:underline">
                {j.owner}/{j.repo}
              </Link>
              <span className="mono text-xs text-[var(--dim)]">{new Date(j.at).toISOString().slice(0, 16).replace("T", " ")}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
