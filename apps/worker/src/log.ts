import { prisma } from "@auditor/db";

/** Strip anything that looks like an API key before it reaches a log line or the DB. */
export function scrub(s: string): string {
  return s.replace(/sk-ant-[A-Za-z0-9_-]{8,}/g, "sk-ant-***").replace(/(api[-_]?key=)[^&\s"']+/gi, "$1***");
}

export function log(level: "info" | "warn" | "error", msg: string, data?: Record<string, unknown>) {
  const line = `${new Date().toISOString()} [${level}] ${scrub(msg)}${data ? " " + scrub(JSON.stringify(data)) : ""}`;
  if (level === "error") console.error(line);
  else console.log(line);
}

export async function jobEvent(jobId: string, message: string, data?: Record<string, unknown>, level: "info" | "warn" | "error" = "info") {
  log(level, `[${jobId}] ${message}`, data);
  try {
    await prisma.jobEvent.create({
      data: { jobId, level, message: scrub(message).slice(0, 2000), data: data ? (JSON.parse(scrub(JSON.stringify(data))) as object) : undefined },
    });
  } catch (e) {
    log("warn", `could not persist job event: ${(e as Error).message}`);
  }
}
