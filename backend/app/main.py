from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.sessions import SessionMiddleware

from app.api.router import router
from app.settings import Settings, get_settings


def create_app(settings: Settings | None = None) -> FastAPI:
    configured = settings or get_settings()
    application = FastAPI(
        title="FocusArc API",
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
        same_site="lax",
        https_only=configured.app_env == "prod",
    )
    application.include_router(router, prefix="/api")
    return application


app = create_app()
