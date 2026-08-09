#!/usr/bin/env bash
# ============================================================================
# setup-entra-sso.sh — Create Entra app registration and wire ConTigo production SSO
# ============================================================================
# Prerequisites:
#   - az login as a user who can create app registrations (Application Administrator
#     or Global Administrator on the Entra tenant — guest accounts often cannot)
#   - Contributor on resource group contigoContainerApps
#
# Usage:
#   bash scripts/setup-entra-sso.sh
#   bash scripts/setup-entra-sso.sh --tenant-id <entra-tenant-guid>
#   bash scripts/setup-entra-sso.sh --skip-create --client-id X --client-secret Y --tenant-id Z
#
# After success, "Continue with Microsoft" appears on https://www.mycontigo.app/auth/signin
# ============================================================================

set -euo pipefail

APP_NAME="ConTigo Production SSO"
RESOURCE_GROUP="contigoContainerApps"
CONTAINER_APP="contigo"
NEXTAUTH_HOST="https://www.mycontigo.app"
CALLBACK="${NEXTAUTH_HOST}/api/auth/callback/microsoft-entra-id"
CALLBACK_ACA="https://contigo.mangoglacier-821a6329.switzerlandnorth.azurecontainerapps.io/api/auth/callback/microsoft-entra-id"

CLIENT_ID=""
CLIENT_SECRET=""
TENANT_ID=""
SKIP_CREATE=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --client-id) CLIENT_ID="$2"; shift 2 ;;
    --client-secret) CLIENT_SECRET="$2"; shift 2 ;;
    --tenant-id) TENANT_ID="$2"; shift 2 ;;
    --skip-create) SKIP_CREATE=true; shift ;;
    -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info() { echo -e "${BLUE}ℹ${NC}  $1"; }
ok()   { echo -e "${GREEN}✓${NC}  $1"; }
warn() { echo -e "${YELLOW}⚠${NC}  $1"; }
fail() { echo -e "${RED}✗${NC}  $1"; exit 1; }

command -v az >/dev/null || fail "az CLI required"
az account show >/dev/null 2>&1 || fail "Run az login first"

if [[ -z "$TENANT_ID" ]]; then
  TENANT_ID=$(az account show --query tenantId -o tsv)
fi
info "Entra tenant: $TENANT_ID"
info "Redirect URIs:"
echo "    $CALLBACK"
echo "    $CALLBACK_ACA"

if ! $SKIP_CREATE; then
  info "Creating app registration '$APP_NAME'..."
  if ! APP_JSON=$(az ad app create \
      --display-name "$APP_NAME" \
      --sign-in-audience AzureADMyOrg \
      --web-redirect-uris "$CALLBACK" "$CALLBACK_ACA" \
      --enable-id-token-issuance true \
      --enable-access-token-issuance false \
      -o json 2>&1); then
    fail "Cannot create app registration (need Application Administrator). Re-run with --skip-create and provide --client-id/--client-secret from portal."
  fi
  CLIENT_ID=$(echo "$APP_JSON" | python3 -c 'import sys,json; print(json.load(sys.stdin)["appId"])')
  ok "App created: $CLIENT_ID"

  az ad sp create --id "$CLIENT_ID" -o none 2>/dev/null || true
  az ad app update --id "$CLIENT_ID" --web-home-page-url "$NEXTAUTH_HOST" -o none 2>/dev/null || true

  # Graph delegated: openid, profile, email, User.Read
  az ad app permission add --id "$CLIENT_ID" --api 00000003-0000-0000-c000-000000000000 \
    --api-permissions \
      37f7f235-527c-4136-accd-4a02d197296e=Scope \
      14dad69e-099b-42c9-810b-d002981feec1=Scope \
      64a6cdd6-aab1-4aaf-94b8-3cc8405e90d0=Scope \
      e1fe6dd8-ba31-4d61-89e7-88639da4683d=Scope \
    -o none 2>/dev/null || warn "Could not add Graph permissions (may already exist)"

  if az ad app permission admin-consent --id "$CLIENT_ID" -o none 2>/dev/null; then
    ok "Admin consent granted"
  else
    warn "Admin consent failed — grant in portal: Entra → App registrations → API permissions → Grant admin consent"
  fi

  SECRET_JSON=$(az ad app credential reset --id "$CLIENT_ID" --display-name "contigo-prod-$(date +%Y%m)" --years 2 -o json)
  CLIENT_SECRET=$(echo "$SECRET_JSON" | python3 -c 'import sys,json; print(json.load(sys.stdin)["password"])')
  ok "Client secret created"
else
  [[ -n "$CLIENT_ID" && -n "$CLIENT_SECRET" && -n "$TENANT_ID" ]] || fail "--skip-create requires --client-id --client-secret --tenant-id"
  info "Using provided credentials (skip-create)"
fi

info "Updating Container App env (triggers new revision)..."
az containerapp update \
  --name "$CONTAINER_APP" \
  --resource-group "$RESOURCE_GROUP" \
  --set-env-vars \
    "AZURE_AD_CLIENT_ID=$CLIENT_ID" \
    "AZURE_AD_CLIENT_SECRET=$CLIENT_SECRET" \
    "AZURE_AD_TENANT_ID=$TENANT_ID" \
    "AUTH_TRUST_HOST=true" \
  --output none

ok "Container App updated"

info "Waiting for revision to become ready..."
for i in $(seq 1 30); do
  STATE=$(az containerapp show -n "$CONTAINER_APP" -g "$RESOURCE_GROUP" --query "properties.runningStatus" -o tsv 2>/dev/null || echo "")
  IMG=$(az containerapp show -n "$CONTAINER_APP" -g "$RESOURCE_GROUP" --query "properties.template.containers[0].image" -o tsv 2>/dev/null || echo "")
  if [[ "$STATE" == "Running" ]]; then
    ok "App running ($IMG)"
    break
  fi
  sleep 5
done

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  Entra SSO wired${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo "  Client ID:  $CLIENT_ID"
echo "  Tenant ID:  $TENANT_ID"
echo "  Sign-in:    ${NEXTAUTH_HOST}/auth/signin"
echo ""
echo "  Verify: curl -s ${NEXTAUTH_HOST}/api/auth/providers | jq 'keys'"
echo "  Expect: credentials + microsoft-entra-id"
echo ""
echo "  Portal checklist if login fails:"
echo "  1. Redirect URI exactly: $CALLBACK"
echo "  2. ID tokens enabled (Authentication → Implicit grant / hybrid → ID tokens)"
echo "  3. Supported account types match AZURE_AD_TENANT_ID"
echo "  4. Users exist in ConTigo (invite or SSO_AUTO_PROVISION=true + SSO_DEFAULT_TENANT_ID)"
echo ""
