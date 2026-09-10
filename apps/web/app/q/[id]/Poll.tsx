"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Refreshes the server-rendered page while a job is in progress. */
export function Poll({ active, intervalMs = 3000 }: { active: boolean; intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs, router]);
  return null;
}
