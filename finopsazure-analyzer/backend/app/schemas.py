"""Pydantic schemas for request/response models."""
from __future__ import annotations

import re
from datetime import datetime

from pydantic import BaseModel, Field, field_validator

GUID_RE = re.compile(r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")


def _validate_guid(value: str, field: str) -> str:
    if not GUID_RE.match(value or ""):
        raise ValueError(f"{field} debe ser un GUID válido")
    return value


# ── Connections ────────────────────────────────────────────────────────────
class ConnectionBase(BaseModel):
    connectionName: str = Field(min_length=1, max_length=200)
    tenantId: str
    clientId: str
    subscriptionIds: list[str] = Field(default_factory=list)
    defaultCurrency: str | None = None
    enabled: bool = True

    @field_validator("tenantId")
    @classmethod
    def _tenant(cls, v: str) -> str:
        return _validate_guid(v, "tenantId")

    @field_validator("clientId")
    @classmethod
    def _client(cls, v: str) -> str:
        return _validate_guid(v, "clientId")

    @field_validator("subscriptionIds")
    @classmethod
    def _subs(cls, v: list[str]) -> list[str]:
        for s in v:
            _validate_guid(s, "subscriptionId")
        return v


class ConnectionCreate(ConnectionBase):
    clientSecret: str = Field(min_length=1)


class ConnectionUpdate(BaseModel):
    connectionName: str | None = Field(default=None, max_length=200)
    subscriptionIds: list[str] | None = None
    defaultCurrency: str | None = None
    enabled: bool | None = None

    @field_validator("subscriptionIds")
    @classmethod
    def _subs(cls, v: list[str] | None) -> list[str] | None:
        if v is None:
            return v
        for s in v:
            _validate_guid(s, "subscriptionId")
        return v


class SecretRotate(BaseModel):
    clientSecret: str = Field(min_length=1)


class ConnectionOut(BaseModel):
    """Public representation — NEVER includes the client secret."""

    id: str
    connectionName: str
    tenantId: str
    clientId: str
    subscriptionIds: list[str]
    defaultCurrency: str | None = None
    enabled: bool
    secretSet: bool
    secretHint: str  # masked, e.g. "****abcd"
    createdAt: datetime
    updatedAt: datetime


class SubscriptionStatus(BaseModel):
    subscriptionId: str
    status: str  # ok | no_permission | not_accessible | error
    message: str | None = None


class ValidationResult(BaseModel):
    connectionId: str
    credentialsValid: bool
    status: str  # credentials_valid | auth_error | api_error | no_permission
    message: str | None = None
    subscriptions: list[SubscriptionStatus] = Field(default_factory=list)


# ── Analysis ────────────────────────────────────────────────────────────────
class AnalysisRequest(BaseModel):
    connectionId: str
    subscriptionIds: list[str] | None = None
    dateFrom: str | None = None
    dateTo: str | None = None


class AnalysisRunOut(BaseModel):
    id: str
    connectionId: str
    status: str
    dateFrom: str | None
    dateTo: str | None
    subscriptionIds: list[str]
    createdAt: datetime
    completedAt: datetime | None


# ── Azure passthrough queries ────────────────────────────────────────────────
class CostQueryRequest(BaseModel):
    subscriptionId: str
    dateFrom: str | None = None
    dateTo: str | None = None
    groupBy: str = "ServiceName"  # ServiceName | ResourceGroup | ResourceLocation


class ResourceGraphRequest(BaseModel):
    subscriptionIds: list[str]
    query: str


class AdvisorRequest(BaseModel):
    subscriptionId: str


# ── Chat ─────────────────────────────────────────────────────────────────────
class ChatMessage(BaseModel):
    role: str  # user | assistant
    content: str


class ChatRequest(BaseModel):
    connectionId: str
    message: str = Field(min_length=1, max_length=4000)
    history: list[ChatMessage] = Field(default_factory=list)


class ChatResponse(BaseModel):
    reply: str
    generatedBy: str
    aiError: str | None = None
