"""Health/version endpoint tests."""
from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health() -> None:
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_version() -> None:
    resp = client.get("/api/version")
    assert resp.status_code == 200
    body = resp.json()
    assert "version" in body
    assert "env" in body
