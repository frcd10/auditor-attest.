// Shared Prisma client. One instance per process (Next.js dev reloads reuse the global).
import { PrismaClient } from "../generated/client/index.js";

export * from "../generated/client/index.js";

declare global {
  // eslint-disable-next-line no-var
  var __auditorPrisma: PrismaClient | undefined;
}

export function getPrisma(): PrismaClient {
  if (!globalThis.__auditorPrisma) {
    globalThis.__auditorPrisma = new PrismaClient({
      log: process.env.PRISMA_LOG === "1" ? ["query", "warn", "error"] : ["warn", "error"],
    });
  }
  return globalThis.__auditorPrisma;
}

export const prisma: PrismaClient = getPrisma();
