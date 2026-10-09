/**
 * Start the audit for a job: a `workflow_dispatch` of .github/workflows/audit.yml in the
 * site's own repository. The runner reads everything else from the database.
 */
import { githubToken, siteBranch, siteRepo } from "./env";

export const AUDIT_WORKFLOW = "audit.yml";

export async function dispatchAudit(jobId: string): Promise<void> {
  const token = githubToken();
  if (!token) throw new Error("GITHUB_DISPATCH_TOKEN is not configured on this deployment");
  const res = await fetch(`https://api.github.com/repos/${siteRepo()}/actions/workflows/${AUDIT_WORKFLOW}/dispatches`, {
    method: "POST",
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "user-agent": "auditor-attest",
      "x-github-api-version": "2022-11-28",
    },
    body: JSON.stringify({ ref: siteBranch(), inputs: { job_id: jobId } }),
    cache: "no-store",
  });
  if (res.status !== 204) {
    const text = await res.text().catch(() => "");
    throw new Error(`GitHub refused to start the audit workflow (${res.status}): ${text.slice(0, 300)}`);
  }
}

export function actionsUrl(): string {
  return `https://github.com/${siteRepo()}/actions/workflows/${AUDIT_WORKFLOW}`;
}
