#!/usr/bin/env bash
# Crea el Resource Group FinOpsAzure y registra los resource providers necesarios.
set -euo pipefail

RG_NAME="FinOpsAzure"
LOCATION=""
SUBSCRIPTION_ID=""

usage() {
  echo "Uso: $0 -l <location> [-s <subscriptionId>]"
  echo "  -l  Región de Azure (ej. eastus2)"
  echo "  -s  Subscription ID de despliegue (opcional; usa la actual si se omite)"
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

# Validar Azure CLI.
if ! command -v az >/dev/null 2>&1; then
  echo "ERROR: Azure CLI (az) no está instalada." >&2
  exit 1
fi

# Validar login.
if ! az account show >/dev/null 2>&1; then
  echo "ERROR: no hay sesión de Azure. Ejecuta 'az login'." >&2
  exit 1
fi

if [ -n "$SUBSCRIPTION_ID" ]; then
  echo ">> Seleccionando suscripción $SUBSCRIPTION_ID"
  az account set --subscription "$SUBSCRIPTION_ID"
fi

echo ">> Creando resource group $RG_NAME en $LOCATION"
az group create --name "$RG_NAME" --location "$LOCATION" -o table

echo ">> Registrando resource providers"
for ns in Microsoft.App Microsoft.ContainerRegistry Microsoft.OperationalInsights \
          Microsoft.Insights Microsoft.KeyVault Microsoft.CognitiveServices Microsoft.Network; do
  echo "   - $ns"
  az provider register --namespace "$ns" --wait
done

echo ">> Listo. Resource group '$RG_NAME' preparado en '$LOCATION'."
