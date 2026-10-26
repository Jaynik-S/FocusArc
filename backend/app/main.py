import asyncio
import logging
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.sessions import SessionMiddleware

from app.api.router import router
from app.settings import Settings, get_settings
from app.db import SessionLocal
from app.services.study_state import expire_stale_accounts

logger = logging.getLogger(__name__)


def _expire_study_leases() -> None:
    with SessionLocal() as db:
        expire_stale_accounts(db)
        db.commit()


async def _sweep_study_leases() -> None:
    while True:
        await asyncio.sleep(15)
        try:
            await asyncio.to_thread(_expire_study_leases)
        except Exception as exc:
            logger.warning('Study lease sweep failed (%s)', type(exc).__name__)


@asynccontextmanager
async def lifespan(application: FastAPI):
    sweeper = asyncio.create_task(_sweep_study_leases())
    try:
        yield
    finally:
        sweeper.cancel()
        with suppress(asyncio.CancelledError):
            await sweeper


def create_app(settings: Settings | None = None) -> FastAPI:
    configured = settings or get_settings()
    application = FastAPI(
        title="FocusArc API",
        lifespan=lifespan,
        debug=configured.app_env != "prod",
        docs_url=None if configured.app_env == "prod" else "/docs",
        redoc_url=None if configured.app_env == "prod" else "/redoc",
        openapi_url=None if configured.app_env == "prod" else "/openapi.json",
    )
    origins = [
        origin.strip()
        for origin in configured.cors_origins.split(",")
        if origin.strip()
    ]

    @application.middleware("http")
    async def security_headers(request: Request, call_next):
        origin = request.headers.get("origin")
        if (
            request.method not in {"GET", "HEAD", "OPTIONS"}
            and origin is not None
            and origin not in origins
        ):
            return JSONResponse(
                status_code=403,
                content={"detail": "Origin is not allowed"},
            )

        response = await call_next(request)
        if request.url.path.startswith("/api/") and request.url.path != "/api/health":
            response.headers["Cache-Control"] = "no-store"
        return response

    if origins:
        application.add_middleware(
            CORSMiddleware,
            allow_origins=origins,
            allow_credentials=True,
            allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
            allow_headers=["Content-Type"],
        )
    application.add_middleware(
        SessionMiddleware,
        secret_key=configured.session_secret,
        session_cookie="focusarc_session",
        max_age=configured.session_max_age_seconds,
        path="/api",
        same_site="none" if configured.app_env == "prod" else "lax",
        https_only=configured.app_env == "prod",
    )
    application.include_router(router, prefix="/api")
    return application


app = create_app()
