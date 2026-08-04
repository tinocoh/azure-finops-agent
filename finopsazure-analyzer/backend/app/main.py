"""FinOpsAzure Analyzer — FastAPI application entrypoint."""
from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import analysis, azure, chat, config_connections, health
from .config import get_settings
from .database import init_db

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")

settings = get_settings()

app = FastAPI(
    title="FinOpsAzure Analyzer API",
    version=settings.app_version,
    description="Análisis de costos, inventario y recomendaciones de optimización en Azure.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(config_connections.router)
app.include_router(analysis.router)
app.include_router(azure.router)
app.include_router(chat.router)

# Ensure tables exist at import time (idempotent) so the app works under the
# test client and any ASGI server without relying solely on the startup event.
init_db()


@app.on_event("startup")
def _startup() -> None:
    init_db()
