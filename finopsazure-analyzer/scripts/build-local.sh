#!/usr/bin/env bash
# Construye las imágenes locales de backend y frontend.
set -euo pipefail

cd "$(dirname "$0")/.."

echo ">> Construyendo finopsazure-backend:local"
docker build -t finopsazure-backend:local ./backend

echo ">> Construyendo finopsazure-frontend:local"
docker build -t finopsazure-frontend:local ./frontend

echo ">> Imágenes locales listas:"
docker images | grep finopsazure || true
