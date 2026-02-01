"""Experiment log schemas - Pydantic."""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.experiment import CohortVariant, LearningTheme


# -------------------
# Log Event Schemas
# -------------------


class LogEventCreate(BaseModel):
    """Log event creation schema."""
    
    event_type: str = Field(..., max_length=50, description="이벤트 타입")
    event_data: dict[str, Any] | None = Field(default=None, description="이벤트 데이터")
    learning_theme: LearningTheme | None = Field(default=None, description="학습 테마")
    scenario_id: UUID | None = Field(default=None, description="시나리오 ID")
    experiment_id: UUID | None = Field(default=None, description="실험 ID")


class LogEventResponse(BaseModel):
    """Log event response schema."""
    
    id: UUID
    user_id: UUID
    experiment_id: UUID | None = None
    variant: CohortVariant | None = None
    event_type: str
    event_data: dict[str, Any] | None = None
    learning_theme: LearningTheme | None = None
    scenario_id: UUID | None = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class LogEventBatch(BaseModel):
    """Batch log events request."""
    
    events: list[LogEventCreate] = Field(..., description="이벤트 목록")


class LogEventBatchResponse(BaseModel):
    """Batch log events response."""
    
    created: int = Field(description="생성된 이벤트 수")


# -------------------
# Log Query Schemas
# -------------------


class LogQueryParams(BaseModel):
    """Log query parameters."""
    
    user_id: UUID | None = None
    experiment_id: UUID | None = None
    event_type: str | None = None
    learning_theme: LearningTheme | None = None
    scenario_id: UUID | None = None
    start_date: datetime | None = None
    end_date: datetime | None = None
    limit: int = Field(default=100, ge=1, le=1000)
    offset: int = Field(default=0, ge=0)


class LogListResponse(BaseModel):
    """Log list response schema."""
    
    items: list[LogEventResponse]
    total: int


# -------------------
# Analytics Schemas
# -------------------


class EventCountResponse(BaseModel):
    """Event count by type response."""
    
    event_type: str
    count: int


class AnalyticsSummary(BaseModel):
    """Analytics summary response."""
    
    total_events: int
    unique_users: int
    events_by_type: list[EventCountResponse]
    events_by_theme: dict[str, int]
