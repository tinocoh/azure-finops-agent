"""Sanitization tests: GUID masking and forbidden-key stripping before AI."""
from __future__ import annotations

from app.security.sanitization import mask_secret_hint, sanitize_for_ai, sanitize_text


def test_mask_secret_hint() -> None:
    assert mask_secret_hint("abcd1234") == "****1234"
    assert mask_secret_hint("") == ""


def test_sanitize_text_masks_guids() -> None:
    text = "sub 33333333-3333-3333-3333-333333333333 spend"
    out = sanitize_text(text)
    assert "33333333-3333-3333-3333-333333333333" not in out
    assert "****-333333333333" in out


def test_sanitize_for_ai_strips_secrets() -> None:
    payload = {
        "clientSecret": "leak",
        "token": "leak",
        "nested": {"password": "leak", "keep": "ok"},
        "list": [{"access_token": "leak", "value": 1}],
    }
    out = sanitize_for_ai(payload)
    assert "clientSecret" not in out
    assert "token" not in out
    assert "password" not in out["nested"]
    assert out["nested"]["keep"] == "ok"
    assert "access_token" not in out["list"][0]
    assert out["list"][0]["value"] == 1
