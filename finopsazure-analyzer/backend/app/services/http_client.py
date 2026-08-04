"""Shared HTTP helper with exponential backoff for Azure Management APIs."""
from __future__ import annotations

import logging
import time

import httpx

logger = logging.getLogger("finopsazure.http")

RETRYABLE = {429, 500, 502, 503, 504}


def request_with_retry(
    method: str,
    url: str,
    token: str,
    *,
    json_body: dict | None = None,
    max_retries: int = 4,
    timeout: float = 30.0,
) -> httpx.Response:
    """Issue an authenticated request, retrying throttling/5xx with backoff."""
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    attempt = 0
    while True:
        resp = httpx.request(method, url, headers=headers, json=json_body, timeout=timeout)
        if resp.status_code not in RETRYABLE or attempt >= max_retries:
            return resp
        # Honor Retry-After when present, else exponential backoff.
        retry_after = resp.headers.get("Retry-After")
        delay = float(retry_after) if retry_after and retry_after.isdigit() else min(2**attempt, 30)
        logger.warning("Azure API %s -> %s; retry %d in %.1fs", url, resp.status_code, attempt + 1, delay)
        time.sleep(delay)
        attempt += 1
