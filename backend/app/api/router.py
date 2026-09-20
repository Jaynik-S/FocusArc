import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.auth import get_username, require_access
from app.api.end_day import router as end_day_router
from app.api.stats import router as stats_router
from app.api.sessions import router as sessions_router
from app.api.timers import router as timers_router
from app.api.totals import router as totals_router
from app.db import get_db
from app.models.session import Session as SessionModel

router = APIRouter()
public_router = APIRouter()
api_router = APIRouter(dependencies=[Depends(get_username)])
logger = logging.getLogger(__name__)


@public_router.get("/health")
def health_check() -> dict:
    return {"status": "ok"}


@public_router.get("/ready", dependencies=[Depends(require_access)])
def readiness(db: Session = Depends(get_db)) -> dict:
    try:
        db.execute(text("SELECT 1"))
        revision = db.execute(text("SELECT version_num FROM alembic_version")).scalar_one()
        if not isinstance(revision, str) or not revision.strip():
            raise HTTPException(status_code=503, detail="Database is not ready")
        return {"status": "ok", "revision": revision}
    except SQLAlchemyError as exc:
        # Database exceptions can include credentials, SQL, and personal data.
        logger.warning("Readiness failed (%s)", type(exc).__name__)
        raise HTTPException(status_code=503, detail="Database is not ready") from None


def _session_to_dict(session: SessionModel) -> dict:
    return {
        "id": str(session.id),
        "timer_id": str(session.timer_id),
        "start_at": session.start_at.isoformat(),
        "end_at": session.end_at.isoformat() if session.end_at else None,
        "duration_seconds": session.duration_seconds,
        "client_tz": session.client_tz,
        "day_date": session.day_date.isoformat(),
        "day_of_week": session.day_of_week,
    }


@api_router.get("/me")
def get_me(request: Request, db: Session = Depends(get_db)) -> dict:
    username = request.state.username
    active_session = db.execute(
        select(SessionModel).where(
            SessionModel.username == username,
            SessionModel.end_at.is_(None),
        )
    ).scalars().first()
    return {
        "username": username,
        "active_session": _session_to_dict(active_session) if active_session else None,
    }


api_router.include_router(timers_router)
api_router.include_router(sessions_router)
api_router.include_router(end_day_router)
api_router.include_router(stats_router)
api_router.include_router(totals_router)
router.include_router(public_router)
router.include_router(api_router)
