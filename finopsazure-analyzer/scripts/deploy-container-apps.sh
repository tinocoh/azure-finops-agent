#!/usr/bin/env bash
# Actualiza las Container Apps con las imágenes nuevas del ACR.
set -euo pipefail

cd "$(dirname "$0")/.."

RG_NAME="FinOpsAzure"
ACR_NAME="${1:-}"
TAG="${2:-latest}"
BACKEND_APP="${3:-finopsazure-backend}"
FRONTEND_APP="${4:-finopsazure-frontend}"

if [ -z "$ACR_NAME" ]; then
  echo "Uso: $0 <acrName> [tag] [backendAppName] [frontendAppName]" >&2
  exit 1
fi

LOGIN_SERVER="$(az acr show -n "$ACR_NAME" --query loginServer -o tsv)"

echo ">> Actualizando backend Container App con la imagen nueva"
az containerapp update \
  --name "$BACKEND_APP" \
  --resource-group "$RG_NAME" \
  --image "$LOGIN_SERVER/finopsazure-backend:$TAG"

echo ">> Actualizando frontend Container App con la imagen nueva"
az containerapp update \
  --name "$FRONTEND_APP" \
  --resource-group "$RG_NAME" \
  --image "$LOGIN_SERVER/finopsazure-frontend:$TAG"

echo ">> FQDNs:"
az containerapp show -n "$FRONTEND_APP" -g "$RG_NAME" --query properties.configuration.ingress.fqdn -o tsv
az containerapp show -n "$BACKEND_APP" -g "$RG_NAME" --query properties.configuration.ingress.fqdn -o tsv
