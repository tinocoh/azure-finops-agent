#!/usr/bin/env bash
# Levanta la app en local con docker compose.
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "ERROR: falta .env. Copia .env.example a .env y genera FINOPS_CONFIG_ENCRYPTION_KEY." >&2
  exit 1
fi

echo ">> Iniciando docker compose (build + up)"
docker compose up --build -d

echo ""
echo ">> URLs:"
echo "   Frontend: http://localhost:${FRONTEND_PORT:-3000}"
echo "   Backend:  http://localhost:${BACKEND_PORT:-8000}"
echo "   Swagger:  http://localhost:${BACKEND_PORT:-8000}/docs"
echo ""
echo ">> Logs: docker compose logs -f   |   Detener: docker compose down"
