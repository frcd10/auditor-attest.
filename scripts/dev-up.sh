#!/usr/bin/env bash
# Setup only (no worker/web). Same steps as `pnpm dev`, then build + test everything.
#   bash scripts/dev-up.sh
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
bash scripts/dev.sh --setup-only "$@"
printf '\n\033[1;35m▶ build + test\033[0m\n'
pnpm build
pnpm test
echo; echo "ready: pnpm dev"
