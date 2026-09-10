import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { siteUrl } from "@/lib/env";
import { exchangeCode, fetchRepoPermission, fetchUser, githubConfigured, isMaintainer, verifyState } from "@/lib/github";

export const dynamic = "force-dynamic";

function back(path: string, msg: string, ok: boolean) {
  const u = new URL(path, siteUrl());
  u.searchParams.set(ok ? "verified" : "verify_error", msg);
  return NextResponse.redirect(u.toString());
}

export async function GET(req: Request) {
  if (!githubConfigured()) return NextResponse.json({ error: "GitHub OAuth is not configured" }, { status: 503 });
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");
  const jar = await cookies();
  const stateCookie = jar.get("gh_oauth_state")?.value ?? null;
  const state = verifyState(stateParam);
  if (!code || !state || !stateCookie || stateCookie !== stateParam) return NextResponse.json({ error: "invalid or expired OAuth state" }, { status: 400 });

  const target = state.kind === "job" ? `/q/${state.id}` : null;
  try {
    const token = await exchangeCode(code, `${siteUrl()}/api/auth/github/callback`);
    const [user, perm] = await Promise.all([fetchUser(token), fetchRepoPermission(token, state.owner, state.repo)]);
    // token is dropped here; never stored.
    const dbUser = await prisma.user.upsert({
      where: { githubId: String(user.id) },
      create: { githubId: String(user.id), githubLogin: user.login },
      update: { githubLogin: user.login },
    });
    if (!isMaintainer(perm)) {
      const path = target ?? (await reportPath(state.id));
      return back(path, `@${user.login} has ${perm.level} permission on ${state.owner}/${state.repo}; admin or maintain is required`, false);
    }
    await prisma.maintainerVerification.upsert({
      where: { userId_owner_repo: { userId: dbUser.id, owner: state.owner, repo: state.repo } },
      create: { userId: dbUser.id, owner: state.owner, repo: state.repo, permission: perm.level },
      update: { permission: perm.level, verifiedAt: new Date() },
    });
    if (state.kind === "job") {
      await prisma.$transaction([
        prisma.job.update({ where: { id: state.id }, data: { submitterVerified: true, submitterId: dbUser.id } }),
        prisma.jobEvent.create({ data: { jobId: state.id, message: `submitter verified as maintainer (@${user.login}, ${perm.level})` } }),
      ]);
      // If the report already exists, verification counts as acknowledgement.
      await prisma.report.updateMany({ where: { jobId: state.id }, data: { submitterVerified: true, maintainerAckAt: new Date() } });
      return back(`/q/${state.id}`, `@${user.login} verified as ${perm.level} on ${state.owner}/${state.repo}`, true);
    }
    await prisma.report.update({ where: { id: state.id }, data: { maintainerAckAt: new Date() } });
    return back(await reportPath(state.id), `@${user.login} acknowledged the report as ${perm.level}; Critical/High findings are now public`, true);
  } catch (e) {
    const path = target ?? (await reportPath(state.id));
    return back(path, (e as Error).message, false);
  } finally {
    jar.delete("gh_oauth_state");
  }
}

async function reportPath(reportId: string): Promise<string> {
  const r = await prisma.report.findUnique({ where: { id: reportId } });
  return r ? `/r/${r.owner}/${r.repo}/${r.commit}` : "/";
}
