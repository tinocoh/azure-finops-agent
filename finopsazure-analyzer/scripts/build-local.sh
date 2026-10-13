#!/usr/bin/env bash
# Copyright (c) Microsoft Corporation.
# Licensed under the MIT license.
# Builds the local backend and frontend images.
set -euo pipefail

cd "$(dirname "$0")/.."

echo ">> Building finopsazure-backend:local"
docker build -t finopsazure-backend:local ./backend

echo ">> Building finopsazure-frontend:local"
docker build -t finopsazure-frontend:local ./frontend

echo ">> Local images are ready:"
docker images | grep finopsazure || true
