from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.settings import get_settings, normalize_database_url

settings = get_settings()

engine = create_engine(normalize_database_url(settings.database_url), pool_pre_ping=True,
                       pool_size=settings.db_pool_size, max_overflow=settings.db_max_overflow,
                       pool_timeout=settings.db_pool_timeout,
                       connect_args={"connect_timeout": settings.db_connect_timeout,
                                     "prepare_threshold": None})
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
