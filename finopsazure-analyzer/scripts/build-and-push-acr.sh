#!/usr/bin/env bash
# Copyright (c) Microsoft Corporation.
# Licensed under the MIT license.
# Logs in to ACR, tags, and pushes the backend and frontend images.
# Contains no secrets: login uses the Azure CLI identity.
set -euo pipefail

cd "$(dirname "$0")/.."

ACR_NAME="${1:-}"
TAG="${2:-latest}"

if [ -z "$ACR_NAME" ]; then
  echo "Usage: $0 <acrName> [tag]" >&2
  echo "  Get <acrName> from the deploy-infra.sh outputs (acrName)." >&2
  exit 1
fi

LOGIN_SERVER="$(az acr show -n "$ACR_NAME" --query loginServer -o tsv)"

echo ">> Logging in to ACR $LOGIN_SERVER"
az acr login -n "$ACR_NAME"

echo ">> Build + tag backend"
docker build -t "$LOGIN_SERVER/finopsazure-backend:$TAG" ./backend

echo ">> Build + tag frontend"
docker build -t "$LOGIN_SERVER/finopsazure-frontend:$TAG" ./frontend

echo ">> Push backend"
docker push "$LOGIN_SERVER/finopsazure-backend:$TAG"

echo ">> Push frontend"
docker push "$LOGIN_SERVER/finopsazure-frontend:$TAG"

echo ">> Images published to $LOGIN_SERVER (tag: $TAG)"
