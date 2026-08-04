"""Sanitization helpers to strip/ mask sensitive identifiers before they
leave the trust boundary (e.g. sent to the AI model or returned by the API).
"""
from __future__ import annotations

import re

GUID_RE = re.compile(r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}")


def mask_secret_hint(secret: str) -> str:
    """Return a non-reversible masked hint like '****abcd'. Never the full value."""
    if not secret:
        return ""
    tail = secret[-4:] if len(secret) >= 4 else ""
    return f"****{tail}"


def mask_guid(value: str) -> str:
    """Mask a GUID keeping only the last segment for correlation."""
    if not value:
        return value
    parts = value.split("-")
    if len(parts) == 5:
        return f"****-{parts[-1]}"
    return "****"


def sanitize_text(text: str) -> str:
    """Replace any GUIDs embedded in free text with masked placeholders."""
    return GUID_RE.sub(lambda m: mask_guid(m.group(0)), text or "")


def sanitize_for_ai(payload: dict) -> dict:
    """Recursively mask GUIDs in a dict destined for the AI model.

    Removes any keys that could carry secrets/tokens defensively.
    """
    forbidden = {"clientsecret", "client_secret", "secret", "token", "access_token", "password", "authorization"}

    def _clean(obj):
        if isinstance(obj, dict):
            out = {}
            for k, v in obj.items():
                if k.lower() in forbidden:
                    continue
                out[k] = _clean(v)
            return out
        if isinstance(obj, list):
            return [_clean(i) for i in obj]
        if isinstance(obj, str):
            return sanitize_text(obj)
        return obj

    return _clean(payload)
