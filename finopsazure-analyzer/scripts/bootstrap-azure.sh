#!/usr/bin/env bash
# Copyright (c) Microsoft Corporation.
# Licensed under the MIT license.
# Creates the FinOpsAzure resource group and registers required resource providers.
set -euo pipefail

RG_NAME="FinOpsAzure"
LOCATION=""
SUBSCRIPTION_ID=""

usage() {
  echo "Usage: $0 -l <location> [-s <subscriptionId>]"
  echo "  -l  Azure region, such as eastus2"
  echo "  -s  Deployment subscription ID (optional; uses the current subscription when omitted)"
  exit 1
}

while getopts "l:s:h" opt; do
  case "$opt" in
    l) LOCATION="$OPTARG" ;;
    s) SUBSCRIPTION_ID="$OPTARG" ;;
    h|*) usage ;;
  esac
done

[ -z "$LOCATION" ] && usage

# Validate Azure CLI.
if ! command -v az >/dev/null 2>&1; then
  echo "ERROR: Azure CLI (az) is not installed." >&2
  exit 1
fi

# Validate login.
if ! az account show >/dev/null 2>&1; then
  echo "ERROR: no Azure session found. Run 'az login'." >&2
  exit 1
fi

if [ -n "$SUBSCRIPTION_ID" ]; then
  echo ">> Selecting subscription $SUBSCRIPTION_ID"
  az account set --subscription "$SUBSCRIPTION_ID"
fi

echo ">> Creating resource group $RG_NAME in $LOCATION"
az group create --name "$RG_NAME" --location "$LOCATION" -o table

echo ">> Registering resource providers"
for ns in Microsoft.App Microsoft.ContainerRegistry Microsoft.OperationalInsights \
          Microsoft.Insights Microsoft.KeyVault Microsoft.CognitiveServices Microsoft.Network; do
  echo "   - $ns"
  az provider register --namespace "$ns" --wait
done

echo ">> Done. Resource group '$RG_NAME' is ready in '$LOCATION'."
