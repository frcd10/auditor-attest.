import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { siteUrl } from "@/lib/env";
import { authorizeUrl, githubConfigured, signState } from "@/lib/github";

export const dynamic = "force-dynamic";

/** Start maintainer verification: /api/auth/github?job=<id> or ?report=<id> */
export async function GET(req: Request) {
  if (!githubConfigured()) return NextResponse.json({ error: "GitHub OAuth is not configured (GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET / AUTH_SECRET)" }, { status: 503 });
  const url = new URL(req.url);
  const jobId = url.searchParams.get("job");
  const reportId = url.searchParams.get("report");
  let payload: { kind: "job" | "report"; id: string; owner: string; repo: string } | null = null;
  if (jobId) {
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (job) payload = { kind: "job", id: job.id, owner: job.owner, repo: job.repo };
  } else if (reportId) {
    const report = await prisma.report.findUnique({ where: { id: reportId } });
    if (report) payload = { kind: "report", id: report.id, owner: report.owner, repo: report.repo };
  }
  if (!payload) return NextResponse.json({ error: "job or report not found" }, { status: 404 });
  const state = signState(payload);
  const redirectUri = `${siteUrl()}/api/auth/github/callback`;
  const res = NextResponse.redirect(authorizeUrl(state, redirectUri));
  res.cookies.set("gh_oauth_state", state, { httpOnly: true, sameSite: "lax", secure: siteUrl().startsWith("https"), maxAge: 900, path: "/" });
  return res;
}
