#!/usr/bin/env bash
set -euo pipefail
umask 077
cd "$(dirname "$0")/.."
mkdir -p backups
stamp=$(date -u +%Y%m%dT%H%M%SZ)
docker compose exec -T db pg_dump -U mimir -d mimir -Fc > "backups/mimir-mk2-${stamp}.dump"
test -s "backups/mimir-mk2-${stamp}.dump"
echo "Saved backups/mimir-mk2-${stamp}.dump"
