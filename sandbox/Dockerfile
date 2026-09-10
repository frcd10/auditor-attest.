# Ephemeral audit job container.
#
# Contains: node, git (read-only inspection only), ripgrep, the Claude Agent SDK with its
# bundled Claude Code binary, and the runner. It deliberately contains NO cargo, rustc,
# anchor, python or package managers the audited code could be built or executed with.
#
# Runtime contract (set by apps/worker):
#   /target   audited repo, bind-mounted read-only
#   /corpus   vendor/auditor-skill, bind-mounted read-only (the `auditor` plugin root)
#   /work     tmpfs, cwd for the auditor (audit_<n>/ artifacts land here)
#   /out      job output dir: report.md, run.json, status.json, runner.log
#   stdin     one JSON line: the job spec (includes the per-job API key; never written to disk)
#   network   --internal network; HTTPS_PROXY points at the egress proxy (api.anthropic.com only)

# ── build stage ───────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS build
WORKDIR /build
COPY sandbox/runner/package.json ./
# npm installs the platform-specific @anthropic-ai/claude-agent-sdk-linux-* package that
# carries the Claude Code binary, so nothing is downloaded at job time.
RUN npm install --omit=dev --no-audit --no-fund \
 && npm install --no-save --no-audit --no-fund typescript@5.9.3 @types/node@22.20.2
COPY sandbox/runner/tsconfig.json ./
COPY sandbox/runner/src ./src
RUN npx tsc -p tsconfig.json

# ── runtime stage ─────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends git ripgrep ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && groupadd -g 10001 runner && useradd -m -u 10001 -g runner runner \
 && mkdir -p /work /out /target /corpus && chown runner:runner /work /out
WORKDIR /runner
COPY --from=build /build/node_modules ./node_modules
COPY --from=build /build/dist ./dist
COPY sandbox/runner/package.json ./
# The clone is owned by a different uid on the host; tell git that is fine (read-only use).
RUN git config --system safe.directory '*' \
 && git config --system core.hooksPath /dev/null
USER runner
ENV HOME=/work/home \
    NODE_ENV=production \
    CLAUDE_CODE_TMPDIR=/work/tmp \
    DISABLE_TELEMETRY=1 \
    DISABLE_ERROR_REPORTING=1 \
    DISABLE_AUTOUPDATER=1 \
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1 \
    CLAUDE_CODE_DISABLE_ARTIFACT=1 \
    ENABLE_CLAUDEAI_MCP_SERVERS=false \
    CI=1
ENTRYPOINT ["node", "/runner/dist/index.js"]
