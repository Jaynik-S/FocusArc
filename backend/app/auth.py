import hashlib
import hmac

from fastapi import Depends, Header, HTTPException, Request
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.user import User
from app.settings import get_settings


def require_access(
    x_username: str | None = Header(default=None, alias="X-Username"),
    authorization: str | None = Header(default=None),
) -> str:
    settings = get_settings()
    
    # Production mode requires authentication
    if settings.auth_mode == "personal":
        parts = (authorization or "").split()
        valid = (len(parts) == 2 and parts[0].lower() == "bearer"
                 and hmac.compare_digest(hashlib.sha256(parts[1].encode()).hexdigest(),
                                         (settings.personal_access_key_sha256 or "").lower()))
        if not valid:
            raise HTTPException(status_code=401, detail="Invalid access credentials",
                                headers={"WWW-Authenticate": "Bearer"})
        
        # Use configured owner username
        username = settings.owner_username
        if x_username is not None and x_username.strip() != username:
            raise HTTPException(status_code=403, detail="Username does not match owner")
    else:
        # Legacy mode: trust X-Username header (local development only)
        if x_username is None:
            raise HTTPException(status_code=400, detail="X-Username header required")
        
        username = x_username.strip()
        if not username:
            raise HTTPException(status_code=400, detail="X-Username header required")
        if len(username) > 32:
            raise HTTPException(status_code=400, detail="X-Username must be 1-32 chars")
    
    return username


def get_username(request: Request, username: str = Depends(require_access),
                 db: Session = Depends(get_db)) -> str:
    # Access validation resolves before the database dependency.
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
