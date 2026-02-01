"""Analytics API router - Analytics endpoints."""

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter

from app.api.deps import DbSession
from app.schemas.log import AnalyticsSummary
from app.services import log_service

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/summary", response_model=AnalyticsSummary)
async def get_analytics_summary(
    db: DbSession,
    experiment_id: UUID | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
) -> AnalyticsSummary:
    """Get analytics summary.
    
    Args:
        experiment_id: Optional experiment filter.
        start_date: Optional start date filter.
        end_date: Optional end date filter.
        
    Returns:
        Analytics summary with event counts.
    """
    return await log_service.get_analytics_summary(
        db,
        experiment_id=experiment_id,
        start_date=start_date,
        end_date=end_date,
    )
