"use server";

import { timingSafeEqual } from "node:crypto";
import { redirect } from "next/navigation";
import { budgetFor, defaultModelId, enabledModels, envNumber, estimate, loadModels, type LanguageMix, type RepoMarkers } from "@auditor/pricing";
import { parseGitHubUrl } from "@auditor/report";
import { prisma } from "@/lib/db";
import { adminToken, byokKek } from "@/lib/env";
import { encryptSecret } from "@/lib/secret";

function fail(msg: string): never {
  throw new Error(msg);
}

/** `/` form: paste a URL → job in `quoting`. */
export async function createJob(formData: FormData): Promise<void> {
  const url = String(formData.get("url") ?? "");
  const gh = parseGitHubUrl(url);
  if (!gh) fail("Enter a public GitHub repository URL (https://github.com/owner/repo).");
  const job = await prisma.job.create({
    data: { repoUrl: gh.url, owner: gh.owner, repo: gh.repo, ref: gh.ref, model: defaultModelId(loadModels()), tier: "quick", visibility: "private", status: "quoting" },
  });
  await prisma.jobEvent.create({ data: { jobId: job.id, message: "job created", data: { url: gh.url, ref: gh.ref } } });
  redirect(`/q/${job.id}`);
}

/** Quote page form: choose tier / model / visibility. */
export async function configureJob(formData: FormData): Promise<void> {
  const jobId = String(formData.get("jobId") ?? "");
  const tier = String(formData.get("tier") ?? "");
  const model = String(formData.get("model") ?? "");
  const visibility = String(formData.get("visibility") ?? "private");
  const byokKey = String(formData.get("byokKey") ?? "").trim();

  if (!["quick", "standard", "byok"].includes(tier)) fail("invalid tier");
  if (!["public", "private"].includes(visibility)) fail("invalid visibility");
  const cfg = loadModels();
  if (!enabledModels(cfg).some((m) => m.id === model)) fail("invalid model");

  const job = await prisma.job.findUnique({ where: { id: jobId }, include: { quote: true } });
  if (!job || !job.quote) fail("job not found or not quoted");
  if (!["quoted", "awaiting_payment"].includes(job.status)) fail(`job is ${job.status}`);
  if (job.quote.expiresAt.getTime() < Date.now()) fail("quote expired; submit the repository again");

  if (tier === "quick") {
    await prisma.$transaction([
      prisma.job.update({ where: { id: jobId }, data: { tier: "quick", model, visibility: visibility as "public" | "private", status: "done", finishedAt: new Date(), byokCiphertext: null } }),
      prisma.jobEvent.create({ data: { jobId, message: "quick tier selected: static scan complete, no LLM run" } }),
    ]);
    redirect(`/q/${jobId}`);
  }

  const est = estimate({
    loc: job.quote.loc,
    languages: job.quote.languages as unknown as LanguageMix,
    markers: job.quote.markers as unknown as Partial<RepoMarkers>,
    model,
    models: cfg,
  });
  const price = tier === "byok" ? est.attestFeeUsdc : est.priceUsdc;
  let byokCiphertext: string | null = null;
  if (tier === "byok") {
    if (!/^sk-ant-[A-Za-z0-9_-]{20,}$/.test(byokKey)) fail("BYOK requires an Anthropic API key (sk-ant-...)");
    const kek = byokKek();
    if (!kek) fail("BYOK is not enabled on this deployment (BYOK_KEK missing)");
    byokCiphertext = encryptSecret(byokKey, kek);
  }
  const ttlMin = envNumber("QUOTE_TTL_MINUTES", 60);
  await prisma.$transaction([
    prisma.job.update({
      where: { id: jobId },
      data: { tier: tier as "standard" | "byok", model, visibility: visibility as "public" | "private", status: "awaiting_payment", budgetUsd: budgetFor(est), byokCiphertext },
    }),
    prisma.quote.update({ where: { jobId }, data: { model, estCostUsd: est.estCostUsd, estInputTokens: est.tokens.inputTotal, estOutputTokens: est.tokens.output, priceUsdc: est.priceUsdc, attestFeeUsdc: est.attestFeeUsdc } }),
    prisma.payment.upsert({
      where: { jobId },
      create: { jobId, memo: jobId, expectedUsdc: price, expiresAt: new Date(Date.now() + ttlMin * 60_000) },
      update: { expectedUsdc: price, expiresAt: new Date(Date.now() + ttlMin * 60_000), status: "pending" },
    }),
    prisma.jobEvent.create({ data: { jobId, message: `configured: ${tier} / ${model} / ${visibility}`, data: { priceUsdc: price, budgetUsd: budgetFor(est) } } }),
  ]);
  redirect(`/q/${jobId}`);
}

/** Operator-only: enqueue without payment (local runs, calibration, comps). */
export async function adminEnqueue(formData: FormData): Promise<void> {
  const jobId = String(formData.get("jobId") ?? "");
  const token = String(formData.get("token") ?? "");
  const expected = adminToken();
  if (!expected) fail("ADMIN_TOKEN is not configured");
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) fail("invalid admin token");
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) fail("job not found");
  if (job.tier === "quick") fail("quick jobs do not run the sandbox");
  if (!["awaiting_payment", "quoted", "failed", "failed_budget"].includes(job.status)) fail(`job is ${job.status}`);
  await prisma.$transaction([
    prisma.job.update({ where: { id: jobId }, data: { status: "queued", error: null } }),
    prisma.jobEvent.create({ data: { jobId, message: "admin enqueue (payment bypassed by operator)" } }),
  ]);
  redirect(`/q/${jobId}`);
}
