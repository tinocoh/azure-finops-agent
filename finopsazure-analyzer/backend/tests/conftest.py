"""Shared pytest fixtures. Sets a Fernet key and in-memory-ish SQLite before app import."""
from __future__ import annotations

import os

from cryptography.fernet import Fernet

# Configure environment BEFORE importing the app/config (settings are cached).
os.environ.setdefault("FINOPS_CONFIG_ENCRYPTION_KEY", Fernet.generate_key().decode())
os.environ.setdefault("DATABASE_URL", "sqlite:///./data/test_finopsazure.db")
os.environ.setdefault("APP_ENV", "test")
