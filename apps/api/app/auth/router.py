import hashlib
import uuid
from typing import Optional
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Response, Request, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from app.database import get_db
from app.auth.models import User, UserPreference, UserSession, UserRole, UserStatus
from app.auth.security import get_password_hash, verify_password, create_access_token, create_refresh_token, verify_token
from app.auth.dependencies import get_current_user
from app.config import settings

router = APIRouter(prefix="/auth", tags=["User Authentication"])


# --- Schemas ---

class UserRegisterSchema(BaseModel):
    email: EmailStr
    username: str
    password: str
    display_name: Optional[str] = None


class UserLoginSchema(BaseModel):
    username: str
    password: str


class UserPreferencesResponseSchema(BaseModel):
    adult_content_enabled: bool
    autoplay_videos: bool
    theme: str
    preferred_title_language: str


class UserResponseSchema(BaseModel):
    id: uuid.UUID
    email: str
    username: str
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    role: str
    status: str
    preferences: Optional[UserPreferencesResponseSchema] = None

    model_config = {
        "from_attributes": True
    }


# Optional import handling for Pydantic schema
from typing import Optional


# --- Endpoints ---

@router.post("/register", response_model=UserResponseSchema, status_code=status.HTTP_201_CREATED)
def register(user_data: UserRegisterSchema, db: Session = Depends(get_db)):
    """
    Register a new user account, creating default profiles and preferences.
    """
    # 1. Check if email/username already exists
    if db.query(User).filter(User.email == user_data.email.lower()).first():
        raise HTTPException(status_code=400, detail="An account with this email is already registered.")
        
    if db.query(User).filter(User.username == user_data.username.lower()).first():
        raise HTTPException(status_code=400, detail="This username is already taken.")

    # 2. Hash password and save user
    password_hash = get_password_hash(user_data.password)
    user = User(
        email=user_data.email.lower(),
        username=user_data.username.lower(),
        display_name=user_data.display_name or user_data.username,
        password_hash=password_hash,
        role=UserRole.USER,
        status=UserStatus.ACTIVE,
        email_verified=True  # Auto-verify email for development simplicity
    )
    db.add(user)
    db.flush()

    # 3. Create default preferences record
    prefs = UserPreference(user_id=user.id)
    db.add(prefs)
    db.commit()
    db.refresh(user)

    # Convert enum response to match schema
    response_data = {
        "id": user.id,
        "email": user.email,
        "username": user.username,
        "display_name": user.display_name,
        "avatar_url": user.avatar_url,
        "role": user.role.value,
        "status": user.status.value,
        "preferences": {
            "adult_content_enabled": prefs.adult_content_enabled,
            "autoplay_videos": prefs.autoplay_videos,
            "theme": prefs.theme,
            "preferred_title_language": prefs.preferred_title_language.value
        }
    }

    return UserResponseSchema(**response_data)


@router.post("/login")
def login(login_data: UserLoginSchema, response: Response, db: Session = Depends(get_db)):
    """
    Authenticate user, generate JWT session tokens, and set secure HttpOnly cookies.
    """
    user = db.query(User).filter(
        (User.username == login_data.username.lower()) | 
        (User.email == login_data.username.lower())
    ).first()
    
    if not user or not verify_password(login_data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect username or password.")
        
    if user.status == UserStatus.SUSPENDED:
        raise HTTPException(status_code=403, detail="Your account has been suspended by a moderator.")

    # Create Access & Refresh Tokens
    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id)
    
    # Store refresh token hash in DB
    rt_hash = hashlib.sha256(refresh_token.encode()).hexdigest()
    expires_at = datetime.utcnow() + timedelta(days=7)
    
    session = UserSession(
        user_id=user.id,
        refresh_token_hash=rt_hash,
        expires_at=expires_at
    )
    db.add(session)
    
    # Update last login time
    user.last_login_at = datetime.utcnow()
    db.commit()

    # Set secure HttpOnly cookies
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        max_age=1800,  # 30 mins
        samesite="lax",
        secure=False   # Set True in production
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        max_age=604800, # 7 days
        samesite="lax",
        secure=False
    )

    return {
        "message": "Login successful",
        "username": user.username,
        "display_name": user.display_name,
        "role": user.role.value
    }


@router.post("/logout")
def logout(response: Response, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Revoke user session and delete cookies.
    """
    # Delete active sessions in DB
    db.query(UserSession).filter(UserSession.user_id == current_user.id).delete()
    db.commit()

    # Clear browser cookies
    response.delete_cookie("access_token")
    response.delete_cookie("refresh_token")
    return {"message": "Logout successful"}


@router.get("/me", response_model=UserResponseSchema)
def get_me(current_user: User = Depends(get_current_user)):
    """
    Get profile information of the currently authenticated user.
    """
    prefs = current_user.preferences
    response_data = {
        "id": current_user.id,
        "email": current_user.email,
        "username": current_user.username,
        "display_name": current_user.display_name,
        "avatar_url": current_user.avatar_url,
        "role": current_user.role.value,
        "status": current_user.status.value,
        "preferences": {
            "adult_content_enabled": prefs.adult_content_enabled,
            "autoplay_videos": prefs.autoplay_videos,
            "theme": prefs.theme,
            "preferred_title_language": prefs.preferred_title_language.value
        } if prefs else None
    }
    return UserResponseSchema(**response_data)


@router.get("/profile/{username}")
def get_public_profile(username: str, db: Session = Depends(get_db)):
    """
    Get public profile information for any user by username.
    Returns safe fields only (no email, no preferences).
    """
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    return {
        "id": str(user.id),
        "username": user.username,
        "display_name": user.display_name,
        "avatar_url": user.avatar_url,
        "bio": user.bio if hasattr(user, "bio") else None,
        "role": user.role.value,
        "created_at": user.created_at,
    }


@router.post("/refresh")
def refresh_token_rotation(request: Request, response: Response, db: Session = Depends(get_db)):
    """
    Validate refresh token cookie, rotate access and refresh tokens, and update session hash.
    """
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        raise HTTPException(status_code=401, detail="Refresh token missing. Please login again.")

    # Decode and verify token signature
    user_id = verify_token(refresh_token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Refresh token expired or invalid.")

    # Verify session hash in database to prevent reuse attacks
    rt_hash = hashlib.sha256(refresh_token.encode()).hexdigest()
    session = db.query(UserSession).filter(
        UserSession.user_id == user_id,
        UserSession.refresh_token_hash == rt_hash
    ).first()

    if not session or session.expires_at < datetime.utcnow():
        if session:
            db.delete(session)
            db.commit()
        raise HTTPException(status_code=401, detail="Session expired or revoked.")

    # Generate new access & refresh tokens
    new_access_token = create_access_token(user_id)
    new_refresh_token = create_refresh_token(user_id)
    
    # Rotate token hash in database session
    new_rt_hash = hashlib.sha256(new_refresh_token.encode()).hexdigest()
    session.refresh_token_hash = new_rt_hash
    session.expires_at = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    
    # Update last login time
    user = db.query(User).filter(User.id == user_id).first()
    if user:
        user.last_login_at = datetime.utcnow()
    db.commit()

    # Set new secure HttpOnly cookies
    response.set_cookie(
        key="access_token",
        value=new_access_token,
        httponly=True,
        max_age=1800,  # 30 mins
        samesite="lax",
        secure=False   # Set True in production
    )
    response.set_cookie(
        key="refresh_token",
        value=new_refresh_token,
        httponly=True,
        max_age=604800, # 7 days
        samesite="lax",
        secure=False
    )

    return {"message": "Session refreshed successfully"}


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(response: Response, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Permanently deletes the currently authenticated user's account and revokes all active cookies.
    """
    # Delete user from DB. Cascading rules clean up list entries, subscriptions, events etc.
    db.delete(current_user)
    db.commit()

    # Delete browser cookies
    response.delete_cookie("access_token")
    response.delete_cookie("refresh_token")
    return None


@router.get("/me/export")
def export_user_data(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Compiles and exports all user-generated records and preferences.
    """
    # Load user's watchlists
    from app.lists.models import AnimeListEntry
    list_entries = db.query(AnimeListEntry).filter(AnimeListEntry.user_id == current_user.id).all()
    serialized_lists = [{
        "anime_id": entry.anime_id,
        "status": entry.status.value if entry.status else None,
        "progress": entry.progress,
        "score": float(entry.score) if entry.score else None,
        "rewatch_count": entry.rewatch_count,
        "updated_at": entry.updated_at.isoformat() if entry.updated_at else None
    } for entry in list_entries]

    # Load notifications preferences
    from app.notifications.models import NotificationPreference
    pref = db.query(NotificationPreference).filter(NotificationPreference.user_id == current_user.id).first()
    serialized_prefs = {
        "episodes_enabled": pref.episodes_enabled,
        "trailers_enabled": pref.trailers_enabled,
        "movies_enabled": pref.movies_enabled,
        "replies_enabled": pref.replies_enabled,
        "followers_enabled": pref.followers_enabled,
        "emails_enabled": pref.emails_enabled,
        "push_enabled": pref.push_enabled
    } if pref else None

    # Load anime subscriptions (following)
    from app.notifications.models import AnimeSubscription
    subs = db.query(AnimeSubscription).filter(AnimeSubscription.user_id == current_user.id).all()
    serialized_subs = [{
        "anime_id": sub.anime_id,
        "trailer_alerts": sub.trailer_alerts,
        "episode_alerts": sub.episode_alerts,
        "news_alerts": sub.news_alerts
    } for sub in subs]

    return {
        "user_profile": {
            "id": str(current_user.id),
            "username": current_user.username,
            "email": current_user.email,
            "display_name": current_user.display_name,
            "role": current_user.role.value,
            "created_at": current_user.created_at.isoformat() if current_user.created_at else None
        },
        "watchlist": serialized_lists,
        "subscriptions": serialized_subs,
        "notification_preferences": serialized_prefs
    }


