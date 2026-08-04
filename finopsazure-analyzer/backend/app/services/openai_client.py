"""Shared Azure OpenAI client factory.

Returns a configured client + deployment name, or (None, None) when Azure OpenAI
is not configured (so callers can degrade to rule-based behavior). Prefers
Managed Identity (RBAC) over an API key. Never logs secrets.
"""
from __future__ import annotations

import logging

from ..config import get_settings

logger = logging.getLogger("finopsazure.openai")


def get_openai_client():
    """Return (client, deploymentName) or (None, None) if not configured."""
    settings = get_settings()
    if not settings.azure_openai_endpoint or not settings.azure_openai_deployment:
        return None, None

    try:
        from openai import AzureOpenAI

        if settings.azure_openai_api_key:
            client = AzureOpenAI(
                azure_endpoint=settings.azure_openai_endpoint,
                api_key=settings.azure_openai_api_key,
                api_version=settings.azure_openai_api_version,
            )
        else:
            from azure.identity import DefaultAzureCredential, get_bearer_token_provider

            token_provider = get_bearer_token_provider(
                DefaultAzureCredential(), "https://cognitiveservices.azure.com/.default"
            )
            client = AzureOpenAI(
                azure_endpoint=settings.azure_openai_endpoint,
                azure_ad_token_provider=token_provider,
                api_version=settings.azure_openai_api_version,
            )
        return client, settings.azure_openai_deployment
    except Exception as exc:  # noqa: BLE001 — caller degrades gracefully
        logger.warning("No se pudo crear el cliente de Azure OpenAI: %s", type(exc).__name__)
        return None, None
