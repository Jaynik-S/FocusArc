from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import router
from app.settings import get_settings

settings = get_settings()

app = FastAPI(title="FocusArc API", debug=settings.app_env != "prod",
              docs_url=None if settings.app_env == "prod" else "/docs",
              redoc_url=None if settings.app_env == "prod" else "/redoc",
              openapi_url=None if settings.app_env == "prod" else "/openapi.json")


@app.middleware("http")
async def private_no_store(request, call_next):
    response = await call_next(request)
    if request.url.path.startswith("/api/") and request.url.path != "/api/health":
        response.headers["Cache-Control"] = "no-store"
    return response
origins = [origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()]
if origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Username"],
    )
app.include_router(router, prefix="/api")
