import { notFound, redirect } from "next/navigation";
import { effectiveVisibility } from "@auditor/report";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Stable link for READMEs: redirects to the latest public report for the repo. */
export default async function LatestReport({ params }: { params: Promise<{ owner: string; repo: string }> }) {
  const { owner, repo } = await params;
  const rows = await prisma.report.findMany({ where: { owner, repo, visibility: "public" }, orderBy: { createdAt: "desc" }, take: 5 });
  const latest = rows.find((r) => effectiveVisibility({ visibility: r.visibility, submitterVerified: r.submitterVerified, redactUntil: r.redactUntil, maintainerAckAt: r.maintainerAckAt }) !== "private");
  if (!latest) notFound();
  redirect(`/r/${owner}/${repo}/${latest.commit}`);
}
