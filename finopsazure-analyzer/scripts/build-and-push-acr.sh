#!/usr/bin/env bash
# Login a ACR, tag y push de las imágenes de backend y frontend.
# No contiene secretos: el login usa la identidad de az CLI.
set -euo pipefail

cd "$(dirname "$0")/.."

ACR_NAME="${1:-}"
TAG="${2:-latest}"

if [ -z "$ACR_NAME" ]; then
  echo "Uso: $0 <acrName> [tag]" >&2
  echo "  Obtén <acrName> de los outputs de deploy-infra.sh (acrName)." >&2
  exit 1
fi

LOGIN_SERVER="$(az acr show -n "$ACR_NAME" --query loginServer -o tsv)"

echo ">> Login a ACR $LOGIN_SERVER"
az acr login -n "$ACR_NAME"

echo ">> Build + tag backend"
docker build -t "$LOGIN_SERVER/finopsazure-backend:$TAG" ./backend

echo ">> Build + tag frontend"
docker build -t "$LOGIN_SERVER/finopsazure-frontend:$TAG" ./frontend

echo ">> Push backend"
docker push "$LOGIN_SERVER/finopsazure-backend:$TAG"

echo ">> Push frontend"
docker push "$LOGIN_SERVER/finopsazure-frontend:$TAG"

echo ">> Imágenes publicadas en $LOGIN_SERVER (tag: $TAG)"
