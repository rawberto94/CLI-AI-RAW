#!/bin/bash
# ============================================================================
# deploy-azure.sh — Build and deploy the web app to Azure Container Apps
# ============================================================================
# Mirrors what .github/workflows/deploy-container-apps.yml does, runnable
# locally without spending GitHub Actions minutes:
#   1. az acr build   — build the Dockerfile image remotely in ACR
#   2. az containerapp update — point the Container App at the new image
#   3. Verify: image / provisioning state / revision traffic
#   4. Smoke test: GET /api/health with retries
#
# Usage:
#   bash scripts/deploy-azure.sh                  # deploy current HEAD to production
#   bash scripts/deploy-azure.sh --tag my-tag      # override the image tag
#   bash scripts/deploy-azure.sh --skip-build      # deploy an already-built tag
#   bash scripts/deploy-azure.sh --yes             # skip the confirmation prompt
#
# Requires: az CLI logged in (az login) with access to the contigoContainerApps
# resource group, and a clean-enough working tree (uncommitted changes are
# warned about, not blocked, since ACR builds from the working directory).
# ============================================================================

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# ── Colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${BLUE}ℹ${NC}  $1"; }
ok()      { echo -e "${GREEN}✓${NC}  $1"; }
warn()    { echo -e "${YELLOW}⚠${NC}  $1"; }
fail()    { echo -e "${RED}✗${NC}  $1"; }

# ── Fixed deployment target (only production exists today — see below) ─────
RESOURCE_GROUP="contigoContainerApps"
ACR_NAME="contigoacr2026"
CONTAINER_APP_NAME="contigo"
IMAGE_REPOSITORY="contigo-web"
HEALTHCHECK_PATH="/api/health"
REGISTRY_SERVER="${ACR_NAME}.azurecr.io"

# NOTE: There is no separate staging Container App in this Azure subscription
# — only "contigo" in "contigoContainerApps". Every run of this script
# deploys to that single (production) app. Confirmed via `az containerapp
# list` — if a real staging environment gets provisioned later, add an
# --environment flag here the same way deploy-container-apps.yml does.

# ── Parse args ───────────────────────────────────────────────────────────────
TAG=""
SKIP_BUILD=false
ASSUME_YES=false
while [[ $# -gt 0 ]]; do
    case "$1" in
        --tag) TAG="$2"; shift 2 ;;
        --skip-build) SKIP_BUILD=true; shift ;;
        --yes|-y) ASSUME_YES=true; shift ;;
        -h|--help) grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
        *) fail "Unknown argument: $1"; exit 1 ;;
    esac
done

if [[ -z "$TAG" ]]; then
    TAG="sha-$(git rev-parse --short=8 HEAD)"
fi
IMAGE="${REGISTRY_SERVER}/${IMAGE_REPOSITORY}:${TAG}"

# ── Preflight ────────────────────────────────────────────────────────────────
info "Running preflight checks..."

if ! command -v az &>/dev/null; then
    fail "az CLI not found"; exit 1
fi
if ! az account show &>/dev/null; then
    fail "Not logged in to Azure — run 'az login' first"; exit 1
fi
ok "Azure CLI authenticated as $(az account show --query user.name -o tsv)"

if [[ -n "$(git status --porcelain)" ]]; then
    warn "Working tree has uncommitted changes — ACR builds from the local directory, so they WILL be included in the image."
fi

CURRENT_SHA=$(git rev-parse --short=8 HEAD)
CURRENT_MSG=$(git log -1 --format='%s')
info "HEAD: ${CURRENT_SHA} — ${CURRENT_MSG}"
info "Target: ${CONTAINER_APP_NAME} (${RESOURCE_GROUP}) ← ${IMAGE}"

if ! $ASSUME_YES; then
    read -r -p "$(echo -e "${YELLOW}This deploys to the LIVE production app. Continue? [y/N] ${NC}")" CONFIRM
    if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
        info "Aborted."
        exit 0
    fi
fi

# ── 1. Build ─────────────────────────────────────────────────────────────────
if $SKIP_BUILD; then
    info "Skipping build (--skip-build) — assuming ${IMAGE} already exists in ACR"
else
    info "Building image in Azure Container Registry (this takes ~10-15 min)..."
    az acr build \
        --registry "$ACR_NAME" \
        --image "${IMAGE_REPOSITORY}:${TAG}" \
        --image "${IMAGE_REPOSITORY}:latest" \
        --file Dockerfile \
        --build-arg CACHE_BUST="$TAG" \
        .
    ok "Image built and pushed: ${IMAGE}"
fi

# ── 2. Deploy ────────────────────────────────────────────────────────────────
info "Updating Container App to new image..."
az containerapp update \
    --name "$CONTAINER_APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --image "$IMAGE" \
    --output none
ok "Container App update applied"

# ── 3. Verify ────────────────────────────────────────────────────────────────
info "Verifying deployment..."

DEPLOYED_IMAGE=$(az containerapp show --name "$CONTAINER_APP_NAME" --resource-group "$RESOURCE_GROUP" \
    --query 'properties.template.containers[0].image' -o tsv)
PROVISIONING_STATE=$(az containerapp show --name "$CONTAINER_APP_NAME" --resource-group "$RESOURCE_GROUP" \
    --query 'properties.provisioningState' -o tsv)
FQDN=$(az containerapp show --name "$CONTAINER_APP_NAME" --resource-group "$RESOURCE_GROUP" \
    --query 'properties.configuration.ingress.fqdn' -o tsv)

if [[ "$DEPLOYED_IMAGE" != "$IMAGE" ]]; then
    fail "Deployed image mismatch. Expected ${IMAGE}, found ${DEPLOYED_IMAGE}"
    exit 1
fi
if [[ "$PROVISIONING_STATE" != "Succeeded" ]]; then
    fail "Provisioning state: ${PROVISIONING_STATE}"
    exit 1
fi
if [[ -z "$FQDN" ]]; then
    fail "Container App ingress FQDN is empty"
    exit 1
fi
ok "Image: ${DEPLOYED_IMAGE}"
ok "Provisioning state: ${PROVISIONING_STATE}"

APP_URL="https://${FQDN}"

# ── 4. Smoke test ────────────────────────────────────────────────────────────
info "Smoke testing ${APP_URL}${HEALTHCHECK_PATH}..."
if curl --fail --silent --show-error \
    --retry 12 --retry-all-errors --retry-delay 10 \
    "${APP_URL}${HEALTHCHECK_PATH}" > /tmp/deploy-health-check.json; then
    ok "Health check passed: $(cat /tmp/deploy-health-check.json)"
    rm -f /tmp/deploy-health-check.json
else
    fail "Health check failed after retries — check 'az containerapp logs show --name ${CONTAINER_APP_NAME} --resource-group ${RESOURCE_GROUP}'"
    exit 1
fi

# ── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}  Deployed successfully${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo "  Commit:   ${CURRENT_SHA} — ${CURRENT_MSG}"
echo "  Image:    ${IMAGE}"
echo "  App URL:  ${APP_URL}"
echo ""
echo "  Rollback: az containerapp update --name ${CONTAINER_APP_NAME} --resource-group ${RESOURCE_GROUP} --image <previous-image>"
echo "  Revisions: az containerapp revision list --name ${CONTAINER_APP_NAME} --resource-group ${RESOURCE_GROUP} -o table"
echo ""
