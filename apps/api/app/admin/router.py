import threading
import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.admin.models import IngestionJob, JobType, JobStatus
from app.ingestion.anilist import AniListClient
from app.ingestion.service import import_anime_payload, process_relations
from datetime import datetime

logger = logging.getLogger("admin_router")

router = APIRouter(prefix="/admin", tags=["Administration"])


def run_catalogue_sync(job_id: str, limit: int, db_session_factory):
    """
    Background worker running the AniList import pipeline.
    """
    db: Session = db_session_factory()
    job = db.query(IngestionJob).filter(IngestionJob.id == job_id).first()
    if not job:
        logger.error(f"Ingestion job {job_id} not found in database.")
        db.close()
        return

    job.status = JobStatus.RUNNING
    db.commit()

    client = AniListClient()
    processed = 0
    failed = 0
    relations_map = {}
    
    try:
        page = 1
        per_page = 20  # fetch in blocks of 20
        
        while processed < limit:
            fetch_size = min(per_page, limit - processed)
            if fetch_size <= 0:
                break
                
            try:
                response = client.fetch_anime_page(page=page, per_page=fetch_size)
            except Exception as e:
                logger.error(f"Error fetching AniList page {page}: {e}")
                failed += fetch_size
                break
                
            media_list = response.get("data", {}).get("Page", {}).get("media", [])
            if not media_list:
                break
                
            for media in media_list:
                try:
                    # Import core data
                    anime = import_anime_payload(db, media)
                    
                    # Store relations for post-processing pass
                    anilist_id = media["id"]
                    relations = media.get("relations", {}).get("edges") or []
                    relations_map[anilist_id] = relations
                    
                    processed += 1
                    db.commit()
                except Exception as e:
                    logger.error(f"Error mapping anime id {media.get('id')}: {e}")
                    failed += 1
                    db.rollback()
            
            # Check pagination
            has_next = response.get("data", {}).get("Page", {}).get("pageInfo", {}).get("hasNextPage")
            if not has_next:
                break
                
            page += 1

        # Post-process self-referential graph relations
        try:
            process_relations(db, relations_map)
        except Exception as e:
            logger.error(f"Error building relation graph: {e}")

        # Update final job status
        job.status = JobStatus.COMPLETED if failed == 0 else JobStatus.FAILED
        job.records_processed = processed
        job.records_failed = failed
        job.completed_at = datetime.utcnow()
        db.commit()
        logger.info(f"Ingestion job {job_id} completed. Processed: {processed}, Failed: {failed}")

    except Exception as e:
        logger.error(f"Ingestion job {job_id} failed catastrophically: {e}")
        job.status = JobStatus.FAILED
        job.error_summary = str(e)
        job.completed_at = datetime.utcnow()
        db.commit()
    finally:
        client.close()
        db.close()


@router.post("/catalogue/sync")
def trigger_catalogue_sync(
    background_tasks: BackgroundTasks,
    limit: int = Query(default=50, description="Max number of popular anime to import"),
    db: Session = Depends(get_db)
):
    """
    Trigger manual catalogue import from AniList GraphQL API as a background task.
    """
    # Check if there is already a running job of this type
    running_job = db.query(IngestionJob).filter(
        IngestionJob.job_type == JobType.CATALOGUE_SYNC,
        IngestionJob.status == JobStatus.RUNNING
    ).first()
    
    if running_job:
        raise HTTPException(
            status_code=400,
            detail=f"An ingestion job is already running: {running_job.id}"
        )
        
    job = IngestionJob(
        job_type=JobType.CATALOGUE_SYNC,
        status=JobStatus.PENDING,
        cursor={"limit": limit}
    )
    db.add(job)
    db.commit()
    
    # We pass the session maker to the background thread to safely open a new DB connection
    from app.database import SessionLocal
    background_tasks.add_task(
        run_catalogue_sync,
        job_id=str(job.id),
        limit=limit,
        db_session_factory=SessionLocal
    )
    
    return {
        "message": "Ingestion job triggered successfully",
        "job_id": job.id,
        "status": job.status
    }


@router.get("/jobs")
def get_ingestion_jobs(
    limit: int = 10,
    db: Session = Depends(get_db)
):
    """
    List ingestion history status.
    """
    jobs = db.query(IngestionJob).order_index = IngestionJob.started_at.desc()
    return db.query(IngestionJob).order_by(IngestionJob.started_at.desc()).limit(limit).all()


@router.post("/airing/sync")
def trigger_airing_sync(
    background_tasks: BackgroundTasks,
    days_ahead: int = Query(default=30, description="How many days ahead to sync airing schedules"),
    db: Session = Depends(get_db),
):
    """
    Trigger airing schedule sync from AniList.
    Pulls upcoming episode air-times and upserts them into the Episode table
    so the calendar and notifications work with real data.
    Runs as a background task to avoid blocking the request.
    """
    from app.database import SessionLocal
    from app.ingestion.service import sync_airing_schedule

    def _run(days: int, factory):
        _db = factory()
        try:
            count = sync_airing_schedule(_db, days_ahead=days)
            logger.info(f"Airing sync background task finished: {count} episodes")
        except Exception as e:
            logger.error(f"Airing sync background task failed: {e}")
        finally:
            _db.close()

    background_tasks.add_task(_run, days_ahead, SessionLocal)

    return {
        "message": f"Airing schedule sync triggered for next {days_ahead} days",
        "status": "RUNNING",
    }
