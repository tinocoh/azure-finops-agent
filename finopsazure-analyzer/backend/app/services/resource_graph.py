"""Azure Resource Graph client for inventory queries."""
from __future__ import annotations

import logging

from ..config import get_settings
from .http_client import request_with_retry

logger = logging.getLogger("finopsazure.rg")

# Minimal KQL queries for inventory.
Q_BY_TYPE = "Resources | summarize count() by type | order by count_ desc"
Q_BY_LOCATION = "Resources | summarize count() by location | order by count_ desc"
Q_WITHOUT_TAGS = "Resources | where isnull(tags) or array_length(todynamic(tostring(tags))) == 0 | count"
Q_TOTAL = "Resources | count"
Q_PUBLIC_IPS = "Resources | where type =~ 'microsoft.network/publicipaddresses' | count"
Q_UNATTACHED_DISKS = (
    "Resources | where type =~ 'microsoft.compute/disks' "
    "| where properties.diskState == 'Unattached' | count"
)
Q_VMS = (
    "Resources | where type =~ 'microsoft.compute/virtualmachines' "
    "| project name, size = tostring(properties.hardwareProfile.vmSize), "
    "location, powerState = tostring(properties.extended.instanceView.powerState.code)"
)
Q_STORAGE = "Resources | where type =~ 'microsoft.storage/storageaccounts' | count"
Q_LOAD_BALANCERS = "Resources | where type =~ 'microsoft.network/loadbalancers' | count"
Q_DATABASES = (
    "Resources | where type in~ ('microsoft.sql/servers/databases', "
    "'microsoft.dbforpostgresql/flexibleservers', 'microsoft.dbformysql/flexibleservers', "
    "'microsoft.documentdb/databaseaccounts') | summarize count() by type"
)


def run_query(token: str, subscription_ids: list[str], query: str) -> dict:
    """Execute a Resource Graph query across the given subscriptions."""
    settings = get_settings()
    url = f"{settings.arm_endpoint}/providers/Microsoft.ResourceGraph/resources?api-version=2022-10-01"
    body = {
        "subscriptions": subscription_ids,
        "query": query,
        "options": {"resultFormat": "objectArray", "top": 1000},
    }
    resp = request_with_retry("POST", url, token, json_body=body)
    if resp.status_code in (401, 403):
        return {"error": "no_permission", "data": []}
    if resp.status_code != 200:
        return {"error": f"api_error_{resp.status_code}", "data": []}
    payload = resp.json()
    return {"data": payload.get("data", []), "count": payload.get("count", 0)}


def _count_from(result: dict) -> int:
    data = result.get("data", [])
    if not data:
        return 0
    row = data[0]
    # A `| count` query returns a single row with a 'Count' or 'count_' field.
    for k in ("Count", "count_", "count"):
        if k in row:
            return int(row[k])
    return int(result.get("count", 0))


def inventory_summary(token: str, subscription_ids: list[str]) -> dict:
    """Collect a normalized inventory snapshot. Never fails hard."""
    by_type = run_query(token, subscription_ids, Q_BY_TYPE)
    by_location = run_query(token, subscription_ids, Q_BY_LOCATION)
    without_tags = run_query(token, subscription_ids, Q_WITHOUT_TAGS)
    total = run_query(token, subscription_ids, Q_TOTAL)
    public_ips = run_query(token, subscription_ids, Q_PUBLIC_IPS)
    unattached = run_query(token, subscription_ids, Q_UNATTACHED_DISKS)
    vms = run_query(token, subscription_ids, Q_VMS)
    storage = run_query(token, subscription_ids, Q_STORAGE)
    lbs = run_query(token, subscription_ids, Q_LOAD_BALANCERS)
    dbs = run_query(token, subscription_ids, Q_DATABASES)

    vm_rows = vms.get("data", [])
    stopped_vms = [
        v for v in vm_rows
        if "deallocated" in str(v.get("powerState", "")).lower()
        or "stopped" in str(v.get("powerState", "")).lower()
    ]

    errors = [
        r.get("error")
        for r in (by_type, by_location, without_tags, total, vms)
        if r.get("error")
    ]

    return {
        "totalResources": _count_from(total),
        "byType": by_type.get("data", []),
        "byLocation": by_location.get("data", []),
        "resourcesWithoutTags": _count_from(without_tags),
        "publicIps": _count_from(public_ips),
        "unattachedDisks": _count_from(unattached),
        "virtualMachines": vm_rows,
        "stoppedVms": stopped_vms,
        "storageAccounts": _count_from(storage),
        "loadBalancers": _count_from(lbs),
        "databases": dbs.get("data", []),
        "errors": [e for e in errors if e],
    }
