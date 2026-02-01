"""Logs API router - Event logging endpoints."""

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter

from app.api.deps import DbSession
from app.models.experiment import LearningTheme
from app.schemas.log import (
    LogEventBatch,
    LogEventBatchResponse,
    LogEventCreate,
    LogEventResponse,
    LogListResponse,
    LogQueryParams,
)
from app.services import log_service

router = APIRouter(prefix="/logs", tags=["logs"])


@router.post("", response_model=LogEventResponse)
async def create_log(
    user_id: UUID,
    event_data: LogEventCreate,
    db: DbSession,
) -> LogEventResponse:
    """Create a single log event.
    
    Args:
        user_id: User UUID (query param for now, will be from auth later).
        event_data: Event data.
        
    Returns:
        Created log event.
    """
    return await log_service.create_log_event(db, user_id, event_data)


@router.post("/batch", response_model=LogEventBatchResponse)
async def create_logs_batch(
    user_id: UUID,
    batch: LogEventBatch,
    db: DbSession,
) -> LogEventBatchResponse:
    """Create multiple log events in batch.
    
    Args:
        user_id: User UUID.
        batch: Batch of events.
        
    Returns:
        Number of created events.
    """
    return await log_service.create_log_events_batch(db, user_id, batch)


@router.get("", response_model=LogListResponse)
async def list_logs(
    db: DbSession,
    user_id: UUID | None = None,
    experiment_id: UUID | None = None,
    event_type: str | None = None,
    learning_theme: LearningTheme | None = None,
    scenario_id: UUID | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    limit: int = 100,
    offset: int = 0,
) -> LogListResponse:
    """Get logs with filters.
    
    Returns:
        Filtered list of logs.
    """
    params = LogQueryParams(
        user_id=user_id,
        experiment_id=experiment_id,
        event_type=event_type,
        learning_theme=learning_theme,
        scenario_id=scenario_id,
        start_date=start_date,
        end_date=end_date,
        limit=limit,
        offset=offset,
    )
    return await log_service.get_logs(db, params)
