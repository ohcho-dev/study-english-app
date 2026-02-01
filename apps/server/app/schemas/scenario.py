"""Scenario schemas - Pydantic."""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.experiment import LearningTheme
from app.models.scenario import ScenarioStatus, ScenarioStepType


# -------------------
# Scenario Step Schemas
# -------------------


class ScenarioStepBase(BaseModel):
    """Base scenario step schema."""
    
    step_order: int = Field(..., ge=0, description="스텝 순서 (0부터 시작)")
    type: ScenarioStepType = Field(..., description="스텝 타입")
    content: dict[str, Any] = Field(..., description="스텝 콘텐츠")
    ai_config: dict[str, Any] | None = Field(default=None, description="AI 설정")


class ScenarioStepCreate(ScenarioStepBase):
    """Scenario step creation schema."""
    
    pass


class ScenarioStepUpdate(BaseModel):
    """Scenario step update schema."""
    
    step_order: int | None = None
    type: ScenarioStepType | None = None
    content: dict[str, Any] | None = None
    ai_config: dict[str, Any] | None = None


class ScenarioStepResponse(ScenarioStepBase):
    """Scenario step response schema."""
    
    id: UUID
    scenario_id: UUID
    created_at: datetime
    
    class Config:
        from_attributes = True


# -------------------
# Scenario Schemas
# -------------------


class ScenarioBase(BaseModel):
    """Base scenario schema."""
    
    title: str = Field(..., max_length=200, description="시나리오 제목")
    description: str | None = Field(default=None, description="시나리오 설명")
    category: LearningTheme = Field(..., description="학습 카테고리")
    level_required: int = Field(default=1, ge=1, description="필요 레벨")
    xp_reward: int = Field(default=10, ge=0, description="완료 시 XP")
    order: int = Field(default=0, ge=0, description="정렬 순서")


class ScenarioCreate(ScenarioBase):
    """Scenario creation schema."""
    
    steps: list[ScenarioStepCreate] = Field(default_factory=list, description="시나리오 스텝")


class ScenarioUpdate(BaseModel):
    """Scenario update schema."""
    
    title: str | None = None
    description: str | None = None
    status: ScenarioStatus | None = None
    level_required: int | None = Field(default=None, ge=1)
    xp_reward: int | None = Field(default=None, ge=0)
    order: int | None = Field(default=None, ge=0)


class ScenarioResponse(ScenarioBase):
    """Scenario response schema."""
    
    id: UUID
    status: ScenarioStatus
    created_by: UUID | None = None
    created_at: datetime
    updated_at: datetime
    step_count: int = 0
    
    class Config:
        from_attributes = True


class ScenarioWithSteps(ScenarioResponse):
    """Scenario with steps response."""
    
    steps: list[ScenarioStepResponse] = []


class ScenarioListResponse(BaseModel):
    """Scenario list response schema."""
    
    items: list[ScenarioResponse]
    total: int
