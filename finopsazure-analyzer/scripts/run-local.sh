#!/usr/bin/env bash
# Copyright (c) Microsoft Corporation.
# Licensed under the MIT license.
# Starts the app locally with Docker Compose.
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "ERROR: .env is missing. Copy .env.example to .env and generate FINOPS_CONFIG_ENCRYPTION_KEY." >&2
  exit 1
fi

echo ">> Starting Docker Compose (build + up)"
docker compose up --build -d

echo ""
echo ">> URLs:"
echo "   Frontend: http://localhost:${FRONTEND_PORT:-3000}"
echo "   Backend:  http://localhost:${BACKEND_PORT:-8000}"
echo "   Swagger:  http://localhost:${BACKEND_PORT:-8000}/docs"
echo ""
echo ">> Logs: docker compose logs -f   |   Stop: docker compose down"
