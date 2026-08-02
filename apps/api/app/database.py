from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from app.config import settings

# In production, we might want to check for SSL parameters, pool size, etc.
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db() -> Generator:
    """
    Dependency generator for SQLAlchemy database sessions.
    Yields a database session and closes it after the request lifecycle.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
