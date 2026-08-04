"""Chat endpoint: natural-language questions over a connection's Azure data."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Connection
from ..schemas import ChatRequest, ChatResponse
from ..services import chat as chat_service

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post("", response_model=ChatResponse)
def chat(payload: ChatRequest, db: Session = Depends(get_db)) -> ChatResponse:
    c = db.get(Connection, payload.connectionId)
    if not c:
        raise HTTPException(404, "Conexión no encontrada")
    if not c.enabled:
        raise HTTPException(400, "La conexión está deshabilitada")
    history = [{"role": m.role, "content": m.content} for m in payload.history]
    result = chat_service.answer(c, payload.message, history)
    return ChatResponse(
        reply=result.get("reply", ""),
        generatedBy=result.get("generatedBy", "unknown"),
        aiError=result.get("aiError"),
    )
