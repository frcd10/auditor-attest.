import { existsSync } from "node:fs";
import { join } from "node:path";
import { findRepoRoot } from "@auditor/pricing";

// Serverless fallback: point Prisma at the traced engine binary when the bundled client
// cannot locate it by itself (see scripts/copy-prisma-engine.mjs for the other half).
if (!process.env.PRISMA_QUERY_ENGINE_LIBRARY) {
  const root = findRepoRoot(process.cwd());
  for (const dir of [join(root, "apps/web/generated/client"), join(process.cwd(), "generated/client"), join(root, "packages/db/generated/client")]) {
    const candidate = join(dir, "libquery_engine-rhel-openssl-3.0.x.so.node");
    if (existsSync(candidate)) {
      process.env.PRISMA_QUERY_ENGINE_LIBRARY = candidate;
      break;
    }
  }
}

export * from "@auditor/db";
