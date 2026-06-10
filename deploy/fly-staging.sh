#!/usr/bin/env bash
# HalfThePrice Fly.io staging deploy helper
# Prerequisites: flyctl installed + authenticated (`fly auth login`)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_NAME="half-the-price-staging"
CONFIG="$ROOT/fly.staging.toml"
STAGING_URL="https://${APP_NAME}.fly.dev"

require_fly() {
  if ! command -v flyctl >/dev/null 2>&1 && ! command -v fly >/dev/null 2>&1; then
    echo "flyctl not found. Install: https://fly.io/docs/hands-on/install-flyctl/"
    echo "  macOS: brew install flyctl"
    echo "  curl:  curl -L https://fly.io/install.sh | sh"
    exit 1
  fi
  FLY="$(command -v flyctl 2>/dev/null || command -v fly)"
}

cmd_create() {
  require_fly
  if "$FLY" apps list 2>/dev/null | grep -q "$APP_NAME"; then
    echo "App $APP_NAME already exists."
    return 0
  fi
  "$FLY" apps create "$APP_NAME" --org personal
}

cmd_secrets() {
  require_fly
  if [[ ! -f "$ROOT/.env.staging" ]]; then
    echo "Create $ROOT/.env.staging from .env.example (staging values only, never prod secrets)."
    echo "  cp .env.example .env.staging"
    exit 1
  fi
  # shellcheck disable=SC1091
  set -a && source "$ROOT/.env.staging" && set +a
  "$FLY" secrets set \
    DATABASE_URL="${DATABASE_URL:?}" \
    NEXTAUTH_SECRET="${NEXTAUTH_SECRET:?}" \
    NEXTAUTH_URL="${NEXTAUTH_URL:-$STAGING_URL}" \
    CRON_SECRET="${CRON_SECRET:?}" \
    MINIO_ENDPOINT="${MINIO_ENDPOINT:-}" \
    MINIO_ACCESS_KEY="${MINIO_ACCESS_KEY:-}" \
    MINIO_SECRET_KEY="${MINIO_SECRET_KEY:-}" \
    MEILISEARCH_HOST="${MEILISEARCH_HOST:-}" \
    MEILISEARCH_API_KEY="${MEILISEARCH_API_KEY:-}" \
    CENTRIFUGO_TOKEN_SECRET="${CENTRIFUGO_TOKEN_SECRET:-}" \
    CENTRIFUGO_API_KEY="${CENTRIFUGO_API_KEY:-}" \
    PAYMENT_WEBHOOK_SECRET="${PAYMENT_WEBHOOK_SECRET:-}" \
    RETAIL_CRAWLER_MODE="${RETAIL_CRAWLER_MODE:-live}" \
    --app "$APP_NAME"
}

cmd_deploy() {
  require_fly
  cmd_create
  "$FLY" deploy --config "$CONFIG" --app "$APP_NAME"
  echo ""
  echo "Staging URL: $STAGING_URL"
  echo "Health:      $STAGING_URL/api/health"
}

cmd_health() {
  curl -fsS "$STAGING_URL/api/health" | python3 -m json.tool 2>/dev/null || curl -fsS "$STAGING_URL/api/health"
}

usage() {
  cat <<EOF
Usage: $(basename "$0") <command>

Commands:
  create   Create Fly app $APP_NAME (idempotent)
  secrets  Set secrets from .env.staging
  deploy   Create app (if needed) and deploy staging
  health   Curl /api/health on staging

First-time setup:
  1. brew install flyctl && fly auth login
  2. cp .env.example .env.staging  # fill staging DATABASE_URL etc.
  3. ./deploy/fly-staging.sh secrets
  4. ./deploy/fly-staging.sh deploy
  5. ./deploy/fly-staging.sh health
EOF
}

case "${1:-}" in
  create) cmd_create ;;
  secrets) cmd_secrets ;;
  deploy) cmd_deploy ;;
  health) cmd_health ;;
  *) usage; exit 1 ;;
esac
