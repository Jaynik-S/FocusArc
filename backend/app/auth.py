from fastapi import Depends, Header, HTTPException, Request
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.user import User


def get_username(
    request: Request,
    x_username: str | None = Header(default=None, alias="X-Username"),
    db: Session = Depends(get_db),
) -> str:
    if x_username is None:
        raise HTTPException(status_code=400, detail="X-Username header required")

    normalized = x_username.strip()
    if not normalized:
        raise HTTPException(status_code=400, detail="X-Username header required")
    if len(normalized) > 32:
        raise HTTPException(status_code=400, detail="X-Username must be 1-32 chars")

    user = db.get(User, normalized)
    if user is None:
        user = User(username=normalized)
        db.add(user)
        try:
            db.commit()
        except Exception:
            db.rollback()
            user = db.get(User, normalized)
            if user is None:
                raise

    request.state.username = normalized
    return normalized
