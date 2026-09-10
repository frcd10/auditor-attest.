-- One report per (repo, commit, corpus, model) instead of per (repo, commit)
DROP INDEX "Report_owner_repo_commit_key";
CREATE UNIQUE INDEX "Report_owner_repo_commit_corpusVersion_model_key" ON "Report"("owner", "repo", "commit", "corpusVersion", "model");
CREATE INDEX "Report_owner_repo_commit_idx" ON "Report"("owner", "repo", "commit");

-- Operator batches queue right after the quote
ALTER TABLE "Job" ADD COLUMN "autoEnqueue" BOOLEAN NOT NULL DEFAULT false;

-- Audit scope: full repository or on-chain program only
ALTER TABLE "Job" ADD COLUMN "scope" TEXT NOT NULL DEFAULT 'full';
