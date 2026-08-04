"""Secret resolution helpers.

Local: secrets live encrypted in the DB (Fernet).
Azure: sensitive values are delivered as Container App secret refs backed by
Key Vault + Managed Identity. This module never logs secret values.
"""
from __future__ import annotations

import logging

from ..config import get_settings

logger = logging.getLogger("finopsazure.secrets")


def resolve_openai_api_key() -> str | None:
    """Return the Azure OpenAI API key if configured (optional).

    In Azure prefer Managed Identity + RBAC over an API key; this only returns a
    value when explicitly provided via env/secret ref. Never logged.
    """
    key = get_settings().azure_openai_api_key
    return key or None


def redact(value: str | None) -> str:
    """Return a log-safe representation. Never returns the raw secret."""
    if not value:
        return "<empty>"
    return "<redacted>"
