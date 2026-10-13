#!/usr/bin/env bash
# Copyright (c) Microsoft Corporation.
# Licensed under the MIT license.
# Deploys the Bicep infrastructure to the FinOpsAzure resource group and prints outputs.
set -euo pipefail

RG_NAME="FinOpsAzure"
TEMPLATE="infra/main.bicep"
PARAMS="infra/main.parameters.json"

cd "$(dirname "$0")/.."

if ! az account show >/dev/null 2>&1; then
  echo "ERROR: no Azure session found. Run 'az login'." >&2
  exit 1
fi

echo ">> Deploying $TEMPLATE to $RG_NAME"
az deployment group create \
  --resource-group "$RG_NAME" \
  --template-file "$TEMPLATE" \
  --parameters @"$PARAMS" \
  -o json > .deploy-output.json

echo ">> Deployment outputs:"
jq -r '.properties.outputs | to_entries[] | "  \(.key): \(.value.value)"' .deploy-output.json 2>/dev/null || \
  az deployment group show -g "$RG_NAME" -n main --query properties.outputs -o json

echo ""
echo ">> Save these values. Use them in build-and-push-acr.sh and deploy-container-apps.sh."
