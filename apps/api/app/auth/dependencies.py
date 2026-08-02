from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.auth.security import verify_token
from app.auth.models import User


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    """
    Dependency to validate session cookies and retrieve the active User record.
    """
    # 1. Fetch access token from cookies
    token = request.cookies.get("access_token")
    
    # Fallback to Authorization Header if cookies are empty (helps testing)
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session cookies missing or expired. Please login again.",
        )
        
    user_id = verify_token(token)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session signature is invalid or expired.",
        )
        
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Associated user account no longer exists.",
        )
        
    return user
