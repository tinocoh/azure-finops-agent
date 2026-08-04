"""Invalid connection handling: auth error mapping."""
from __future__ import annotations

from app.services.azure_auth import AzureAuthError


def test_azure_auth_error_carries_code() -> None:
    err = AzureAuthError("invalid_client", "Client ID o Client Secret inválido")
    assert err.code == "invalid_client"
    assert "invalid_client" in str(err)
