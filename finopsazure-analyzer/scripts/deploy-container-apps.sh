#!/usr/bin/env bash
# Copyright (c) Microsoft Corporation.
# Licensed under the MIT license.
# Updates the Container Apps with new ACR images.
set -euo pipefail

cd "$(dirname "$0")/.."

RG_NAME="FinOpsAzure"
ACR_NAME="${1:-}"
TAG="${2:-latest}"
BACKEND_APP="${3:-finopsazure-backend}"
FRONTEND_APP="${4:-finopsazure-frontend}"

if [ -z "$ACR_NAME" ]; then
  echo "Usage: $0 <acrName> [tag] [backendAppName] [frontendAppName]" >&2
  exit 1
fi

LOGIN_SERVER="$(az acr show -n "$ACR_NAME" --query loginServer -o tsv)"

echo ">> Updating backend Container App with the new image"
az containerapp update \
  --name "$BACKEND_APP" \
  --resource-group "$RG_NAME" \
  --image "$LOGIN_SERVER/finopsazure-backend:$TAG"

echo ">> Updating frontend Container App with the new image"
az containerapp update \
  --name "$FRONTEND_APP" \
  --resource-group "$RG_NAME" \
  --image "$LOGIN_SERVER/finopsazure-frontend:$TAG"

echo ">> FQDNs:"
az containerapp show -n "$FRONTEND_APP" -g "$RG_NAME" --query properties.configuration.ingress.fqdn -o tsv
az containerapp show -n "$BACKEND_APP" -g "$RG_NAME" --query properties.configuration.ingress.fqdn -o tsv
