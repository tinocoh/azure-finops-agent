#!/usr/bin/env bash
# Copyright (c) Microsoft Corporation.
# Licensed under the MIT license.
# Local smoke test: validates /api/health, /docs, and frontend loading.
set -euo pipefail

BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"
BACKEND="http://localhost:${BACKEND_PORT}"
FRONTEND="http://localhost:${FRONTEND_PORT}"

fail() { echo "SMOKE FAIL: $1" >&2; exit 1; }

echo ">> GET $BACKEND/api/health"
curl -fsS "$BACKEND/api/health" | grep -q '"status":"ok"' || fail "health did not return ok"

echo ">> GET $BACKEND/api/version"
curl -fsS "$BACKEND/api/version" | grep -q '"version"' || fail "version did not respond"

echo ">> GET $BACKEND/docs (Swagger)"
curl -fsS "$BACKEND/docs" | grep -qi 'swagger' || fail "Swagger did not load"

echo ">> GET $FRONTEND (frontend)"
curl -fsS "$FRONTEND" | grep -qi '<div id="root">' || fail "Frontend did not load"

echo ">> SMOKE OK: backend, Swagger, and frontend are responding."
