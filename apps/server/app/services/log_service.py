"""Experiment log service - Business logic."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.experiment import CohortVariant, LearningTheme, UserCohort
from app.models.experiment_log import ExperimentLog
from app.schemas.log import (
    AnalyticsSummary,
    EventCountResponse,
    LogEventBatch,
    LogEventBatchResponse,
    LogEventCreate,
    LogEventResponse,
    LogListResponse,
    LogQueryParams,
)


async def create_log_event(
    db: AsyncSession,
    user_id: UUID,
    event_data: LogEventCreate,
) -> LogEventResponse:
    """Create a single log event.
    
    Args:
        db: Database session.
        user_id: User UUID.
        event_data: Event data.
        
    Returns:
        Created log event.
    """
    # Get user's variant if experiment is specified
    variant = None
    if event_data.experiment_id:
        cohort_query = select(UserCohort).where(
            UserCohort.user_id == user_id,
            UserCohort.experiment_id == event_data.experiment_id,
        )
        result = await db.execute(cohort_query)
        cohort = result.scalar_one_or_none()
        if cohort:
            variant = cohort.variant
    
    log = ExperimentLog(
        user_id=user_id,
        experiment_id=event_data.experiment_id,
        variant=variant,
        event_type=event_data.event_type,
        event_data=event_data.event_data,
        learning_theme=event_data.learning_theme,
        scenario_id=event_data.scenario_id,
    )
    db.add(log)
    await db.commit()
    await db.refresh(log)
    
    return LogEventResponse(
        id=log.id,
        user_id=log.user_id,
        experiment_id=log.experiment_id,
        variant=log.variant,
        event_type=log.event_type,
        event_data=log.event_data,
        learning_theme=log.learning_theme,
        scenario_id=log.scenario_id,
        created_at=log.created_at,
    )


async def create_log_events_batch(
    db: AsyncSession,
    user_id: UUID,
    batch: LogEventBatch,
) -> LogEventBatchResponse:
    """Create multiple log events in batch.
    
    Args:
        db: Database session.
        user_id: User UUID.
        batch: Batch of events.
        
    Returns:
        Number of created events.
    """
    # Pre-fetch all relevant cohorts for the user
    experiment_ids = [e.experiment_id for e in batch.events if e.experiment_id]
    cohort_map: dict[UUID, CohortVariant] = {}
    
    if experiment_ids:
        cohort_query = select(UserCohort).where(
            UserCohort.user_id == user_id,
            UserCohort.experiment_id.in_(experiment_ids),
        )
        result = await db.execute(cohort_query)
        cohorts = result.scalars().all()
        cohort_map = {c.experiment_id: c.variant for c in cohorts}
    
    logs = []
    for event_data in batch.events:
        variant = cohort_map.get(event_data.experiment_id) if event_data.experiment_id else None
        log = ExperimentLog(
            user_id=user_id,
            experiment_id=event_data.experiment_id,
            variant=variant,
            event_type=event_data.event_type,
            event_data=event_data.event_data,
            learning_theme=event_data.learning_theme,
            scenario_id=event_data.scenario_id,
        )
        logs.append(log)
    
    db.add_all(logs)
    await db.commit()
    
    return LogEventBatchResponse(created=len(logs))


async def get_logs(
    db: AsyncSession,
    params: LogQueryParams,
) -> LogListResponse:
    """Get logs with filters.
    
    Args:
        db: Database session.
        params: Query parameters.
        
    Returns:
        List of logs.
    """
    query = select(ExperimentLog).order_by(ExperimentLog.created_at.desc())
    count_query = select(func.count(ExperimentLog.id))
    
    # Apply filters
    if params.user_id:
        query = query.where(ExperimentLog.user_id == params.user_id)
        count_query = count_query.where(ExperimentLog.user_id == params.user_id)
    if params.experiment_id:
        query = query.where(ExperimentLog.experiment_id == params.experiment_id)
        count_query = count_query.where(ExperimentLog.experiment_id == params.experiment_id)
    if params.event_type:
        query = query.where(ExperimentLog.event_type == params.event_type)
        count_query = count_query.where(ExperimentLog.event_type == params.event_type)
    if params.learning_theme:
        query = query.where(ExperimentLog.learning_theme == params.learning_theme)
        count_query = count_query.where(ExperimentLog.learning_theme == params.learning_theme)
    if params.scenario_id:
        query = query.where(ExperimentLog.scenario_id == params.scenario_id)
        count_query = count_query.where(ExperimentLog.scenario_id == params.scenario_id)
    if params.start_date:
        query = query.where(ExperimentLog.created_at >= params.start_date)
        count_query = count_query.where(ExperimentLog.created_at >= params.start_date)
    if params.end_date:
        query = query.where(ExperimentLog.created_at <= params.end_date)
        count_query = count_query.where(ExperimentLog.created_at <= params.end_date)
    
    # Get total count
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    
    # Apply pagination
    query = query.offset(params.offset).limit(params.limit)
    
    result = await db.execute(query)
    logs = result.scalars().all()
    
    items = [
        LogEventResponse(
            id=log.id,
            user_id=log.user_id,
            experiment_id=log.experiment_id,
            variant=log.variant,
            event_type=log.event_type,
            event_data=log.event_data,
            learning_theme=log.learning_theme,
            scenario_id=log.scenario_id,
            created_at=log.created_at,
        )
        for log in logs
    ]
    
    return LogListResponse(items=items, total=total)


async def get_analytics_summary(
    db: AsyncSession,
    experiment_id: UUID | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
) -> AnalyticsSummary:
    """Get analytics summary.
    
    Args:
        db: Database session.
        experiment_id: Optional experiment filter.
        start_date: Optional start date filter.
        end_date: Optional end date filter.
        
    Returns:
        Analytics summary.
    """
    base_query = select(ExperimentLog)
    
    if experiment_id:
        base_query = base_query.where(ExperimentLog.experiment_id == experiment_id)
    if start_date:
        base_query = base_query.where(ExperimentLog.created_at >= start_date)
    if end_date:
        base_query = base_query.where(ExperimentLog.created_at <= end_date)
    
    # Total events
    total_query = select(func.count(ExperimentLog.id)).select_from(base_query.subquery())
    total_result = await db.execute(total_query)
    total_events = total_result.scalar() or 0
    
    # Unique users
    unique_query = select(func.count(func.distinct(ExperimentLog.user_id))).select_from(base_query.subquery())
    unique_result = await db.execute(unique_query)
    unique_users = unique_result.scalar() or 0
    
    # Events by type
    type_query = (
        select(ExperimentLog.event_type, func.count(ExperimentLog.id))
        .group_by(ExperimentLog.event_type)
        .order_by(func.count(ExperimentLog.id).desc())
    )
    if experiment_id:
        type_query = type_query.where(ExperimentLog.experiment_id == experiment_id)
    if start_date:
        type_query = type_query.where(ExperimentLog.created_at >= start_date)
    if end_date:
        type_query = type_query.where(ExperimentLog.created_at <= end_date)
    
    type_result = await db.execute(type_query)
    events_by_type = [
        EventCountResponse(event_type=event_type, count=count)
        for event_type, count in type_result.all()
    ]
    
    # Events by theme
    theme_query = (
        select(ExperimentLog.learning_theme, func.count(ExperimentLog.id))
        .where(ExperimentLog.learning_theme.isnot(None))
        .group_by(ExperimentLog.learning_theme)
    )
    if experiment_id:
        theme_query = theme_query.where(ExperimentLog.experiment_id == experiment_id)
    if start_date:
        theme_query = theme_query.where(ExperimentLog.created_at >= start_date)
    if end_date:
        theme_query = theme_query.where(ExperimentLog.created_at <= end_date)
    
    theme_result = await db.execute(theme_query)
    events_by_theme = {
        theme.value if theme else "unknown": count
        for theme, count in theme_result.all()
    }
    
    return AnalyticsSummary(
        total_events=total_events,
        unique_users=unique_users,
        events_by_type=events_by_type,
        events_by_theme=events_by_theme,
    )
