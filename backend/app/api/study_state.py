from datetime import date

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.orm import Session

from app.db import get_db
from app.services import study_state
from app.schemas.study_state import StudyHeartbeat, StudyStateChanged, StudyStateUnchanged

router = APIRouter(tags=['study'])


@router.get('/study-state')
def get_study_state(request: Request, known_revision: int | None = None,
                    known_day: date | None = None, db: Session = Depends(get_db)) -> StudyStateChanged | StudyStateUnchanged:
    return study_state.get_study_state(db, request.state.username, known_revision, known_day)


@router.post('/study-heartbeat', status_code=204)
def heartbeat(payload: StudyHeartbeat, request: Request, db: Session = Depends(get_db)) -> Response:
    renewed = study_state.heartbeat(db, request.state.username, payload.active_session_id)
    return Response(status_code=204 if renewed else 409)
