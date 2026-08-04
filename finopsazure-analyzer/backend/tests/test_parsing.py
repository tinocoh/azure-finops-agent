"""Parsing tests for Cost Management, Resource Graph and Advisor responses."""
from __future__ import annotations

from app.services.advisor import parse_advisor_response
from app.services.cost_management import parse_cost_response
from app.services.resource_graph import _count_from


def test_parse_cost_response() -> None:
    payload = {
        "properties": {
            "columns": [{"name": "Cost"}, {"name": "ServiceName"}, {"name": "Currency"}],
            "rows": [
                [100.5, "Storage", "MXN"],
                [250.0, "Virtual Machines", "MXN"],
                [10.0, "Networking", "MXN"],
            ],
        }
    }
    out = parse_cost_response(payload, "ServiceName")
    assert out["total"] == 360.5
    assert out["currency"] == "MXN"
    assert out["rows"][0]["key"] == "Virtual Machines"  # sorted desc
    assert out["rows"][0]["cost"] == 250.0
    assert len(out["top10"]) == 3


def test_parse_cost_response_empty() -> None:
    out = parse_cost_response({"properties": {"columns": [], "rows": []}}, "ServiceName")
    assert out["total"] == 0
    assert out["rows"] == []


def test_count_from_resource_graph() -> None:
    assert _count_from({"data": [{"Count": 42}]}) == 42
    assert _count_from({"data": [{"count_": 7}]}) == 7
    assert _count_from({"data": []}) == 0


def test_parse_advisor_response() -> None:
    payload = {
        "value": [
            {
                "id": "/rec/1",
                "properties": {
                    "category": "Cost",
                    "impact": "High",
                    "shortDescription": {"problem": "Idle VM", "solution": "Resize"},
                    "impactedField": "Microsoft.Compute/virtualMachines",
                    "impactedValue": "vm-1",
                },
            },
            {
                "id": "/rec/2",
                "properties": {
                    "category": "Security",
                    "impact": "Medium",
                    "shortDescription": {"problem": "MFA", "solution": "Enable"},
                },
            },
        ]
    }
    out = parse_advisor_response(payload)
    assert out["available"] is True
    assert out["total"] == 2
    assert out["byCategory"]["Cost"] == 1
    assert out["byCategory"]["Security"] == 1
    assert len(out["quickWins"]) == 1  # Cost + High
    assert out["quickWins"][0]["impactedValue"] == "vm-1"
