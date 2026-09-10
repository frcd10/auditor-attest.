import { execFile, spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { promisify } from "node:util";
import type { WorkerEnv } from "./env.js";
import { log } from "./log.js";

const execFileP = promisify(execFile);

async function docker(args: string[], opts: { timeout?: number } = {}): Promise<{ stdout: string; stderr: string }> {
  return execFileP("docker", args, { timeout: opts.timeout ?? 60_000, maxBuffer: 8 * 1024 * 1024 });
}

async function dockerOk(args: string[]): Promise<boolean> {
  try {
    await docker(args);
    return true;
  } catch {
    return false;
  }
}

/**
 * Idempotently create the internal network and the egress proxy container.
 * Job containers attach only to the internal network; the proxy sits on both it and the
 * default bridge and tunnels CONNECT to the allowlisted hosts only.
 */
export async function ensureEgress(env: WorkerEnv): Promise<string> {
  if (!(await dockerOk(["network", "inspect", env.egressNetwork]))) {
    await docker(["network", "create", "--internal", env.egressNetwork]);
    log("info", `created internal network ${env.egressNetwork}`);
  }
  const exists = await dockerOk(["container", "inspect", env.egressProxyName]);
  if (exists) {
    const { stdout } = await docker(["container", "inspect", "-f", "{{.State.Running}}|{{.Config.Image}}", env.egressProxyName]);
    const [running, image] = stdout.trim().split("|");
    if (image !== env.egressProxyImage) {
      await docker(["rm", "-f", env.egressProxyName]);
      log("info", `replaced egress proxy (image changed ${image} → ${env.egressProxyImage})`);
      await startProxy(env);
    } else if (running !== "true") {
      await docker(["start", env.egressProxyName]);
    }
  } else {
    await startProxy(env);
  }
  return `http://${env.egressProxyName}:3128`;
}

async function startProxy(env: WorkerEnv) {
  await docker([
    "run",
    "-d",
    "--name",
    env.egressProxyName,
    "--restart",
    "unless-stopped",
    "--network",
    env.egressNetwork,
    "--read-only",
    "--cap-drop",
    "ALL",
    "--security-opt",
    "no-new-privileges:true",
    "--memory",
    "256m",
    "-e",
    `ALLOWED_HOSTS=${env.egressAllowedHosts}`,
    "-e",
    "PROXY_LOG=1",
    env.egressProxyImage,
  ]);
  await docker(["network", "connect", "bridge", env.egressProxyName]);
  log("info", `started egress proxy ${env.egressProxyName} (allow: ${env.egressAllowedHosts})`);
}

export interface SandboxRun {
  name: string;
  repoDir: string;
  outDir: string;
  /** JSON spec written to the container's stdin, then stdin is closed. */
  spec: unknown;
  proxyUrl: string;
  logFile: string;
  /** Called for every JSON line the runner prints. */
  onEvent?: (ev: Record<string, unknown>) => void;
  killAfterMs: number;
}

export interface SandboxResult {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  killed: boolean;
}

/** Run one audit job container to completion. The container is removed automatically. */
export function runSandbox(env: WorkerEnv, run: SandboxRun): Promise<SandboxResult> {
  const args = [
    "run",
    "--rm",
    "-i",
    "--name",
    run.name,
    "--network",
    env.egressNetwork,
    "--read-only",
    "--tmpfs",
    "/work:rw,exec,size=2g,uid=10001,gid=10001",
    "--tmpfs",
    "/tmp:rw,size=256m,uid=10001,gid=10001",
    "-v",
    `${run.repoDir}:/target:ro`,
    "-v",
    `${env.corpusDir}:/corpus:ro`,
    "-v",
    `${run.outDir}:/out:rw`,
    "--cap-drop",
    "ALL",
    "--security-opt",
    "no-new-privileges:true",
    "--pids-limit",
    "1024",
    "--memory",
    env.sandboxMemory,
    "--cpus",
    env.sandboxCpus,
    "-e",
    `HTTPS_PROXY=${run.proxyUrl}`,
    "-e",
    `https_proxy=${run.proxyUrl}`,
    "-e",
    "NO_PROXY=localhost,127.0.0.1",
    env.sandboxImage,
  ];
  return new Promise((resolve, reject) => {
    const child = spawn("docker", args, { stdio: ["pipe", "pipe", "pipe"] });
    const logStream = createWriteStream(run.logFile, { flags: "a" });
    let killed = false;
    const killer = setTimeout(() => {
      killed = true;
      log("warn", `killing ${run.name}: exceeded ${Math.round(run.killAfterMs / 60000)} min`);
      execFile("docker", ["kill", run.name], () => {});
    }, run.killAfterMs);

    let buf = "";
    child.stdout.on("data", (chunk: Buffer) => {
      buf += chunk.toString("utf8");
      let nl: number;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl);
        buf = buf.slice(nl + 1);
        logStream.write(line + "\n");
        if (!line.startsWith("{")) continue;
        try {
          run.onEvent?.(JSON.parse(line) as Record<string, unknown>);
        } catch {
          /* non-JSON noise */
        }
      }
    });
    child.stderr.on("data", (chunk: Buffer) => logStream.write("[stderr] " + chunk.toString("utf8")));
    child.on("error", (err) => {
      clearTimeout(killer);
      logStream.end();
      reject(err);
    });
    child.on("close", (code, signal) => {
      clearTimeout(killer);
      logStream.end();
      resolve({ exitCode: code, signal, killed });
    });
    child.stdin.on("error", () => {});
    child.stdin.end(JSON.stringify(run.spec));
  });
}

export async function removeContainer(name: string): Promise<void> {
  await dockerOk(["rm", "-f", name]);
}

export async function dockerAvailable(): Promise<boolean> {
  return dockerOk(["version", "--format", "{{.Server.Version}}"]);
}

export async function imageExists(image: string): Promise<boolean> {
  return dockerOk(["image", "inspect", image]);
}
