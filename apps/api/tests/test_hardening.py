import pytest
import hashlib
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.database import SessionLocal
from app.auth.models import User, UserSession, UserRole, UserStatus
from app.auth.security import get_password_hash, create_refresh_token

client = TestClient(app)

@pytest.fixture(scope="module")
def db_session():
    session = SessionLocal()
    yield session
    session.close()

@pytest.fixture(scope="module")
def setup_test_user(db_session: Session):
    # Setup test user for settings/rotation checks
    username = "test_hardening_user"
    email = "hardening@aniverse.com"
    user = db_session.query(User).filter(User.username == username).first()
    if not user:
        user = User(
            email=email,
            username=username,
            password_hash=get_password_hash("securepass123"),
            role=UserRole.USER,
            status=UserStatus.ACTIVE,
            email_verified=True
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
    return user

def test_security_headers():
    response = client.get("/api/v1/anime")
    # Verify standard security headers
    assert response.headers.get("X-Frame-Options") == "DENY"
    assert response.headers.get("X-Content-Type-Options") == "nosniff"
    assert response.headers.get("X-XSS-Protection") == "1; mode=block"
    assert "Strict-Transport-Security" in response.headers
    assert "Content-Security-Policy" in response.headers
    assert "X-Request-ID" in response.headers

def test_rate_limiter():
    # Trigger multiple requests in rapid succession to test in-memory fallback
    # The limit is 100 per IP, let's verify headers decrement or trigger a small rate check
    # For unit testing the middleware directly under limit test client
    responses = [client.get("/api/v1/anime") for _ in range(5)]
    for r in responses:
        assert r.status_code != 429  # 5 requests should easily pass

def test_refresh_token_rotation(db_session: Session, setup_test_user: User):
    # Create manual mock session & refresh token
    user = setup_test_user
    refresh_token = create_refresh_token(user.id)
    rt_hash = hashlib.sha256(refresh_token.encode()).hexdigest()
    
    session = UserSession(
        user_id=user.id,
        refresh_token_hash=rt_hash,
        expires_at=datetime.utcnow() + timedelta(days=7)
    )
    db_session.add(session)
    db_session.commit()

    # Clear cookies to avoid conflicts
    client.cookies.clear()
    client.cookies.set("refresh_token", refresh_token)
    response = client.post("/api/v1/auth/refresh")
    
    assert response.status_code == 200
    assert "access_token" in response.cookies
    assert "refresh_token" in response.cookies
    
    # Assert new cookies rotate and old cookie hash is no longer in DB
    new_refresh = response.cookies.get("refresh_token")
    assert new_refresh != refresh_token
    
    old_hash_exists = db_session.query(UserSession).filter(
        UserSession.refresh_token_hash == rt_hash
    ).first()
    assert old_hash_exists is None

def test_user_data_export(db_session: Session, setup_test_user: User):
    # Log in user to obtain access token
    response = client.post("/api/v1/auth/login", json={
        "username": setup_test_user.username,
        "password": "securepass123"
    })
    assert response.status_code == 200
    
    # Trigger data export request
    export_response = client.get("/api/v1/auth/me/export")
    assert export_response.status_code == 200
    
    payload = export_response.json()
    assert "user_profile" in payload
    assert "watchlist" in payload
    assert "subscriptions" in payload
    
    assert payload["user_profile"]["username"] == setup_test_user.username
    assert payload["user_profile"]["email"] == setup_test_user.email
