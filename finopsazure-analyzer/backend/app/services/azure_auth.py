# Copyright (c) Microsoft Corporation.
# Licensed under the MIT license.
"""Azure authentication using ClientSecretCredential for saved connections.

Maps low-level failures into clear, user-facing error codes. Never logs secrets.
"""
from __future__ import annotations

import logging

import httpx
from azure.core.exceptions import ClientAuthenticationError
from azure.identity import ClientSecretCredential

from ..config import get_settings

logger = logging.getLogger("finopsazure.azure_auth")


class AzureAuthError(Exception):
    def __init__(self, code: str, message: str):
        self.code = code
        self.message = message
        super().__init__(f"{code}: {message}")


def build_credential(tenant_id: str, client_id: str, client_secret: str) -> ClientSecretCredential:
    settings = get_settings()
    return ClientSecretCredential(
        tenant_id=tenant_id,
        client_id=client_id,
        client_secret=client_secret,
        authority=settings.authority_host,
    )


def get_token(tenant_id: str, client_id: str, client_secret: str) -> str:
    """Acquire an ARM token. Raises AzureAuthError with a specific code."""
    settings = get_settings()
    try:
        cred = build_credential(tenant_id, client_id, client_secret)
        token = cred.get_token(settings.arm_scope)
        return token.token
    except ClientAuthenticationError as exc:
        msg = str(exc).lower()
        if "aadsts700016" in msg or "was not found in the directory" in msg or "invalid_client" in msg:
            raise AzureAuthError("invalid_client", "Invalid Client ID or Client Secret") from exc
        if "aadsts90002" in msg or "tenant" in msg and "not found" in msg:
            raise AzureAuthError("invalid_tenant", "Tenant ID is invalid or was not found") from exc
        raise AzureAuthError("authorization_failed", "Azure authentication failed") from exc
    except Exception as exc:  # noqa: BLE001 — surface as controlled error
        raise AzureAuthError("timeout", "Could not contact Entra ID (timeout or network issue)") from exc


def check_subscription_access(token: str, subscription_id: str) -> tuple[str, str | None]:
    """Return (status, message) for a subscription.

    status ∈ {ok, no_permission, not_accessible, error}
    """
    settings = get_settings()
    url = f"{settings.arm_endpoint}/subscriptions/{subscription_id}?api-version=2022-12-01"
    headers = {"Authorization": f"Bearer {token}"}
    try:
        resp = httpx.get(url, headers=headers, timeout=15.0)
    except httpx.HTTPError:
        return "error", "Network error while querying the subscription"

    if resp.status_code == 200:
        return "ok", None
    if resp.status_code in (401, 403):
        return "no_permission", "The service principal does not have permissions on the subscription"
    if resp.status_code == 404:
        return "not_accessible", "Subscription not found or not accessible"
    return "error", f"Azure API returned {resp.status_code}"
