#!/usr/bin/env bash
# Run the worker and the web app together in one terminal. Ctrl+C stops both.
# Starts Postgres if it is not running. Re-execs under the docker group when the
# current shell was opened before you were added to it.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

if ! docker info >/dev/null 2>&1; then
  if getent group docker | grep -qw "$USER" && ! id -nG | grep -qw docker; then
    exec sg docker -c "bash $0 $*"
  fi
  echo "docker is not reachable; run: bash scripts/dev-up.sh" >&2
  exit 1
fi

docker compose up -d postgres >/dev/null
for i in $(seq 1 30); do docker compose exec -T postgres pg_isready -U auditor -d auditor >/dev/null 2>&1 && break; sleep 1; done

trap 'echo; echo "stopping…"; kill 0' INT TERM EXIT
pnpm --filter @auditor/worker dev 2>&1 | sed -u 's/^/[worker] /' &
pnpm --filter @auditor/web dev 2>&1 | sed -u 's/^/[web]    /' &
wait
