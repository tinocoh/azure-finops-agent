#!/usr/bin/env bash
# Despliega la infraestructura Bicep en el resource group FinOpsAzure y muestra outputs.
set -euo pipefail

RG_NAME="FinOpsAzure"
TEMPLATE="infra/main.bicep"
PARAMS="infra/main.parameters.json"

cd "$(dirname "$0")/.."

if ! az account show >/dev/null 2>&1; then
  echo "ERROR: no hay sesión de Azure. Ejecuta 'az login'." >&2
  exit 1
fi

echo ">> Desplegando $TEMPLATE en $RG_NAME"
az deployment group create \
  --resource-group "$RG_NAME" \
  --template-file "$TEMPLATE" \
  --parameters @"$PARAMS" \
  -o json > .deploy-output.json

echo ">> Outputs del despliegue:"
jq -r '.properties.outputs | to_entries[] | "  \(.key): \(.value.value)"' .deploy-output.json 2>/dev/null || \
  az deployment group show -g "$RG_NAME" -n main --query properties.outputs -o json

echo ""
echo ">> Guarda estos valores. Úsalos en build-and-push-acr.sh y deploy-container-apps.sh."
