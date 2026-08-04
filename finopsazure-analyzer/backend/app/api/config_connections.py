"""Connection configuration endpoints. Secrets are never returned."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Connection
from ..schemas import (
    ConnectionCreate,
    ConnectionOut,
    ConnectionUpdate,
    SecretRotate,
    SubscriptionStatus,
    ValidationResult,
)
from ..security.sanitization import mask_secret_hint
from ..services import azure_auth
from ..services.encryption import decrypt, encrypt

router = APIRouter(prefix="/api/config", tags=["config"])


def _to_out(c: Connection) -> ConnectionOut:
    secret = ""
    try:
        secret = decrypt(c.client_secret_encrypted) if c.client_secret_encrypted else ""
    except Exception:  # noqa: BLE001 — hint only, never expose value
        secret = ""
    return ConnectionOut(
        id=c.id,
        connectionName=c.connection_name,
        tenantId=c.tenant_id,
        clientId=c.client_id,
        subscriptionIds=[s for s in (c.subscription_ids or "").split(",") if s],
        defaultCurrency=c.default_currency,
        enabled=c.enabled,
        secretSet=bool(c.client_secret_encrypted),
        secretHint=mask_secret_hint(secret),
        createdAt=c.created_at,
        updatedAt=c.updated_at,
    )


@router.get("/connections", response_model=list[ConnectionOut])
def list_connections(db: Session = Depends(get_db)) -> list[ConnectionOut]:
    return [_to_out(c) for c in db.query(Connection).all()]


@router.post("/connections", response_model=ConnectionOut, status_code=201)
def create_connection(payload: ConnectionCreate, db: Session = Depends(get_db)) -> ConnectionOut:
    c = Connection(
        connection_name=payload.connectionName,
        tenant_id=payload.tenantId,
        client_id=payload.clientId,
        client_secret_encrypted=encrypt(payload.clientSecret),
        subscription_ids=",".join(payload.subscriptionIds),
        default_currency=payload.defaultCurrency,
        enabled=payload.enabled,
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return _to_out(c)


@router.get("/connections/{conn_id}", response_model=ConnectionOut)
def get_connection(conn_id: str, db: Session = Depends(get_db)) -> ConnectionOut:
    c = db.get(Connection, conn_id)
    if not c:
        raise HTTPException(404, "Conexión no encontrada")
    return _to_out(c)


@router.put("/connections/{conn_id}", response_model=ConnectionOut)
def update_connection(conn_id: str, payload: ConnectionUpdate, db: Session = Depends(get_db)) -> ConnectionOut:
    c = db.get(Connection, conn_id)
    if not c:
        raise HTTPException(404, "Conexión no encontrada")
    if payload.connectionName is not None:
        c.connection_name = payload.connectionName
    if payload.subscriptionIds is not None:
        c.subscription_ids = ",".join(payload.subscriptionIds)
    if payload.defaultCurrency is not None:
        c.default_currency = payload.defaultCurrency
    if payload.enabled is not None:
        c.enabled = payload.enabled
    db.commit()
    db.refresh(c)
    return _to_out(c)


@router.delete("/connections/{conn_id}", status_code=204, response_class=Response)
def delete_connection(conn_id: str, db: Session = Depends(get_db)) -> Response:
    c = db.get(Connection, conn_id)
    if not c:
        raise HTTPException(404, "Conexión no encontrada")
    db.delete(c)
    db.commit()
    return Response(status_code=204)


@router.post("/connections/{conn_id}/rotate-secret", response_model=ConnectionOut)
def rotate_secret(conn_id: str, payload: SecretRotate, db: Session = Depends(get_db)) -> ConnectionOut:
    c = db.get(Connection, conn_id)
    if not c:
        raise HTTPException(404, "Conexión no encontrada")
    c.client_secret_encrypted = encrypt(payload.clientSecret)
    db.commit()
    db.refresh(c)
    return _to_out(c)


@router.post("/connections/{conn_id}/validate", response_model=ValidationResult)
def validate_connection(conn_id: str, db: Session = Depends(get_db)) -> ValidationResult:
    c = db.get(Connection, conn_id)
    if not c:
        raise HTTPException(404, "Conexión no encontrada")

    secret = decrypt(c.client_secret_encrypted)
    try:
        token = azure_auth.get_token(c.tenant_id, c.client_id, secret)
    except azure_auth.AzureAuthError as exc:
        return ValidationResult(
            connectionId=c.id,
            credentialsValid=False,
            status="auth_error",
            message=f"{exc.code}: {exc.message}",
        )

    sub_statuses: list[SubscriptionStatus] = []
    subs = [s for s in (c.subscription_ids or "").split(",") if s]
    for sub in subs:
        status, message = azure_auth.check_subscription_access(token, sub)
        sub_statuses.append(SubscriptionStatus(subscriptionId=sub, status=status, message=message))

    return ValidationResult(
        connectionId=c.id,
        credentialsValid=True,
        status="credentials_valid",
        message="Credenciales válidas",
        subscriptions=sub_statuses,
    )
