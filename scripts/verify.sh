#!/usr/bin/env bash
# HalfThePrice verify gate — the single fast local "does it work" check, mirroring the
# infra-free steps of CI. CI (.github/workflows/ci.yml) remains the FULL source of truth:
# it adds a Postgres service, `prisma migrate deploy`, schema-drift, integration tests,
# Playwright E2E, `pnpm audit`, and SBOM. "Done" = verify.sh green locally AND CI green.
#
#   bash scripts/verify.sh           # guards + typecheck + lint + test + build
#   bash scripts/verify.sh --fast    # guards + typecheck + lint only (for the edit loop)
set -euo pipefail
FAST="${1:-}"

echo "==> guards"
# Mirror the CI "Grep guards", but check TRACKED files only so local build output
# (.next/, node_modules/) never false-positives — CI runs these on a pristine checkout.
if git ls-files | grep -E '^(packages|apps)/[^/]+/src/.*\.js$'; then
  echo "VERIFY FAILED: compiled .js committed under */src" >&2
  exit 1
fi
if git ls-files | grep -E '^packages/[^/]+/packages/'; then
  echo "VERIFY FAILED: nested packages/ directory committed under packages/*/" >&2
  exit 1
fi
# Split the literal so THIS file is not itself a hit for the CI guard.
secret_pat='dev-''secret'
if git grep -i "$secret_pat" -- ':!.github/workflows/ci.yml' ':!scripts/verify.sh' 2>/dev/null | grep .; then
  echo "VERIFY FAILED: forbidden secret literal in source" >&2
  exit 1
fi

echo "==> typecheck"
pnpm -r typecheck
echo "==> lint"
pnpm lint
if [[ "$FAST" != "--fast" ]]; then
  echo "==> test"
  pnpm test
  echo "==> build"
  pnpm build
fi
echo "VERIFY OK"
