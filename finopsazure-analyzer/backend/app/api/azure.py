"""Azure passthrough endpoints for ad-hoc queries against a saved connection."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..config import get_settings
from ..database import get_db
from ..models import Connection
from ..schemas import AdvisorRequest, CostQueryRequest, ResourceGraphRequest
from ..services import advisor, azure_auth, cost_management, resource_graph
from ..services.encryption import decrypt
from ..services.http_client import request_with_retry

router = APIRouter(prefix="/api/azure", tags=["azure"])


def _token_for(db: Session, conn_id: str) -> tuple[Connection, str]:
    c = db.get(Connection, conn_id)
    if not c:
        raise HTTPException(404, "Conexión no encontrada")
    secret = decrypt(c.client_secret_encrypted)
    try:
        token = azure_auth.get_token(c.tenant_id, c.client_id, secret)
    except azure_auth.AzureAuthError as exc:
        raise HTTPException(400, f"{exc.code}: {exc.message}") from exc
    return c, token


@router.get("/connections/{conn_id}/subscriptions")
def list_subscriptions(conn_id: str, db: Session = Depends(get_db)) -> dict:
    _, token = _token_for(db, conn_id)
    settings = get_settings()
    url = f"{settings.arm_endpoint}/subscriptions?api-version=2022-12-01"
    resp = request_with_retry("GET", url, token)
    if resp.status_code != 200:
        raise HTTPException(resp.status_code, "No se pudieron listar las suscripciones")
    data = resp.json().get("value", [])
    return {
        "subscriptions": [
            {"subscriptionId": s.get("subscriptionId"), "displayName": s.get("displayName"), "state": s.get("state")}
            for s in data
        ]
    }


@router.post("/connections/{conn_id}/cost-query")
def cost_query(conn_id: str, payload: CostQueryRequest, db: Session = Depends(get_db)) -> dict:
    _, token = _token_for(db, conn_id)
    return cost_management.query_costs(
        token, payload.subscriptionId, group_by=payload.groupBy,
        date_from=payload.dateFrom, date_to=payload.dateTo,
    )


@router.post("/connections/{conn_id}/resource-graph-query")
def resource_graph_query(conn_id: str, payload: ResourceGraphRequest, db: Session = Depends(get_db)) -> dict:
    _, token = _token_for(db, conn_id)
    return resource_graph.run_query(token, payload.subscriptionIds, payload.query)


@router.post("/connections/{conn_id}/advisor-recommendations")
def advisor_recommendations(conn_id: str, payload: AdvisorRequest, db: Session = Depends(get_db)) -> dict:
    _, token = _token_for(db, conn_id)
    return advisor.get_recommendations(token, payload.subscriptionId)
