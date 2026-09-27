from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.user import User


def get_current_username(
    request: Request,
    db: Session = Depends(get_db),
) -> str:
    username = request.session.get("username")
    if not isinstance(username, str) or not username:
        raise HTTPException(status_code=401, detail="Authentication required")

    user = db.get(User, username)
    if user is None or user.password_hash is None:
        request.session.clear()
        raise HTTPException(status_code=401, detail="Authentication required")

    request.state.username = user.username
    return user.username
