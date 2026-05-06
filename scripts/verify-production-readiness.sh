#!/usr/bin/env bash
# Production-readiness verification gate.
#
# Runs the minimum set of checks that must pass before tagging a release:
#   1. Web app type-check
#   2. Web app production build (Next.js)
#   3. Focused security/session test suite
#
# Exits non-zero on the first failure so CI can fail fast.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

log() {
  printf '\n\033[1;36m[verify]\033[0m %s\n' "$1"
}

log "1/3 Type-checking web app"
pnpm --filter web typecheck

log "2/3 Building web app for production"
pnpm --filter web build

log "3/3 Running security/session test suite"
pnpm --filter web exec vitest run \
  lib/security/__tests__/tenant-session-policy.test.ts \
  app/api/auth/sessions/__tests__/route.test.ts \
  app/api/admin/security/ip-allowlist/__tests__/route.test.ts

log "Production readiness checks passed."
