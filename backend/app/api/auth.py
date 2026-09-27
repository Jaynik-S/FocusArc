from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session

from app.auth import get_current_username
from app.db import get_db
from app.rate_limit import FixedWindowLimiter, RateLimitExceeded
from app.schemas.auth import AuthUser, LoginRequest, RegisterRequest
from app.services.accounts import AccountError
from app.services.accounts import authenticate as authenticate_account
from app.services.accounts import register as register_account


router = APIRouter(prefix="/auth", tags=["auth"])
auth_limiter = FixedWindowLimiter()

_ACCOUNT_ERRORS: dict[str, tuple[int, str]] = {
    "username_not_registered": (404, "This username isn't registered"),
    "password_setup_required": (
        403,
        "This existing account requires private password setup",
    ),
    "incorrect_password": (401, "Incorrect password"),
    "username_unavailable": (409, "This username is unavailable"),
}


def _client_host(request: Request) -> str:
    return request.client.host if request.client is not None else "unknown"


def _check_limit(key: str, *, limit: int, window_seconds: int) -> None:
    try:
        auth_limiter.check(key, limit=limit, window_seconds=window_seconds)
    except RateLimitExceeded as exc:
        raise HTTPException(
            status_code=429,
            detail={
                "code": "rate_limited",
                "message": "Too many attempts. Try again later.",
            },
            headers={"Retry-After": str(exc.retry_after)},
        ) from None


def _raise_account_error(exc: AccountError) -> None:
    status, message = _ACCOUNT_ERRORS.get(
        exc.code, (400, "The account request could not be completed")
    )
    raise HTTPException(
        status_code=status,
        detail={"code": exc.code, "message": message},
    ) from None


@router.post("/login", response_model=AuthUser)
def login(
    payload: LoginRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> AuthUser:
    host_key = f"login:ip:{_client_host(request)}"
    user_key = f"login:user:{payload.username}"
    _check_limit(host_key, limit=20, window_seconds=300)
    _check_limit(user_key, limit=8, window_seconds=300)
    try:
        user = authenticate_account(db, payload.username, payload.password)
    except AccountError as exc:
        _raise_account_error(exc)

    auth_limiter.clear(user_key)
    request.session.clear()
    request.session["username"] = user.username
    return AuthUser(username=user.username)


@router.post("/register", response_model=AuthUser, status_code=201)
def register(
    payload: RegisterRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> AuthUser:
    _check_limit(
        f"register:ip:{_client_host(request)}", limit=5, window_seconds=3600
    )
    try:
        user = register_account(db, payload.username, payload.password)
    except AccountError as exc:
        _raise_account_error(exc)

    request.session.clear()
    request.session["username"] = user.username
    return AuthUser(username=user.username)


@router.post("/logout", status_code=204)
def logout(request: Request) -> Response:
    request.session.clear()
    return Response(status_code=204)


@router.get("/session", response_model=AuthUser)
def session(username: str = Depends(get_current_username)) -> AuthUser:
    return AuthUser(username=username)
