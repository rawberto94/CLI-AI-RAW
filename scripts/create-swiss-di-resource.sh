#!/usr/bin/env bash
# Create a Switzerland North Document Intelligence resource for ConTigo
# and wire it into the live Container App.
#
# WARNING: This creates billable Azure resources. Review before running.
# The existing DI resource (ConTigoDocumentIntelligence) is in eastus and
# should be deleted or decommissioned after this migration.
set -euo pipefail

RESOURCE_GROUP="contigoContainerApps"
LOCATION="switzerlandnorth"
NEW_DI_NAME="contigo-document-intelligence-ch"
CONTAINER_APP_NAME="contigo"

echo "Creating Document Intelligence resource in Switzerland North..."
az cognitiveservices account create \
  --name "$NEW_DI_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --location "$LOCATION" \
  --kind FormRecognizer \
  --sku S0 \
  --yes

echo "Retrieving new endpoint and key..."
NEW_ENDPOINT=$(az cognitiveservices account show \
  --name "$NEW_DI_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query properties.endpoint -o tsv)

NEW_KEY=$(az cognitiveservices account keys list \
  --name "$NEW_DI_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query key1 -o tsv)

echo "Updating Container App environment variables..."
az containerapp update \
  --name "$CONTAINER_APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --set-env-vars \
    "AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT=${NEW_ENDPOINT}" \
    "AZURE_DOCUMENT_INTELLIGENCE_KEY=${NEW_KEY}" \
    "AZURE_DI_DEFAULT_MODEL=layout" \
    "AZURE_DI_FEATURES=keyValuePairs" \
    "AZURE_DI_ENABLED=true"

echo ""
echo "Swiss DI resource created and wired."
echo "Endpoint: $NEW_ENDPOINT"
echo ""
echo "Next steps:"
echo "1. Update apps/web/.env.local with the new endpoint and key."
echo "2. Update GitHub secret AZURE_CREDENTIALS if the service principal needs access."
echo "3. Redeploy the Container App (already triggered by the env update)."
echo "4. Consider deleting the old eastus resource: ConTigoDocumentIntelligence"
