// On Vercel the bundled Prisma client resolves its engine next to the *bundle*
// (/var/task/apps/web/generated/client), not next to packages/db. Copy the generated
// client's engine binaries there before `next build` so the function can find them.
import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, "../../../packages/db/generated/client");
const dst = resolve(here, "../generated/client");
if (!existsSync(src)) {
  console.error(`copy-prisma-engine: ${src} missing (run prisma generate first)`);
  process.exit(1);
}
mkdirSync(dst, { recursive: true });
let n = 0;
for (const f of readdirSync(src)) {
  if (/\.so\.node$/.test(f) || f === "schema.prisma") {
    copyFileSync(join(src, f), join(dst, f));
    n++;
  }
}
console.log(`copy-prisma-engine: ${n} file(s) → ${dst}`);
