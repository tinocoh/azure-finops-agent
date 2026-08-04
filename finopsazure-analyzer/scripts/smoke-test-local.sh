#!/usr/bin/env bash
# Smoke test local: valida /api/health, /docs y la carga del frontend.
set -euo pipefail

BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"
BACKEND="http://localhost:${BACKEND_PORT}"
FRONTEND="http://localhost:${FRONTEND_PORT}"

fail() { echo "SMOKE FAIL: $1" >&2; exit 1; }

echo ">> GET $BACKEND/api/health"
curl -fsS "$BACKEND/api/health" | grep -q '"status":"ok"' || fail "health no respondió ok"

echo ">> GET $BACKEND/api/version"
curl -fsS "$BACKEND/api/version" | grep -q '"version"' || fail "version no respondió"

echo ">> GET $BACKEND/docs (Swagger)"
curl -fsS "$BACKEND/docs" | grep -qi 'swagger' || fail "Swagger no cargó"

echo ">> GET $FRONTEND (frontend)"
curl -fsS "$FRONTEND" | grep -qi '<div id="root">' || fail "El frontend no cargó"

echo ">> SMOKE OK: backend, swagger y frontend responden."
