#!/usr/bin/env bash
set -euo pipefail

# End-to-end web upload + AI processing test.
# Logs in as demo@example.com / demo123, uploads the test PDF, triggers
# processing, and polls until artifacts are generated.

BASE_URL="${BASE_URL:-http://127.0.0.1:8080}"
EMAIL="demo@example.com"
PASSWORD="demo123"
TEST_PDF="public/realistic_contract.pdf"
COOKIE_JAR=$(mktemp)

cleanup() {
  rm -f "$COOKIE_JAR"
}
trap cleanup EXIT

echo "=== 1. Fetch CSRF token ==="
CSRF_RESP=$(curl -s -c "$COOKIE_JAR" -b "$COOKIE_JAR" "$BASE_URL/api/auth/csrf")
CSRF_TOKEN=$(echo "$CSRF_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['csrfToken'])")
echo "CSRF token: ${CSRF_TOKEN:0:20}..."

echo "=== 2. Credentials login ==="
curl -s -c "$COOKIE_JAR" -b "$COOKIE_JAR" -X POST \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "email=$EMAIL" \
  --data-urlencode "password=$PASSWORD" \
  --data-urlencode "csrfToken=$CSRF_TOKEN" \
  --data-urlencode "callbackUrl=$BASE_URL/login" \
  --data-urlencode "json=true" \
  "$BASE_URL/api/auth/callback/credentials" >/dev/null
echo "Login POST complete (redirect expected)"

echo ""
echo "=== 3. Verify session ==="
curl -s -c "$COOKIE_JAR" -b "$COOKIE_JAR" "$BASE_URL/api/auth/session" | python3 -m json.tool

echo ""
echo "=== 4. Upload test PDF ==="
UPLOAD_RESP=$(curl -s -c "$COOKIE_JAR" -b "$COOKIE_JAR" -X POST \
  -F "file=@$TEST_PDF;type=application/pdf" \
  "$BASE_URL/api/contracts/upload")
echo "$UPLOAD_RESP" | python3 -m json.tool

CONTRACT_ID=$(echo "$UPLOAD_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('contractId') or d.get('data',{}).get('contractId') or '')")
if [ -z "$CONTRACT_ID" ]; then
  echo "ERROR: Could not extract contractId from upload response"
  exit 1
fi
echo "Contract ID: $CONTRACT_ID"

echo ""
echo "=== 5. Trigger AI processing ==="
curl -s -c "$COOKIE_JAR" -b "$COOKIE_JAR" -X POST \
  -H "Content-Type: application/json" \
  "$BASE_URL/api/contracts/$CONTRACT_ID/process" | python3 -m json.tool

echo ""
echo "=== 6. Poll for completion (max 90s) ==="
for i in $(seq 1 18); do
  sleep 5
  STATUS_RESP=$(curl -s -c "$COOKIE_JAR" -b "$COOKIE_JAR" "$BASE_URL/api/contracts/$CONTRACT_ID")
  STATUS=$(echo "$STATUS_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('status') or d.get('data',{}).get('status') or 'UNKNOWN')")
  ARTIFACT_COUNT=$(echo "$STATUS_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('data',{}).get('artifacts',[])))" 2>/dev/null || echo 0)
  echo "[$i] status=$STATUS artifacts=$ARTIFACT_COUNT"
  if [ "$STATUS" = "COMPLETED" ] || [ "$STATUS" = "PROCESSED" ] || [ "$ARTIFACT_COUNT" -gt 0 ]; then
    echo "$STATUS_RESP" | python3 -m json.tool
    break
  fi
done

echo ""
echo "=== 7. Fetch artifacts ==="
curl -s -c "$COOKIE_JAR" -b "$COOKIE_JAR" "$BASE_URL/api/contracts/$CONTRACT_ID/artifacts" | python3 -m json.tool | head -200

echo ""
echo "Done. Contract ID: $CONTRACT_ID"
