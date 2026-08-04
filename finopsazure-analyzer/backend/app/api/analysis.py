"""Analysis endpoints: run analyses and fetch results."""
from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import AnalysisRun, Connection
from ..schemas import AnalysisRequest, AnalysisRunOut
from ..services import analysis_runner

router = APIRouter(prefix="/api/analysis", tags=["analysis"])


def _to_out(r: AnalysisRun) -> AnalysisRunOut:
    return AnalysisRunOut(
        id=r.id,
        connectionId=r.connection_id,
        status=r.status,
        dateFrom=r.date_from,
        dateTo=r.date_to,
        subscriptionIds=[s for s in (r.subscription_ids or "").split(",") if s],
        createdAt=r.created_at,
        completedAt=r.completed_at,
    )


def _get_run(db: Session, run_id: str) -> AnalysisRun:
    r = db.get(AnalysisRun, run_id)
    if not r:
        raise HTTPException(404, "Análisis no encontrado")
    return r


@router.post("/run", response_model=AnalysisRunOut, status_code=201)
def run(payload: AnalysisRequest, db: Session = Depends(get_db)) -> AnalysisRunOut:
    c = db.get(Connection, payload.connectionId)
    if not c:
        raise HTTPException(404, "Conexión no encontrada")
    if not c.enabled:
        raise HTTPException(400, "La conexión está deshabilitada")
    r = analysis_runner.run_analysis(db, c, payload.subscriptionIds, payload.dateFrom, payload.dateTo)
    return _to_out(r)


@router.get("/runs", response_model=list[AnalysisRunOut])
def list_runs(db: Session = Depends(get_db)) -> list[AnalysisRunOut]:
    runs = db.query(AnalysisRun).order_by(AnalysisRun.created_at.desc()).all()
    return [_to_out(r) for r in runs]


@router.get("/runs/{run_id}", response_model=AnalysisRunOut)
def get_run(run_id: str, db: Session = Depends(get_db)) -> AnalysisRunOut:
    return _to_out(_get_run(db, run_id))


@router.get("/runs/{run_id}/summary")
def get_summary(run_id: str, db: Session = Depends(get_db)) -> dict:
    r = _get_run(db, run_id)
    return {"runId": r.id, "status": r.status, "summary": json.loads(r.summary_json or "{}"),
            "errors": json.loads(r.errors_json or "[]")}


@router.get("/runs/{run_id}/costs")
def get_costs(run_id: str, db: Session = Depends(get_db)) -> dict:
    r = _get_run(db, run_id)
    return json.loads(r.costs_json or "{}")


@router.get("/runs/{run_id}/resources")
def get_resources(run_id: str, db: Session = Depends(get_db)) -> dict:
    r = _get_run(db, run_id)
    return json.loads(r.resources_json or "{}")


@router.get("/runs/{run_id}/recommendations")
def get_recommendations(run_id: str, db: Session = Depends(get_db)) -> dict:
    r = _get_run(db, run_id)
    return json.loads(r.recommendations_json or "{}")


@router.get("/runs/{run_id}/ai-summary")
def get_ai_summary(run_id: str, db: Session = Depends(get_db)) -> dict:
    r = _get_run(db, run_id)
    return json.loads(r.ai_summary_json or "{}")
