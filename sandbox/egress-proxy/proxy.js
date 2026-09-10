// Allowlist-only HTTP CONNECT proxy.
//
// Job containers sit on an --internal Docker network with no route to the outside.
// This proxy is the only container attached to both that network and the default
// bridge. It tunnels TLS (CONNECT) to hosts in ALLOWED_HOSTS on port 443 and refuses
// everything else. It never terminates TLS, so it cannot read API traffic (or the key).
//
// Env:
//   ALLOWED_HOSTS   comma-separated hostnames (default: api.anthropic.com)
//   PORT            listen port (default: 3128)
//   PROXY_LOG       "1" to log allow/deny decisions (hostnames only, never payloads)
import http from "node:http";
import net from "node:net";

const ALLOWED = new Set(
  (process.env.ALLOWED_HOSTS ?? "api.anthropic.com")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean),
);
const PORT = Number(process.env.PORT ?? 3128);
const LOG = process.env.PROXY_LOG === "1";

function log(...args) {
  if (LOG) console.log(new Date().toISOString(), ...args);
}

export function isAllowed(hostPort) {
  const m = /^\[?([^\]]+?)\]?(?::(\d+))?$/.exec(hostPort ?? "");
  if (!m) return { ok: false, host: null, port: null };
  const host = m[1].toLowerCase();
  const port = Number(m[2] ?? 443);
  return { ok: ALLOWED.has(host) && port === 443, host, port };
}

export function createProxy() {
  const server = http.createServer((req, res) => {
    // Plain HTTP forwarding is never allowed: nothing the runner needs is cleartext.
    log("DENY http", req.method, req.url);
    res.writeHead(403, { "content-type": "text/plain" });
    res.end("egress denied\n");
  });

  server.on("connect", (req, clientSocket, head) => {
    const { ok, host, port } = isAllowed(req.url);
    if (!ok) {
      log("DENY connect", req.url);
      clientSocket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
      clientSocket.destroy();
      return;
    }
    const upstream = net.connect(port, host, () => {
      log("ALLOW connect", host);
      clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
      if (head?.length) upstream.write(head);
      upstream.pipe(clientSocket);
      clientSocket.pipe(upstream);
    });
    const kill = () => {
      upstream.destroy();
      clientSocket.destroy();
    };
    upstream.on("error", kill);
    clientSocket.on("error", kill);
    upstream.setTimeout(10 * 60 * 1000, kill);
  });

  server.on("clientError", (_err, socket) => {
    if (socket.writable) socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
  });

  return server;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  const server = createProxy();
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`egress-proxy listening on :${PORT}; allowed: ${[...ALLOWED].join(", ")}`);
  });
  const stop = () => server.close(() => process.exit(0));
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
}
