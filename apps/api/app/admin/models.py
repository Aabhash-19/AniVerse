import enum
import uuid
from datetime import datetime
from sqlalchemy import Column, Integer, BigInteger, String, Text, DateTime, Enum, JSON
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class JobType(str, enum.Enum):
    CATALOGUE_SYNC = "CATALOGUE_SYNC"
    AIRING_SCHEDULE = "AIRING_SCHEDULE"
    VIDEO_DISCOVERY = "VIDEO_DISCOVERY"


class JobStatus(str, enum.Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class IngestionJob(Base):
    __tablename__ = "ingestion_jobs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_type = Column(Enum(JobType, name="jobtype"), nullable=False)
    status = Column(Enum(JobStatus, name="jobstatus"), nullable=False, default=JobStatus.PENDING)
    cursor = Column(JSON, nullable=True)
    records_processed = Column(Integer, default=0, nullable=False)
    records_failed = Column(Integer, default=0, nullable=False)
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    error_summary = Column(Text, nullable=True)


class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    actor_id = Column(UUID(as_uuid=True), nullable=True)  # Can be system or user id
    action = Column(String, nullable=False)
    entity_type = Column(String, nullable=True)
    entity_id = Column(String, nullable=True)
    before_data = Column(JSON, nullable=True)
    after_data = Column(JSON, nullable=True)
    ip_hash = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
