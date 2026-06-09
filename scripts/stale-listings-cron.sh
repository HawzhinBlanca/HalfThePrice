#!/usr/bin/env bash
# Run stale listing processor. Set BASE_URL and CRON_SECRET in environment.
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3001}"
CRON_SECRET="${CRON_SECRET:-}"

if [[ -z "$CRON_SECRET" ]]; then
  echo "CRON_SECRET is required" >&2
  exit 1
fi

curl -sf -X POST "${BASE_URL}/api/cron/stale-listings" \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  -H "Content-Type: application/json"

echo ""
