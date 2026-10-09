import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  agentRules: false,
  outputFileTracingRoot: root,
  // Files read at request time through the filesystem (not imported), so the tracer
  // cannot see them: the model price list and the Prisma client + query engine.
  outputFileTracingIncludes: {
    "/**": ["../../config/models.json", "../../pnpm-workspace.yaml", "../../packages/db/generated/**", "../../packages/db/dist/**", "generated/**"],
  },
  serverExternalPackages: ["@auditor/db", "@prisma/client", "prisma"],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
