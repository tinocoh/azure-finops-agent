"""GUID validation + client_secret must never be returned by the API."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.main import app
from app.schemas import ConnectionCreate

client = TestClient(app)

VALID = {
    "connectionName": "demo",
    "tenantId": "11111111-1111-1111-1111-111111111111",
    "clientId": "22222222-2222-2222-2222-222222222222",
    "clientSecret": "super-secret-value-1234",
    "subscriptionIds": ["33333333-3333-3333-3333-333333333333"],
}


def test_invalid_guid_rejected() -> None:
    with pytest.raises(ValidationError):
        ConnectionCreate(**{**VALID, "tenantId": "not-a-guid"})


def test_valid_guid_accepted() -> None:
    model = ConnectionCreate(**VALID)
    assert model.tenantId == VALID["tenantId"]


def test_client_secret_never_returned() -> None:
    created = client.post("/api/config/connections", json=VALID)
    assert created.status_code == 201
    body = created.json()
    # The secret value must NOT appear anywhere in the response.
    assert "clientSecret" not in body
    assert VALID["clientSecret"] not in created.text
    assert body["secretSet"] is True
    assert body["secretHint"].startswith("****")

    # Cleanup
    client.delete(f"/api/config/connections/{body['id']}")
