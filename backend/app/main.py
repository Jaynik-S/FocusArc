from fastapi import FastAPI

from app.api.router import router
from app.settings import get_settings

settings = get_settings()

app = FastAPI(title="CourseTimers API", debug=settings.app_env != "prod")
app.include_router(router, prefix="/api")
