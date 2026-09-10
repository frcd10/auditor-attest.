-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Tier" AS ENUM ('quick', 'standard', 'byok');

-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('public', 'private');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('quoting', 'quote_running', 'quoted', 'awaiting_payment', 'queued', 'running', 'ingesting', 'done', 'failed', 'failed_budget', 'cancelled', 'refunded');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'detected', 'finalized', 'mismatched', 'refunded', 'expired');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "walletPubkey" TEXT,
    "githubId" TEXT,
    "githubLogin" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintainerVerification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "repo" TEXT NOT NULL,
    "permission" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaintainerVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "repoUrl" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "repo" TEXT NOT NULL,
    "ref" TEXT,
    "commitSha" TEXT,
    "tier" "Tier" NOT NULL DEFAULT 'quick',
    "model" TEXT NOT NULL,
    "visibility" "Visibility" NOT NULL DEFAULT 'private',
    "status" "JobStatus" NOT NULL DEFAULT 'quoting',
    "submitterId" TEXT,
    "submitterVerified" BOOLEAN NOT NULL DEFAULT false,
    "budgetUsd" DECIMAL(18,6),
    "byokCiphertext" TEXT,
    "error" TEXT,
    "containerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobEvent" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "level" TEXT NOT NULL DEFAULT 'info',
    "message" TEXT NOT NULL,
    "data" JSONB,

    CONSTRAINT "JobEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "loc" INTEGER NOT NULL,
    "totalLoc" INTEGER NOT NULL,
    "files" INTEGER NOT NULL,
    "languages" JSONB NOT NULL,
    "markers" JSONB NOT NULL,
    "scope" JSONB NOT NULL,
    "estInputTokens" INTEGER NOT NULL,
    "estOutputTokens" INTEGER NOT NULL,
    "estCostUsd" DECIMAL(18,6) NOT NULL,
    "margin" DECIMAL(8,3) NOT NULL,
    "calibration" DECIMAL(8,3) NOT NULL,
    "priceUsdc" DECIMAL(18,6) NOT NULL,
    "attestFeeUsdc" DECIMAL(18,6) NOT NULL,
    "breakdown" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "memo" TEXT NOT NULL,
    "expectedUsdc" DECIMAL(18,6) NOT NULL,
    "receivedUsdc" DECIMAL(18,6),
    "payer" TEXT,
    "txSig" TEXT,
    "slot" BIGINT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "detectedAt" TIMESTAMP(3),
    "finalizedAt" TIMESTAMP(3),
    "refundTxSig" TEXT,
    "refundedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "jobId" TEXT,
    "owner" TEXT NOT NULL,
    "repo" TEXT NOT NULL,
    "commit" TEXT NOT NULL,
    "corpusVersion" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "reportSha256" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "critical" INTEGER NOT NULL DEFAULT 0,
    "high" INTEGER NOT NULL DEFAULT 0,
    "medium" INTEGER NOT NULL DEFAULT 0,
    "low" INTEGER NOT NULL DEFAULT 0,
    "info" INTEGER NOT NULL DEFAULT 0,
    "highestSeverity" INTEGER,
    "riskScore" INTEGER,
    "visibility" "Visibility" NOT NULL,
    "submitterVerified" BOOLEAN NOT NULL DEFAULT false,
    "redactUntil" TIMESTAMP(3),
    "maintainerAckAt" TIMESTAMP(3),
    "accessToken" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "inputTokens" BIGINT NOT NULL DEFAULT 0,
    "outputTokens" BIGINT NOT NULL DEFAULT 0,
    "cacheReadTokens" BIGINT NOT NULL DEFAULT 0,
    "cacheWriteTokens" BIGINT NOT NULL DEFAULT 0,
    "costUsd" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attestation" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "pda" TEXT NOT NULL,
    "txSig" TEXT NOT NULL,
    "attester" TEXT NOT NULL,
    "slot" BIGINT,
    "programId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attestation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_walletPubkey_key" ON "User"("walletPubkey");

-- CreateIndex
CREATE UNIQUE INDEX "User_githubId_key" ON "User"("githubId");

-- CreateIndex
CREATE INDEX "MaintainerVerification_owner_repo_idx" ON "MaintainerVerification"("owner", "repo");

-- CreateIndex
CREATE UNIQUE INDEX "MaintainerVerification_userId_owner_repo_key" ON "MaintainerVerification"("userId", "owner", "repo");

-- CreateIndex
CREATE INDEX "Job_status_createdAt_idx" ON "Job"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Job_owner_repo_idx" ON "Job"("owner", "repo");

-- CreateIndex
CREATE INDEX "JobEvent_jobId_at_idx" ON "JobEvent"("jobId", "at");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_jobId_key" ON "Quote"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_jobId_key" ON "Payment"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_memo_key" ON "Payment"("memo");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_txSig_key" ON "Payment"("txSig");

-- CreateIndex
CREATE INDEX "Payment_status_expiresAt_idx" ON "Payment"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Report_jobId_key" ON "Report"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "Report_accessToken_key" ON "Report"("accessToken");

-- CreateIndex
CREATE INDEX "Report_visibility_createdAt_idx" ON "Report"("visibility", "createdAt");

-- CreateIndex
CREATE INDEX "Report_owner_repo_idx" ON "Report"("owner", "repo");

-- CreateIndex
CREATE UNIQUE INDEX "Report_owner_repo_commit_key" ON "Report"("owner", "repo", "commit");

-- CreateIndex
CREATE UNIQUE INDEX "Attestation_reportId_key" ON "Attestation"("reportId");

-- CreateIndex
CREATE UNIQUE INDEX "Attestation_pda_key" ON "Attestation"("pda");

-- CreateIndex
CREATE UNIQUE INDEX "Attestation_txSig_key" ON "Attestation"("txSig");

-- AddForeignKey
ALTER TABLE "MaintainerVerification" ADD CONSTRAINT "MaintainerVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_submitterId_fkey" FOREIGN KEY ("submitterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobEvent" ADD CONSTRAINT "JobEvent_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attestation" ADD CONSTRAINT "Attestation_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

