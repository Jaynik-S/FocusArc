import os
from unittest.mock import patch

import pytest

from app.settings import Settings


def test_legacy_mode_accepts_username_header(client):
    """Legacy mode (no OWNER_USERNAME/ACCESS_KEY) accepts X-Username"""
    headers = {"X-Username": "testuser"}
    response = client.get("/api/me", headers=headers)
    assert response.status_code == 200
    assert response.json()["username"] == "testuser"


def test_legacy_mode_rejects_missing_username(client):
    """Legacy mode requires X-Username header"""
    response = client.get("/api/me")
    assert response.status_code == 400


def test_protected_mode_requires_bearer_token():
    """Protected mode rejects requests without bearer token"""
    from fastapi.testclient import TestClient
    from app.main import app
    
    with patch("app.auth.get_settings") as mock_settings:
        mock_settings.return_value = Settings(
            owner_username="jayy",
            access_key="test-secret-key-12345"
        )
        
        test_client = TestClient(app)
        response = test_client.get("/api/me")
        assert response.status_code == 401
        assert "Authorization required" in response.text


def test_protected_mode_rejects_invalid_bearer_format():
    """Protected mode validates bearer token format"""
    from fastapi.testclient import TestClient
    from app.main import app
    
    with patch("app.auth.get_settings") as mock_settings:
        mock_settings.return_value = Settings(
            owner_username="jayy",
            access_key="test-secret-key-12345"
        )
        
        test_client = TestClient(app)
        response = test_client.get("/api/me", headers={"Authorization": "BadFormat token"})
        assert response.status_code == 401


def test_protected_mode_rejects_wrong_key():
    """Protected mode rejects incorrect access key"""
    from fastapi.testclient import TestClient
    from app.main import app
    
    with patch("app.auth.get_settings") as mock_settings:
        mock_settings.return_value = Settings(
            owner_username="jayy",
            access_key="test-secret-key-12345"
        )
        
        test_client = TestClient(app)
        response = test_client.get(
            "/api/me",
            headers={"Authorization": "Bearer wrong-key"}
        )
        assert response.status_code == 401
        assert "Invalid access key" in response.text


def test_protected_mode_accepts_valid_bearer_token():
    """Protected mode accepts valid bearer token and uses owner username"""
    from fastapi.testclient import TestClient
    from app.main import app
    from app.db import get_db
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from app.models.base import Base
    
    # Setup test database
    url = os.getenv("TEST_DATABASE_URL")
    if not url:
        pytest.skip("TEST_DATABASE_URL not set")
    
    engine = create_engine(url, pool_pre_ping=True)
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    
    def override_get_db():
        db = SessionLocal()
        try:
            yield db
            db.commit()
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()
    
    with patch("app.auth.get_settings") as mock_settings:
        mock_settings.return_value = Settings(
            owner_username="jayy",
            access_key="test-secret-key-12345"
        )
        
        app.dependency_overrides[get_db] = override_get_db
        test_client = TestClient(app)
        
        response = test_client.get(
            "/api/me",
            headers={"Authorization": "Bearer test-secret-key-12345"}
        )
        assert response.status_code == 200
        assert response.json()["username"] == "jayy"
        
        app.dependency_overrides.clear()
        Base.metadata.drop_all(engine)


def test_protected_mode_ignores_username_header():
    """Protected mode uses owner username, not X-Username header"""
    from fastapi.testclient import TestClient
    from app.main import app
    from app.db import get_db
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from app.models.base import Base
    
    url = os.getenv("TEST_DATABASE_URL")
    if not url:
        pytest.skip("TEST_DATABASE_URL not set")
    
    engine = create_engine(url, pool_pre_ping=True)
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    
    def override_get_db():
        db = SessionLocal()
        try:
            yield db
            db.commit()
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()
    
    with patch("app.auth.get_settings") as mock_settings:
        mock_settings.return_value = Settings(
            owner_username="jayy",
            access_key="test-secret-key-12345"
        )
        
        app.dependency_overrides[get_db] = override_get_db
        test_client = TestClient(app)
        
        response = test_client.get(
            "/api/me",
            headers={
                "Authorization": "Bearer test-secret-key-12345",
                "X-Username": "attacker"
            }
        )
        assert response.status_code == 200
        # Should use owner username, not the X-Username header
        assert response.json()["username"] == "jayy"
        
        app.dependency_overrides.clear()
        Base.metadata.drop_all(engine)
