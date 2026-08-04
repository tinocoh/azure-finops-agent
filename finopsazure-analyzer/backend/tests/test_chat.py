"""Chat service tests: rule-based fallback and snapshot sanitization."""
from __future__ import annotations

from app.services import chat as chat_service


def test_rule_based_answer_has_no_ai() -> None:
    snapshot = {
        "costs": {"currentMonthCost": 1234.5, "currency": "MXN", "deltaPercent": 12.0,
                  "topServices": [{"key": "Virtual Machines", "cost": 900}]},
        "inventory": {"totalResources": 40, "resourcesWithoutTags": 5},
        "recommendations": {"total": 3, "quickWins": [{"id": "1"}]},
    }
    out = chat_service._rule_based_answer("¿cuánto gasté?", snapshot)
    assert out["generatedBy"] == "rules"
    assert "1234.5" in out["reply"]
    assert "Virtual Machines" in out["reply"]


def test_snapshot_cache_roundtrip(monkeypatch) -> None:
    # Fake connection object with the attributes get_snapshot reads.
    class FakeConn:
        id = "conn-1"
        subscription_ids = "33333333-3333-3333-3333-333333333333"

    calls = {"n": 0}

    def fake_build(_token, _subs):
        calls["n"] += 1
        return {"costs": {}, "inventory": {}, "recommendations": {}}

    monkeypatch.setattr(chat_service, "_build_snapshot", fake_build)
    chat_service._snapshot_cache.clear()

    s1 = chat_service.get_snapshot(FakeConn(), "token")
    s2 = chat_service.get_snapshot(FakeConn(), "token")
    assert s1 is s2  # served from cache
    assert calls["n"] == 1  # built only once
