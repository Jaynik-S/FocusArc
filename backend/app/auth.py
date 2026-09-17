from fastapi import Depends, Header, HTTPException, Request
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.user import User
from app.settings import get_settings


def get_username(
    request: Request,
    x_username: str | None = Header(default=None, alias="X-Username"),
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> str:
    settings = get_settings()
    
    # Production mode requires authentication
    if settings.owner_username and settings.access_key:
        if not authorization:
            raise HTTPException(status_code=401, detail="Authorization required")
        
        # Expect "Bearer <token>"
        parts = authorization.split()
        if len(parts) != 2 or parts[0].lower() != "bearer":
            raise HTTPException(status_code=401, detail="Invalid authorization format")
        
        provided_key = parts[1]
        if provided_key != settings.access_key:
            raise HTTPException(status_code=401, detail="Invalid access key")
        
        # Use configured owner username
        username = settings.owner_username
    else:
        # Legacy mode: trust X-Username header (local development only)
        if x_username is None:
            raise HTTPException(status_code=400, detail="X-Username header required")
        
        username = x_username.strip()
        if not username:
            raise HTTPException(status_code=400, detail="X-Username header required")
        if len(username) > 32:
            raise HTTPException(status_code=400, detail="X-Username must be 1-32 chars")
    
    # Auto-create user if needed
    user = db.get(User, username)
    if user is None:
        user = User(username=username)
        db.add(user)
        try:
            db.commit()
        except Exception:
            db.rollback()
            user = db.get(User, username)
            if user is None:
                raise

    request.state.username = username
    return username
