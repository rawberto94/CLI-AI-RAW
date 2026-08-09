#!/usr/bin/env bash
# ============================================================================
# local-ui-mode.sh — Switch local web UI between demo and full modes
# ============================================================================
# Production / pilot demo deploys keep NEXT_PUBLIC_DEMO_MODE=true.
# This script only rewrites DEMO_* flags in apps/web/.env.local so you can
# browse Contigo Labs, Inbox, approvals, and agent tooling on localhost.
#
# Usage:
#   bash scripts/local-ui-mode.sh full    # full nav + agent UI (default for local)
#   bash scripts/local-ui-mode.sh demo    # match production demo skin
#   bash scripts/local-ui-mode.sh status  # show current flags
#
# After switching, restart the web app so NEXT_PUBLIC_* is picked up:
#   pnpm --filter web dev
# ============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT}/apps/web/.env.local"
MODE="${1:-}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing ${ENV_FILE}"
  echo "Copy apps/web/.env.local.example or create .env.local first."
  exit 1
fi

upsert_kv() {
  local key="$1"
  local value="$2"
  if grep -qE "^${key}=" "$ENV_FILE"; then
    # portable in-place replace
    if sed --version >/dev/null 2>&1; then
      sed -i -E "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
    else
      sed -i '' -E "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
    fi
  else
    printf '\n%s=%s\n' "$key" "$value" >> "$ENV_FILE"
  fi
}

show_status() {
  echo "Local UI mode flags in apps/web/.env.local:"
  grep -E '^(DEMO_MODE|NEXT_PUBLIC_DEMO_MODE|DEMO_SKIP_OCR|DEMO_SKIP_EMBEDDINGS|DEMO_SKIP_WEBSOCKET)=' "$ENV_FILE" 2>/dev/null || echo "  (no DEMO_* keys found)"
  echo
  if grep -qE '^NEXT_PUBLIC_DEMO_MODE=true' "$ENV_FILE" 2>/dev/null; then
    echo "→ DEMO skin (nav hides Contigo Labs / Inbox)"
    echo "  Still openable by URL: /contigo-labs  /inbox  /agents"
  else
    echo "→ FULL skin (Contigo Labs, Inbox, agent tooling visible)"
  fi
}

apply_full() {
  upsert_kv DEMO_MODE false
  upsert_kv NEXT_PUBLIC_DEMO_MODE false
  upsert_kv DEMO_SKIP_OCR false
  upsert_kv DEMO_SKIP_EMBEDDINGS false
  upsert_kv DEMO_SKIP_WEBSOCKET false
  echo "Set local UI to FULL mode."
  show_status
  echo
  echo "Restart the web app so Next.js reloads NEXT_PUBLIC_*:"
  echo "  pnpm --filter web dev"
  echo
  echo "Then open:"
  echo "  http://localhost:3005/contigo-labs?tab=agents"
  echo "  http://localhost:3005/inbox"
}

apply_demo() {
  upsert_kv DEMO_MODE true
  upsert_kv NEXT_PUBLIC_DEMO_MODE true
  upsert_kv DEMO_SKIP_OCR true
  upsert_kv DEMO_SKIP_EMBEDDINGS true
  upsert_kv DEMO_SKIP_WEBSOCKET true
  echo "Set local UI to DEMO mode (matches pilot/demo deploy skin)."
  show_status
  echo
  echo "Restart the web app:"
  echo "  pnpm --filter web dev"
}

case "$MODE" in
  full|full-ui|dev)
    apply_full
    ;;
  demo|pilot)
    apply_demo
    ;;
  status|show)
    show_status
    ;;
  *)
    echo "Usage: bash scripts/local-ui-mode.sh {full|demo|status}"
    echo
    echo "  full    Full navigation + Contigo Labs / agents (local only)"
    echo "  demo    Locked demo skin (sidebar hides automation surfaces)"
    echo "  status  Print current DEMO_* flags in apps/web/.env.local"
    exit 1
    ;;
esac
