#!/usr/bin/env bash
# One-shot local bring-up. Idempotent. Run after Docker is installed:
#   bash scripts/dev-up.sh          # postgres + migrations + sandbox images + build
#   bash scripts/dev-up.sh --run    # ...and then start worker + web in the foreground
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

# If the current shell is not yet in the docker group (fresh install), re-exec under `sg`.
if ! docker info >/dev/null 2>&1; then
  if id -nG | grep -qw docker; then
    echo "docker is installed but the daemon is not reachable. Try: sudo systemctl start docker" >&2
    exit 1
  elif getent group docker | grep -qw "$USER"; then
    echo "re-running under the docker group (no re-login needed)…"
    exec sg docker -c "bash $0 $*"
  else
    echo "add yourself to the docker group first: sudo usermod -aG docker $USER" >&2
    exit 1
  fi
fi

[ -f .env ] || { cp .env.example .env; echo "created .env from .env.example — fill in secrets"; }
git submodule update --init vendor/auditor-skill
[ "$(git -C vendor/auditor-skill rev-parse HEAD)" = "6bb2cbfb64334b0d1af8f1003d2f61ff3157ef52" ] || { echo "corpus submodule is not at 6bb2cbf" >&2; exit 1; }

echo "▶ postgres"
docker compose up -d postgres
for i in $(seq 1 30); do docker compose exec -T postgres pg_isready -U auditor -d auditor >/dev/null 2>&1 && break; sleep 1; done

echo "▶ dependencies + prisma"
pnpm install --frozen-lockfile
pnpm db:generate >/dev/null
pnpm db:deploy

echo "▶ sandbox images"
pnpm sandbox:proxy:build
pnpm sandbox:build

echo "▶ build + test"
pnpm build
pnpm test

echo
echo "ready. next:"
echo "  pnpm dev:worker     # terminal 1 (use: sg docker -c 'pnpm dev:worker' until you re-login)"
echo "  pnpm dev:web        # terminal 2 → http://localhost:3000"

if [ "${1:-}" = "--run" ]; then
  trap 'kill 0' EXIT
  pnpm dev:worker &
  pnpm dev:web
fi
